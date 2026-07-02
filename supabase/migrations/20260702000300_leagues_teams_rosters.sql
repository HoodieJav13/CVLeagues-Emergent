-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 3/8
-- leagues, teams, team_players (rosters).
--
-- Design notes (approved):
--   * season is TEXT ("Summer 2026") for Season 1 — matches seed/settings and
--     every frontend read; a seasons table is a Season-2 migration if needed.
--     Season strings are auto-stamped from league_settings/league rows, never
--     free-typed.
--   * teams.sport is deliberately denormalized (frontend reads team.sport
--     everywhere) but trigger-enforced to equal the parent league's sport,
--     so it can never silently diverge.
--   * team_players soft-deletes via roster_status ('removed'), never row
--     deletion — "who was on this roster" stays answerable forever.
-- ============================================================================

-- ------------------------------- leagues -----------------------------------
create table public.leagues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  sport        text not null check (sport in ('kickball', 'flag_football')),
  season       text not null,
  description  text,
  status       text not null default 'active'
               check (status in ('draft', 'active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger leagues_updated_at
  before update on public.leagues
  for each row execute procedure extensions.moddatetime (updated_at);

-- -------------------------------- teams ------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues (id) on delete restrict,
  name        text not null,
  sport       text not null check (sport in ('kickball', 'flag_football')),
  captain_id  uuid references public.profiles (id) on delete set null,
  logo_color  text not null,
  founded     text,          -- display year-string, matching seed
  status      text not null default 'active'
              check (status in ('draft', 'active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger teams_updated_at
  before update on public.teams
  for each row execute procedure extensions.moddatetime (updated_at);

-- Denormalization guard: a team's sport must equal its league's sport.
create or replace function public.enforce_team_sport()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_league_sport text;
begin
  select sport into v_league_sport from public.leagues where id = new.league_id;
  if v_league_sport is null then
    raise exception 'Unknown league %', new.league_id;
  end if;
  if new.sport is distinct from v_league_sport then
    raise exception 'Team sport (%) must match league sport (%)', new.sport, v_league_sport;
  end if;
  return new;
end;
$$;

create trigger teams_sport_consistency
  before insert or update of sport, league_id on public.teams
  for each row execute procedure public.enforce_team_sport();

-- ---------------------------- team_players ---------------------------------
-- Roster join. seed.js calls profile_id `playerId` and jersey_number `jersey`;
-- the schema uses the CLAUDE.md names (frontend rename sweep is approved).
create table public.team_players (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams (id) on delete restrict,
  profile_id     uuid not null references public.profiles (id) on delete restrict,
  season         text not null,     -- auto-stamped from the team's league on assignment
  jersey_number  int,
  "position"     text not null default '',
  -- CLAUDE.md roster lifecycle, introduced here for the first time.
  -- Purely informational: never gates anything in-app (locked decision).
  roster_status  text not null default 'pending_waiver'
                 check (roster_status in ('pending_waiver', 'eligible', 'inactive', 'removed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (team_id, profile_id, season)
);

create trigger team_players_updated_at
  before update on public.team_players
  for each row execute procedure extensions.moddatetime (updated_at);

-- ---------------------------------------------------------------------------
-- RLS
--   leagues / teams / team_players: public scoreboard data — world-readable.
--   Rosters expose jersey/position only; contact PII lives on profiles,
--   which is admin-only.
--   Writes: admin. team_players has NO delete for anyone (roster_status).
-- ---------------------------------------------------------------------------
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;

create policy leagues_public_read on public.leagues
  for select to anon, authenticated using (true);
create policy leagues_admin_write on public.leagues
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy teams_public_read on public.teams
  for select to anon, authenticated using (true);
create policy teams_admin_write on public.teams
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy team_players_public_read on public.team_players
  for select to anon, authenticated using (true);
create policy team_players_admin_insert on public.team_players
  for insert to authenticated with check (public.is_admin());
create policy team_players_admin_update on public.team_players
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- no delete policy — lifecycle via roster_status
revoke delete on table public.team_players from anon, authenticated;
