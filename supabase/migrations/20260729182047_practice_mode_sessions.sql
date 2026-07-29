-- Sequence 5B (Migration 30): practice mode — Option B, sessions without games.
--
-- The owner-approved design (docs/scoring/PRACTICE_MODE_DESIGN_2026-07-29.md)
-- makes exclusion from official surfaces structural: a practice session is a
-- scorekeeping_sessions row with session_kind = 'practice' and game_id NULL,
-- so practice evidence exists only in the four private scorekeeping tables
-- (admin-read-only RLS, no anonymous grant, no client write grant). Practice
-- finalization computes and RETURNS the projection and writes nothing to
-- games, player_stats, game_edit_history, or playoff tables.
--
-- Official runtime RPCs already reject NULL-game sessions naturally: every
-- session-consuming RPC (renew/resume/cancel/append/replace/finalize ordinary
-- and correction) begins with
--   select game_id into v_game_id ...; if v_game_id is null then raise
-- and the game-consuming RPCs (start_scorekeeping_session,
-- start_scorekeeping_correction, declare_ledger_forfeit,
-- advance_playoff_match) take a game id a practice session never has. They
-- are deliberately left untouched.
--
-- Four trigger functions and one validation trigger DO need practice-aware
-- re-emission because their bodies structurally exclude NULL-game rows
-- (documented per function below):
--   cvf_guard_scorekeeping_session       (4C authoritative)
--   cvf_prepare_scorekeeping_participant (Migration 24 authoritative)
--   cvf_prepare_scorekeeping_event       (5A authoritative)
--   cvf_prepare_scorekeeping_attribution (Migration 24 authoritative)
--   cvf_validate_correction_event_target (4C authoritative)
-- Each is transcribed faithfully from its authoritative definition with the
-- minimal practice branch added.
--
-- cvf_build_ledger_projection (5A) is already practice-safe: it reads only
-- the session row, the session-chain events, attributions, and participant
-- snapshots — it never joins public.games — so practice finalization calls it
-- directly instead of a parallel copy.

-- ---------------------------------------------------------------------------
-- 1. Schema: the practice session shape.
-- ---------------------------------------------------------------------------

alter table public.scorekeeping_sessions
  alter column game_id drop not null;

alter table public.scorekeeping_sessions
  drop constraint scorekeeping_sessions_session_kind_check,
  add constraint scorekeeping_sessions_session_kind_check
    check (session_kind in ('ordinary', 'correction', 'practice'));

-- Practice is exactly the NULL-game kind, in both directions.
alter table public.scorekeeping_sessions
  add constraint scorekeeping_sessions_practice_game_check
    check ((session_kind = 'practice') = (game_id is null));

alter table public.scorekeeping_sessions
  drop constraint scorekeeping_sessions_stage_check,
  add constraint scorekeeping_sessions_stage_check
    check (stage in ('regular', 'playoff', 'tournament', 'practice'));

-- The kind/status/base/correction arm gains practice: an ordinary-entry
-- practice session has no base and no reason; a practice correction is a NEW
-- practice session referencing a finalized practice base with a nonblank
-- reason. Practice never uses 'drafting' — every practice session is 'open'
-- while active.
alter table public.scorekeeping_sessions
  drop constraint scorekeeping_sessions_check1,
  add constraint scorekeeping_sessions_kind_shape_check check (
    (session_kind = 'ordinary'
      and status in ('open', 'finalized', 'canceled', 'failed')
      and base_session_id is null
      and correction_reason is null)
    or
    (session_kind = 'correction'
      and status in ('drafting', 'finalized', 'canceled', 'failed')
      and base_session_id is not null
      and length(trim(correction_reason)) > 0)
    or
    (session_kind = 'practice'
      and status in ('open', 'finalized', 'canceled', 'failed')
      and (
        (base_session_id is null and correction_reason is null)
        or
        (base_session_id is not null and length(trim(correction_reason)) > 0)
      ))
  );

-- The (base_session_id, game_id) anti-cross-game FK stops enforcing when
-- game_id is NULL (MATCH SIMPLE), so pin the plain base reference too.
alter table public.scorekeeping_sessions
  add constraint scorekeeping_sessions_base_fkey
    foreign key (base_session_id)
    references public.scorekeeping_sessions (id) on delete restrict;

-- Child tables: game_id becomes nullable for practice rows. Their composite
-- (session_id, game_id) FKs are MATCH SIMPLE and therefore stop enforcing
-- when game_id is NULL, so each table gains a plain session FK (and events /
-- attributions gain plain event/participant/void/replace FKs). A CHECK cannot
-- cross-reference the session row to assert "game_id is NULL exactly when the
-- session is practice"; that consistency is enforced by the controlled
-- trigger path, which always stamps the child game_id from its session/event.
alter table public.scorekeeping_participants
  alter column game_id drop not null,
  add constraint scorekeeping_participants_session_fkey
    foreign key (session_id)
    references public.scorekeeping_sessions (id) on delete restrict;

alter table public.scorekeeping_events
  alter column game_id drop not null,
  add constraint scorekeeping_events_session_fkey
    foreign key (session_id)
    references public.scorekeeping_sessions (id) on delete restrict,
  add constraint scorekeeping_events_voids_event_fkey
    foreign key (voids_event_id)
    references public.scorekeeping_events (id) on delete restrict,
  add constraint scorekeeping_events_replaces_event_fkey
    foreign key (replaces_event_id)
    references public.scorekeeping_events (id) on delete restrict;

alter table public.scorekeeping_event_attributions
  alter column game_id drop not null,
  add constraint scorekeeping_event_attributions_session_fkey
    foreign key (session_id)
    references public.scorekeeping_sessions (id) on delete restrict,
  add constraint scorekeeping_event_attributions_event_fkey
    foreign key (event_id)
    references public.scorekeeping_events (id) on delete restrict,
  add constraint scorekeeping_event_attributions_participant_fkey
    foreign key (participant_id)
    references public.scorekeeping_participants (id) on delete restrict;

-- The per-game unique constraints on (game_id, sequence_number) and
-- (game_id, idempotency_key) do not constrain NULL-game rows, so the
-- practice scope gets per-session parallels. Practice sequences are dense
-- 1..N per session; practice idempotency is session-scoped.
create unique index scorekeeping_events_practice_sequence_idx
  on public.scorekeeping_events (session_id, sequence_number)
  where game_id is null;
create unique index scorekeeping_events_practice_idempotency_idx
  on public.scorekeeping_events (session_id, idempotency_key)
  where game_id is null;

-- Event shape (scorekeeping_events_shape_check) is deliberately unchanged:
-- practice records/voids/replacements satisfy exactly the official rules.
-- The points >= 0 check is likewise unchanged.

-- ---------------------------------------------------------------------------
-- 2. Session guard (4C authoritative) + practice INSERT branch.
--    The official INSERT path selects the game row and raises [INV-28] for a
--    missing game, which would reject every practice session; the practice
--    branch validates the gameless snapshot instead. The UPDATE path is
--    byte-faithful: its immutability and lease-advance comparisons are
--    already NULL-safe.
-- ---------------------------------------------------------------------------
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
    if new.session_kind = 'practice' then
      -- Practice: no game exists. The practice/game CHECK already ties the
      -- kind to game_id IS NULL; here the guard pins the practice stage and
      -- the practice-correction chain rules.
      if new.stage <> 'practice' then
        raise exception '[INV-10] A practice session must snapshot stage = practice.';
      end if;
      if new.base_session_id is not null then
        select * into v_base from public.scorekeeping_sessions where id = new.base_session_id;
        if not found or v_base.session_kind <> 'practice'
           or v_base.game_id is not null or v_base.status <> 'finalized' then
          raise exception '[INV-24] A practice correction requires a finalized practice base session.';
        end if;
        if (new.sport, new.league_id, new.season, new.stage, new.home_team_id, new.away_team_id,
            new.rule_version, new.regulation_period_count, new.overtime_start_setting, new.allow_ties, new.rules_snapshot)
           is distinct from
           (v_base.sport, v_base.league_id, v_base.season, v_base.stage, v_base.home_team_id, v_base.away_team_id,
            v_base.rule_version, v_base.regulation_period_count, v_base.overtime_start_setting, v_base.allow_ties, v_base.rules_snapshot) then
          raise exception '[INV-10] Practice correction rules must exactly preserve the base practice snapshot.';
        end if;
      end if;
      return new;
    end if;
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

-- ---------------------------------------------------------------------------
-- 3. Participant snapshot trigger (Migration 24 authoritative) + practice.
--    An ordinary-entry practice session snapshots from the live roster
--    exactly like an ordinary game session; a practice correction (base set)
--    clones the base practice snapshot. The clone lookup's
--    "game_id = v_session.game_id" is never true for NULL, so the practice
--    path compares with IS NOT DISTINCT FROM.
-- ---------------------------------------------------------------------------
create or replace function public.cvf_prepare_scorekeeping_participant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_session public.scorekeeping_sessions%rowtype;
  v_roster public.team_players%rowtype;
  v_profile public.profiles%rowtype;
  v_source public.scorekeeping_participants%rowtype;
begin
  if current_user <> 'postgres'
     or coalesce(current_setting('cvf.ledger_session_mutation', true), '') <> 'on' then
    raise exception '[INV-04] Participant snapshots may be created only by the controlled server path.';
  end if;
  select * into v_session
    from public.scorekeeping_sessions where id = new.session_id for update;
  if not found or v_session.status not in ('open', 'drafting') then
    raise exception '[INV-20] Participants require an active scorekeeping session.';
  end if;
  if exists (select 1 from public.scorekeeping_events where session_id = new.session_id) then
    raise exception '[INV-12] Participant snapshots cannot grow after the first event.';
  end if;

  new.game_id := v_session.game_id;
  if v_session.session_kind = 'ordinary'
     or (v_session.session_kind = 'practice' and v_session.base_session_id is null) then
    if new.source_team_player_id is null or new.source_participant_id is not null then
      raise exception '[INV-11] Ordinary participant snapshots require a roster source.';
    end if;
    select * into v_roster from public.team_players where id = new.source_team_player_id;
    if not found or v_roster.roster_status <> 'eligible'
       or v_roster.season is distinct from v_session.season
       or v_roster.team_id not in (v_session.home_team_id, v_session.away_team_id) then
      raise exception '[INV-11] Participant source must be an eligible game-team roster row for the snapshotted season.';
    end if;
    select * into v_profile from public.profiles where id = v_roster.profile_id;
    new.profile_id := v_roster.profile_id;
    new.team_id := v_roster.team_id;
    new.season := v_roster.season;
    new.display_name := v_profile.name;
    new.jersey_number := v_roster.jersey_number;
    new.position := v_roster.position;
    new.roster_status := v_roster.roster_status;
  else
    if new.source_participant_id is null or new.source_team_player_id is not null then
      raise exception '[INV-12] Correction participants must clone the ordinary-session snapshot.';
    end if;
    select * into v_source
      from public.scorekeeping_participants
     where id = new.source_participant_id
       and session_id = v_session.base_session_id
       and game_id is not distinct from v_session.game_id;
    if not found then
      raise exception '[INV-12] Correction participant source is not in the base session.';
    end if;
    new.source_team_player_id := null;
    new.profile_id := v_source.profile_id;
    new.team_id := v_source.team_id;
    new.season := v_source.season;
    new.display_name := v_source.display_name;
    new.jersey_number := v_source.jersey_number;
    new.position := v_source.position;
    new.roster_status := v_source.roster_status;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Event preparation trigger (5A authoritative) + practice branch.
--    Practice differences, each required by the NULL game:
--      - advisory lock on 'cvf-scorekeeping-practice:' || session_id;
--      - no games row exists, so no games FOR UPDATE and no mode check;
--      - sequence_number is the per-session max + 1 (dense 1..N per session);
--      - the overtime ordering rules also govern ordinary-entry practice
--        sessions, so practice rehearses real overtime semantics;
--      - void/replace original-event lookups are scoped to the practice
--        session chain instead of game_id equality, and practice-correction
--        sessions (kind 'practice' with a base) are the only practice
--        sessions allowed to void/replace.
-- ---------------------------------------------------------------------------
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
  v_is_practice boolean;
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

  select * into v_session
    from public.scorekeeping_sessions where id = new.session_id;
  if not found then
    raise exception '[INV-20] Unknown scorekeeping session %.', new.session_id;
  end if;
  v_game_id := v_session.game_id;
  v_is_practice := v_game_id is null;

  if v_is_practice then
    perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || new.session_id::text, 0));
    select * into v_session
      from public.scorekeeping_sessions where id = new.session_id for update;
    if v_session.status not in ('open', 'drafting') then
      raise exception '[INV-20] Events require an active practice session.';
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping:' || v_game_id::text, 0));
    select * into v_game from public.games where id = v_game_id for update;
    select * into v_session
      from public.scorekeeping_sessions where id = new.session_id for update;

    if v_game.scorekeeping_mode <> 'ledger'
       or v_session.status not in ('open', 'drafting') then
      raise exception '[INV-20][INV-28] Events require an active ledger session.';
    end if;
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
  if v_is_practice then
    new.sequence_number := coalesce((
      select max(event.sequence_number)
        from public.scorekeeping_events event
       where event.session_id = new.session_id
    ), 0) + 1;
  else
    new.sequence_number := coalesce((
      select max(event.sequence_number)
        from public.scorekeeping_events event
       where event.game_id = v_game_id
    ), 0) + 1;
  end if;

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

  -- Ordinary-entry practice sessions rehearse the identical overtime
  -- ordering contract; practice corrections, like official corrections, are
  -- exempt because they operate on the settled chain.
  if (v_session.session_kind = 'ordinary'
      or (v_session.session_kind = 'practice' and v_session.base_session_id is null))
     and new.action = 'record' then
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
    if not (v_session.session_kind = 'correction'
            or (v_session.session_kind = 'practice' and v_session.base_session_id is not null)) then
      raise exception '[INV-16] Void events require a correction session.';
    end if;
    if v_is_practice then
      select * into v_original
        from public.scorekeeping_events
       where id = new.voids_event_id
         and session_id in (
           with recursive session_chain as (
             select id, base_session_id from public.scorekeeping_sessions where id = new.session_id
             union all
             select parent.id, parent.base_session_id
               from public.scorekeeping_sessions parent
               join session_chain child on child.base_session_id = parent.id
           )
           select id from session_chain
         );
      if not found or v_original.action = 'void' then
        raise exception '[INV-16] A void must reference a non-void event in the same practice chain.';
      end if;
    else
      select * into v_original
        from public.scorekeeping_events
       where id = new.voids_event_id and game_id = v_game_id;
      if not found or v_original.action = 'void' then
        raise exception '[INV-16] A void must reference a non-void event in the same game.';
      end if;
    end if;
  elsif new.action = 'replace' then
    if not (v_session.session_kind = 'correction'
            or (v_session.session_kind = 'practice' and v_session.base_session_id is not null)) then
      raise exception '[INV-17] Replacement events require a correction session.';
    end if;
    if v_is_practice then
      select * into v_original
        from public.scorekeeping_events
       where id = new.replaces_event_id
         and session_id in (
           with recursive session_chain as (
             select id, base_session_id from public.scorekeeping_sessions where id = new.session_id
             union all
             select parent.id, parent.base_session_id
               from public.scorekeeping_sessions parent
               join session_chain child on child.base_session_id = parent.id
           )
           select id from session_chain
         );
      if not found or v_original.action = 'void'
         or not exists (
           select 1 from public.scorekeeping_events void_event
            where void_event.session_id = v_session.id
              and void_event.action = 'void'
              and void_event.voids_event_id = v_original.id
         ) then
        raise exception '[INV-17] A replacement must follow this correction session''s void of the same original.';
      end if;
    else
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
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Attribution trigger (Migration 24 authoritative): the participant
--    lookup's "game_id = v_event.game_id" is never true for NULL, so it
--    becomes IS NOT DISTINCT FROM. Everything else is byte-faithful.
-- ---------------------------------------------------------------------------
create or replace function public.cvf_prepare_scorekeeping_attribution()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_event public.scorekeeping_events%rowtype;
  v_participant public.scorekeeping_participants%rowtype;
  v_status text;
begin
  if current_user <> 'postgres'
     or coalesce(current_setting('cvf.ledger_event_write', true), '') <> 'on' then
    raise exception '[INV-04] Event attributions may be created only by the controlled server path.';
  end if;
  if new.created_by is null then
    raise exception '[INV-19] An event attribution requires an actor.';
  end if;
  select * into v_event from public.scorekeeping_events where id = new.event_id;
  if not found or v_event.action = 'void' then
    raise exception '[INV-11] Attributions require a non-void ledger event.';
  end if;
  select status into v_status from public.scorekeeping_sessions where id = v_event.session_id;
  if v_status not in ('open', 'drafting') then
    raise exception '[INV-20] Closed sessions reject new attributions.';
  end if;
  select * into v_participant
    from public.scorekeeping_participants
   where id = new.participant_id
     and session_id = v_event.session_id
     and game_id is not distinct from v_event.game_id;
  if not found then
    raise exception '[INV-11] Attribution participant is outside the event session snapshot.';
  end if;
  new.session_id := v_event.session_id;
  new.game_id := v_event.game_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Correction-target trigger (4C authoritative): a practice session with a
--    base is a correction for targeting purposes — records are rejected and
--    voids must hit an event still effective in the chain. The chain query
--    was already session-scoped (base_session_id recursion), so it is
--    practice-safe unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.cvf_validate_correction_event_target()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_kind text;
  v_base_session_id uuid;
begin
  select session_kind, base_session_id into v_kind, v_base_session_id
    from public.scorekeeping_sessions where id = new.session_id;
  if not (v_kind = 'correction'
          or (v_kind = 'practice' and v_base_session_id is not null)) then
    return new;
  end if;
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

-- ---------------------------------------------------------------------------
-- 7. Practice runtime RPCs. Same AAL2 boundary, lease machinery, sentinel
--    pattern, and command hashing as the official RPCs; the practice
--    advisory key replaces the game key and no official surface is written.
-- ---------------------------------------------------------------------------

create function public.start_practice_session(
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_rule_version text,
  p_regulation_period_count int,
  p_overtime_start_setting text default null,
  p_rules_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_home public.teams%rowtype;
  v_away public.teams%rowtype;
  v_home_league public.leagues%rowtype;
  v_away_league public.leagues%rowtype;
  v_session public.scorekeeping_sessions%rowtype;
  v_session_id uuid := gen_random_uuid();
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  select * into v_home from public.teams where id = p_home_team_id;
  if not found then raise exception '[INV-04] Home team % does not exist.', p_home_team_id; end if;
  select * into v_away from public.teams where id = p_away_team_id;
  if not found then raise exception '[INV-04] Away team % does not exist.', p_away_team_id; end if;
  if p_home_team_id = p_away_team_id then
    raise exception '[INV-02] Practice requires two distinct teams.';
  end if;
  select * into v_home_league from public.leagues where id = v_home.league_id;
  select * into v_away_league from public.leagues where id = v_away.league_id;
  if v_home_league.sport is distinct from v_away_league.sport
     or v_home_league.season is distinct from v_away_league.season then
    raise exception '[INV-10] Practice teams must share one sport and league season.';
  end if;
  if coalesce(length(trim(p_rule_version)), 0) = 0
     or p_regulation_period_count is null or p_regulation_period_count <= 0
     or jsonb_typeof(coalesce(p_rules_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception '[INV-10] A valid immutable rule snapshot is required.';
  end if;
  if v_home_league.sport = 'flag_football' and p_regulation_period_count <> 4 then
    raise exception '[INV-10] Flag football requires exactly four regulation quarters.';
  end if;

  -- Practice sessions have no shared game resource; the advisory lock on the
  -- new session id exists for lock-order symmetry with the event path.
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || v_session_id::text, 0));

  perform set_config('cvf.ledger_session_mutation', 'on', true);
  -- league_id snapshots the HOME team's league: both leagues are proven to
  -- share sport and season, and the snapshot columns need one league id.
  insert into public.scorekeeping_sessions (
    id, game_id, session_kind, status, opened_by, lease_token_hash, lease_expires_at,
    sport, league_id, season, stage, home_team_id, away_team_id, rule_version,
    regulation_period_count, overtime_start_setting, allow_ties, rules_snapshot
  ) values (
    v_session_id, null, 'practice', 'open', auth.uid(), public.cvf_ledger_token_hash(v_token), clock_timestamp() + interval '10 minutes',
    v_home_league.sport, v_home.league_id, v_home_league.season, 'practice', p_home_team_id, p_away_team_id,
    trim(p_rule_version), p_regulation_period_count, nullif(trim(coalesce(p_overtime_start_setting, '')), ''),
    false, coalesce(p_rules_snapshot, '{}'::jsonb)
  ) returning * into v_session;

  insert into public.scorekeeping_participants (session_id, game_id, source_team_player_id, profile_id, team_id, season, display_name, position, roster_status)
  select v_session.id, null, roster.id, roster.profile_id, roster.team_id, roster.season, profile.name, roster.position, roster.roster_status
    from public.team_players roster
    join public.profiles profile on profile.id = roster.profile_id
   where roster.team_id in (p_home_team_id, p_away_team_id)
     and roster.season = v_home_league.season and roster.roster_status = 'eligible';

  if not exists (select 1 from public.scorekeeping_participants where session_id = v_session.id and team_id = p_home_team_id)
     or not exists (select 1 from public.scorekeeping_participants where session_id = v_session.id and team_id = p_away_team_id) then
    raise exception '[INV-11] Both teams require at least one eligible snapshotted participant.';
  end if;

  return jsonb_build_object('session_id', v_session.id, 'lease_token', v_token, 'lease_version', v_session.lease_version,
    'lease_expires_at', v_session.lease_expires_at, 'session_kind', v_session.session_kind);
end;
$$;

create function public.append_practice_event(
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
  select * into v_session from public.scorekeeping_sessions where id = p_session_id;
  if not found then
    raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id;
  end if;
  if v_session.session_kind <> 'practice' then
    raise exception '[INV-04][INV-30] append_practice_event may target only a practice session.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || p_session_id::text, 0));
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
   where session_id = p_session_id and game_id is null
     and idempotency_key = trim(p_idempotency_key);
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
    p_session_id, null, null, trim(p_idempotency_key), v_hash,
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
      v_event.id, p_session_id, null,
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

create function public.renew_practice_session(
  p_session_id uuid, p_lease_token text, p_lease_version int
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_session public.scorekeeping_sessions%rowtype;
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  select * into v_session from public.scorekeeping_sessions where id = p_session_id;
  if not found then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  if v_session.session_kind <> 'practice' then
    raise exception '[INV-04][INV-30] renew_practice_session may target only a practice session.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || p_session_id::text, 0));
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

create function public.resume_practice_session(p_session_id uuid, p_reason text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_session public.scorekeeping_sessions%rowtype;
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  select * into v_session from public.scorekeeping_sessions where id = p_session_id;
  if not found then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  if v_session.session_kind <> 'practice' then
    raise exception '[INV-04][INV-30] resume_practice_session may target only a practice session.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || p_session_id::text, 0));
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
  -- Unlike the official resume, no game_edit_history row is written: there is
  -- no game, and practice never produces official audit output.
  return jsonb_build_object('session_id', v_session.id, 'lease_token', v_token, 'lease_version', v_session.lease_version,
    'lease_expires_at', v_session.lease_expires_at, 'session_kind', v_session.session_kind);
end;
$$;

create function public.cancel_practice_session(
  p_session_id uuid, p_lease_token text, p_lease_version int, p_reason text
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_session public.scorekeeping_sessions%rowtype;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_reason)), 0) = 0 then raise exception '[INV-25] Canceling a scorekeeping session requires a reason.'; end if;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id;
  if not found then raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id; end if;
  if v_session.session_kind <> 'practice' then
    raise exception '[INV-04][INV-30] cancel_practice_session may target only a practice session.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || p_session_id::text, 0));
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  update public.scorekeeping_sessions set status = 'canceled', closed_by = auth.uid(), closed_at = clock_timestamp(),
    lease_version = lease_version + 1, lease_expires_at = clock_timestamp()
  where id = p_session_id;
  -- No games update and no game_edit_history row: practice has no game and
  -- produces no official audit output. The reason is still required for
  -- operator-intent parity with the official cancel (the official path stores
  -- it in game_edit_history, which practice must never write).
end;
$$;

create function public.finalize_practice_session(
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
  v_session public.scorekeeping_sessions%rowtype;
  v_projection jsonb;
  v_hash text;
  v_result jsonb;
  v_latest_overtime_period int;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_idempotency_key)), 0) = 0 then
    raise exception '[INV-15] Finalization idempotency key is required.';
  end if;
  select * into v_session from public.scorekeeping_sessions where id = p_session_id;
  if not found then
    raise exception '[INV-20] Unknown scorekeeping session %.', p_session_id;
  end if;
  if v_session.session_kind <> 'practice' then
    raise exception '[INV-04][INV-30] finalize_practice_session may target only a practice session.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || p_session_id::text, 0));
  select * into v_session from public.scorekeeping_sessions where id = p_session_id for update;

  v_hash := encode(digest(jsonb_build_object(
    'session_id', p_session_id,
    'override_reason', nullif(trim(coalesce(p_override_reason, '')), '')
  )::text, 'sha256'), 'hex');
  -- Finalization is idempotent through the session-stored finalization key,
  -- exactly like the official path: after finalization the same key and
  -- command return the same terminal result and a different command raises.
  if v_session.status = 'finalized' then
    if v_session.finalization_idempotency_key = trim(p_idempotency_key)
       and v_session.finalization_command_hash = v_hash then
      return v_session.finalization_result;
    end if;
    raise exception '[INV-15] Finalized practice session cannot be replayed with a different command.';
  end if;
  perform public.cvf_assert_ledger_lease(v_session, p_lease_token, p_lease_version);

  -- cvf_build_ledger_projection is session-chain scoped and never joins
  -- public.games, so it is practice-safe as-is (verified against the 5A
  -- definition). The same overtime completion rules produce the same PREVIEW
  -- verdicts as official finalization.
  v_projection := public.cvf_build_ledger_projection(p_session_id);
  v_latest_overtime_period := (v_projection ->> 'latest_overtime_period')::int;

  if not (v_projection ->> 'finalizable')::boolean then
    return jsonb_build_object(
      'ok', true,
      'status', 'overtime_period_open',
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

  v_result := jsonb_build_object(
    'ok', true,
    'status', 'practice_finalized',
    'session_id', p_session_id,
    'home_score', v_projection -> 'home_score',
    'away_score', v_projection -> 'away_score',
    'warnings', v_projection -> 'warnings',
    'overridden', jsonb_array_length(v_projection -> 'warnings') > 0,
    'projection', v_projection
  );
  -- The ONLY write: close the private session. Nothing is written to games,
  -- player_stats, game_edit_history, or any playoff table, and no exception
  -- handler writes failure audit — a failed practice finalization simply
  -- rolls back with no official trace.
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
  return v_result;
end;
$$;

create function public.start_practice_correction(p_base_session_id uuid, p_reason text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_base public.scorekeeping_sessions%rowtype;
  v_session public.scorekeeping_sessions%rowtype;
  v_session_id uuid := gen_random_uuid();
  v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  perform public.assert_admin();
  if coalesce(length(trim(p_reason)), 0) = 0 then raise exception '[INV-24] A correction reason is required.'; end if;
  select * into v_base from public.scorekeeping_sessions where id = p_base_session_id;
  if not found then raise exception '[INV-20] Unknown scorekeeping session %.', p_base_session_id; end if;
  if v_base.session_kind <> 'practice' or v_base.game_id is not null then
    raise exception '[INV-04][INV-30] start_practice_correction may target only a practice session.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cvf-scorekeeping-practice:' || p_base_session_id::text, 0));
  select * into v_base from public.scorekeeping_sessions where id = p_base_session_id for update;
  if v_base.status <> 'finalized' then
    raise exception '[INV-24] A practice correction requires a finalized practice base session.';
  end if;
  -- Practice chains are rehearsal-only: unlike the official path there is no
  -- one-active-session-per-game slot to contend for. Divergent forks that
  -- void the same base event are still impossible — the global one-void-per-
  -- event unique index holds across all sessions.
  perform set_config('cvf.ledger_session_mutation', 'on', true);
  insert into public.scorekeeping_sessions (
    id, game_id, session_kind, status, base_session_id, correction_reason, opened_by,
    lease_token_hash, lease_expires_at, sport, league_id, season, stage, home_team_id, away_team_id, rule_version,
    regulation_period_count, overtime_start_setting, allow_ties, rules_snapshot
  ) values (
    v_session_id, null, 'practice', 'open', v_base.id, trim(p_reason), auth.uid(),
    public.cvf_ledger_token_hash(v_token), clock_timestamp() + interval '10 minutes',
    v_base.sport, v_base.league_id, v_base.season, v_base.stage,
    v_base.home_team_id, v_base.away_team_id, v_base.rule_version, v_base.regulation_period_count,
    v_base.overtime_start_setting, v_base.allow_ties, v_base.rules_snapshot
  ) returning * into v_session;
  insert into public.scorekeeping_participants (session_id, game_id, source_participant_id, profile_id, team_id, season, display_name, position, roster_status)
  select v_session.id, null, prior.id, prior.profile_id, prior.team_id, prior.season, prior.display_name, prior.position, prior.roster_status
    from public.scorekeeping_participants prior where prior.session_id = v_base.id;
  return jsonb_build_object('session_id', v_session.id, 'base_session_id', v_base.id, 'lease_token', v_token,
    'lease_version', v_session.lease_version, 'lease_expires_at', v_session.lease_expires_at,
    'session_kind', 'practice', 'practice_correction', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RLS readback: the four private tables' policies are admin-keyed
--    ((select public.is_admin())) with no game_id predicate, so NULL-game
--    practice rows are already admin-visible and client-immutable. No policy
--    change is required.
--
-- 9. Privilege footprint, matching the official RPC pattern.
-- ---------------------------------------------------------------------------
revoke execute on function public.start_practice_session(uuid, uuid, text, int, text, jsonb)
  from public, anon, service_role;
revoke execute on function public.append_practice_event(
  uuid, text, int, text, text, text, text, int, uuid, int, uuid, uuid, jsonb, jsonb, text
) from public, anon, service_role;
revoke execute on function public.renew_practice_session(uuid, text, int)
  from public, anon, service_role;
revoke execute on function public.resume_practice_session(uuid, text)
  from public, anon, service_role;
revoke execute on function public.cancel_practice_session(uuid, text, int, text)
  from public, anon, service_role;
revoke execute on function public.finalize_practice_session(uuid, text, int, text, text)
  from public, anon, service_role;
revoke execute on function public.start_practice_correction(uuid, text)
  from public, anon, service_role;

grant execute on function public.start_practice_session(uuid, uuid, text, int, text, jsonb) to authenticated;
grant execute on function public.append_practice_event(
  uuid, text, int, text, text, text, text, int, uuid, int, uuid, uuid, jsonb, jsonb, text
) to authenticated;
grant execute on function public.renew_practice_session(uuid, text, int) to authenticated;
grant execute on function public.resume_practice_session(uuid, text) to authenticated;
grant execute on function public.cancel_practice_session(uuid, text, int, text) to authenticated;
grant execute on function public.finalize_practice_session(uuid, text, int, text, text) to authenticated;
grant execute on function public.start_practice_correction(uuid, text) to authenticated;
