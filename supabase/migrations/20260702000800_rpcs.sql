-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 8/8
-- RPCs — every multi-table mutation is a single transaction here, because
-- RLS-wrapped clients cannot compose transactions. These are the ONLY writers
-- of: game_edit_history, the lock bypass, intake linkage columns, and
-- waiver->roster eligibility transitions.
--
-- All are SECURITY DEFINER (they bypass RLS by design) and therefore begin
-- with assert_admin(). EXECUTE is revoked from public/anon.
-- ============================================================================

-- Brand palette for auto-created teams/profiles (mirrors seed.js).
create or replace function public.cvf_palette_color(p_index int)
returns text
language sql immutable
as $$
  select (array[
    '#22d3ee','#f97316','#a855f7','#10b981','#ef4444',
    '#facc15','#3b82f6','#ec4899','#14b8a6','#f59e0b'
  ])[1 + (greatest(p_index, 0) % 10)];
$$;

revoke execute on function public.cvf_palette_color(int) from public;
grant execute on function public.cvf_palette_color(int) to authenticated;

-- ============================================================================
-- save_score — the core loop. Mirrors AppStateContext.submitScore exactly:
-- game -> completed/submitted, periods stored, stat rows replaced wholesale,
-- history appended. p_stats is the frontend's statsByPlayer shape:
--   { "<profile_id>": { "team_id": "<uuid>", "stats": { ... } }, ... }
-- ============================================================================
create or replace function public.save_score(
  p_game_id    uuid,
  p_home_score int,
  p_away_score int,
  p_periods    jsonb,
  p_stats      jsonb default '{}'::jsonb
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
begin
  perform public.assert_admin();

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'Unknown game %', p_game_id;
  end if;
  if v_game.locked then
    raise exception 'Game is final and locked. Unlock it (with a reason) first.';
  end if;

  update public.games
     set status       = 'completed',
         score_status = 'submitted',
         home_score   = p_home_score,
         away_score   = p_away_score,
         periods      = coalesce(p_periods, periods),
         submitted_by = auth.uid()
   where id = p_game_id;

  insert into public.game_edit_history (game_id, action, actor)
  values (
    p_game_id,
    case when v_game.status = 'completed' then 'Score edited' else 'Score saved' end,
    auth.uid()
  );

  -- Replace stat rows wholesale (the mock's drop-and-insert semantics).
  delete from public.player_stats where game_id = p_game_id;

  insert into public.player_stats (game_id, profile_id, team_id, sport, stats)
  select p_game_id,
         (e.key)::uuid,
         (e.value ->> 'team_id')::uuid,
         v_game.sport,
         coalesce(e.value -> 'stats', '{}'::jsonb)
    from jsonb_each(coalesce(p_stats, '{}'::jsonb)) as e(key, value)
   where e.value ? 'team_id';
end;
$$;

-- ============================================================================
-- lock_game — Mark Final: score_status 'final', locked true, history row.
-- ============================================================================
create or replace function public.lock_game(p_game_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  perform public.assert_admin();

  select locked into v_locked from public.games where id = p_game_id for update;
  if not found then
    raise exception 'Unknown game %', p_game_id;
  end if;
  if v_locked then
    return;  -- already final; idempotent
  end if;

  update public.games
     set score_status = 'final',
         locked       = true,
         approved_by  = auth.uid()
   where id = p_game_id;

  insert into public.game_edit_history (game_id, action, actor)
  values (p_game_id, 'Marked final', auth.uid());
end;
$$;

-- ============================================================================
-- unlock_game — the ONLY path through the lock trigger. A non-empty reason is
-- required at the database level; the reason lands in history in the same
-- transaction. score_status returns to 'approved' (mock lifecycle).
-- ============================================================================
create or replace function public.unlock_game(p_game_id uuid, p_reason text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  perform public.assert_admin();

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Unlocking a final game requires a reason.';
  end if;

  select locked into v_locked from public.games where id = p_game_id for update;
  if not found then
    raise exception 'Unknown game %', p_game_id;
  end if;
  if not v_locked then
    raise exception 'Game % is not locked.', p_game_id;
  end if;

  -- Transaction-local bypass consumed by the lock triggers (migration 4).
  perform set_config('cvf.bypass_lock', 'on', true);

  update public.games
     set locked       = false,
         score_status = 'approved'
   where id = p_game_id;

  insert into public.game_edit_history (game_id, action, reason, actor)
  values (p_game_id, 'Unlocked', trim(p_reason), auth.uid());
end;
$$;

-- ============================================================================
-- set_game_status — postpone / cancel / restore to upcoming, with history.
-- 'completed' is deliberately excluded: games complete only via save_score.
-- The lock trigger blocks this on locked games with no bypass here — correct.
-- ============================================================================
create or replace function public.set_game_status(p_game_id uuid, p_status text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  if p_status not in ('upcoming', 'postponed', 'canceled') then
    raise exception 'Invalid status %; use save_score to complete a game.', p_status;
  end if;

  update public.games set status = p_status where id = p_game_id;
  if not found then
    raise exception 'Unknown game %', p_game_id;
  end if;

  insert into public.game_edit_history (game_id, action, actor)
  values (p_game_id, 'Game ' || p_status, auth.uid());
end;
$$;

-- ============================================================================
-- approve_registration — Team Interest -> real team (+ captain profile).
-- The first leg of the intake->roster->waiver chain. Approved design:
-- p_create_captain_profile defaults TRUE; captain_name naive-splits on the
-- last space (admin-editable afterward); no player roster is fabricated.
-- ============================================================================
create or replace function public.approve_registration(
  p_registration_id         uuid,
  p_league_id               uuid,
  p_create_captain_profile  boolean default true
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg        public.team_registrations%rowtype;
  v_league     public.leagues%rowtype;
  v_team_id    uuid;
  v_captain_id uuid;
  v_first      text;
  v_last       text;
  v_color      text;
  v_eligible   boolean := false;
begin
  perform public.assert_admin();

  select * into v_reg from public.team_registrations
   where id = p_registration_id for update;
  if not found then
    raise exception 'Unknown registration %', p_registration_id;
  end if;
  if v_reg.status not in ('new', 'contacted') then
    raise exception 'Registration is already % — only new/contacted submissions can be approved.', v_reg.status;
  end if;

  select * into v_league from public.leagues where id = p_league_id;
  if not found then
    raise exception 'Unknown league %', p_league_id;
  end if;
  if v_league.sport <> v_reg.sport then
    raise exception 'League sport (%) does not match registration sport (%).', v_league.sport, v_reg.sport;
  end if;

  v_color := public.cvf_palette_color((select count(*)::int from public.teams));

  insert into public.teams (league_id, name, sport, logo_color, status)
  values (p_league_id, v_reg.team_name, v_reg.sport, v_color, 'active')
  returning id into v_team_id;

  if p_create_captain_profile then
    -- Naive last-space split; single-token names land wholly in first_name.
    if position(' ' in trim(v_reg.captain_name)) > 0 then
      v_first := trim(regexp_replace(trim(v_reg.captain_name), '\s+\S+$', ''));
      v_last  := regexp_replace(trim(v_reg.captain_name), '^.*\s', '');
    else
      v_first := trim(v_reg.captain_name);
      v_last  := '';
    end if;

    insert into public.profiles
      (first_name, last_name, email, phone, sports, avatar_color)
    values
      (v_first, v_last,
       nullif(trim(coalesce(v_reg.captain_email, '')), ''),
       nullif(trim(coalesce(v_reg.captain_phone, '')), ''),
       array[v_reg.sport],
       public.cvf_palette_color((select count(*)::int from public.profiles)))
    returning id into v_captain_id;

    update public.teams set captain_id = v_captain_id where id = v_team_id;

    -- Late waiver linkage: attach any pre-profile signatures by email
    -- (NULL -> value is the one transition the immutability trigger allows).
    if v_reg.captain_email is not null then
      update public.waivers
         set profile_id = v_captain_id
       where profile_id is null
         and lower(email) = lower(v_reg.captain_email);
    end if;

    v_eligible := exists (
      select 1 from public.waivers w
      where w.profile_id = v_captain_id
        and w.verification_status = 'verified'
        and w.waiver_version = public.current_waiver_version()
    );

    -- Captain joins their own roster; season auto-stamped from the league.
    insert into public.team_players (team_id, profile_id, season, roster_status)
    values (v_team_id, v_captain_id, v_league.season,
            case when v_eligible then 'eligible' else 'pending_waiver' end);
  end if;

  update public.team_registrations
     set status           = 'approved',
         approved_team_id = v_team_id,
         processed_at     = now(),
         processed_by     = auth.uid()
   where id = p_registration_id;

  return jsonb_build_object(
    'team_id', v_team_id,
    'captain_profile_id', v_captain_id
  );
end;
$$;

-- ============================================================================
-- assign_free_agent — Free Agent -> profile -> roster, waiver-aware.
-- The second leg of the chain. Approved design: auto-link to an existing
-- profile on exact unique email match, WITH VISIBILITY — the return value
-- says whether an existing profile was linked so the admin UI can surface it.
-- ============================================================================
create or replace function public.assign_free_agent(
  p_free_agent_id  uuid,
  p_team_id        uuid,
  p_jersey_number  int default null,
  p_position       text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_fa            public.free_agents%rowtype;
  v_league        public.leagues%rowtype;
  v_team          public.teams%rowtype;
  v_profile_id    uuid;
  v_linked        boolean := false;
  v_matches       uuid[];
  v_eligible      boolean;
  v_roster_status text;
  v_tp_id         uuid;
begin
  perform public.assert_admin();

  select * into v_fa from public.free_agents
   where id = p_free_agent_id for update;
  if not found then
    raise exception 'Unknown free agent %', p_free_agent_id;
  end if;
  if v_fa.status in ('assigned', 'archived') then
    raise exception 'Free agent is already %.', v_fa.status;
  end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'Unknown team %', p_team_id;
  end if;
  select * into v_league from public.leagues where id = v_team.league_id;

  -- 1. Resolve the person (Auth User ≠ Player: profile created with no auth).
  v_profile_id := v_fa.profile_id;
  if v_profile_id is null then
    if v_fa.email is not null and trim(v_fa.email) <> '' then
      select array_agg(id) into v_matches
        from public.profiles
       where lower(email) = lower(trim(v_fa.email));
      if coalesce(array_length(v_matches, 1), 0) = 1 then
        v_profile_id := v_matches[1];
        v_linked := true;
      end if;
    end if;

    if v_profile_id is null then
      insert into public.profiles
        (first_name, last_name, display_name, email, phone, sports, experience,
         emergency_contact_name, emergency_contact_phone, avatar_color)
      values
        (v_fa.first_name,
         coalesce(v_fa.last_name, ''),
         nullif(coalesce(v_fa.display_name, ''), ''),
         nullif(trim(coalesce(v_fa.email, '')), ''),
         nullif(trim(coalesce(v_fa.phone, '')), ''),
         coalesce(v_fa.sports, '{}'),
         v_fa.experience,
         v_fa.emergency_contact_name,
         v_fa.emergency_contact_phone,
         public.cvf_palette_color((select count(*)::int from public.profiles)))
      returning id into v_profile_id;
    end if;

    update public.free_agents
       set profile_id = v_profile_id
     where id = p_free_agent_id;
  end if;

  -- 2. Late waiver linkage (NULL -> profile, the one allowed transition).
  if v_fa.email is not null and trim(v_fa.email) <> '' then
    update public.waivers
       set profile_id = v_profile_id
     where profile_id is null
       and lower(email) = lower(trim(v_fa.email));
  end if;

  -- 3. Roster row, waiver-aware but never gating (informational only).
  if exists (select 1 from public.team_players tp
             where tp.team_id = p_team_id
               and tp.profile_id = v_profile_id
               and tp.season = v_league.season) then
    raise exception 'Player is already on this roster for %.', v_league.season;
  end if;

  v_eligible := exists (
    select 1 from public.waivers w
    where w.profile_id = v_profile_id
      and w.verification_status = 'verified'
      and w.waiver_version = public.current_waiver_version()
  );
  v_roster_status := case when v_eligible then 'eligible' else 'pending_waiver' end;

  insert into public.team_players
    (team_id, profile_id, season, jersey_number, "position", roster_status)
  values
    (p_team_id, v_profile_id, v_league.season, p_jersey_number,
     coalesce(p_position, ''), v_roster_status)
  returning id into v_tp_id;

  -- 4. Close the intake row.
  update public.free_agents
     set status = 'assigned',
         assigned_team_id = p_team_id
   where id = p_free_agent_id;

  return jsonb_build_object(
    'profile_id', v_profile_id,
    'team_player_id', v_tp_id,
    'linked_existing_profile', v_linked,   -- surface this in the admin UI
    'roster_status', v_roster_status
  );
end;
$$;

-- ============================================================================
-- verify_waiver — the third leg: admin verification catching rosters up.
-- Sets the verification surface (the only mutable waiver columns) and, on
-- 'verified', flips that profile's pending_waiver roster rows to eligible.
-- ============================================================================
create or replace function public.verify_waiver(p_waiver_id uuid, p_decision text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  perform public.assert_admin();

  if p_decision not in ('pending', 'verified', 'rejected', 'duplicate') then
    raise exception 'Invalid decision %', p_decision;
  end if;

  select profile_id into v_profile_id
    from public.waivers where id = p_waiver_id for update;
  if not found then
    raise exception 'Unknown waiver %', p_waiver_id;
  end if;

  update public.waivers
     set verification_status = p_decision,
         verified_by         = auth.uid(),
         verified_at         = now()
   where id = p_waiver_id;

  if p_decision = 'verified' and v_profile_id is not null then
    update public.team_players
       set roster_status = 'eligible'
     where profile_id = v_profile_id
       and roster_status = 'pending_waiver';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants: admin RPCs are callable by authenticated only (each one
-- still asserts is_admin() internally — belt and suspenders).
-- ---------------------------------------------------------------------------
revoke execute on function public.save_score(uuid, int, int, jsonb, jsonb) from public, anon;
revoke execute on function public.lock_game(uuid) from public, anon;
revoke execute on function public.unlock_game(uuid, text) from public, anon;
revoke execute on function public.set_game_status(uuid, text) from public, anon;
revoke execute on function public.approve_registration(uuid, uuid, boolean) from public, anon;
revoke execute on function public.assign_free_agent(uuid, uuid, int, text) from public, anon;
revoke execute on function public.verify_waiver(uuid, text) from public, anon;

grant execute on function public.save_score(uuid, int, int, jsonb, jsonb) to authenticated;
grant execute on function public.lock_game(uuid) to authenticated;
grant execute on function public.unlock_game(uuid, text) to authenticated;
grant execute on function public.set_game_status(uuid, text) to authenticated;
grant execute on function public.approve_registration(uuid, uuid, boolean) to authenticated;
grant execute on function public.assign_free_agent(uuid, uuid, int, text) to authenticated;
grant execute on function public.verify_waiver(uuid, text) to authenticated;
