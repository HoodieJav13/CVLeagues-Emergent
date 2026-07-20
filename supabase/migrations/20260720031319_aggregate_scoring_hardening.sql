-- Sequence 2: harden aggregate score entry without introducing ledger mode.
-- Score/stat projections and audit history become RPC-only. Final corrections
-- replace the bare unlock workflow and preserve the final lock throughout.

alter table public.game_edit_history
  add column before_state jsonb,
  add column after_state jsonb,
  add column override_reason text,
  add column validation_warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_warnings) = 'array');

comment on column public.game_edit_history.before_state is
  'Non-authoritative aggregate audit snapshot; never projection input.';
comment on column public.game_edit_history.after_state is
  'Non-authoritative aggregate audit snapshot; never projection input.';
comment on column public.game_edit_history.override_reason is
  'Required when SOFT score validation warnings are accepted.';

create or replace function public.cvf_aggregate_score_snapshot(p_game_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'home_score', game.home_score,
    'away_score', game.away_score,
    'periods', game.periods,
    'player_stats', coalesce((
      select jsonb_object_agg(
        stat.profile_id::text,
        jsonb_build_object('team_id', stat.team_id, 'stats', stat.stats)
      )
      from public.player_stats stat
      where stat.game_id = game.id
    ), '{}'::jsonb)
  )
  from public.games game
  where game.id = p_game_id;
$$;

revoke execute on function public.cvf_aggregate_score_snapshot(uuid)
  from public, anon, authenticated, service_role;

-- HARD rules raise with the INV-ID and concrete values. SOFT rules return a
-- structured warning array that the caller must pair with an override reason.
create or replace function public.cvf_validate_aggregate_score(
  p_game_id uuid,
  p_home_score int,
  p_away_score int,
  p_periods jsonb,
  p_stats jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_allowed_keys text[];
  v_signed_keys constant text[] := array['passYards', 'rushYards', 'recYards'];
  v_home_count int;
  v_away_count int;
  v_sum bigint;
  v_side text;
  v_values jsonb;
  v_item record;
  v_entry record;
  v_stat record;
  v_profile_id uuid;
  v_team_id uuid;
  v_stat_value bigint;
  v_warnings jsonb := '[]'::jsonb;
  v_team_name text;
  v_score int;
  v_opponent_id uuid;
  v_runs bigint;
  v_rbis bigint;
  v_tds bigint;
  v_one bigint;
  v_two bigint;
  v_three bigint;
  v_safeties bigint;
  v_derived bigint;
  v_completions bigint;
  v_attempts bigint;
  v_catches bigint;
  v_pass_yards bigint;
  v_rec_yards bigint;
  v_pass_tds bigint;
  v_rec_tds bigint;
  v_ints bigint;
  v_def_ints bigint;
  v_rush_first_downs bigint;
  v_carries bigint;
  v_rec_first_downs bigint;
begin
  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception '[INV-04] Controlled score mutation target game % does not exist.', p_game_id;
  end if;

  if p_home_score is null or p_home_score < 0 then
    raise exception '[INV-03] Home score must be a nonnegative integer; received %.', p_home_score;
  end if;
  if p_away_score is null or p_away_score < 0 then
    raise exception '[INV-03] Away score must be a nonnegative integer; received %.', p_away_score;
  end if;
  if p_home_score = p_away_score
     and (v_game.sport in ('kickball', 'flag_football') or v_game.stage = 'playoff') then
    raise exception '[INV-08] Season 1 final scores cannot be tied; received %-%',
      p_home_score, p_away_score;
  end if;

  if p_periods is null or jsonb_typeof(p_periods) is distinct from 'object'
     or jsonb_typeof(p_periods -> 'home') is distinct from 'array'
     or jsonb_typeof(p_periods -> 'away') is distinct from 'array' then
    raise exception '[INV-01] Periods must contain home and away arrays.';
  end if;

  v_home_count := jsonb_array_length(p_periods -> 'home');
  v_away_count := jsonb_array_length(p_periods -> 'away');
  if v_home_count = 0 or v_home_count <> v_away_count then
    raise exception '[INV-01] Home and away must have the same nonzero period count; home=%, away=%.',
      v_home_count, v_away_count;
  end if;
  if v_game.sport = 'flag_football' and v_home_count <> 4 then
    raise exception '[INV-10] Flag football requires four quarters; received %.', v_home_count;
  end if;

  for v_side, v_values in
    select 'home', p_periods -> 'home'
    union all
    select 'away', p_periods -> 'away'
  loop
    v_sum := 0;
    for v_item in
      select value, ordinality from jsonb_array_elements(v_values) with ordinality
    loop
      if jsonb_typeof(v_item.value) <> 'number'
         or (v_item.value #>> '{}') !~ '^-?[0-9]+$' then
        raise exception '[INV-03] % period % must be an integer; received %.',
          v_side, v_item.ordinality, v_item.value;
      end if;
      begin
        v_stat_value := (v_item.value #>> '{}')::bigint;
      exception when numeric_value_out_of_range then
        raise exception '[INV-03] % period % is outside the supported integer range; received %.',
          v_side, v_item.ordinality, v_item.value;
      end;
      if v_stat_value < 0 then
        raise exception '[INV-03] % period % cannot be negative; received %.',
          v_side, v_item.ordinality, v_stat_value;
      end if;
      v_sum := v_sum + v_stat_value;
    end loop;
    if (v_side = 'home' and v_sum <> p_home_score)
       or (v_side = 'away' and v_sum <> p_away_score) then
      raise exception '[INV-01] % period sum % does not equal entered score %.',
        v_side, v_sum, case when v_side = 'home' then p_home_score else p_away_score end;
    end if;
  end loop;

  if p_stats is null or jsonb_typeof(p_stats) is distinct from 'object' then
    raise exception '[INV-03] Player stats must be a JSON object.';
  end if;

  v_allowed_keys := case v_game.sport
    when 'kickball' then array[
      'kicks', 'singles', 'doubles', 'triples', 'homeRuns', 'rbis',
      'runs', 'walks', 'strikeouts', 'outs', 'assists', 'errors'
    ]
    when 'flag_football' then array[
      'completions', 'attempts', 'passYards', 'passTDs', 'ints',
      'carries', 'rushYards', 'rushTDs', 'rushFirstDowns',
      'catches', 'recYards', 'recTDs', 'recFirstDowns',
      'flagPulls', 'sacks', 'defInts', 'safeties', 'tds',
      'onePoint', 'twoPoint', 'threePoint'
    ]
  end;

  for v_entry in select key, value from jsonb_each(p_stats)
  loop
    begin
      v_profile_id := v_entry.key::uuid;
    exception when invalid_text_representation then
      raise exception '[INV-11] Player stat key is not a UUID; received %.', v_entry.key;
    end;
    if jsonb_typeof(v_entry.value) is distinct from 'object' then
      raise exception '[INV-03] Player % stat entry must be an object.', v_profile_id;
    end if;
    begin
      v_team_id := (v_entry.value ->> 'team_id')::uuid;
    exception when invalid_text_representation then
      raise exception '[INV-11] Player % has an invalid team id %.', v_profile_id, v_entry.value ->> 'team_id';
    end;
    if v_team_id is null or v_team_id not in (v_game.home_team_id, v_game.away_team_id) then
      raise exception '[INV-11] Player % team % is not in game %.', v_profile_id, v_team_id, p_game_id;
    end if;
    if not exists (
      select 1 from public.team_players roster
      where roster.profile_id = v_profile_id
        and roster.team_id = v_team_id
        and roster.roster_status not in ('removed', 'inactive')
    ) then
      raise exception '[INV-11] Player % is not on the active roster for team %.', v_profile_id, v_team_id;
    end if;
    if jsonb_typeof(v_entry.value -> 'stats') is distinct from 'object' then
      raise exception '[INV-03] Player % stats must be an object.', v_profile_id;
    end if;

    for v_stat in select key, value from jsonb_each(v_entry.value -> 'stats')
    loop
      if not (v_stat.key = any(v_allowed_keys)) then
        raise exception '[INV-04] Stat key % is not valid for %; player %.',
          v_stat.key, v_game.sport, v_profile_id;
      end if;
      if jsonb_typeof(v_stat.value) <> 'number'
         or (v_stat.value #>> '{}') !~ '^-?[0-9]+$' then
        raise exception '[INV-03] % for player % must be an integer; received %.',
          v_stat.key, v_profile_id, v_stat.value;
      end if;
      begin
        v_stat_value := (v_stat.value #>> '{}')::bigint;
      exception when numeric_value_out_of_range then
        raise exception '[INV-03] % for player % is outside the supported integer range; received %.',
          v_stat.key, v_profile_id, v_stat.value;
      end;
      if not (v_stat.key = any(v_signed_keys)) and v_stat_value < 0 then
        raise exception '[INV-03] % for player % cannot be negative; received %.',
          v_stat.key, v_profile_id, v_stat_value;
      end if;
    end loop;
  end loop;

  for v_team_id, v_team_name, v_score, v_opponent_id in
    select v_game.home_team_id, home.name, p_home_score, v_game.away_team_id
      from public.teams home where home.id = v_game.home_team_id
    union all
    select v_game.away_team_id, away.name, p_away_score, v_game.home_team_id
      from public.teams away where away.id = v_game.away_team_id
  loop
    select
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'runs')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'rbis')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'tds')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'onePoint')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'twoPoint')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'threePoint')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'safeties')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'completions')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'attempts')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'catches')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'passYards')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'recYards')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'passTDs')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'recTDs')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'ints')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'rushFirstDowns')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'carries')::bigint, 0)), 0),
      coalesce(sum(coalesce((entry.value -> 'stats' ->> 'recFirstDowns')::bigint, 0)), 0)
    into v_runs, v_rbis, v_tds, v_one, v_two, v_three, v_safeties,
         v_completions, v_attempts, v_catches, v_pass_yards, v_rec_yards,
         v_pass_tds, v_rec_tds, v_ints, v_rush_first_downs, v_carries,
         v_rec_first_downs
    from jsonb_each(p_stats) entry
    where (entry.value ->> 'team_id')::uuid = v_team_id;

    if v_game.sport = 'kickball' then
      if v_runs <> v_score then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-05', 'code', 'kickball_runs_score',
          'message', format('[INV-05] %s has %s recorded player runs but an entered score of %s.', v_team_name, v_runs, v_score),
          'values', jsonb_build_object('team_id', v_team_id, 'runs', v_runs, 'score', v_score)
        ));
      end if;
      if v_rbis > v_runs then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-05', 'code', 'kickball_rbis_runs',
          'message', format('[INV-05] %s has %s RBIs but only %s recorded runs.', v_team_name, v_rbis, v_runs),
          'values', jsonb_build_object('team_id', v_team_id, 'rbis', v_rbis, 'runs', v_runs)
        ));
      end if;
    else
      v_derived := 6 * v_tds + v_one + 2 * v_two + 3 * v_three + 2 * v_safeties;
      if v_derived <> v_score then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-06', 'code', 'flag_points_score',
          'message', format('[INV-06] %s stat-derived points are %s but the entered score is %s.', v_team_name, v_derived, v_score),
          'values', jsonb_build_object('team_id', v_team_id, 'derived', v_derived, 'score', v_score)
        ));
      end if;
      if v_completions <> v_catches then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-07', 'code', 'flag_completions_catches',
          'message', format('[INV-07] %s completions/catches do not reconcile: completions=%s, catches=%s.', v_team_name, v_completions, v_catches),
          'values', jsonb_build_object('team_id', v_team_id, 'completions', v_completions, 'catches', v_catches)
        ));
      end if;
      if v_pass_yards <> v_rec_yards then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-07', 'code', 'flag_passYards_recYards',
          'message', format('[INV-07] %s passing/receiving yards do not reconcile: passYards=%s, recYards=%s.', v_team_name, v_pass_yards, v_rec_yards),
          'values', jsonb_build_object('team_id', v_team_id, 'passYards', v_pass_yards, 'recYards', v_rec_yards)
        ));
      end if;
      if v_pass_tds <> v_rec_tds then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-07', 'code', 'flag_passTDs_recTDs',
          'message', format('[INV-07] %s passing/receiving touchdowns do not reconcile: passTDs=%s, recTDs=%s.', v_team_name, v_pass_tds, v_rec_tds),
          'values', jsonb_build_object('team_id', v_team_id, 'passTDs', v_pass_tds, 'recTDs', v_rec_tds)
        ));
      end if;
      select coalesce(sum(coalesce((entry.value -> 'stats' ->> 'defInts')::bigint, 0)), 0)
      into v_def_ints
      from jsonb_each(p_stats) entry
      where (entry.value ->> 'team_id')::uuid = v_opponent_id;
      if v_ints <> v_def_ints then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-07', 'code', 'flag_interceptions',
          'message', format('[INV-07] %s interceptions thrown (%s) do not match opponent defensive interceptions (%s).', v_team_name, v_ints, v_def_ints),
          'values', jsonb_build_object('team_id', v_team_id, 'ints', v_ints, 'opponentDefInts', v_def_ints)
        ));
      end if;
      if v_completions > v_attempts then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-07', 'code', 'flag_completions_attempts',
          'message', format('[INV-07] %s completions exceed attempts: completions=%s, attempts=%s.', v_team_name, v_completions, v_attempts),
          'values', jsonb_build_object('team_id', v_team_id, 'completions', v_completions, 'attempts', v_attempts)
        ));
      end if;
      if v_rush_first_downs > v_carries then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-07', 'code', 'flag_rushFirstDowns_carries',
          'message', format('[INV-07] %s rushing first downs exceed carries: firstDowns=%s, carries=%s.', v_team_name, v_rush_first_downs, v_carries),
          'values', jsonb_build_object('team_id', v_team_id, 'rushFirstDowns', v_rush_first_downs, 'carries', v_carries)
        ));
      end if;
      if v_rec_first_downs > v_catches then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'invId', 'INV-07', 'code', 'flag_recFirstDowns_catches',
          'message', format('[INV-07] %s receiving first downs exceed catches: firstDowns=%s, catches=%s.', v_team_name, v_rec_first_downs, v_catches),
          'values', jsonb_build_object('team_id', v_team_id, 'recFirstDowns', v_rec_first_downs, 'catches', v_catches)
        ));
      end if;
    end if;
  end loop;

  return v_warnings;
end;
$$;

revoke execute on function public.cvf_validate_aggregate_score(uuid, int, int, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.submit_score(
  p_game_id uuid,
  p_home_score int,
  p_away_score int,
  p_periods jsonb,
  p_stats jsonb default '{}'::jsonb,
  p_override_reason text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_warnings jsonb;
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  perform public.assert_admin();

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception '[INV-04] Controlled score mutation target game % does not exist.', p_game_id; end if;
  if v_game.locked then
    raise exception '[INV-24] Game % is final and locked; use correct_final_score with a reason.', p_game_id;
  end if;
  if v_game.status = 'canceled' then
    raise exception '[INV-09] Canceled game % cannot receive an aggregate score.', p_game_id;
  end if;

  v_warnings := public.cvf_validate_aggregate_score(
    p_game_id, p_home_score, p_away_score, p_periods, coalesce(p_stats, '{}'::jsonb)
  );
  if jsonb_array_length(v_warnings) > 0
     and coalesce(length(trim(p_override_reason)), 0) = 0 then
    raise exception 'SOFT validation requires an override reason: %', v_warnings -> 0 ->> 'message';
  end if;

  v_before := public.cvf_aggregate_score_snapshot(p_game_id);
  v_action := case when v_game.status = 'completed' then 'Score edited' else 'Score saved' end;

  update public.games
     set status = 'completed',
         score_status = 'submitted',
         home_score = p_home_score,
         away_score = p_away_score,
         periods = p_periods,
         submitted_by = auth.uid()
   where id = p_game_id;

  delete from public.player_stats where game_id = p_game_id;
  insert into public.player_stats (game_id, profile_id, team_id, sport, stats)
  select p_game_id, entry.key::uuid, (entry.value ->> 'team_id')::uuid,
         v_game.sport, entry.value -> 'stats'
  from jsonb_each(coalesce(p_stats, '{}'::jsonb)) entry;

  v_after := public.cvf_aggregate_score_snapshot(p_game_id);
  insert into public.game_edit_history
    (game_id, action, actor, before_state, after_state, override_reason, validation_warnings)
  values
    (p_game_id, v_action, auth.uid(), v_before, v_after,
     nullif(trim(coalesce(p_override_reason, '')), ''), v_warnings);

  return jsonb_build_object('warnings', v_warnings, 'overridden', jsonb_array_length(v_warnings) > 0);
end;
$$;

create or replace function public.correct_final_score(
  p_game_id uuid,
  p_home_score int,
  p_away_score int,
  p_periods jsonb,
  p_stats jsonb default '{}'::jsonb,
  p_reason text default null,
  p_override_reason text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_match public.playoff_matches%rowtype;
  v_destination public.playoff_matches%rowtype;
  v_warnings jsonb;
  v_before jsonb;
  v_after jsonb;
  v_new_winner uuid;
  v_new_loser uuid;
  v_winner_seed int;
  v_loser_seed int;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception '[INV-24] Correcting a final game requires a reason.';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception '[INV-04] Controlled score mutation target game % does not exist.', p_game_id; end if;
  if not v_game.locked or v_game.score_status <> 'final' or v_game.status <> 'completed' then
    raise exception '[INV-24] Game % must be completed, final, and locked before correction.', p_game_id;
  end if;

  v_warnings := public.cvf_validate_aggregate_score(
    p_game_id, p_home_score, p_away_score, p_periods, coalesce(p_stats, '{}'::jsonb)
  );
  if jsonb_array_length(v_warnings) > 0
     and coalesce(length(trim(p_override_reason)), 0) = 0 then
    raise exception 'SOFT validation requires an override reason: %', v_warnings -> 0 ->> 'message';
  end if;

  v_before := public.cvf_aggregate_score_snapshot(p_game_id);
  v_new_winner := case when p_home_score > p_away_score then v_game.home_team_id else v_game.away_team_id end;
  v_new_loser := case when v_new_winner = v_game.home_team_id then v_game.away_team_id else v_game.home_team_id end;

  select * into v_match
  from public.playoff_matches
  where game_id = p_game_id
  for update;

  if found and v_match.status = 'completed' and v_match.winner_team_id is distinct from v_new_winner then
    if v_match.winner_to_match_id is not null then
      select * into v_destination from public.playoff_matches
      where id = v_match.winner_to_match_id for update;
      if v_destination.game_id is not null or v_destination.status = 'completed' then
        raise exception '[INV-32] Winner-changing correction is blocked because the next playoff game is scheduled or completed.';
      end if;
    end if;
    if v_match.loser_to_match_id is not null then
      select * into v_destination from public.playoff_matches
      where id = v_match.loser_to_match_id for update;
      if v_destination.game_id is not null or v_destination.status = 'completed' then
        raise exception '[INV-32] Winner-changing correction is blocked because the third-place game is scheduled or completed.';
      end if;
    end if;

    v_winner_seed := case when v_new_winner = v_match.home_team_id then v_match.home_seed else v_match.away_seed end;
    v_loser_seed := case when v_new_loser = v_match.home_team_id then v_match.home_seed else v_match.away_seed end;

    if v_match.winner_to_match_id is not null then
      if v_match.winner_to_slot = 'home' then
        update public.playoff_matches set home_team_id = v_new_winner, home_seed = v_winner_seed
        where id = v_match.winner_to_match_id;
      else
        update public.playoff_matches set away_team_id = v_new_winner, away_seed = v_winner_seed
        where id = v_match.winner_to_match_id;
      end if;
      update public.playoff_matches
         set status = case when home_team_id is not null and away_team_id is not null then 'ready' else 'pending' end
       where id = v_match.winner_to_match_id;
    end if;
    if v_match.loser_to_match_id is not null then
      if v_match.loser_to_slot = 'home' then
        update public.playoff_matches set home_team_id = v_new_loser, home_seed = v_loser_seed
        where id = v_match.loser_to_match_id;
      else
        update public.playoff_matches set away_team_id = v_new_loser, away_seed = v_loser_seed
        where id = v_match.loser_to_match_id;
      end if;
      update public.playoff_matches
         set status = case when home_team_id is not null and away_team_id is not null then 'ready' else 'pending' end
       where id = v_match.loser_to_match_id;
    end if;

    update public.playoff_matches
       set winner_team_id = v_new_winner,
           loser_team_id = v_new_loser
     where id = v_match.id;
  end if;

  perform set_config('cvf.bypass_lock', 'on', true);
  update public.games
     set home_score = p_home_score,
         away_score = p_away_score,
         periods = p_periods,
         status = 'completed',
         score_status = 'final',
         locked = true,
         submitted_by = auth.uid(),
         approved_by = auth.uid()
   where id = p_game_id;

  delete from public.player_stats where game_id = p_game_id;
  insert into public.player_stats (game_id, profile_id, team_id, sport, stats)
  select p_game_id, entry.key::uuid, (entry.value ->> 'team_id')::uuid,
         v_game.sport, entry.value -> 'stats'
  from jsonb_each(coalesce(p_stats, '{}'::jsonb)) entry;

  v_after := public.cvf_aggregate_score_snapshot(p_game_id);
  insert into public.game_edit_history
    (game_id, action, reason, actor, before_state, after_state, override_reason, validation_warnings)
  values
    (p_game_id, 'Final score corrected', trim(p_reason), auth.uid(), v_before, v_after,
     nullif(trim(coalesce(p_override_reason, '')), ''), v_warnings);

  return jsonb_build_object('warnings', v_warnings, 'overridden', jsonb_array_length(v_warnings) > 0);
end;
$$;

-- Finalization rechecks every HARD rule against the stored aggregate payload.
create or replace function public.lock_game(p_game_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_stats jsonb;
  v_before jsonb;
  v_after jsonb;
begin
  perform public.assert_admin();
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception '[INV-04] Controlled score mutation target game % does not exist.', p_game_id; end if;
  if v_game.locked then return; end if;
  if v_game.status <> 'completed' or v_game.score_status not in ('submitted', 'approved') then
    raise exception '[INV-23] Game % must have a submitted or approved completed score before finalization.', p_game_id;
  end if;

  select coalesce(jsonb_object_agg(
    stat.profile_id::text,
    jsonb_build_object('team_id', stat.team_id, 'stats', stat.stats)
  ), '{}'::jsonb)
  into v_stats
  from public.player_stats stat
  where stat.game_id = p_game_id;

  perform public.cvf_validate_aggregate_score(
    p_game_id, v_game.home_score, v_game.away_score, v_game.periods, v_stats
  );

  v_before := public.cvf_aggregate_score_snapshot(p_game_id);
  update public.games
     set score_status = 'final', locked = true, approved_by = auth.uid()
   where id = p_game_id;
  v_after := public.cvf_aggregate_score_snapshot(p_game_id);
  insert into public.game_edit_history (game_id, action, actor, before_state, after_state)
  values (p_game_id, 'Marked final', auth.uid(), v_before, v_after);
end;
$$;

-- Retire compatibility RPCs that bypass the new contract.
revoke execute on function public.save_score(uuid, int, int, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.unlock_game(uuid, text)
  from public, anon, authenticated, service_role;

revoke execute on function public.submit_score(uuid, int, int, jsonb, jsonb, text)
  from public, anon, service_role;
revoke execute on function public.correct_final_score(uuid, int, int, jsonb, jsonb, text, text)
  from public, anon, service_role;
revoke execute on function public.lock_game(uuid)
  from public, anon, service_role;
grant execute on function public.submit_score(uuid, int, int, jsonb, jsonb, text) to authenticated;
grant execute on function public.correct_final_score(uuid, int, int, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.lock_game(uuid) to authenticated;

-- Data API write grants are independent from RLS. Preserve public reads and
-- non-score schedule editing while removing every direct score/stat/history
-- mutation route (INV-04, INV-38).
revoke insert, update, delete on table public.games from authenticated;
grant insert (id, league_id, sport, home_team_id, away_team_id, date, time, location, temp_admin_id, stage)
  on table public.games to authenticated;
grant update (league_id, sport, home_team_id, away_team_id, date, time, location, temp_admin_id, stage)
  on table public.games to authenticated;

revoke insert, update, delete on table public.player_stats from authenticated;
revoke insert, update, delete on table public.game_edit_history from authenticated;

drop policy if exists player_stats_admin_write on public.player_stats;
drop policy if exists geh_admin_insert on public.game_edit_history;
