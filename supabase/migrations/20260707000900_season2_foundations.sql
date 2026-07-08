-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 9
-- Season-2 structural foundations, landed BEFORE wiring locks in (approved
-- audit, 2026-07-07). Six pieces:
--
--   A. seasons        — the season anchor. Natural TEXT key ('Summer 2026'):
--                       every existing season column becomes a real FK with
--                       ZERO changes to frontend reads, seed shape, or the
--                       stamping RPCs. Renaming a season cascades.
--   B. games.stage    — 'regular' | 'playoff' | 'tournament'. Playoff games
--                       are their own record set (WHERE stage = 'playoff')
--                       while still counting toward season totals (stats rows
--                       are stage-agnostic). Standings = regular only —
--                       enforced in the views/selectors, defined here.
--   C. leagues.kind   — tournament-as-container. A standalone tournament is a
--                       leagues row with kind='tournament' and its own team
--                       shells (consistent with per-season shells), avoiding
--                       nullable games.league_id surgery forever.
--                       + leagues.playoff_format (varies per season, not fixed).
--   D. teams.division — named in the duplicate-season copy spec.
--   E. charges + payment_entries — registration payments as a LEDGER:
--                       balance is derived (sum of entries vs. amount due),
--                       never stored, so partial/installment payments and
--                       future in-app enforcement need no restructure.
--                       Exactly one of profile_id / team_id per charge
--                       (approved: the populated FK IS the charge type).
--   F. hof_entries    — admin-curated Hall of Fame, one table for game /
--                       player / record entries. Publicly INVISIBLE at the
--                       RLS level until league_settings.hof_published flips.
--
-- Deliberately deferred (additive later): duplicate_season RPC, bracket/round
-- metadata, season-aware frontend selectors, Leaders/HOF nav split.
-- ============================================================================

-- ============================================================================
-- A. seasons
-- ============================================================================
create table public.seasons (
  name        text primary key,             -- the string already stamped everywhere
  status      text not null default 'active'
              check (status in ('upcoming', 'active', 'completed', 'archived')),
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger seasons_updated_at
  before update on public.seasons
  for each row execute procedure extensions.moddatetime (updated_at);

alter table public.seasons enable row level security;

create policy seasons_public_read on public.seasons
  for select to anon, authenticated using (true);
create policy seasons_admin_write on public.seasons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Deleting a referenced season is blocked by the FKs below (NO ACTION).

-- Season 1 row must exist before the FKs land (league_settings already
-- carries 'Summer 2026' from migration 7).
insert into public.seasons (name, status) values ('Summer 2026', 'active');

-- Anchor every existing season column. ON UPDATE CASCADE: renaming a season
-- in one place renames it everywhere, atomically.
alter table public.leagues
  add constraint leagues_season_fkey
  foreign key (season) references public.seasons (name) on update cascade;

alter table public.team_players
  add constraint team_players_season_fkey
  foreign key (season) references public.seasons (name) on update cascade;

alter table public.league_settings
  add constraint league_settings_season_fkey
  foreign key (current_season) references public.seasons (name) on update cascade;

-- ============================================================================
-- B. games.stage
-- ============================================================================
-- Default keeps every existing row and every existing write path valid; the
-- linkage/score RPCs are stage-agnostic by design.
alter table public.games
  add column stage text not null default 'regular'
  check (stage in ('regular', 'playoff', 'tournament'));

-- ============================================================================
-- C. leagues.kind + playoff_format
-- ============================================================================
-- kind='tournament' models a standalone event. Its season stays NOT NULL —
-- for a tournament the season string is a time label, not membership in the
-- league season; nothing mixes because its games carry stage='tournament'.
alter table public.leagues
  add column kind text not null default 'league'
  check (kind in ('league', 'tournament'));

-- Per-container playoff format; NULL until the format is chosen.
alter table public.leagues
  add column playoff_format text
  check (playoff_format in ('single_elim', 'double_elim', 'round_robin'));

-- Consistency guard grows two stage rules (replaces migration 4's function;
-- same body plus the stage block, trigger recreated to also fire on stage):
--   * tournament containers hold only stage='tournament' games
--   * league containers hold 'regular'/'playoff' games
create or replace function public.enforce_game_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_league public.leagues%rowtype;
begin
  select * into v_league from public.leagues where id = new.league_id;
  if not found then
    raise exception 'Unknown league %', new.league_id;
  end if;
  if new.sport is distinct from v_league.sport then
    raise exception 'Game sport (%) must match league sport (%)', new.sport, v_league.sport;
  end if;
  if not exists (select 1 from public.teams t
                 where t.id = new.home_team_id and t.league_id = new.league_id) then
    raise exception 'Home team is not in this league';
  end if;
  if not exists (select 1 from public.teams t
                 where t.id = new.away_team_id and t.league_id = new.league_id) then
    raise exception 'Away team is not in this league';
  end if;
  if v_league.kind = 'tournament' and new.stage <> 'tournament' then
    raise exception 'Games in a standalone tournament must have stage=tournament.';
  end if;
  if v_league.kind = 'league' and new.stage = 'tournament' then
    raise exception 'stage=tournament is reserved for standalone tournament containers; use playoff.';
  end if;
  return new;
end;
$$;

drop trigger games_consistency on public.games;
create trigger games_consistency
  before insert or update of league_id, sport, home_team_id, away_team_id, stage on public.games
  for each row execute procedure public.enforce_game_consistency();

-- The lock guard grows stage: reclassifying a FINAL game's record set is
-- exactly the kind of silent history edit the lock exists to prevent.
-- (Replaces migration 4's function; same body plus the stage line.)
create or replace function public.enforce_game_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.locked
     and coalesce(current_setting('cvf.bypass_lock', true), '') <> 'on' then
    if (new.home_score   is distinct from old.home_score)
    or (new.away_score   is distinct from old.away_score)
    or (new.periods      is distinct from old.periods)
    or (new.score_status is distinct from old.score_status)
    or (new.status       is distinct from old.status)
    or (new.stage        is distinct from old.stage)
    or (new.locked       is distinct from old.locked) then
      raise exception 'Game % is final and locked. Unlock it (with a reason) before editing.', old.id;
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- D. teams.division
-- ============================================================================
alter table public.teams
  add column division text;      -- display label; copied by duplicate_season (later RPC)

-- ============================================================================
-- E. charges + payment_entries — the payments ledger
-- ============================================================================
-- charges: what is OWED. Exactly one of profile_id (free-agent registration)
-- or team_id (team registration) — the populated FK is the charge type.
-- Season-scoped: payments never carry over (locked decision).
create table public.charges (
  id                uuid primary key default gen_random_uuid(),
  season            text not null references public.seasons (name) on update cascade,
  kind              text not null default 'league_registration'
                    check (kind in ('league_registration', 'equipment', 'other')),
  profile_id        uuid references public.profiles (id) on delete restrict,
  team_id           uuid references public.teams (id) on delete restrict,
  amount_due_cents  int not null check (amount_due_cents >= 0),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (num_nonnulls(profile_id, team_id) = 1)
);

create trigger charges_updated_at
  before update on public.charges
  for each row execute procedure extensions.moddatetime (updated_at);

-- payment_entries: what was RECEIVED, one row per payment against a charge.
-- Balance / paid-in-full are DERIVED (amount_due - sum(entries)), never
-- stored. Overpayment is allowed (a credit). Not enforced in-app yet —
-- future enforcement is a derived flag, no restructure (locked decision).
create table public.payment_entries (
  id            uuid primary key default gen_random_uuid(),
  charge_id     uuid not null references public.charges (id) on delete restrict,
  amount_cents  int not null check (amount_cents > 0),
  method        text,                -- 'cash' | 'venmo' | ... admin-entered, free text
  paid_at       timestamptz not null default now(),
  note          text,
  recorded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- RLS: payment data is PII-adjacent — admin-only in full, like profiles.
-- Manual bookkeeping, not a legal record: admin may correct/delete entries
-- (unlike waivers). Deleting a charge with entries is blocked by the FK.
alter table public.charges enable row level security;
alter table public.payment_entries enable row level security;

create policy charges_admin_all on public.charges
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy payment_entries_admin_all on public.payment_entries
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- F. hof_entries + the publish gate
-- ============================================================================
-- Admin-curated, never auto-generated. One table for all entry types
-- (hof_games / hof_players are just filtered reads of it):
--   'game'   — an inducted game (game_id required)
--   'player' — an inducted player (profile_id required)
--   'record' — a curated record at game/season/career scope (record_scope
--              required; game/profile/team FKs optional context)
-- stat_key/stat_value are a curated SNAPSHOT (display strings), deliberately
-- not live-derived — records say what the admin inscribed, and don't drift
-- if underlying stats are later corrected.
create table public.hof_entries (
  id             uuid primary key default gen_random_uuid(),
  entry_type     text not null check (entry_type in ('game', 'player', 'record')),
  game_id        uuid references public.games (id) on delete restrict,
  profile_id     uuid references public.profiles (id) on delete restrict,
  team_id        uuid references public.teams (id) on delete restrict,
  sport          text check (sport in ('kickball', 'flag_football')),
  season         text references public.seasons (name) on update cascade,
  record_scope   text check (record_scope in ('game', 'season', 'career')),
  title          text not null,
  blurb          text,
  stat_key       text,
  stat_value     text,
  display_order  int not null default 0,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (
       (entry_type = 'game'   and game_id    is not null)
    or (entry_type = 'player' and profile_id is not null)
    or (entry_type = 'record')
  ),
  check ((entry_type = 'record') = (record_scope is not null))
);

create trigger hof_entries_updated_at
  before update on public.hof_entries
  for each row execute procedure extensions.moddatetime (updated_at);

-- The gate: a real flag on the settings singleton, not an empty state.
alter table public.league_settings
  add column hof_published boolean not null default false;

-- RLS: the public cannot see that the Hall of Fame EXISTS until the admin
-- flips hof_published — the gate lives in the policy itself, database-level.
-- Curated content only (titles/blurbs); no PII. Player names resolve through
-- public_profiles as everywhere else.
alter table public.hof_entries enable row level security;

create policy hof_entries_public_read on public.hof_entries
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.league_settings s
               where s.id = 1 and s.hof_published)
  );

create policy hof_entries_admin_write on public.hof_entries
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
