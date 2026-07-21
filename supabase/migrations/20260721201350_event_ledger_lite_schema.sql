-- Sequence 3: Event Ledger Lite schema.
--
-- This migration deliberately creates no client-facing mutation RPC and no
-- public live-score projection. It establishes the private, append-only
-- authority boundary that Sequence 4 will consume. Aggregate mode remains the
-- default and keeps the single correct_final_score correction authority.

-- ---------------------------------------------------------------------------
-- Explicit, one-way scorekeeping mode (INV-28, INV-29, INV-30).
-- ---------------------------------------------------------------------------
alter table public.games
  add column scorekeeping_mode text not null default 'aggregate'
    check (scorekeeping_mode in ('aggregate', 'ledger')),
  add column ledger_enabled_at timestamptz;

comment on column public.games.scorekeeping_mode is
  'Exactly one score authority: aggregate or ledger. Ledger conversion is one-way.';
comment on column public.games.ledger_enabled_at is
  'Server timestamp of the controlled aggregate-to-ledger conversion.';

-- Ledger sessions introduce a live state, but no existing RPC is granted a
-- path to set it. Sequence 4 will own the sanctioned transition.
alter table public.games drop constraint games_status_check;
alter table public.games
  add constraint games_status_check
  check (status in ('upcoming', 'live', 'completed', 'postponed', 'canceled'));

-- ---------------------------------------------------------------------------
-- Private rule/session and participant snapshots (INV-10..INV-12, INV-18..20).
-- ---------------------------------------------------------------------------
create table public.scorekeeping_sessions (
  id                         uuid primary key default gen_random_uuid(),
  game_id                    uuid not null references public.games (id) on delete restrict,
  session_kind               text not null
                             check (session_kind in ('ordinary', 'correction')),
  status                     text not null
                             check (status in ('open', 'drafting', 'finalized', 'canceled', 'failed')),
  base_session_id            uuid,
  correction_reason          text,
  opened_by                  uuid references auth.users (id) on delete set null,
  closed_by                  uuid references auth.users (id) on delete set null,
  lease_version              int not null default 1 check (lease_version > 0),
  lease_token_hash           text not null check (length(trim(lease_token_hash)) > 0),
  lease_expires_at           timestamptz not null,

  -- Immutable rule and game-identity snapshot.
  sport                      text not null check (sport in ('kickball', 'flag_football')),
  league_id                  uuid not null references public.leagues (id) on delete restrict,
  season                     text not null references public.seasons (name) on update restrict on delete restrict,
  stage                      text not null check (stage in ('regular', 'playoff', 'tournament')),
  home_team_id               uuid not null references public.teams (id) on delete restrict,
  away_team_id               uuid not null references public.teams (id) on delete restrict,
  rule_version               text not null check (length(trim(rule_version)) > 0),
  regulation_period_count    int not null check (regulation_period_count > 0),
  overtime_start_setting     text,
  allow_ties                 boolean not null,
  rules_snapshot             jsonb not null check (jsonb_typeof(rules_snapshot) = 'object'),

  created_at                 timestamptz not null default now(),
  closed_at                  timestamptz,

  unique (id, game_id),
  check (home_team_id <> away_team_id),
  check (
    (session_kind = 'ordinary'
      and status in ('open', 'finalized', 'canceled', 'failed')
      and base_session_id is null
      and correction_reason is null)
    or
    (session_kind = 'correction'
      and status in ('drafting', 'finalized', 'canceled', 'failed')
      and base_session_id is not null
      and length(trim(correction_reason)) > 0)
  ),
  check (
    (status in ('open', 'drafting') and closed_at is null)
    or (status in ('finalized', 'canceled', 'failed') and closed_at is not null)
  )
);

alter table public.scorekeeping_sessions
  add constraint scorekeeping_sessions_base_game_fkey
  foreign key (base_session_id, game_id)
  references public.scorekeeping_sessions (id, game_id)
  on delete restrict;

create unique index scorekeeping_sessions_one_active_game_idx
  on public.scorekeeping_sessions (game_id)
  where status in ('open', 'drafting');
create index scorekeeping_sessions_game_id_idx
  on public.scorekeeping_sessions (game_id);
create index scorekeeping_sessions_base_game_idx
  on public.scorekeeping_sessions (base_session_id, game_id)
  where base_session_id is not null;
create index scorekeeping_sessions_opened_by_idx
  on public.scorekeeping_sessions (opened_by)
  where opened_by is not null;
create index scorekeeping_sessions_closed_by_idx
  on public.scorekeeping_sessions (closed_by)
  where closed_by is not null;
create index scorekeeping_sessions_league_id_idx
  on public.scorekeeping_sessions (league_id);
create index scorekeeping_sessions_season_idx
  on public.scorekeeping_sessions (season);
create index scorekeeping_sessions_home_team_id_idx
  on public.scorekeeping_sessions (home_team_id);
create index scorekeeping_sessions_away_team_id_idx
  on public.scorekeeping_sessions (away_team_id);

create table public.scorekeeping_participants (
  id                         uuid primary key default gen_random_uuid(),
  session_id                 uuid not null,
  game_id                    uuid not null,
  source_team_player_id      uuid references public.team_players (id) on delete restrict,
  source_participant_id      uuid,
  profile_id                 uuid not null references public.profiles (id) on delete restrict,
  team_id                    uuid not null references public.teams (id) on delete restrict,
  season                     text not null references public.seasons (name) on update restrict on delete restrict,
  display_name               text not null,
  jersey_number              int,
  position                   text not null,
  roster_status              text not null,
  created_at                 timestamptz not null default now(),

  unique (id, session_id, game_id),
  unique (session_id, profile_id),
  unique (session_id, source_team_player_id),
  unique (session_id, source_participant_id),
  foreign key (session_id, game_id)
    references public.scorekeeping_sessions (id, game_id) on delete restrict,
  check (num_nonnulls(source_team_player_id, source_participant_id) = 1)
);

alter table public.scorekeeping_participants
  add constraint scorekeeping_participants_source_snapshot_fkey
  foreign key (source_participant_id)
  references public.scorekeeping_participants (id)
  on delete restrict;

create index scorekeeping_participants_game_id_idx
  on public.scorekeeping_participants (game_id);
create index scorekeeping_participants_session_game_idx
  on public.scorekeeping_participants (session_id, game_id);
create index scorekeeping_participants_source_team_player_id_idx
  on public.scorekeeping_participants (source_team_player_id)
  where source_team_player_id is not null;
create index scorekeeping_participants_source_participant_id_idx
  on public.scorekeeping_participants (source_participant_id)
  where source_participant_id is not null;
create index scorekeeping_participants_profile_id_idx
  on public.scorekeeping_participants (profile_id);
create index scorekeeping_participants_team_id_idx
  on public.scorekeeping_participants (team_id);
create index scorekeeping_participants_season_idx
  on public.scorekeeping_participants (season);

-- ---------------------------------------------------------------------------
-- Ordered, immutable events and player attributions (INV-13..INV-17).
-- ---------------------------------------------------------------------------
create table public.scorekeeping_events (
  id                         uuid primary key default gen_random_uuid(),
  session_id                 uuid not null,
  game_id                    uuid not null,
  sequence_number            int not null check (sequence_number > 0),
  idempotency_key            text not null check (length(trim(idempotency_key)) > 0),
  command_hash               text not null check (length(trim(command_hash)) > 0),
  action                     text not null check (action in ('record', 'void', 'replace')),
  event_type                 text not null check (length(trim(event_type)) > 0),
  period_type                text check (period_type in ('regulation', 'overtime')),
  period_number              int check (period_number > 0),
  credited_team_id           uuid references public.teams (id) on delete restrict,
  points                     int not null default 0 check (points >= 0),
  voids_event_id             uuid,
  replaces_event_id          uuid,
  payload                    jsonb not null default '{}'::jsonb
                             check (jsonb_typeof(payload) = 'object'),
  created_by                 uuid references auth.users (id) on delete set null,
  created_at                 timestamptz not null default now(),

  unique (id, session_id, game_id),
  unique (id, game_id),
  unique (game_id, sequence_number),
  unique (game_id, idempotency_key),
  foreign key (session_id, game_id)
    references public.scorekeeping_sessions (id, game_id) on delete restrict,
  foreign key (voids_event_id, game_id)
    references public.scorekeeping_events (id, game_id) on delete restrict,
  foreign key (replaces_event_id, game_id)
    references public.scorekeeping_events (id, game_id) on delete restrict,
  check (
    (action = 'record'
      and voids_event_id is null
      and replaces_event_id is null
      and event_type <> 'void'
      and period_type is not null
      and period_number is not null
      and credited_team_id is not null)
    or
    (action = 'void'
      and voids_event_id is not null
      and replaces_event_id is null
      and event_type = 'void'
      and period_type is null
      and period_number is null
      and credited_team_id is null
      and points = 0)
    or
    (action = 'replace'
      and voids_event_id is null
      and replaces_event_id is not null
      and event_type <> 'void'
      and period_type is not null
      and period_number is not null
      and credited_team_id is not null)
  )
);

create unique index scorekeeping_events_one_void_idx
  on public.scorekeeping_events (voids_event_id)
  where action = 'void';
create unique index scorekeeping_events_one_replacement_idx
  on public.scorekeeping_events (replaces_event_id)
  where action = 'replace';
create index scorekeeping_events_session_game_idx
  on public.scorekeeping_events (session_id, game_id);
create index scorekeeping_events_voids_game_idx
  on public.scorekeeping_events (voids_event_id, game_id)
  where voids_event_id is not null;
create index scorekeeping_events_replaces_game_idx
  on public.scorekeeping_events (replaces_event_id, game_id)
  where replaces_event_id is not null;
create index scorekeeping_events_credited_team_id_idx
  on public.scorekeeping_events (credited_team_id)
  where credited_team_id is not null;
create index scorekeeping_events_created_by_idx
  on public.scorekeeping_events (created_by)
  where created_by is not null;

create table public.scorekeeping_event_attributions (
  id                         uuid primary key default gen_random_uuid(),
  event_id                   uuid not null,
  session_id                 uuid not null,
  game_id                    uuid not null,
  participant_id             uuid not null,
  role                       text not null check (length(trim(role)) > 0),
  stat_key                   text not null check (length(trim(stat_key)) > 0),
  stat_delta                 int not null,
  created_by                 uuid references auth.users (id) on delete set null,
  created_at                 timestamptz not null default now(),

  unique (event_id, participant_id, role, stat_key),
  foreign key (event_id, session_id, game_id)
    references public.scorekeeping_events (id, session_id, game_id) on delete restrict,
  foreign key (participant_id, session_id, game_id)
    references public.scorekeeping_participants (id, session_id, game_id) on delete restrict
);

create index scorekeeping_event_attributions_event_session_game_idx
  on public.scorekeeping_event_attributions (event_id, session_id, game_id);
create index scorekeeping_event_attributions_session_id_idx
  on public.scorekeeping_event_attributions (session_id);
create index scorekeeping_event_attributions_game_id_idx
  on public.scorekeeping_event_attributions (game_id);
create index scorekeeping_event_attributions_participant_session_game_idx
  on public.scorekeeping_event_attributions (participant_id, session_id, game_id);
create index scorekeeping_event_attributions_created_by_idx
  on public.scorekeeping_event_attributions (created_by)
  where created_by is not null;

-- ---------------------------------------------------------------------------
-- Controlled state and snapshot guards.
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
    if current_user <> 'postgres'
       or coalesce(current_setting('cvf.ledger_session_mutation', true), '') <> 'on' then
      raise exception '[INV-04] Scorekeeping sessions may be created only by the controlled server path.';
    end if;
    if new.opened_by is null then
      raise exception '[INV-19] A scorekeeping session requires an opening actor.';
    end if;

    select * into v_game from public.games where id = new.game_id for update;
    if not found or v_game.scorekeeping_mode <> 'ledger' then
      raise exception '[INV-28] Scorekeeping sessions require a ledger-mode game.';
    end if;
    select * into v_league from public.leagues where id = v_game.league_id;

    if new.sport is distinct from v_game.sport
       or new.league_id is distinct from v_game.league_id
       or new.season is distinct from v_league.season
       or new.stage is distinct from v_game.stage
       or new.home_team_id is distinct from v_game.home_team_id
       or new.away_team_id is distinct from v_game.away_team_id then
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
      select * into v_base
        from public.scorekeeping_sessions
       where id = new.base_session_id and game_id = new.game_id;
      if not found or v_base.session_kind <> 'ordinary' or v_base.status <> 'finalized' then
        raise exception '[INV-24] A correction session requires the finalized ordinary session for the same game.';
      end if;
      if (new.sport, new.league_id, new.season, new.stage,
          new.home_team_id, new.away_team_id, new.rule_version,
          new.regulation_period_count, new.overtime_start_setting,
          new.allow_ties, new.rules_snapshot)
         is distinct from
         (v_base.sport, v_base.league_id, v_base.season, v_base.stage,
          v_base.home_team_id, v_base.away_team_id, v_base.rule_version,
          v_base.regulation_period_count, v_base.overtime_start_setting,
          v_base.allow_ties, v_base.rules_snapshot) then
        raise exception '[INV-10] Correction rules must exactly preserve the ordinary-session snapshot.';
      end if;
    end if;
    return new;
  end if;

  v_actor_null_only :=
    (to_jsonb(new) - array['opened_by', 'closed_by'])
      = (to_jsonb(old) - array['opened_by', 'closed_by'])
    and (new.opened_by is not distinct from old.opened_by
         or (old.opened_by is not null and new.opened_by is null))
    and (new.closed_by is not distinct from old.closed_by
         or (old.closed_by is not null and new.closed_by is null));
  if v_actor_null_only then
    return new;
  end if;

  if current_user <> 'postgres'
     or coalesce(current_setting('cvf.ledger_session_mutation', true), '') <> 'on' then
    raise exception '[INV-04] Scorekeeping session state may change only through the controlled server path.';
  end if;
  if (new.game_id, new.session_kind, new.base_session_id, new.correction_reason,
      new.opened_by, new.sport, new.league_id, new.season, new.stage,
      new.home_team_id, new.away_team_id, new.rule_version,
      new.regulation_period_count, new.overtime_start_setting,
      new.allow_ties, new.rules_snapshot, new.created_at)
     is distinct from
     (old.game_id, old.session_kind, old.base_session_id, old.correction_reason,
      old.opened_by, old.sport, old.league_id, old.season, old.stage,
      old.home_team_id, old.away_team_id, old.rule_version,
      old.regulation_period_count, old.overtime_start_setting,
      old.allow_ties, old.rules_snapshot, old.created_at) then
    raise exception '[INV-10] Session identity and rule snapshots are immutable.';
  end if;
  if new.lease_version <= old.lease_version then
    raise exception '[INV-20] Controlled session updates must advance the lease version.';
  end if;
  return new;
end;
$$;

create trigger scorekeeping_sessions_guard
  before insert or update on public.scorekeeping_sessions
  for each row execute procedure public.cvf_guard_scorekeeping_session();

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
  if v_session.session_kind = 'ordinary' then
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
       and game_id = v_session.game_id;
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

create trigger scorekeeping_participants_prepare
  before insert on public.scorekeeping_participants
  for each row execute procedure public.cvf_prepare_scorekeeping_participant();

create or replace function public.cvf_reject_scorekeeping_evidence_rewrite()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '[INV-12][INV-36] Scorekeeping evidence is append-only.';
  end if;
  if tg_table_name = 'scorekeeping_participants' then
    raise exception '[INV-12][INV-36] Scorekeeping evidence is append-only.';
  end if;
  if old.created_by is not null and new.created_by is null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;
  raise exception '[INV-12][INV-36] Scorekeeping evidence is append-only.';
end;
$$;

create trigger scorekeeping_participants_append_only
  before update or delete on public.scorekeeping_participants
  for each row execute procedure public.cvf_reject_scorekeeping_evidence_rewrite();
create trigger scorekeeping_events_append_only
  before update or delete on public.scorekeeping_events
  for each row execute procedure public.cvf_reject_scorekeeping_evidence_rewrite();
create trigger scorekeeping_event_attributions_append_only
  before update or delete on public.scorekeeping_event_attributions
  for each row execute procedure public.cvf_reject_scorekeeping_evidence_rewrite();

-- ---------------------------------------------------------------------------
-- Server sequence assignment and correction-chain integrity.
-- Lock order: advisory(game) -> games row -> sessions row.
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

  if new.action in ('record', 'replace')
     and new.credited_team_id not in (v_session.home_team_id, v_session.away_team_id) then
    raise exception '[INV-02] Credited team must be a snapshotted game team.';
  end if;
  if new.period_type = 'regulation'
     and new.period_number > v_session.regulation_period_count then
    raise exception '[INV-02][INV-10] Regulation period % exceeds the snapshotted count %.',
      new.period_number, v_session.regulation_period_count;
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

create trigger scorekeeping_events_prepare
  before insert on public.scorekeeping_events
  for each row execute procedure public.cvf_prepare_scorekeeping_event();

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
     and game_id = v_event.game_id;
  if not found then
    raise exception '[INV-11] Attribution participant is outside the event session snapshot.';
  end if;
  new.session_id := v_event.session_id;
  new.game_id := v_event.game_id;
  return new;
end;
$$;

create trigger scorekeeping_event_attributions_prepare
  before insert on public.scorekeeping_event_attributions
  for each row execute procedure public.cvf_prepare_scorekeeping_attribution();

-- ---------------------------------------------------------------------------
-- Mode-transition and single-authority projection guards.
-- ---------------------------------------------------------------------------
create or replace function public.cvf_guard_scorekeeping_mode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.scorekeeping_mode <> 'aggregate' or new.ledger_enabled_at is not null then
      raise exception '[INV-29] New games begin in aggregate mode.';
    end if;
    return new;
  end if;
  if new.scorekeeping_mode is not distinct from old.scorekeeping_mode then
    if new.ledger_enabled_at is distinct from old.ledger_enabled_at then
      raise exception '[INV-29] Ledger conversion evidence is immutable.';
    end if;
    return new;
  end if;
  if current_user <> 'postgres'
     or coalesce(current_setting('cvf.ledger_transition', true), '') <> 'on' then
    raise exception '[INV-29] Scorekeeping mode changes require the controlled server path.';
  end if;
  if old.scorekeeping_mode <> 'aggregate' or new.scorekeeping_mode <> 'ledger' then
    raise exception '[INV-29] Scorekeeping mode conversion is aggregate-to-ledger only.';
  end if;
  if old.status <> 'upcoming' or old.score_status <> 'pending' or old.locked
     or old.home_score is not null or old.away_score is not null
     or old.periods is distinct from '{"home": [], "away": []}'::jsonb
     or exists (select 1 from public.player_stats where game_id = old.id)
     or exists (select 1 from public.scorekeeping_sessions where game_id = old.id) then
    raise exception '[INV-29] Only an unscored, pending, unlocked game with no ledger session can convert.';
  end if;
  new.ledger_enabled_at := clock_timestamp();
  return new;
end;
$$;

create trigger games_scorekeeping_mode_guard
  before insert or update of scorekeeping_mode, ledger_enabled_at on public.games
  for each row execute procedure public.cvf_guard_scorekeeping_mode();

create or replace function public.cvf_guard_ledger_game_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.scorekeeping_mode = 'ledger'
     and exists (select 1 from public.scorekeeping_sessions where game_id = old.id) then
    raise exception '[INV-10] Ledger game identity is frozen after its first session snapshot.';
  end if;
  return new;
end;
$$;

create trigger games_ledger_identity_guard
  before update of league_id, sport, home_team_id, away_team_id, stage on public.games
  for each row execute procedure public.cvf_guard_ledger_game_identity();

-- Replace the existing aggregate lock functions with mode-aware versions.
-- Existing aggregate behavior is byte-for-byte equivalent; ledger projection
-- writes additionally require the future controlled projection flag.
create or replace function public.enforce_game_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_projection_change boolean;
begin
  v_projection_change :=
    (new.home_score is distinct from old.home_score)
    or (new.away_score is distinct from old.away_score)
    or (new.periods is distinct from old.periods)
    or (new.score_status is distinct from old.score_status)
    or (new.status is distinct from old.status)
    or (new.locked is distinct from old.locked);

  if (old.scorekeeping_mode = 'ledger' or new.scorekeeping_mode = 'ledger')
     and v_projection_change
     and (current_user <> 'postgres'
          or coalesce(current_setting('cvf.ledger_projection', true), '') <> 'on') then
    raise exception '[INV-30][INV-39] Ledger projections may change only through ledger finalization.';
  end if;
  if old.locked
     and coalesce(current_setting('cvf.bypass_lock', true), '') <> 'on' then
    if v_projection_change
       or (new.stage is distinct from old.stage) then
      raise exception 'Game % is final and locked. Use its single controlled correction authority.', old.id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_stats_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_game_id uuid := coalesce(new.game_id, old.game_id);
  v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = v_game_id;
  if v_game.scorekeeping_mode = 'ledger'
     and (current_user <> 'postgres'
          or coalesce(current_setting('cvf.ledger_projection', true), '') <> 'on') then
    raise exception '[INV-30][INV-39] Ledger player-stat projections may change only through ledger finalization.';
  end if;
  if coalesce(v_game.locked, false)
     and coalesce(current_setting('cvf.bypass_lock', true), '') <> 'on' then
    raise exception 'Stats for game % are locked. Use its controlled correction authority.', v_game_id;
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Private Data API boundary. Admins may inspect; no client role can mutate.
-- ---------------------------------------------------------------------------
alter table public.scorekeeping_sessions enable row level security;
alter table public.scorekeeping_participants enable row level security;
alter table public.scorekeeping_events enable row level security;
alter table public.scorekeeping_event_attributions enable row level security;

create policy scorekeeping_sessions_admin_read on public.scorekeeping_sessions
  for select to authenticated using ((select public.is_admin()));
create policy scorekeeping_participants_admin_read on public.scorekeeping_participants
  for select to authenticated using ((select public.is_admin()));
create policy scorekeeping_events_admin_read on public.scorekeeping_events
  for select to authenticated using ((select public.is_admin()));
create policy scorekeeping_event_attributions_admin_read on public.scorekeeping_event_attributions
  for select to authenticated using ((select public.is_admin()));

revoke all privileges on table
  public.scorekeeping_sessions,
  public.scorekeeping_participants,
  public.scorekeeping_events,
  public.scorekeeping_event_attributions
from public, anon, authenticated, service_role;

grant select on table
  public.scorekeeping_sessions,
  public.scorekeeping_participants,
  public.scorekeeping_events,
  public.scorekeeping_event_attributions
to authenticated;

revoke execute on function public.cvf_guard_scorekeeping_session()
  from public, anon, authenticated, service_role;
revoke execute on function public.cvf_prepare_scorekeeping_participant()
  from public, anon, authenticated, service_role;
revoke execute on function public.cvf_reject_scorekeeping_evidence_rewrite()
  from public, anon, authenticated, service_role;
revoke execute on function public.cvf_prepare_scorekeeping_event()
  from public, anon, authenticated, service_role;
revoke execute on function public.cvf_prepare_scorekeeping_attribution()
  from public, anon, authenticated, service_role;
revoke execute on function public.cvf_guard_scorekeeping_mode()
  from public, anon, authenticated, service_role;
revoke execute on function public.cvf_guard_ledger_game_identity()
  from public, anon, authenticated, service_role;

-- Reassert future-object defaults so this migration cannot widen the Data API
-- or the protected service-role boundary if deployed independently.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on functions from service_role;
alter default privileges for role postgres
  revoke execute on functions from public;
