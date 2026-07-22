-- Sequence 4A: controlled Event Ledger Lite runtime.
-- Every client entry point is AAL2-admin only, SECURITY DEFINER, and uses the
-- global lock order: advisory(game) -> games row -> scorekeeping session row.

create or replace function public.cvf_ledger_token_hash(p_token text)
returns text
language sql immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.cvf_assert_ledger_lease(
  p_session public.scorekeeping_sessions,
  p_lease_token text,
  p_lease_version int
)
returns void
language plpgsql stable
set search_path = public
as $$
begin
  if p_session.status not in ('open', 'drafting') then
    raise exception '[INV-20] Scorekeeping session % is not active.', p_session.id;
  end if;
  if p_session.lease_expires_at <= clock_timestamp() then
    raise exception '[INV-20] Scorekeeping session % lease has expired.', p_session.id;
  end if;
  if p_session.lease_version <> p_lease_version
     or p_session.lease_token_hash is distinct from public.cvf_ledger_token_hash(p_lease_token) then
    raise exception '[INV-20] Scorekeeping session lease is stale or invalid.';
  end if;
end;
$$;

create or replace function public.cvf_validate_ledger_event(
  p_session public.scorekeeping_sessions,
  p_event_type text,
  p_points int,
  p_attributions jsonb
)
returns void
language plpgsql stable
set search_path = public
as $$
declare
  v_type text := lower(trim(coalesce(p_event_type, '')));
  v_item jsonb;
  v_stat_key text;
  v_delta int;
  v_allowed text[];
  v_signed constant text[] := array['passYards', 'rushYards', 'recYards'];
begin
  if p_session.sport = 'kickball' then
    if v_type not in ('run', 'out', 'kick', 'single', 'double', 'triple', 'home_run', 'walk', 'strikeout', 'assist', 'error') then
      raise exception '[INV-04] Event type % is not valid for kickball.', v_type;
    end if;
    if (v_type = 'run' and p_points <> 1) or (v_type <> 'run' and p_points <> 0) then
      raise exception '[INV-02] Kickball event % requires % points.', v_type, case when v_type = 'run' then 1 else 0 end;
    end if;
    v_allowed := array['kicks','singles','doubles','triples','homeRuns','rbis','runs','walks','strikeouts','outs','assists','errors'];
  else
    if v_type not in ('touchdown', 'one_point', 'two_point', 'three_point', 'safety', 'completion', 'carry', 'reception', 'flag_pull', 'sack', 'interception') then
      raise exception '[INV-04] Event type % is not valid for flag football.', v_type;
    end if;
    if p_points <> (case v_type when 'touchdown' then 6 when 'one_point' then 1 when 'two_point' then 2 when 'three_point' then 3 when 'safety' then 2 else 0 end) then
      raise exception '[INV-02] Flag-football event % has an invalid point value %.', v_type, p_points;
    end if;
    v_allowed := array['completions','attempts','passYards','passTDs','ints','carries','rushYards','rushTDs','rushFirstDowns','catches','recYards','recTDs','recFirstDowns','flagPulls','sacks','defInts','safeties','tds','onePoint','twoPoint','threePoint'];
  end if;

  if jsonb_typeof(coalesce(p_attributions, '[]'::jsonb)) <> 'array' then
    raise exception '[INV-03] Event attributions must be a JSON array.';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb))
  loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'participant_id', '') = ''
       or coalesce(v_item ->> 'role', '') = ''
       or coalesce(v_item ->> 'stat_key', '') = ''
       or coalesce(v_item ->> 'stat_delta', '') !~ '^-?[0-9]+$' then
      raise exception '[INV-03] Each attribution requires participant_id, role, stat_key, and integer stat_delta.';
    end if;
    v_stat_key := v_item ->> 'stat_key';
    v_delta := (v_item ->> 'stat_delta')::int;
    if not (v_stat_key = any(v_allowed)) then
      raise exception '[INV-04] Stat key % is not valid for %.', v_stat_key, p_session.sport;
    end if;
    if v_delta < 0 and not (v_stat_key = any(v_signed)) then
      raise exception '[INV-03] Stat % cannot have a negative delta.', v_stat_key;
    end if;
  end loop;
end;
$$;

create or replace function public.start_scorekeeping_session(
  p_game_id uuid,
  p_rule_version text,
  p_regulation_period_count int,
  p_overtime_start_setting text default null,
  p_allow_ties boolean default false,
  p_rules_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_league public.leagues%rowtype;
  v_session public.scorekeeping_sessions%rowtype;
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || p_game_id::text, 0));
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception '[INV-04] Game % does not exist.', p_game_id; end if;

  select * into v_session from public.scorekeeping_sessions
   where game_id = p_game_id and status in ('open', 'drafting') for update;
  if found then
    raise exception '[INV-20] Game % already has active session %.', p_game_id, v_session.id;
  end if;
  if v_game.status <> 'upcoming' or v_game.score_status <> 'pending' or v_game.locked
     or v_game.home_score is not null or v_game.away_score is not null then
    raise exception '[INV-22] Ordinary scorekeeping requires an unscored upcoming game.';
  end if;
  if coalesce(length(trim(p_rule_version)), 0) = 0
     or p_regulation_period_count is null or p_regulation_period_count <= 0
     or jsonb_typeof(coalesce(p_rules_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception '[INV-10] A valid immutable rule snapshot is required.';
  end if;
  if v_game.sport = 'flag_football' and p_regulation_period_count <> 4 then
    raise exception '[INV-10] Flag football requires exactly four regulation quarters.';
  end if;
  if (v_game.stage = 'playoff' or v_game.sport in ('kickball', 'flag_football')) and p_allow_ties then
    raise exception '[INV-08] Season 1 and playoff ledger games cannot allow final ties.';
  end if;

  select * into v_league from public.leagues where id = v_game.league_id;
  if v_game.scorekeeping_mode = 'aggregate' then
    perform set_config('cvf.ledger_transition', 'on', true);
    update public.games set scorekeeping_mode = 'ledger' where id = p_game_id returning * into v_game;
  end if;

  perform set_config('cvf.ledger_session_mutation', 'on', true);
  insert into public.scorekeeping_sessions (
    game_id, session_kind, status, opened_by, lease_token_hash, lease_expires_at,
    sport, league_id, season, stage, home_team_id, away_team_id, rule_version,
    regulation_period_count, overtime_start_setting, allow_ties, rules_snapshot
  ) values (
    p_game_id, 'ordinary', 'open', auth.uid(), public.cvf_ledger_token_hash(v_token), clock_timestamp() + interval '10 minutes',
    v_game.sport, v_game.league_id, v_league.season, v_game.stage, v_game.home_team_id, v_game.away_team_id,
    trim(p_rule_version), p_regulation_period_count, nullif(trim(coalesce(p_overtime_start_setting, '')), ''),
    p_allow_ties, coalesce(p_rules_snapshot, '{}'::jsonb)
  ) returning * into v_session;

  insert into public.scorekeeping_participants (session_id, game_id, source_team_player_id, profile_id, team_id, season, display_name, position, roster_status)
  select v_session.id, p_game_id, roster.id, roster.profile_id, roster.team_id, roster.season, profile.name, roster.position, roster.roster_status
    from public.team_players roster
    join public.profiles profile on profile.id = roster.profile_id
   where roster.team_id in (v_game.home_team_id, v_game.away_team_id)
     and roster.season = v_league.season and roster.roster_status = 'eligible';

  if not exists (select 1 from public.scorekeeping_participants where session_id = v_session.id and team_id = v_game.home_team_id)
     or not exists (select 1 from public.scorekeeping_participants where session_id = v_session.id and team_id = v_game.away_team_id) then
    raise exception '[INV-11] Both teams require at least one eligible snapshotted participant.';
  end if;

  perform set_config('cvf.ledger_projection', 'on', true);
  update public.games set status = 'live' where id = p_game_id;

  return jsonb_build_object('session_id', v_session.id, 'lease_token', v_token, 'lease_version', v_session.lease_version,
    'lease_expires_at', v_session.lease_expires_at, 'session_kind', v_session.session_kind);
end;
$$;

create or replace function public.renew_scorekeeping_session(
  p_session_id uuid, p_lease_token text, p_lease_version int
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_session public.scorekeeping_sessions%rowtype;
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  perform 1 from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions
     set lease_version = lease_version + 1,
         lease_token_hash = public.cvf_ledger_token_hash(v_token),
         lease_expires_at = clock_timestamp() + interval '10 minutes'
   where id = p_session_id returning * into v_session;
  return jsonb_build_object('session_id', v_session.id, 'lease_token', v_token, 'lease_version', v_session.lease_version,
    'lease_expires_at', v_session.lease_expires_at);
end;
$$;

create or replace function public.resume_scorekeeping_session(p_session_id uuid, p_reason text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_session public.scorekeeping_sessions%rowtype;
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  perform 1 from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;
  if v_session.status not in ('open', 'drafting') then raise exception '[INV-20] Only an active session can resume.'; end if;
  if v_session.opened_by is distinct from auth.uid() and v_session.lease_expires_at > clock_timestamp()
     and coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception '[INV-20] Taking over another active scorekeeper lease requires a reason.';
  end if;
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions set lease_version = lease_version + 1,
    lease_token_hash = public.cvf_ledger_token_hash(v_token), lease_expires_at = clock_timestamp() + interval '10 minutes'
  where id = p_session_id returning * into v_session;
  insert into public.game_edit_history (game_id, action, reason, actor)
  values (v_game_id, 'Ledger session resumed', nullif(trim(coalesce(p_reason, '')), ''), auth.uid());
  return jsonb_build_object('session_id', v_session.id, 'lease_token', v_token, 'lease_version', v_session.lease_version,
    'lease_expires_at', v_session.lease_expires_at, 'session_kind', v_session.session_kind);
end;
$$;

create or replace function public.append_scorekeeping_event(
  p_session_id uuid,
  p_lease_token text,
  p_lease_version int,
  p_idempotency_key text,
  p_action text,
  p_event_type text,
  p_period_type text default null,
  p_period_number int default null,
  p_credited_team_id uuid default null,
  p_points int default 0,
  p_voids_event_id uuid default null,
  p_replaces_event_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_attributions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_game_id uuid;
  v_session public.scorekeeping_sessions%rowtype;
  v_existing public.scorekeeping_events%rowtype;
  v_event public.scorekeeping_events%rowtype;
  v_item jsonb;
  v_hash text;
  v_command jsonb;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then raise exception '[INV-15] Idempotency key is required.'; end if;
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  perform 1 from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);

  v_command := jsonb_build_object('session_id', p_session_id, 'action', lower(trim(p_action)),
    'event_type', lower(trim(p_event_type)), 'period_type', p_period_type, 'period_number', p_period_number,
    'credited_team_id', p_credited_team_id, 'points', p_points, 'voids_event_id', p_voids_event_id,
    'replaces_event_id', p_replaces_event_id, 'payload', coalesce(p_payload, '{}'::jsonb),
    'attributions', coalesce(p_attributions, '[]'::jsonb));
  v_hash := encode(digest(v_command::text, 'sha256'), 'hex');
  select * into v_existing from public.scorekeeping_events
   where game_id = v_game_id and idempotency_key = trim(p_idempotency_key);
  if found then
    if v_existing.command_hash <> v_hash then raise exception '[INV-15] Idempotency key was reused with a different command.'; end if;
    return jsonb_build_object('event_id', v_existing.id, 'sequence_number', v_existing.sequence_number, 'replayed', true);
  end if;

  if lower(trim(p_action)) in ('record', 'replace') then
    perform public.cvf_validate_ledger_event(v_session, p_event_type, p_points, p_attributions);
  elsif lower(trim(p_action)) <> 'void' then
    raise exception '[INV-04] Unknown ledger action %.', p_action;
  end if;

  perform set_config('cvf.ledger_event_write', 'on', true);
  insert into public.scorekeeping_events (
    session_id, game_id, sequence_number, idempotency_key, command_hash, action, event_type,
    period_type, period_number, credited_team_id, points, voids_event_id, replaces_event_id, payload, created_by
  ) values (
    p_session_id, v_game_id, null, trim(p_idempotency_key), v_hash, lower(trim(p_action)), lower(trim(p_event_type)),
    p_period_type, p_period_number, p_credited_team_id, p_points, p_voids_event_id, p_replaces_event_id,
    coalesce(p_payload, '{}'::jsonb), auth.uid()
  ) returning * into v_event;

  for v_item in select value from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb))
  loop
    insert into public.scorekeeping_event_attributions
      (event_id, session_id, game_id, participant_id, role, stat_key, stat_delta, created_by)
    values (v_event.id, p_session_id, v_game_id, (v_item ->> 'participant_id')::uuid,
      trim(v_item ->> 'role'), v_item ->> 'stat_key', (v_item ->> 'stat_delta')::int, auth.uid());
  end loop;
  return jsonb_build_object('event_id', v_event.id, 'sequence_number', v_event.sequence_number, 'replayed', false);
end;
$$;

create or replace function public.cancel_scorekeeping_session(
  p_session_id uuid, p_lease_token text, p_lease_version int, p_reason text
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_session public.scorekeeping_sessions%rowtype;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_reason)), 0) = 0 then raise exception '[INV-25] Canceling a scorekeeping session requires a reason.'; end if;
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  perform 1 from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions set status = 'canceled', closed_by = auth.uid(), closed_at = clock_timestamp(),
    lease_version = lease_version + 1, lease_expires_at = clock_timestamp()
  where id = p_session_id;
  if v_session.session_kind = 'ordinary' then
    perform set_config('cvf.ledger_projection', 'on', true);
    update public.games set status = 'upcoming' where id = v_game_id;
  end if;
  insert into public.game_edit_history (game_id, action, reason, actor)
  values (v_game_id, 'Ledger session canceled', trim(p_reason), auth.uid());
end;
$$;

revoke execute on function public.cvf_ledger_token_hash(text) from public, anon, authenticated, service_role;
revoke execute on function public.cvf_assert_ledger_lease(public.scorekeeping_sessions, text, int) from public, anon, authenticated, service_role;
revoke execute on function public.cvf_validate_ledger_event(public.scorekeeping_sessions, text, int, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.start_scorekeeping_session(uuid, text, int, text, boolean, jsonb) from public, anon, service_role;
revoke execute on function public.renew_scorekeeping_session(uuid, text, int) from public, anon, service_role;
revoke execute on function public.resume_scorekeeping_session(uuid, text) from public, anon, service_role;
revoke execute on function public.append_scorekeeping_event(uuid, text, int, text, text, text, text, int, uuid, int, uuid, uuid, jsonb, jsonb) from public, anon, service_role;
revoke execute on function public.cancel_scorekeeping_session(uuid, text, int, text) from public, anon, service_role;
grant execute on function public.start_scorekeeping_session(uuid, text, int, text, boolean, jsonb) to authenticated;
grant execute on function public.renew_scorekeeping_session(uuid, text, int) to authenticated;
grant execute on function public.resume_scorekeeping_session(uuid, text) to authenticated;
grant execute on function public.append_scorekeeping_event(uuid, text, int, text, text, text, text, int, uuid, int, uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.cancel_scorekeeping_session(uuid, text, int, text) to authenticated;
