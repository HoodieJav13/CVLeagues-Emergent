-- Sequence 5A: Season 1 overtime completion and reasoned INV-07 pairing.
--
-- Overtime remains part of the existing ledger. A teamless, zero-point
-- period_close event is the only completion signal; projection never infers a
-- completed inning/round from sport counters. Flag-football paired statistics
-- are exact within an event unless that event carries its own immutable reason.

alter table public.scorekeeping_events
  add column pairing_override_reason text
    check (
      pairing_override_reason is null
      or length(trim(pairing_override_reason)) > 0
    );

-- The lease validator reads clock_timestamp(). Marking that behavior VOLATILE
-- prevents the planner from treating time-sensitive lease checks as stable
-- within a statement.
create or replace function public.cvf_assert_ledger_lease(
  p_session public.scorekeeping_sessions,
  p_lease_token text,
  p_lease_version int
)
returns void
language plpgsql volatile
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

-- The original shape required a credited team for every record/replacement.
-- Period-close evidence is deliberately teamless while retaining every other
-- record/void/replacement invariant.
alter table public.scorekeeping_events
  drop constraint scorekeeping_events_check,
  add constraint scorekeeping_events_shape_check check (
    (
      action in ('record', 'replace')
      and event_type = 'period_close'
      and period_type = 'overtime'
      and period_number is not null
      and credited_team_id is null
      and points = 0
      and (
        (action = 'record' and voids_event_id is null and replaces_event_id is null)
        or
        (action = 'replace' and voids_event_id is null and replaces_event_id is not null)
      )
    )
    or
    (
      action = 'record'
      and voids_event_id is null
      and replaces_event_id is null
      and event_type not in ('void', 'period_close')
      and period_type is not null
      and period_number is not null
      and credited_team_id is not null
    )
    or
    (
      action = 'void'
      and voids_event_id is not null
      and replaces_event_id is null
      and event_type = 'void'
      and period_type is null
      and period_number is null
      and credited_team_id is null
      and points = 0
      and pairing_override_reason is null
    )
    or
    (
      action = 'replace'
      and voids_event_id is null
      and replaces_event_id is not null
      and event_type not in ('void', 'period_close')
      and period_type is not null
      and period_number is not null
      and credited_team_id is not null
    )
  );

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
  if jsonb_typeof(coalesce(p_attributions, '[]'::jsonb)) <> 'array' then
    raise exception '[INV-03] Event attributions must be a JSON array.';
  end if;

  if v_type = 'period_close' then
    if p_points <> 0 or jsonb_array_length(coalesce(p_attributions, '[]'::jsonb)) <> 0 then
      raise exception '[INV-02][INV-08] A period_close event is zero-point and has no player attribution.';
    end if;
    return;
  end if;

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

create or replace function public.cvf_flag_pairing_mismatches(
  p_session public.scorekeeping_sessions,
  p_credited_team_id uuid,
  p_attributions jsonb
)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_totals jsonb := '{}'::jsonb;
  v_mismatches jsonb := '[]'::jsonb;
  v_offense_team_id uuid;
  v_left int;
  v_right int;
  v_left_present boolean;
  v_right_present boolean;
  v_wrong_team boolean;
  v_pair record;
begin
  if p_session.sport <> 'flag_football' then
    return v_mismatches;
  end if;

  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb)) item
      left join public.scorekeeping_participants participant
        on participant.id = (item ->> 'participant_id')::uuid
       and participant.session_id = p_session.id
     where item ->> 'stat_key' in (
       'completions', 'catches', 'passYards', 'recYards',
       'passTDs', 'recTDs', 'ints', 'defInts'
     )
       and participant.id is null
  ) then
    raise exception '[INV-07][INV-11] Paired-stat participants must belong to the active session snapshot.';
  end if;

  select coalesce(jsonb_object_agg(total_key, total_value), '{}'::jsonb)
    into v_totals
    from (
      select participant.team_id::text || ':' || (item ->> 'stat_key') as total_key,
             sum((item ->> 'stat_delta')::int)::int as total_value
        from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb)) item
        join public.scorekeeping_participants participant
          on participant.id = (item ->> 'participant_id')::uuid
         and participant.session_id = p_session.id
       where item ->> 'stat_key' in (
         'completions', 'catches', 'passYards', 'recYards',
         'passTDs', 'recTDs', 'ints', 'defInts'
       )
       group by participant.team_id, item ->> 'stat_key'
    ) totals;

  for v_pair in
    select *
      from (values
        ('completions', 'catches'),
        ('passYards', 'recYards'),
        ('passTDs', 'recTDs')
      ) pairs(left_key, right_key)
  loop
    v_left := coalesce((v_totals ->> (p_credited_team_id::text || ':' || v_pair.left_key))::int, 0);
    v_right := coalesce((v_totals ->> (p_credited_team_id::text || ':' || v_pair.right_key))::int, 0);
    select
      coalesce(bool_or(
        item ->> 'stat_key' = v_pair.left_key
        and participant.team_id = p_credited_team_id
      ), false),
      coalesce(bool_or(
        item ->> 'stat_key' = v_pair.right_key
        and participant.team_id = p_credited_team_id
      ), false)
      into v_left_present, v_right_present
      from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb)) item
      join public.scorekeeping_participants participant
        on participant.id = (item ->> 'participant_id')::uuid
       and participant.session_id = p_session.id
     where item ->> 'stat_key' in (v_pair.left_key, v_pair.right_key);
    select exists (
      select 1
        from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb)) item
        join public.scorekeeping_participants participant
          on participant.id = (item ->> 'participant_id')::uuid
         and participant.session_id = p_session.id
       where item ->> 'stat_key' in (v_pair.left_key, v_pair.right_key)
         and participant.team_id is distinct from p_credited_team_id
    ) into v_wrong_team;
    if v_left_present is distinct from v_right_present
       or v_left <> v_right
       or v_wrong_team then
      v_mismatches := v_mismatches || jsonb_build_array(jsonb_build_object(
        'left_key', v_pair.left_key,
        'right_key', v_pair.right_key,
        'left_present', v_left_present,
        'right_present', v_right_present,
        'left_total', v_left,
        'right_total', v_right,
        'expected_team_id', p_credited_team_id,
        'wrong_team', v_wrong_team
      ));
    end if;
  end loop;

  v_offense_team_id := case
    when p_credited_team_id = p_session.home_team_id then p_session.away_team_id
    else p_session.home_team_id
  end;
  v_left := coalesce((v_totals ->> (v_offense_team_id::text || ':ints'))::int, 0);
  v_right := coalesce((v_totals ->> (p_credited_team_id::text || ':defInts'))::int, 0);
  select
    coalesce(bool_or(
      item ->> 'stat_key' = 'ints'
      and participant.team_id = v_offense_team_id
    ), false),
    coalesce(bool_or(
      item ->> 'stat_key' = 'defInts'
      and participant.team_id = p_credited_team_id
    ), false)
    into v_left_present, v_right_present
    from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb)) item
    join public.scorekeeping_participants participant
      on participant.id = (item ->> 'participant_id')::uuid
     and participant.session_id = p_session.id
   where item ->> 'stat_key' in ('ints', 'defInts');
  select exists (
    select 1
      from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb)) item
      join public.scorekeeping_participants participant
        on participant.id = (item ->> 'participant_id')::uuid
       and participant.session_id = p_session.id
     where (
       item ->> 'stat_key' = 'ints'
       and participant.team_id is distinct from v_offense_team_id
     ) or (
       item ->> 'stat_key' = 'defInts'
       and participant.team_id is distinct from p_credited_team_id
     )
  ) into v_wrong_team;
  if v_left_present is distinct from v_right_present
     or v_left <> v_right
     or v_wrong_team then
    v_mismatches := v_mismatches || jsonb_build_array(jsonb_build_object(
      'left_key', 'ints',
      'right_key', 'opponent defInts',
      'left_present', v_left_present,
      'right_present', v_right_present,
      'left_total', v_left,
      'right_total', v_right,
      'offense_team_id', v_offense_team_id,
      'defense_team_id', p_credited_team_id,
      'wrong_team', v_wrong_team
    ));
  end if;

  return v_mismatches;
end;
$$;

create or replace function public.cvf_prepare_scorekeeping_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_game_id uuid;
  v_game public.games%rowtype;
  v_session public.scorekeeping_sessions%rowtype;
  v_original public.scorekeeping_events%rowtype;
  v_latest_closed_ot int;
  v_projection jsonb;
begin
  if current_user <> 'postgres'
     or coalesce(current_setting('cvf.ledger_event_write', true), '') <> 'on' then
    raise exception '[INV-04] Ledger events may be created only by the controlled server path.';
  end if;
  if new.sequence_number is not null then
    raise exception '[INV-14] Event sequence numbers are assigned by the server.';
  end if;
  if new.created_by is null then
    raise exception '[INV-19] A ledger event requires an actor.';
  end if;

  select game_id into v_game_id
    from public.scorekeeping_sessions where id = new.session_id;
  if v_game_id is null then
    raise exception '[INV-20] Unknown scorekeeping session %.', new.session_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  select * into v_game from public.games where id = v_game_id for update;
  select * into v_session
    from public.scorekeeping_sessions where id = new.session_id for update;

  if v_game.scorekeeping_mode <> 'ledger'
     or v_session.status not in ('open', 'drafting') then
    raise exception '[INV-20][INV-28] Events require an active ledger session.';
  end if;
  if not exists (
       select 1 from public.scorekeeping_participants
       where session_id = v_session.id and team_id = v_session.home_team_id
     ) or not exists (
       select 1 from public.scorekeeping_participants
       where session_id = v_session.id and team_id = v_session.away_team_id
     ) then
    raise exception '[INV-11] Both game teams require participant snapshots before the first event.';
  end if;

  new.game_id := v_game_id;
  new.sequence_number := coalesce((
    select max(event.sequence_number)
      from public.scorekeeping_events event
     where event.game_id = v_game_id
  ), 0) + 1;

  if new.action in ('record', 'replace') and new.event_type = 'period_close' then
    if new.period_type <> 'overtime' or new.credited_team_id is not null
       or new.points <> 0 or new.pairing_override_reason is not null then
      raise exception '[INV-08] period_close must be a teamless, zero-point overtime event without a pairing override.';
    end if;
  elsif new.action in ('record', 'replace')
     and new.credited_team_id not in (v_session.home_team_id, v_session.away_team_id) then
    raise exception '[INV-02] Credited team must be a snapshotted game team.';
  end if;

  if new.period_type = 'regulation'
     and new.period_number > v_session.regulation_period_count then
    raise exception '[INV-02][INV-10] Regulation period % exceeds the snapshotted count %.',
      new.period_number, v_session.regulation_period_count;
  end if;

  if v_session.session_kind = 'ordinary' and new.action = 'record' then
    select max(event.period_number) filter (where event.event_type = 'period_close')
      into v_latest_closed_ot
      from public.scorekeeping_events event
     where event.session_id = v_session.id
       and event.action = 'record'
       and event.period_type = 'overtime';

    if new.period_type = 'regulation'
       and exists (
         select 1 from public.scorekeeping_events event
          where event.session_id = v_session.id and event.period_type = 'overtime'
       ) then
      raise exception '[INV-08] Regulation events cannot be appended after overtime begins.';
    end if;

    if new.period_type = 'overtime'
       and not exists (
         select 1 from public.scorekeeping_events event
          where event.session_id = v_session.id
            and event.period_type = 'overtime'
       ) then
      v_projection := public.cvf_build_ledger_projection(v_session.id);
      if (v_projection ->> 'regulation_home_score')::int
         <> (v_projection ->> 'regulation_away_score')::int then
        raise exception '[INV-08] Overtime may begin only after tied regulation.';
      end if;
    end if;

    if new.period_type = 'overtime'
       and new.period_number <> coalesce(v_latest_closed_ot, 0) + 1 then
      raise exception '[INV-08] Overtime period % is not the current open period %.',
        new.period_number, coalesce(v_latest_closed_ot, 0) + 1;
    end if;
    if new.event_type = 'period_close'
       and exists (
         select 1 from public.scorekeeping_events event
          where event.session_id = v_session.id
            and event.action = 'record'
            and event.event_type = 'period_close'
            and event.period_type = 'overtime'
            and event.period_number = new.period_number
       ) then
      raise exception '[INV-08] Overtime period % is already closed.', new.period_number;
    end if;
  end if;

  if new.action = 'void' then
    if v_session.session_kind <> 'correction' then
      raise exception '[INV-16] Void events require a correction session.';
    end if;
    select * into v_original
      from public.scorekeeping_events
     where id = new.voids_event_id and game_id = v_game_id;
    if not found or v_original.action = 'void' then
      raise exception '[INV-16] A void must reference a non-void event in the same game.';
    end if;
  elsif new.action = 'replace' then
    if v_session.session_kind <> 'correction' then
      raise exception '[INV-17] Replacement events require a correction session.';
    end if;
    select * into v_original
      from public.scorekeeping_events
     where id = new.replaces_event_id and game_id = v_game_id;
    if not found or v_original.action = 'void'
       or not exists (
         select 1 from public.scorekeeping_events void_event
          where void_event.session_id = v_session.id
            and void_event.game_id = v_game_id
            and void_event.action = 'void'
            and void_event.voids_event_id = v_original.id
       ) then
      raise exception '[INV-17] A replacement must follow this correction session''s void of the same original.';
    end if;
  end if;
  return new;
end;
$$;

drop function public.append_scorekeeping_event(
  uuid, text, int, text, text, text, text, int, uuid, int, uuid, uuid, jsonb, jsonb
);

create function public.append_scorekeeping_event(
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
  p_attributions jsonb default '[]'::jsonb,
  p_pairing_override_reason text default null
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
  v_pairing_mismatches jsonb := '[]'::jsonb;
  v_pairing_reason text := nullif(trim(coalesce(p_pairing_override_reason, '')), '');
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then
    raise exception '[INV-15] Idempotency key is required.';
  end if;
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then
    raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  perform 1 from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);

  v_command := jsonb_build_object(
    'session_id', p_session_id,
    'action', lower(trim(p_action)),
    'event_type', lower(trim(p_event_type)),
    'period_type', p_period_type,
    'period_number', p_period_number,
    'credited_team_id', p_credited_team_id,
    'points', p_points,
    'voids_event_id', p_voids_event_id,
    'replaces_event_id', p_replaces_event_id,
    'payload', coalesce(p_payload, '{}'::jsonb),
    'attributions', coalesce(p_attributions, '[]'::jsonb),
    'pairing_override_reason', v_pairing_reason
  );
  v_hash := encode(digest(v_command::text, 'sha256'), 'hex');
  select * into v_existing from public.scorekeeping_events
   where game_id = v_game_id and idempotency_key = trim(p_idempotency_key);
  if found then
    if v_existing.command_hash <> v_hash then
      raise exception '[INV-15] Idempotency key was reused with a different command.';
    end if;
    return jsonb_build_object(
      'event_id', v_existing.id,
      'sequence_number', v_existing.sequence_number,
      'replayed', true,
      'pairing_overridden', v_existing.pairing_override_reason is not null
    );
  end if;

  if lower(trim(p_action)) in ('record', 'replace') then
    perform public.cvf_validate_ledger_event(v_session, p_event_type, p_points, p_attributions);
    if lower(trim(p_event_type)) = 'period_close' then
      if p_period_type <> 'overtime' or p_credited_team_id is not null then
        raise exception '[INV-08] period_close requires a teamless overtime period.';
      end if;
    else
      v_pairing_mismatches := public.cvf_flag_pairing_mismatches(
        v_session,
        p_credited_team_id,
        p_attributions
      );
    end if;
    if jsonb_array_length(v_pairing_mismatches) > 0 and v_pairing_reason is null then
      raise exception '[INV-07] Paired flag-football statistics must reconcile within the same event.';
    end if;
    if jsonb_array_length(v_pairing_mismatches) = 0 and v_pairing_reason is not null then
      raise exception '[INV-07] A pairing override reason is valid only for an unpaired flag-football event.';
    end if;
  elsif lower(trim(p_action)) <> 'void' then
    raise exception '[INV-04] Unknown ledger action %.', p_action;
  end if;

  perform set_config('cvf.ledger_event_write', 'on', true);
  insert into public.scorekeeping_events (
    session_id, game_id, sequence_number, idempotency_key, command_hash, action,
    event_type, period_type, period_number, credited_team_id, points,
    voids_event_id, replaces_event_id, payload, pairing_override_reason,
    created_by
  ) values (
    p_session_id, v_game_id, null, trim(p_idempotency_key), v_hash,
    lower(trim(p_action)), lower(trim(p_event_type)), p_period_type,
    p_period_number, p_credited_team_id, p_points, p_voids_event_id,
    p_replaces_event_id, coalesce(p_payload, '{}'::jsonb), v_pairing_reason,
    auth.uid()
  ) returning * into v_event;

  for v_item in select value from jsonb_array_elements(coalesce(p_attributions, '[]'::jsonb))
  loop
    insert into public.scorekeeping_event_attributions (
      event_id, session_id, game_id, participant_id, role, stat_key,
      stat_delta, created_by
    ) values (
      v_event.id, p_session_id, v_game_id,
      (v_item ->> 'participant_id')::uuid, trim(v_item ->> 'role'),
      v_item ->> 'stat_key', (v_item ->> 'stat_delta')::int, auth.uid()
    );
  end loop;

  return jsonb_build_object(
    'event_id', v_event.id,
    'sequence_number', v_event.sequence_number,
    'replayed', false,
    'pairing_overridden', v_pairing_reason is not null
  );
end;
$$;

drop function public.replace_scorekeeping_event(
  uuid, text, int, text, text, uuid, text, text, int, uuid, int, jsonb, jsonb
);

create function public.replace_scorekeeping_event(
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
  p_attributions jsonb default '[]'::jsonb,
  p_pairing_override_reason text default null
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
    'void', 'void', null, null, null, 0, p_target_event_id, null,
    '{}'::jsonb, '[]'::jsonb, null
  );
  v_replacement := public.append_scorekeeping_event(
    p_session_id, p_lease_token, p_lease_version,
    p_replacement_idempotency_key, 'replace', p_event_type, p_period_type,
    p_period_number, p_credited_team_id, p_points, null, p_target_event_id,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_attributions, '[]'::jsonb),
    p_pairing_override_reason
  );
  return jsonb_build_object('void', v_void, 'replacement', v_replacement);
end;
$$;

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
  v_regulation_home_score int := 0;
  v_regulation_away_score int := 0;
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
  v_latest_overtime_period int;
  v_latest_closed_overtime_period int;
  v_finalizable boolean;
begin
  select * into v_session from public.scorekeeping_sessions where id = p_session_id;
  if not found then
    raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id;
  end if;

  for v_period in 1..v_session.regulation_period_count loop
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
            and void_event.action = 'void'
            and void_event.voids_event_id = event.id
       )
     order by event.sequence_number
  loop
    if v_event.period_type = 'regulation' then
      v_index := v_event.period_number - 1;
    else
      v_latest_overtime_period := greatest(
        coalesce(v_latest_overtime_period, 0),
        v_event.period_number
      );
      v_index := v_session.regulation_period_count + v_event.period_number - 1;
      while jsonb_array_length(v_home) <= v_index loop
        v_home := v_home || '0'::jsonb;
        v_away := v_away || '0'::jsonb;
      end loop;
    end if;

    if v_event.event_type = 'period_close' then
      v_latest_closed_overtime_period := greatest(
        coalesce(v_latest_closed_overtime_period, 0),
        v_event.period_number
      );
      continue;
    end if;

    v_side := case
      when v_event.credited_team_id = v_session.home_team_id then 'home'
      else 'away'
    end;
    if v_side = 'home' then
      v_current := (v_home ->> v_index)::int;
      v_home := jsonb_set(v_home, array[v_index::text], to_jsonb(v_current + v_event.points));
      v_home_score := v_home_score + v_event.points;
      if v_event.period_type = 'regulation' then
        v_regulation_home_score := v_regulation_home_score + v_event.points;
      end if;
    else
      v_current := (v_away ->> v_index)::int;
      v_away := jsonb_set(v_away, array[v_index::text], to_jsonb(v_current + v_event.points));
      v_away_score := v_away_score + v_event.points;
      if v_event.period_type = 'regulation' then
        v_regulation_away_score := v_regulation_away_score + v_event.points;
      end if;
    end if;

    if v_event.pairing_override_reason is not null then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'invId', 'INV-07',
        'code', 'ledger_pairing_override',
        'message', format(
          'Event %s uses a reasoned paired-stat exception.',
          v_event.sequence_number
        ),
        'values', jsonb_build_object(
          'event_id', v_event.id,
          'sequence_number', v_event.sequence_number,
          'reason', v_event.pairing_override_reason
        )
      ));
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
              and void_event.action = 'void'
              and void_event.voids_event_id = event.id
         )
    )
    select participant.profile_id, participant.team_id, attr.stat_key,
           sum(attr.stat_delta)::int as delta
      from public.scorekeeping_event_attributions attr
      join public.scorekeeping_participants participant
        on participant.id = attr.participant_id
     where attr.event_id in (select id from effective_events)
     group by participant.profile_id, participant.team_id, attr.stat_key
  loop
    v_profile := v_attr.profile_id::text;
    if not (v_stats ? v_profile) then
      v_stats := jsonb_set(
        v_stats,
        array[v_profile],
        jsonb_build_object('team_id', v_attr.team_id, 'stats', '{}'::jsonb)
      );
    end if;
    v_stat_current := coalesce(
      (v_stats #>> array[v_profile, 'stats', v_attr.stat_key])::int,
      0
    );
    v_stats := jsonb_set(
      v_stats,
      array[v_profile, 'stats', v_attr.stat_key],
      to_jsonb(v_stat_current + v_attr.delta),
      true
    );
  end loop;

  foreach v_team in array array[v_session.home_team_id, v_session.away_team_id] loop
    select coalesce(jsonb_object_agg(stat.key, stat.total), '{}'::jsonb)
      into v_team_stats
      from (
        select entry.key, sum((entry.value #>> '{}')::int)::int total
          from jsonb_each(v_stats) player
          cross join lateral jsonb_each(player.value -> 'stats') entry
         where (player.value ->> 'team_id')::uuid = v_team
         group by entry.key
      ) stat;
    v_score := case
      when v_team = v_session.home_team_id then v_home_score
      else v_away_score
    end;
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
        'message', format(
          '%s stat-derived points %s do not equal event score %s.',
          v_session.sport,
          v_derived,
          v_score
        ),
        'values', jsonb_build_object(
          'team_id', v_team,
          'derived', v_derived,
          'score', v_score
        )
      ));
    end if;
  end loop;

  v_finalizable := v_latest_overtime_period is null
    or (
      v_regulation_home_score = v_regulation_away_score
      and coalesce(v_latest_closed_overtime_period, 0) = v_latest_overtime_period
    );
  v_periods := jsonb_build_object('home', v_home, 'away', v_away);
  return jsonb_build_object(
    'home_score', v_home_score,
    'away_score', v_away_score,
    'regulation_home_score', v_regulation_home_score,
    'regulation_away_score', v_regulation_away_score,
    'periods', v_periods,
    'player_stats', v_stats,
    'warnings', v_warnings,
    'latest_overtime_period', v_latest_overtime_period,
    'latest_closed_overtime_period', v_latest_closed_overtime_period,
    'finalizable', v_finalizable,
    'winner_team_id', case
      when not v_finalizable or v_home_score = v_away_score then null
      when v_home_score > v_away_score then v_session.home_team_id
      else v_session.away_team_id
    end,
    'loser_team_id', case
      when not v_finalizable or v_home_score = v_away_score then null
      when v_home_score > v_away_score then v_session.away_team_id
      else v_session.home_team_id
    end
  );
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
  v_latest_overtime_period int;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then
    raise exception '[INV-15] Finalization idempotency key is required.';
  end if;
  select game_id into v_game_id from public.scorekeeping_sessions where id = p_session_id;
  if v_game_id is null then
    raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
  perform 1 from public.games where id = v_game_id for update;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;

  v_hash := encode(digest(jsonb_build_object(
    'session_id', p_session_id,
    'override_reason', nullif(trim(coalesce(p_override_reason, '')), '')
  )::text, 'sha256'), 'hex');
  if v_session.status = 'finalized' then
    if v_session.finalization_idempotency_key = trim(p_idempotency_key)
       and v_session.finalization_command_hash = v_hash then
      return v_session.finalization_result;
    end if;
    raise exception '[INV-15] Finalized session cannot be replayed with a different command.';
  end if;
  if v_session.session_kind <> 'ordinary' then
    raise exception '[INV-24] Correction sessions use finalize_scorekeeping_correction.';
  end if;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);
  v_projection := public.cvf_build_ledger_projection(p_session_id);
  v_latest_overtime_period := (v_projection ->> 'latest_overtime_period')::int;

  if not (v_projection ->> 'finalizable')::boolean then
    return jsonb_build_object(
      'ok', true,
      'status', 'overtime_period_open',
      'game_id', v_game_id,
      'session_id', p_session_id,
      'overtime_period', v_latest_overtime_period,
      'message', format(
        'Overtime period %s must be closed before evaluation.',
        v_latest_overtime_period
      )
    );
  end if;

  if (v_projection ->> 'home_score')::int = (v_projection ->> 'away_score')::int
     and not v_session.allow_ties then
    return jsonb_build_object(
      'ok', true,
      'status', 'continue_overtime',
      'game_id', v_game_id,
      'session_id', p_session_id,
      'home_score', v_projection -> 'home_score',
      'away_score', v_projection -> 'away_score',
      'next_overtime_period', coalesce(v_latest_overtime_period, 0) + 1,
      'message', 'The completed period remains tied; continue overtime.'
    );
  end if;

  if jsonb_array_length(v_projection -> 'warnings') > 0
     and coalesce(length(trim(p_override_reason)), 0) = 0 then
    raise exception 'SOFT validation requires an override reason: %',
      v_projection -> 'warnings' -> 0 ->> 'message';
  end if;

  perform set_config('cvf.ledger_projection', 'on', true);
  perform set_config('cvf.bypass_lock', 'on', true);
  update public.games set
    status = 'completed',
    score_status = 'final',
    locked = true,
    home_score = (v_projection ->> 'home_score')::int,
    away_score = (v_projection ->> 'away_score')::int,
    periods = v_projection -> 'periods',
    submitted_by = auth.uid(),
    approved_by = auth.uid(),
    outcome_type = 'played',
    winner_team_id = (v_projection ->> 'winner_team_id')::uuid,
    loser_team_id = (v_projection ->> 'loser_team_id')::uuid,
    forfeit_reason = null
  where id = v_game_id;
  delete from public.player_stats where game_id = v_game_id;
  for v_stats in select key, value from jsonb_each(v_projection -> 'player_stats') loop
    insert into public.player_stats (game_id, profile_id, team_id, sport, stats)
    values (
      v_game_id,
      v_stats.key::uuid,
      (v_stats.value ->> 'team_id')::uuid,
      v_session.sport,
      v_stats.value -> 'stats'
    );
  end loop;

  select id into v_match_id from public.playoff_matches where game_id = v_game_id;
  if v_match_id is not null then
    perform public.advance_playoff_match(v_match_id);
  end if;
  v_result := jsonb_build_object(
    'ok', true,
    'status', 'finalized',
    'game_id', v_game_id,
    'session_id', p_session_id,
    'home_score', v_projection -> 'home_score',
    'away_score', v_projection -> 'away_score',
    'warnings', v_projection -> 'warnings',
    'overridden', jsonb_array_length(v_projection -> 'warnings') > 0
  );
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions set
    status = 'finalized',
    closed_by = auth.uid(),
    closed_at = clock_timestamp(),
    lease_version = lease_version + 1,
    lease_expires_at = clock_timestamp(),
    finalization_idempotency_key = trim(p_idempotency_key),
    finalization_command_hash = v_hash,
    finalization_result = v_result,
    override_reason = nullif(trim(coalesce(p_override_reason, '')), ''),
    validation_warnings = v_projection -> 'warnings'
  where id = p_session_id;
  insert into public.game_edit_history (
    game_id, action, actor, after_state, override_reason,
    validation_warnings, scorekeeping_session_id
  ) values (
    v_game_id, 'Ledger result finalized', auth.uid(), v_projection,
    nullif(trim(coalesce(p_override_reason, '')), ''),
    v_projection -> 'warnings', p_session_id
  );
  return v_result;
exception when others then
  if v_game_id is null then
    raise;
  end if;
  insert into public.game_edit_history (
    game_id, action, actor, scorekeeping_session_id, failure_metadata
  ) values (
    v_game_id, 'Ledger finalization failed', auth.uid(), p_session_id,
    jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm, 'stage', 'projection')
  );
  return jsonb_build_object(
    'ok', false,
    'code', sqlstate,
    'message', sqlerrm,
    'session_id', p_session_id
  );
end;
$$;

-- Re-state the correction finalizer so an effective period_close is a
-- first-class publication prerequisite. Previously the database still
-- rejected an open-period correction through the completed-game winner
-- constraint, but this guard makes the rule explicit and returns the
-- intended invariant instead of relying on a downstream constraint.
create or replace function public.finalize_scorekeeping_correction(
  p_session_id uuid, p_lease_token text, p_lease_version int,
  p_idempotency_key text, p_override_reason text default null
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
  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then
    raise exception '[INV-15] Finalization idempotency key is required.';
  end if;
  select game_id into v_game_id
    from public.scorekeeping_sessions
   where id = p_session_id;
  if v_game_id is null then
    raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id;
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0)
  );
  select * into v_game
    from public.games
   where id = v_game_id
   for update;
  select * into v_session
    from public.scorekeeping_sessions
   where id = p_session_id
   for update;
  v_hash := encode(digest(jsonb_build_object(
    'session_id', p_session_id,
    'override_reason', nullif(trim(coalesce(p_override_reason, '')), '')
  )::text, 'sha256'), 'hex');
  if v_session.status = 'finalized' then
    if v_session.finalization_idempotency_key = trim(p_idempotency_key)
       and v_session.finalization_command_hash = v_hash then
      return v_session.finalization_result;
    end if;
    raise exception '[INV-15] Finalized correction cannot be replayed with a different command.';
  end if;
  if v_session.session_kind <> 'correction' then
    raise exception '[INV-24] Ordinary sessions use finalize_scorekeeping_session.';
  end if;
  perform public.cvf_assert_ledger_lease(
    v_session,
    p_lease_token,
    p_lease_version
  );
  v_before := jsonb_build_object(
    'home_score', v_game.home_score,
    'away_score', v_game.away_score,
    'periods', v_game.periods,
    'winner_team_id', v_game.winner_team_id,
    'loser_team_id', v_game.loser_team_id
  );

  begin
    v_projection := public.cvf_build_ledger_projection(p_session_id);
    if not coalesce((v_projection ->> 'finalizable')::boolean, false) then
      raise exception '[INV-08][INV-24] A correction cannot publish while the latest overtime period is open; restore or replace its period_close before finalizing.';
    end if;
    if (v_projection ->> 'home_score')::int
         = (v_projection ->> 'away_score')::int
       and not v_session.allow_ties then
      raise exception '[INV-08] Season 1 ledger final scores cannot be tied.';
    end if;
    if jsonb_array_length(v_projection -> 'warnings') > 0
       and coalesce(length(trim(p_override_reason)), 0) = 0 then
      raise exception 'SOFT validation requires an override reason: %',
        v_projection -> 'warnings' -> 0 ->> 'message';
    end if;
    v_new_winner := (v_projection ->> 'winner_team_id')::uuid;
    v_new_loser := (v_projection ->> 'loser_team_id')::uuid;
    select * into v_match
      from public.playoff_matches
     where game_id = v_game_id
     for update;
    if found
       and v_match.status = 'completed'
       and v_match.winner_team_id is distinct from v_new_winner then
      if v_match.winner_to_match_id is not null then
        select * into v_destination
          from public.playoff_matches
         where id = v_match.winner_to_match_id
         for update;
        if v_destination.game_id is not null
           or v_destination.status = 'completed' then
          raise exception '[INV-32] Winner-changing correction is blocked because the next playoff game is scheduled or completed.';
        end if;
      end if;
      if v_match.loser_to_match_id is not null then
        select * into v_destination
          from public.playoff_matches
         where id = v_match.loser_to_match_id
         for update;
        if v_destination.game_id is not null
           or v_destination.status = 'completed' then
          raise exception '[INV-32] Winner-changing correction is blocked because the third-place game is scheduled or completed.';
        end if;
      end if;
      v_winner_seed := case
        when v_new_winner = v_match.home_team_id then v_match.home_seed
        else v_match.away_seed
      end;
      v_loser_seed := case
        when v_new_loser = v_match.home_team_id then v_match.home_seed
        else v_match.away_seed
      end;
      if v_match.winner_to_match_id is not null then
        if v_match.winner_to_slot = 'home' then
          update public.playoff_matches
             set home_team_id = v_new_winner,
                 home_seed = v_winner_seed
           where id = v_match.winner_to_match_id;
        else
          update public.playoff_matches
             set away_team_id = v_new_winner,
                 away_seed = v_winner_seed
           where id = v_match.winner_to_match_id;
        end if;
      end if;
      if v_match.loser_to_match_id is not null then
        if v_match.loser_to_slot = 'home' then
          update public.playoff_matches
             set home_team_id = v_new_loser,
                 home_seed = v_loser_seed
           where id = v_match.loser_to_match_id;
        else
          update public.playoff_matches
             set away_team_id = v_new_loser,
                 away_seed = v_loser_seed
           where id = v_match.loser_to_match_id;
        end if;
      end if;
      update public.playoff_matches
         set winner_team_id = v_new_winner,
             loser_team_id = v_new_loser
       where id = v_match.id;
      update public.playoff_matches
         set status = case
           when home_team_id is not null and away_team_id is not null
             then 'ready'
           else 'pending'
         end
       where id in (
         v_match.winner_to_match_id,
         v_match.loser_to_match_id
       );
    end if;

    perform set_config('cvf.ledger_projection', 'on', true);
    perform set_config('cvf.bypass_lock', 'on', true);
    update public.games
       set home_score = (v_projection ->> 'home_score')::int,
           away_score = (v_projection ->> 'away_score')::int,
           periods = v_projection -> 'periods',
           winner_team_id = v_new_winner,
           loser_team_id = v_new_loser,
           status = 'completed',
           score_status = 'final',
           locked = true,
           submitted_by = auth.uid(),
           approved_by = auth.uid()
     where id = v_game_id;
    delete from public.player_stats where game_id = v_game_id;
    for v_stat in
      select key, value
        from jsonb_each(v_projection -> 'player_stats')
    loop
      insert into public.player_stats (
        game_id,
        profile_id,
        team_id,
        sport,
        stats
      ) values (
        v_game_id,
        v_stat.key::uuid,
        (v_stat.value ->> 'team_id')::uuid,
        v_session.sport,
        v_stat.value -> 'stats'
      );
    end loop;
  exception when others then
    insert into public.game_edit_history (
      game_id,
      action,
      reason,
      actor,
      scorekeeping_session_id,
      failure_metadata
    ) values (
      v_game_id,
      'Ledger correction finalization failed',
      v_session.correction_reason,
      auth.uid(),
      p_session_id,
      jsonb_build_object(
        'sqlstate', sqlstate,
        'message', sqlerrm,
        'stage', 'projection'
      )
    );
    return jsonb_build_object(
      'ok', false,
      'code', sqlstate,
      'message', sqlerrm,
      'session_id', p_session_id
    );
  end;

  v_after := v_projection;
  v_result := jsonb_build_object(
    'ok', true,
    'game_id', v_game_id,
    'session_id', p_session_id,
    'home_score', v_projection -> 'home_score',
    'away_score', v_projection -> 'away_score',
    'warnings', v_projection -> 'warnings',
    'overridden', jsonb_array_length(v_projection -> 'warnings') > 0
  );
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions
     set status = 'finalized',
         closed_by = auth.uid(),
         closed_at = clock_timestamp(),
         lease_version = lease_version + 1,
         lease_expires_at = clock_timestamp(),
         finalization_idempotency_key = trim(p_idempotency_key),
         finalization_command_hash = v_hash,
         finalization_result = v_result,
         override_reason = nullif(trim(coalesce(p_override_reason, '')), ''),
         validation_warnings = v_projection -> 'warnings'
   where id = p_session_id;
  insert into public.game_edit_history (
    game_id,
    action,
    reason,
    actor,
    before_state,
    after_state,
    override_reason,
    validation_warnings,
    scorekeeping_session_id
  ) values (
    v_game_id,
    'Ledger final result corrected',
    v_session.correction_reason,
    auth.uid(),
    v_before,
    v_after,
    nullif(trim(coalesce(p_override_reason, '')), ''),
    v_projection -> 'warnings',
    p_session_id
  );
  return v_result;
end;
$$;

revoke execute on function public.cvf_validate_ledger_event(
  public.scorekeeping_sessions, text, int, jsonb
) from public, anon, authenticated, service_role;
revoke execute on function public.cvf_flag_pairing_mismatches(
  public.scorekeeping_sessions, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke execute on function public.cvf_prepare_scorekeeping_event()
  from public, anon, authenticated, service_role;
revoke execute on function public.cvf_build_ledger_projection(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.append_scorekeeping_event(
  uuid, text, int, text, text, text, text, int, uuid, int, uuid, uuid,
  jsonb, jsonb, text
) from public, anon, service_role;
revoke execute on function public.replace_scorekeeping_event(
  uuid, text, int, text, text, uuid, text, text, int, uuid, int,
  jsonb, jsonb, text
) from public, anon, service_role;
revoke execute on function public.finalize_scorekeeping_session(
  uuid, text, int, text, text
) from public, anon, service_role;

grant execute on function public.append_scorekeeping_event(
  uuid, text, int, text, text, text, text, int, uuid, int, uuid, uuid,
  jsonb, jsonb, text
) to authenticated;
grant execute on function public.replace_scorekeeping_event(
  uuid, text, int, text, text, uuid, text, text, int, uuid, int,
  jsonb, jsonb, text
) to authenticated;
grant execute on function public.finalize_scorekeeping_session(
  uuid, text, int, text, text
) to authenticated;
