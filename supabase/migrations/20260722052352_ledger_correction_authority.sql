-- Sequence 4C: the single ledger correction authority. Draft corrections do
-- not alter public projections; finalization folds the immutable session chain
-- and applies bracket-safe changes atomically.

create or replace function public.cvf_guard_scorekeeping_session()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_league public.leagues%rowtype;
  v_base public.scorekeeping_sessions%rowtype;
  v_actor_null_only boolean;
begin
  if tg_op = 'INSERT' then
    if current_user <> 'postgres' or coalesce(current_setting('cvf.ledger_session_mutation', true), '') <> 'on' then
      raise exception '[INV-04] Scorekeeping sessions may be created only by the controlled server path.';
    end if;
    if new.opened_by is null then raise exception '[INV-19] A scorekeeping session requires an opening actor.'; end if;
    select * into v_game from public.games where id = new.game_id for update;
    if not found or v_game.scorekeeping_mode <> 'ledger' then raise exception '[INV-28] Scorekeeping sessions require a ledger-mode game.'; end if;
    select * into v_league from public.leagues where id = v_game.league_id;
    if new.sport is distinct from v_game.sport or new.league_id is distinct from v_game.league_id
       or new.season is distinct from v_league.season or new.stage is distinct from v_game.stage
       or new.home_team_id is distinct from v_game.home_team_id or new.away_team_id is distinct from v_game.away_team_id then
      raise exception '[INV-10] Session identity snapshot must match the ledger game.';
    end if;
    if new.session_kind = 'ordinary' then
      if v_game.status <> 'upcoming' or v_game.score_status <> 'pending' or v_game.locked then
        raise exception '[INV-22] An ordinary session requires an upcoming, pending, unlocked game.';
      end if;
    else
      if v_game.status <> 'completed' or v_game.score_status <> 'final' or not v_game.locked then
        raise exception '[INV-24] A correction session requires a completed, final, locked game.';
      end if;
      select * into v_base from public.scorekeeping_sessions where id = new.base_session_id and game_id = new.game_id;
      if not found or v_base.status <> 'finalized' then
        raise exception '[INV-24] A correction session requires the latest finalized session for the same game.';
      end if;
      if exists (select 1 from public.scorekeeping_sessions newer where newer.game_id = new.game_id
        and newer.status = 'finalized' and (newer.created_at, newer.id) > (v_base.created_at, v_base.id)) then
        raise exception '[INV-24] A correction must extend the latest finalized session.';
      end if;
      if (new.sport, new.league_id, new.season, new.stage, new.home_team_id, new.away_team_id,
          new.rule_version, new.regulation_period_count, new.overtime_start_setting, new.allow_ties, new.rules_snapshot)
         is distinct from
         (v_base.sport, v_base.league_id, v_base.season, v_base.stage, v_base.home_team_id, v_base.away_team_id,
          v_base.rule_version, v_base.regulation_period_count, v_base.overtime_start_setting, v_base.allow_ties, v_base.rules_snapshot) then
        raise exception '[INV-10] Correction rules must exactly preserve the prior finalized snapshot.';
      end if;
    end if;
    return new;
  end if;
  v_actor_null_only := (to_jsonb(new) - array['opened_by', 'closed_by']) = (to_jsonb(old) - array['opened_by', 'closed_by'])
    and (new.opened_by is not distinct from old.opened_by or (old.opened_by is not null and new.opened_by is null))
    and (new.closed_by is not distinct from old.closed_by or (old.closed_by is not null and new.closed_by is null));
  if v_actor_null_only then return new; end if;
  if current_user <> 'postgres' or coalesce(current_setting('cvf.ledger_session_mutation', true), '') <> 'on' then
    raise exception '[INV-04] Scorekeeping session state may change only through the controlled server path.';
  end if;
  if (new.game_id, new.session_kind, new.base_session_id, new.correction_reason, new.opened_by, new.sport,
      new.league_id, new.season, new.stage, new.home_team_id, new.away_team_id, new.rule_version,
      new.regulation_period_count, new.overtime_start_setting, new.allow_ties, new.rules_snapshot, new.created_at)
     is distinct from
     (old.game_id, old.session_kind, old.base_session_id, old.correction_reason, old.opened_by, old.sport,
      old.league_id, old.season, old.stage, old.home_team_id, old.away_team_id, old.rule_version,
      old.regulation_period_count, old.overtime_start_setting, old.allow_ties, old.rules_snapshot, old.created_at) then
    raise exception '[INV-10] Session identity and rule snapshots are immutable.';
  end if;
  if new.lease_version <= old.lease_version then raise exception '[INV-20] Controlled session updates must advance the lease version.'; end if;
  return new;
end;
$$;

create or replace function public.start_scorekeeping_correction(p_game_id uuid, p_reason text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_base public.scorekeeping_sessions%rowtype;
  v_session public.scorekeeping_sessions%rowtype;
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_reason)), 0) = 0 then raise exception '[INV-24] A correction reason is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || p_game_id::text, 0));
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.scorekeeping_mode <> 'ledger' or v_game.status <> 'completed'
     or v_game.score_status <> 'final' or not v_game.locked or v_game.outcome_type <> 'played' then
    raise exception '[INV-24] Correction requires a played, finalized, locked ledger game.';
  end if;
  if exists (select 1 from public.scorekeeping_sessions where game_id = p_game_id and status in ('open', 'drafting')) then
    raise exception '[INV-20] Game already has an active scorekeeping session.';
  end if;
  select * into v_base from public.scorekeeping_sessions
   where game_id = p_game_id and status = 'finalized' order by created_at desc, id desc limit 1 for update;
  if not found then raise exception '[INV-24] Finalized ledger session evidence is missing.'; end if;
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  insert into public.scorekeeping_sessions (game_id, session_kind, status, base_session_id, correction_reason, opened_by,
    lease_token_hash, lease_expires_at, sport, league_id, season, stage, home_team_id, away_team_id, rule_version,
    regulation_period_count, overtime_start_setting, allow_ties, rules_snapshot)
  values (p_game_id, 'correction', 'drafting', v_base.id, trim(p_reason), auth.uid(), public.cvf_ledger_token_hash(v_token),
    clock_timestamp() + interval '10 minutes', v_base.sport, v_base.league_id, v_base.season, v_base.stage,
    v_base.home_team_id, v_base.away_team_id, v_base.rule_version, v_base.regulation_period_count,
    v_base.overtime_start_setting, v_base.allow_ties, v_base.rules_snapshot)
  returning * into v_session;
  insert into public.scorekeeping_participants (session_id, game_id, source_participant_id, profile_id, team_id, season, display_name, position, roster_status)
  select v_session.id, p_game_id, prior.id, prior.profile_id, prior.team_id, prior.season, prior.display_name, prior.position, prior.roster_status
    from public.scorekeeping_participants prior where prior.session_id = v_base.id;
  return jsonb_build_object('session_id', v_session.id, 'base_session_id', v_base.id, 'lease_token', v_token,
    'lease_version', v_session.lease_version, 'lease_expires_at', v_session.lease_expires_at, 'session_kind', 'correction');
end;
$$;

create or replace function public.cvf_validate_correction_event_target()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_kind text;
begin
  select session_kind into v_kind from public.scorekeeping_sessions where id = new.session_id;
  if v_kind <> 'correction' then return new; end if;
  if new.action = 'record' then
    raise exception '[INV-16][INV-17] Correction sessions may only void or replace existing effective events.';
  end if;
  if new.action = 'void' and not exists (
    with recursive chain as (
      select id, base_session_id from public.scorekeeping_sessions where id = new.session_id
      union all select parent.id, parent.base_session_id from public.scorekeeping_sessions parent join chain child on child.base_session_id = parent.id
    )
    select 1 from public.scorekeeping_events target
     where target.id = new.voids_event_id and target.session_id in (select id from chain)
       and target.action in ('record', 'replace')
       and not exists (select 1 from public.scorekeeping_events prior_void
         where prior_void.id <> new.id and prior_void.session_id in (select id from chain)
           and prior_void.action = 'void' and prior_void.voids_event_id = target.id)
  ) then
    raise exception '[INV-16] A correction can void only an event effective in its base chain.';
  end if;
  return new;
end;
$$;
create trigger scorekeeping_events_correction_target
  after insert on public.scorekeeping_events
  for each row execute procedure public.cvf_validate_correction_event_target();

-- A user-visible "void and replace" is one correction command. Keeping both
-- immutable event inserts in one transaction prevents a transport or validation
-- failure from leaving behind a half-applied void-only draft.
create or replace function public.replace_scorekeeping_event(
  p_session_id uuid,
  p_lease_token text,
  p_lease_version int,
  p_void_idempotency_key text,
  p_replacement_idempotency_key text,
  p_target_event_id uuid,
  p_event_type text,
  p_period_type text,
  p_period_number int,
  p_credited_team_id uuid,
  p_points int,
  p_payload jsonb default '{}'::jsonb,
  p_attributions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_void jsonb;
  v_replacement jsonb;
begin
  perform public.assert_admin();
  v_void := public.append_scorekeeping_event(
    p_session_id, p_lease_token, p_lease_version, p_void_idempotency_key,
    'void', 'void', null, null, null, 0, p_target_event_id, null, '{}'::jsonb, '[]'::jsonb
  );
  v_replacement := public.append_scorekeeping_event(
    p_session_id, p_lease_token, p_lease_version, p_replacement_idempotency_key,
    'replace', p_event_type, p_period_type, p_period_number, p_credited_team_id,
    p_points, null, p_target_event_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_attributions, '[]'::jsonb)
  );
  return jsonb_build_object('void', v_void, 'replacement', v_replacement);
end;
$$;

create or replace function public.finalize_scorekeeping_correction(
  p_session_id uuid, p_lease_token text, p_lease_version int, p_idempotency_key text, p_override_reason text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_game_id uuid;
  v_game public.games%rowtype;
  v_session public.scorekeeping_sessions%rowtype;
  v_projection jsonb;
  v_before jsonb;
  v_after jsonb;
  v_hash text;
  v_result jsonb;
  v_stat record;
  v_match public.playoff_matches%rowtype;
  v_destination public.playoff_matches%rowtype;
  v_new_winner uuid;
  v_new_loser uuid;
  v_winner_seed int;
  v_loser_seed int;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then raise exception '[INV-15] Finalization idempotency key is required.'; end if;
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  select * into v_game from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;
  v_hash := encode(digest(jsonb_build_object('session_id', p_session_id,
    'override_reason', nullif(trim(coalesce(p_override_reason, '')), ''))::text, 'sha256'), 'hex');
  if v_session.status = 'finalized' then
    if v_session.finalization_idempotency_key = trim(p_idempotency_key) and v_session.finalization_command_hash = v_hash then
      return v_session.finalization_result;
    end if;
    raise exception '[INV-15] Finalized correction cannot be replayed with a different command.';
  end if;
  if v_session.session_kind <> 'correction' then raise exception '[INV-24] Ordinary sessions use finalize_scorekeeping_session.'; end if;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);
  v_before := jsonb_build_object('home_score', v_game.home_score, 'away_score', v_game.away_score,
    'periods', v_game.periods, 'winner_team_id', v_game.winner_team_id, 'loser_team_id', v_game.loser_team_id);

  begin
    v_projection := public.cvf_build_ledger_projection(p_session_id);
    if (v_projection ->> 'home_score')::int = (v_projection ->> 'away_score')::int and not v_session.allow_ties then
      raise exception '[INV-08] Season 1 ledger final scores cannot be tied.';
    end if;
    if jsonb_array_length(v_projection -> 'warnings') > 0 and coalesce(length(trim(p_override_reason)), 0) = 0 then
      raise exception 'SOFT validation requires an override reason: %', v_projection -> 'warnings' -> 0 ->> 'message';
    end if;
    v_new_winner := (v_projection ->> 'winner_team_id')::uuid;
    v_new_loser := (v_projection ->> 'loser_team_id')::uuid;
    select * into v_match from public.playoff_matches where game_id = v_game_id for update;
    if found and v_match.status = 'completed' and v_match.winner_team_id is distinct from v_new_winner then
      if v_match.winner_to_match_id is not null then
        select * into v_destination from public.playoff_matches where id = v_match.winner_to_match_id for update;
        if v_destination.game_id is not null or v_destination.status = 'completed' then
          raise exception '[INV-32] Winner-changing correction is blocked because the next playoff game is scheduled or completed.';
        end if;
      end if;
      if v_match.loser_to_match_id is not null then
        select * into v_destination from public.playoff_matches where id = v_match.loser_to_match_id for update;
        if v_destination.game_id is not null or v_destination.status = 'completed' then
          raise exception '[INV-32] Winner-changing correction is blocked because the third-place game is scheduled or completed.';
        end if;
      end if;
      v_winner_seed := case when v_new_winner = v_match.home_team_id then v_match.home_seed else v_match.away_seed end;
      v_loser_seed := case when v_new_loser = v_match.home_team_id then v_match.home_seed else v_match.away_seed end;
      if v_match.winner_to_match_id is not null then
        if v_match.winner_to_slot = 'home' then
          update public.playoff_matches set home_team_id = v_new_winner, home_seed = v_winner_seed where id = v_match.winner_to_match_id;
        else update public.playoff_matches set away_team_id = v_new_winner, away_seed = v_winner_seed where id = v_match.winner_to_match_id; end if;
      end if;
      if v_match.loser_to_match_id is not null then
        if v_match.loser_to_slot = 'home' then
          update public.playoff_matches set home_team_id = v_new_loser, home_seed = v_loser_seed where id = v_match.loser_to_match_id;
        else update public.playoff_matches set away_team_id = v_new_loser, away_seed = v_loser_seed where id = v_match.loser_to_match_id; end if;
      end if;
      update public.playoff_matches set winner_team_id = v_new_winner, loser_team_id = v_new_loser where id = v_match.id;
      update public.playoff_matches set status = case when home_team_id is not null and away_team_id is not null then 'ready' else 'pending' end
       where id in (v_match.winner_to_match_id, v_match.loser_to_match_id);
    end if;

    perform set_config('cvf.ledger_projection', 'on', true);
    perform set_config('cvf.bypass_lock', 'on', true);
    update public.games set home_score = (v_projection ->> 'home_score')::int, away_score = (v_projection ->> 'away_score')::int,
      periods = v_projection -> 'periods', winner_team_id = v_new_winner, loser_team_id = v_new_loser,
      status = 'completed', score_status = 'final', locked = true, submitted_by = auth.uid(), approved_by = auth.uid()
    where id = v_game_id;
    delete from public.player_stats where game_id = v_game_id;
    for v_stat in select key, value from jsonb_each(v_projection -> 'player_stats') loop
      insert into public.player_stats (game_id, profile_id, team_id, sport, stats)
      values (v_game_id, v_stat.key::uuid, (v_stat.value ->> 'team_id')::uuid, v_session.sport, v_stat.value -> 'stats');
    end loop;
  exception when others then
    insert into public.game_edit_history (game_id, action, reason, actor, scorekeeping_session_id, failure_metadata)
    values (v_game_id, 'Ledger correction finalization failed', v_session.correction_reason, auth.uid(), p_session_id,
      jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm, 'stage', 'projection'));
    return jsonb_build_object('ok', false, 'code', sqlstate, 'message', sqlerrm, 'session_id', p_session_id);
  end;

  v_after := v_projection;
  v_result := jsonb_build_object('ok', true, 'game_id', v_game_id, 'session_id', p_session_id,
    'home_score', v_projection -> 'home_score', 'away_score', v_projection -> 'away_score',
    'warnings', v_projection -> 'warnings', 'overridden', jsonb_array_length(v_projection -> 'warnings') > 0);
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions set status = 'finalized', closed_by = auth.uid(), closed_at = clock_timestamp(),
    lease_version = lease_version + 1, lease_expires_at = clock_timestamp(), finalization_idempotency_key = trim(p_idempotency_key),
    finalization_command_hash = v_hash, finalization_result = v_result,
    override_reason = nullif(trim(coalesce(p_override_reason, '')), ''), validation_warnings = v_projection -> 'warnings'
  where id = p_session_id;
  insert into public.game_edit_history (game_id, action, reason, actor, before_state, after_state,
    override_reason, validation_warnings, scorekeeping_session_id)
  values (v_game_id, 'Ledger final result corrected', v_session.correction_reason, auth.uid(), v_before, v_after,
    nullif(trim(coalesce(p_override_reason, '')), ''), v_projection -> 'warnings', p_session_id);
  return v_result;
end;
$$;

revoke execute on function public.start_scorekeeping_correction(uuid, text) from public, anon, service_role;
revoke execute on function public.replace_scorekeeping_event(uuid, text, int, text, text, uuid, text, text, int, uuid, int, jsonb, jsonb) from public, anon, service_role;
revoke execute on function public.finalize_scorekeeping_correction(uuid, text, int, text, text) from public, anon, service_role;
revoke execute on function public.cvf_validate_correction_event_target() from public, anon, authenticated, service_role;
grant execute on function public.start_scorekeeping_correction(uuid, text) to authenticated;
grant execute on function public.replace_scorekeeping_event(uuid, text, int, text, text, uuid, text, text, int, uuid, int, jsonb, jsonb) to authenticated;
grant execute on function public.finalize_scorekeeping_correction(uuid, text, int, text, text) to authenticated;
