-- Sequence 4B: deterministic ledger replay, atomic finalization, and forfeits.

alter table public.scorekeeping_sessions
  add column finalization_idempotency_key text,
  add column finalization_command_hash text,
  add column finalization_result jsonb,
  add column override_reason text,
  add column validation_warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_warnings) = 'array');

alter table public.games
  add column outcome_type text check (outcome_type in ('played', 'forfeit')),
  add column winner_team_id uuid references public.teams (id) on delete restrict,
  add column loser_team_id uuid references public.teams (id) on delete restrict,
  add column forfeit_reason text,
  add constraint games_outcome_consistency check (
    (outcome_type is null and winner_team_id is null and loser_team_id is null and forfeit_reason is null)
    or
    (outcome_type = 'played' and winner_team_id is not null and loser_team_id is not null
      and winner_team_id <> loser_team_id and forfeit_reason is null)
    or
    (outcome_type = 'forfeit' and winner_team_id is not null and loser_team_id is not null
      and winner_team_id <> loser_team_id and length(trim(forfeit_reason)) > 0
      and home_score is null and away_score is null and periods = '{"home": [], "away": []}'::jsonb)
  );

create index games_winner_team_id_idx on public.games (winner_team_id) where winner_team_id is not null;
create index games_loser_team_id_idx on public.games (loser_team_id) where loser_team_id is not null;

alter table public.game_edit_history
  add column scorekeeping_session_id uuid references public.scorekeeping_sessions (id) on delete restrict,
  add column failure_metadata jsonb check (failure_metadata is null or jsonb_typeof(failure_metadata) = 'object');
create index game_edit_history_scorekeeping_session_id_idx
  on public.game_edit_history (scorekeeping_session_id) where scorekeeping_session_id is not null;

create or replace function public.cvf_build_ledger_projection(p_session_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_session public.scorekeeping_sessions%rowtype;
  v_event record;
  v_attr record;
  v_periods jsonb := '{"home": [], "away": []}'::jsonb;
  v_home jsonb := '[]'::jsonb;
  v_away jsonb := '[]'::jsonb;
  v_home_score int := 0;
  v_away_score int := 0;
  v_index int;
  v_side text;
  v_current int;
  v_stats jsonb := '{}'::jsonb;
  v_profile text;
  v_stat_current int;
  v_warnings jsonb := '[]'::jsonb;
  v_team uuid;
  v_team_stats jsonb;
  v_derived int;
  v_score int;
begin
  select * into v_session from public.scorekeeping_sessions where id = p_session_id;
  if not found then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;

  for v_index in 1..v_session.regulation_period_count loop
    v_home := v_home || '0'::jsonb;
    v_away := v_away || '0'::jsonb;
  end loop;

  for v_event in
    with recursive session_chain as (
      select id, base_session_id from public.scorekeeping_sessions where id = p_session_id
      union all
      select parent.id, parent.base_session_id
        from public.scorekeeping_sessions parent
        join session_chain child on child.base_session_id = parent.id
    )
    select event.*
      from public.scorekeeping_events event
     where event.session_id in (select id from session_chain)
       and event.action in ('record', 'replace')
       and not exists (
         select 1 from public.scorekeeping_events void_event
          where void_event.session_id in (select id from session_chain)
            and void_event.action = 'void' and void_event.voids_event_id = event.id
       )
     order by event.sequence_number
  loop
    v_side := case when v_event.credited_team_id = v_session.home_team_id then 'home' else 'away' end;
    if v_event.period_type = 'regulation' then
      v_index := v_event.period_number - 1;
    else
      v_index := v_session.regulation_period_count + v_event.period_number - 1;
      while jsonb_array_length(v_home) <= v_index loop
        v_home := v_home || '0'::jsonb;
        v_away := v_away || '0'::jsonb;
      end loop;
    end if;
    if v_side = 'home' then
      v_current := (v_home ->> v_index)::int;
      v_home := jsonb_set(v_home, array[v_index::text], to_jsonb(v_current + v_event.points));
      v_home_score := v_home_score + v_event.points;
    else
      v_current := (v_away ->> v_index)::int;
      v_away := jsonb_set(v_away, array[v_index::text], to_jsonb(v_current + v_event.points));
      v_away_score := v_away_score + v_event.points;
    end if;
  end loop;

  for v_attr in
    with recursive session_chain as (
      select id, base_session_id from public.scorekeeping_sessions where id = p_session_id
      union all
      select parent.id, parent.base_session_id
        from public.scorekeeping_sessions parent
        join session_chain child on child.base_session_id = parent.id
    ), effective_events as (
      select event.id
        from public.scorekeeping_events event
       where event.session_id in (select id from session_chain)
         and event.action in ('record', 'replace')
         and not exists (
           select 1 from public.scorekeeping_events void_event
            where void_event.session_id in (select id from session_chain)
              and void_event.action = 'void' and void_event.voids_event_id = event.id
         )
    )
    select participant.profile_id, participant.team_id, attr.stat_key, sum(attr.stat_delta)::int as delta
      from public.scorekeeping_event_attributions attr
      join public.scorekeeping_participants participant on participant.id = attr.participant_id
     where attr.event_id in (select id from effective_events)
     group by participant.profile_id, participant.team_id, attr.stat_key
  loop
    v_profile := v_attr.profile_id::text;
    if not (v_stats ? v_profile) then
      v_stats := jsonb_set(v_stats, array[v_profile], jsonb_build_object('team_id', v_attr.team_id, 'stats', '{}'::jsonb));
    end if;
    v_stat_current := coalesce((v_stats #>> array[v_profile, 'stats', v_attr.stat_key])::int, 0);
    v_stats := jsonb_set(v_stats, array[v_profile, 'stats', v_attr.stat_key], to_jsonb(v_stat_current + v_attr.delta), true);
  end loop;

  foreach v_team in array array[v_session.home_team_id, v_session.away_team_id] loop
    select coalesce(jsonb_object_agg(stat.key, stat.total), '{}'::jsonb) into v_team_stats
      from (
        select entry.key, sum((entry.value #>> '{}')::int)::int total
          from jsonb_each(v_stats) player
          cross join lateral jsonb_each(player.value -> 'stats') entry
         where (player.value ->> 'team_id')::uuid = v_team
         group by entry.key
      ) stat;
    v_score := case when v_team = v_session.home_team_id then v_home_score else v_away_score end;
    if v_session.sport = 'kickball' then
      v_derived := coalesce((v_team_stats ->> 'runs')::int, 0);
    else
      v_derived := coalesce((v_team_stats ->> 'tds')::int, 0) * 6
        + coalesce((v_team_stats ->> 'onePoint')::int, 0)
        + coalesce((v_team_stats ->> 'twoPoint')::int, 0) * 2
        + coalesce((v_team_stats ->> 'threePoint')::int, 0) * 3
        + coalesce((v_team_stats ->> 'safeties')::int, 0) * 2;
    end if;
    if v_derived <> v_score then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'invId', case when v_session.sport = 'kickball' then 'INV-05' else 'INV-06' end,
        'code', 'ledger_stat_score_mismatch',
        'message', format('%s stat-derived points %s do not equal event score %s.', v_session.sport, v_derived, v_score),
        'values', jsonb_build_object('team_id', v_team, 'derived', v_derived, 'score', v_score)
      ));
    end if;
  end loop;

  v_periods := jsonb_build_object('home', v_home, 'away', v_away);
  return jsonb_build_object('home_score', v_home_score, 'away_score', v_away_score,
    'periods', v_periods, 'player_stats', v_stats, 'warnings', v_warnings,
    'winner_team_id', case when v_home_score > v_away_score then v_session.home_team_id else v_session.away_team_id end,
    'loser_team_id', case when v_home_score > v_away_score then v_session.away_team_id else v_session.home_team_id end);
end;
$$;

create or replace function public.finalize_scorekeeping_session(
  p_session_id uuid,
  p_lease_token text,
  p_lease_version int,
  p_idempotency_key text,
  p_override_reason text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_game_id uuid;
  v_session public.scorekeeping_sessions%rowtype;
  v_projection jsonb;
  v_hash text;
  v_stats record;
  v_match_id uuid;
  v_result jsonb;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then raise exception '[INV-15] Finalization idempotency key is required.'; end if;
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  perform 1 from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;

  v_hash := encode(digest(jsonb_build_object('session_id', p_session_id,
    'override_reason', nullif(trim(coalesce(p_override_reason, '')), ''))::text, 'sha256'), 'hex');
  if v_session.status = 'finalized' then
    if v_session.finalization_idempotency_key = trim(p_idempotency_key)
       and v_session.finalization_command_hash = v_hash then return v_session.finalization_result; end if;
    raise exception '[INV-15] Finalized session cannot be replayed with a different command.';
  end if;
  if v_session.session_kind <> 'ordinary' then
    raise exception '[INV-24] Correction sessions use finalize_scorekeeping_correction.';
  end if;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);
  v_projection := public.cvf_build_ledger_projection(p_session_id);
  if (v_projection ->> 'home_score')::int = (v_projection ->> 'away_score')::int and not v_session.allow_ties then
    raise exception '[INV-08] Season 1 ledger final scores cannot be tied.';
  end if;
  if jsonb_array_length(v_projection -> 'warnings') > 0 and coalesce(length(trim(p_override_reason)), 0) = 0 then
    raise exception 'SOFT validation requires an override reason: %', v_projection -> 'warnings' -> 0 ->> 'message';
  end if;

  perform set_config('cvf.ledger_projection', 'on', true);
  perform set_config('cvf.bypass_lock', 'on', true);
  update public.games set status = 'completed', score_status = 'final', locked = true,
    home_score = (v_projection ->> 'home_score')::int, away_score = (v_projection ->> 'away_score')::int,
    periods = v_projection -> 'periods', submitted_by = auth.uid(), approved_by = auth.uid(), outcome_type = 'played',
    winner_team_id = (v_projection ->> 'winner_team_id')::uuid, loser_team_id = (v_projection ->> 'loser_team_id')::uuid,
    forfeit_reason = null where id = v_game_id;
  delete from public.player_stats where game_id = v_game_id;
  for v_stats in select key, value from jsonb_each(v_projection -> 'player_stats') loop
    insert into public.player_stats (game_id, profile_id, team_id, sport, stats)
    values (v_game_id, v_stats.key::uuid, (v_stats.value ->> 'team_id')::uuid, v_session.sport, v_stats.value -> 'stats');
  end loop;

  select id into v_match_id from public.playoff_matches where game_id = v_game_id;
  if v_match_id is not null then perform public.advance_playoff_match(v_match_id); end if;
  v_result := jsonb_build_object('game_id', v_game_id, 'session_id', p_session_id,
    'home_score', v_projection -> 'home_score', 'away_score', v_projection -> 'away_score',
    'warnings', v_projection -> 'warnings', 'overridden', jsonb_array_length(v_projection -> 'warnings') > 0);
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions set status = 'finalized', closed_by = auth.uid(), closed_at = clock_timestamp(),
    lease_version = lease_version + 1, lease_expires_at = clock_timestamp(), finalization_idempotency_key = trim(p_idempotency_key),
    finalization_command_hash = v_hash, finalization_result = v_result,
    override_reason = nullif(trim(coalesce(p_override_reason, '')), ''), validation_warnings = v_projection -> 'warnings'
  where id = p_session_id;
  insert into public.game_edit_history (game_id, action, actor, after_state, override_reason, validation_warnings, scorekeeping_session_id)
  values (v_game_id, 'Ledger result finalized', auth.uid(), v_projection,
    nullif(trim(coalesce(p_override_reason, '')), ''), v_projection -> 'warnings', p_session_id);
  return v_result;
exception when others then
  if v_game_id is null then raise; end if;
  insert into public.game_edit_history (game_id, action, actor, scorekeeping_session_id, failure_metadata)
  values (v_game_id, 'Ledger finalization failed', auth.uid(), p_session_id,
    jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm, 'stage', 'projection'));
  return jsonb_build_object('ok', false, 'code', sqlstate, 'message', sqlerrm, 'session_id', p_session_id);
end;
$$;

create or replace function public.declare_ledger_forfeit(
  p_game_id uuid, p_winner_team_id uuid, p_reason text, p_idempotency_key text
)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  v_league public.leagues%rowtype;
  v_loser uuid;
  v_session public.scorekeeping_sessions%rowtype;
  v_token text := gen_random_uuid()::text;
  v_session_id uuid := gen_random_uuid();
  v_hash text;
  v_match_id uuid;
  v_result jsonb;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_reason)), 0) = 0 or coalesce(length(trim(p_idempotency_key)), 0) = 0 then
    raise exception '[INV-09][INV-15] Forfeit reason and idempotency key are required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || p_game_id::text, 0));
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception '[INV-04] Game % does not exist.', p_game_id; end if;
  v_hash := encode(digest(jsonb_build_object(
    'winner_team_id', p_winner_team_id,
    'reason', trim(p_reason)
  )::text, 'sha256'), 'hex');
  if v_game.outcome_type = 'forfeit' then
    select * into v_session
      from public.scorekeeping_sessions
     where game_id = p_game_id and status = 'finalized'
     order by created_at desc, id desc
     limit 1;
    if v_session.finalization_idempotency_key = trim(p_idempotency_key)
       and v_session.finalization_command_hash = v_hash then
      return coalesce(v_session.finalization_result, '{}'::jsonb) || jsonb_build_object('replayed', true);
    end if;
    raise exception '[INV-15] Forfeit replay differs from the finalized outcome.';
  end if;
  if v_game.status <> 'upcoming' or v_game.score_status <> 'pending' or v_game.locked
     or p_winner_team_id not in (v_game.home_team_id, v_game.away_team_id)
     or exists (select 1 from public.scorekeeping_sessions where game_id = p_game_id) then
    raise exception '[INV-09] Forfeit requires an unscored game and one declared game-team winner.';
  end if;
  v_loser := case when p_winner_team_id = v_game.home_team_id then v_game.away_team_id else v_game.home_team_id end;
  select * into v_league from public.leagues where id = v_game.league_id;
  if v_game.scorekeeping_mode = 'aggregate' then
    perform set_config('cvf.ledger_transition', 'on', true);
    update public.games set scorekeeping_mode = 'ledger' where id = p_game_id returning * into v_game;
  end if;
  v_result := jsonb_build_object('game_id', p_game_id, 'outcome_type', 'forfeit',
    'winner_team_id', p_winner_team_id, 'loser_team_id', v_loser,
    'session_id', v_session_id, 'replayed', false);
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  insert into public.scorekeeping_sessions (id, game_id, session_kind, status, opened_by, closed_by, lease_token_hash, lease_expires_at,
    sport, league_id, season, stage, home_team_id, away_team_id, rule_version, regulation_period_count,
    overtime_start_setting, allow_ties, rules_snapshot, closed_at, finalization_idempotency_key, finalization_command_hash, finalization_result)
  values (v_session_id, p_game_id, 'ordinary', 'finalized', auth.uid(), auth.uid(), public.cvf_ledger_token_hash(v_token), clock_timestamp(),
    v_game.sport, v_game.league_id, v_league.season, v_game.stage, v_game.home_team_id, v_game.away_team_id,
    'forfeit-v1', case when v_game.sport = 'flag_football' then 4 else 1 end, null, false,
    jsonb_build_object('outcome', 'forfeit'), clock_timestamp(), trim(p_idempotency_key),
    v_hash, v_result)
  returning * into v_session;
  perform set_config('cvf.ledger_projection', 'on', true);
  update public.games set status = 'canceled', score_status = 'final', locked = true, home_score = null, away_score = null,
    periods = '{"home": [], "away": []}'::jsonb, outcome_type = 'forfeit', winner_team_id = p_winner_team_id,
    loser_team_id = v_loser, forfeit_reason = trim(p_reason), submitted_by = auth.uid(), approved_by = auth.uid()
  where id = p_game_id;
  select id into v_match_id from public.playoff_matches where game_id = p_game_id;
  if v_match_id is not null then perform public.advance_playoff_match(v_match_id); end if;
  insert into public.game_edit_history (game_id, action, reason, actor, after_state, scorekeeping_session_id)
  values (p_game_id, 'Game forfeited', trim(p_reason), auth.uid(), jsonb_build_object(
    'outcome_type', 'forfeit', 'winner_team_id', p_winner_team_id, 'loser_team_id', v_loser), v_session.id);
  return v_result;
end;
$$;

-- The established bracket advancement authority also accepts an explicit
-- scoreless forfeit result. Played aggregate and ledger games retain the
-- existing score comparison path.
create or replace function public.advance_playoff_match(p_match_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_match public.playoff_matches%rowtype;
  v_game public.games%rowtype;
  v_winner uuid;
  v_loser uuid;
  v_winner_seed int;
  v_loser_seed int;
  v_destination public.playoff_matches%rowtype;
begin
  perform public.assert_admin();
  -- Read identity without a row lock so every result path can honor the ledger
  -- lock order before it takes the match lock: advisory(game) -> game -> match.
  select * into v_match from public.playoff_matches where id = p_match_id;
  if not found then raise exception 'Unknown playoff match %', p_match_id; end if;
  if v_match.status = 'completed' then return; end if;
  if v_match.game_id is null then raise exception 'Schedule and complete the linked game first.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_match.game_id::text, 0));
  select * into v_game from public.games where id = v_match.game_id for update;
  select * into v_match from public.playoff_matches where id = p_match_id for update;
  if v_match.status = 'completed' then return; end if;
  if v_match.game_id is distinct from v_game.id then
    raise exception 'The linked playoff game changed while advancement was waiting; retry the operation.';
  end if;
  if v_game.score_status <> 'final' or not v_game.locked
     or not ((v_game.outcome_type = 'forfeit' and v_game.status = 'canceled')
       or (coalesce(v_game.outcome_type, 'played') = 'played' and v_game.status = 'completed')) then
    raise exception 'The linked game must be completed, marked final, and locked, or carry a final locked forfeit outcome, before advancement.';
  end if;
  if v_game.outcome_type = 'forfeit' then
    v_winner := v_game.winner_team_id;
    v_loser := v_game.loser_team_id;
  else
    if v_game.home_score = v_game.away_score then raise exception 'Single-elimination games cannot advance from a tie.'; end if;
    if v_game.home_score > v_game.away_score then
      v_winner := v_game.home_team_id; v_loser := v_game.away_team_id;
    else
      v_winner := v_game.away_team_id; v_loser := v_game.home_team_id;
    end if;
  end if;
  v_winner_seed := case when v_winner = v_match.home_team_id then v_match.home_seed else v_match.away_seed end;
  v_loser_seed := case when v_loser = v_match.home_team_id then v_match.home_seed else v_match.away_seed end;
  if v_match.winner_to_match_id is not null then
    select * into v_destination from public.playoff_matches where id = v_match.winner_to_match_id for update;
    if v_destination.game_id is not null then raise exception 'The next match is already scheduled.'; end if;
    if v_match.winner_to_slot = 'home' then
      update public.playoff_matches set home_team_id = v_winner, home_seed = v_winner_seed where id = v_destination.id;
    else
      update public.playoff_matches set away_team_id = v_winner, away_seed = v_winner_seed where id = v_destination.id;
    end if;
  end if;
  if v_match.loser_to_match_id is not null then
    select * into v_destination from public.playoff_matches where id = v_match.loser_to_match_id for update;
    if v_destination.game_id is not null then raise exception 'The third-place match is already scheduled.'; end if;
    if v_match.loser_to_slot = 'home' then
      update public.playoff_matches set home_team_id = v_loser, home_seed = v_loser_seed where id = v_destination.id;
    else
      update public.playoff_matches set away_team_id = v_loser, away_seed = v_loser_seed where id = v_destination.id;
    end if;
  end if;
  update public.playoff_matches set status = 'completed', winner_team_id = v_winner, loser_team_id = v_loser
   where id = p_match_id;
  update public.playoff_matches set status = 'ready'
   where bracket_id = v_match.bracket_id and status = 'pending'
     and home_team_id is not null and away_team_id is not null;
  update public.playoff_brackets set status = 'complete'
   where id = v_match.bracket_id
     and not exists (select 1 from public.playoff_matches
       where bracket_id = v_match.bracket_id and status not in ('completed', 'bye'));
end;
$$;

-- Extend the ledger projection guard to the explicit outcome fields.
create or replace function public.enforce_game_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_projection_change boolean;
begin
  v_projection_change := (new.home_score is distinct from old.home_score)
    or (new.away_score is distinct from old.away_score) or (new.periods is distinct from old.periods)
    or (new.score_status is distinct from old.score_status) or (new.status is distinct from old.status)
    or (new.locked is distinct from old.locked) or (new.outcome_type is distinct from old.outcome_type)
    or (new.winner_team_id is distinct from old.winner_team_id) or (new.loser_team_id is distinct from old.loser_team_id)
    or (new.forfeit_reason is distinct from old.forfeit_reason);
  if (old.scorekeeping_mode = 'ledger' or new.scorekeeping_mode = 'ledger') and v_projection_change
     and (current_user <> 'postgres' or coalesce(current_setting('cvf.ledger_projection', true), '') <> 'on') then
    raise exception '[INV-30][INV-39] Ledger projections may change only through ledger finalization.';
  end if;
  if old.locked and coalesce(current_setting('cvf.bypass_lock', true), '') <> 'on'
     and (v_projection_change or new.stage is distinct from old.stage) then
    raise exception 'Game % is final and locked. Use its single controlled correction authority.', old.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.cvf_build_ledger_projection(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.finalize_scorekeeping_session(uuid, text, int, text, text) from public, anon, service_role;
revoke execute on function public.declare_ledger_forfeit(uuid, uuid, text, text) from public, anon, service_role;
grant execute on function public.finalize_scorekeeping_session(uuid, text, int, text, text) to authenticated;
grant execute on function public.declare_ledger_forfeit(uuid, uuid, text, text) to authenticated;
