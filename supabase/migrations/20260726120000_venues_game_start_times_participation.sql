-- ============================================================================
-- CVF Leagues — migration 28
-- venues, authoritative game start times, and participation records.
--
-- Three related changes to the games surface, batched deliberately: each one
-- alone would pay the same fixed cost (RLS, explicit Data API grants, foreign
-- key covering indexes, authorization-matrix expansion).
--
--   1. venues — games are played somewhere real. `games.location` was free
--      text, so the same field was spelled several ways and could never carry
--      an address or map coordinates.
--
--   2. starts_at — `games.date` (a date) plus `games.time` (a DISPLAY STRING
--      such as '6:30 PM') could not be ordered within a day, could not produce
--      a calendar invite, and carried no time zone. The original migration
--      called this "known debt"; this is the full cutover, not a second copy.
--      Both legacy columns are dropped here.
--
--   3. game_participation — a player who appeared and recorded nothing still
--      played. Statistics rows were therefore never valid evidence of games
--      played, which made every per-game average uncomputable.
--
-- DELIBERATE BOUNDARY: participation is NOT part of the score lifecycle. It is
-- never written by the scoring RPCs, is not governed by the game lock, and has
-- no interaction with Migrations 23-27's aggregate/ledger correction
-- authority. Attendance is not a score projection, and treating it as one would
-- drag it inside the ledger finalization boundary for no benefit.
-- ============================================================================

-- --------------------------------- venues ----------------------------------
create table public.venues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  address      text,
  field_label  text,
  latitude     numeric(9, 6) check (latitude between -90 and 90),
  longitude    numeric(9, 6) check (longitude between -180 and 180),
  notes        text,
  -- Venues are referenced by historical games, so they retire rather than
  -- delete. There is no delete policy for anyone.
  status       text not null default 'active' check (status in ('active', 'retired')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A venue is identified by its name plus which field within it, and a null
-- field label must collide with other null field labels.
create unique index venues_name_field_key
  on public.venues (name, coalesce(field_label, ''));

create trigger venues_updated_at
  before update on public.venues
  for each row execute procedure extensions.moddatetime (updated_at);

alter table public.venues enable row level security;

-- Where a game is played is public information — the same reason scoreboards
-- are anonymously readable.
create policy venues_public_select on public.venues
  for select to anon, authenticated using (true);

create policy venues_admin_insert on public.venues
  for insert to authenticated with check (public.is_admin());

create policy venues_admin_update on public.venues
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke delete on table public.venues from anon, authenticated;

-- New objects are private by default (migration 11); grant deliberately.
grant select on table public.venues to anon, authenticated;
grant insert, update on table public.venues to authenticated;

-- ------------------------- games: venue + start time -----------------------
alter table public.games
  add column venue_id  uuid references public.venues (id) on delete restrict,
  add column starts_at timestamptz;

-- Fail loudly and completely BEFORE mutating anything if any legacy time
-- string cannot be parsed. A silent fallback here would write a wrong kickoff
-- time into a real schedule.
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s (%s %s)', id, "date", "time"), ', ')
    into v_bad
  from public.games
  where pg_input_is_valid(("date"::text || ' ' || "time"), 'timestamp') is false;

  if v_bad is not null then
    raise exception 'Cannot parse legacy game start times for: %', v_bad;
  end if;
end;
$$;

-- Backfill venues from the distinct free-text locations already in use. The
-- whole string becomes the venue name; splitting "Park, Field 2" into name and
-- field label is an admin curation step, not a guess this migration should make.
insert into public.venues (name)
select distinct trim("location")
from public.games
where length(trim("location")) > 0
on conflict do nothing;

-- Any game with a blank location still needs a venue to point at.
insert into public.venues (name)
select 'Unspecified'
where exists (select 1 from public.games where length(trim("location")) = 0)
on conflict do nothing;

update public.games g
   set venue_id = v.id
  from public.venues v
 where v.field_label is null
   and v.name = case when length(trim(g."location")) > 0
                     then trim(g."location")
                     else 'Unspecified' end;

-- The league is in Albuquerque; legacy rows carry no zone of their own, so the
-- backfill states the intended one explicitly rather than inheriting whatever
-- the running session happens to be set to. New rows arrive as a full
-- timestamptz from the client and never take this path.
update public.games
   set starts_at = (("date"::text || ' ' || "time")::timestamp at time zone 'America/Denver');

alter table public.games
  alter column starts_at set not null,
  alter column venue_id  set not null;

-- The cutover. Two sources of truth for when a game happens is exactly the
-- drift this migration exists to remove.
alter table public.games
  drop column "date",
  drop column "time",
  drop column "location";

-- CRITICAL: migration 23 pinned an explicit COLUMN-LEVEL allowlist on games so
-- authenticated clients can edit schedule fields but can never reach score,
-- stat, or history fields (INV-04, INV-38). That allowlist named date, time,
-- and location by column. Dropping them silently narrows the grant, and the two
-- replacement columns were never in it, so the allowlist is reissued here with
-- exactly the same boundary — schedule columns only, score columns still
-- unreachable except through the scoring RPCs.
revoke insert, update, delete on table public.games from authenticated;
grant insert (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id, temp_admin_id, stage)
  on table public.games to authenticated;
grant update (league_id, sport, home_team_id, away_team_id, starts_at, venue_id, temp_admin_id, stage)
  on table public.games to authenticated;

-- Foreign keys require covering indexes (migration 12's standing rule).
create index games_venue_id_idx on public.games (venue_id);
-- Schedules are read in start order far more than any other way.
create index games_starts_at_idx on public.games (starts_at);

-- --------------------------- game_participation ----------------------------
create table public.game_participation (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete restrict,
  team_id      uuid not null references public.teams (id) on delete restrict,
  status       text not null default 'played'
               check (status in ('played', 'absent', 'excused')),
  -- 'stats' marks a row inferred from an existing statistics row rather than
  -- recorded directly, so a later correction can tell the two apart.
  source       text not null default 'admin' check (source in ('admin', 'stats')),
  recorded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (game_id, profile_id)
);

create trigger game_participation_updated_at
  before update on public.game_participation
  for each row execute procedure extensions.moddatetime (updated_at);

-- A participation row must name one of the two teams actually playing.
create or replace function public.enforce_participation_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_home uuid;
  v_away uuid;
begin
  select home_team_id, away_team_id into v_home, v_away
  from public.games where id = new.game_id;
  if not found then
    raise exception 'Unknown game %', new.game_id;
  end if;
  if new.team_id is distinct from v_home and new.team_id is distinct from v_away then
    raise exception 'Team % is not playing in game %', new.team_id, new.game_id;
  end if;
  return new;
end;
$$;

create trigger game_participation_consistency
  before insert or update of game_id, team_id on public.game_participation
  for each row execute procedure public.enforce_participation_consistency();

alter table public.game_participation enable row level security;

-- Who played is box-score information, and box scores are public.
create policy game_participation_public_select on public.game_participation
  for select to anon, authenticated using (true);

create policy game_participation_admin_insert on public.game_participation
  for insert to authenticated with check (public.is_admin());

create policy game_participation_admin_update on public.game_participation
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Attendance is operational, not an audit trail: a mistaken row is corrected
-- by removing it, unlike waivers or edit history.
create policy game_participation_admin_delete on public.game_participation
  for delete to authenticated using (public.is_admin());

grant select on table public.game_participation to anon, authenticated;
grant insert, update, delete on table public.game_participation to authenticated;

-- The unique (game_id, profile_id) constraint already provides the covering
-- index for the game_id foreign key; the rest need their own.
create index game_participation_profile_id_idx  on public.game_participation (profile_id);
create index game_participation_team_id_idx     on public.game_participation (team_id);
create index game_participation_recorded_by_idx on public.game_participation (recorded_by);

-- Replace a game's entire participation set in one statement.
--
-- This function deliberately does NOT consult games.locked. A locked game has a
-- final, immutable SCORE; who turned up is a separate operational fact that an
-- administrator must still be able to correct afterwards. It writes no score,
-- stat, or history row, so it cannot become a second correction authority.
create or replace function public.set_game_participation(
  p_game_id uuid,
  p_entries jsonb
)
returns int
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform public.assert_admin();

  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'Unknown game %', p_game_id;
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Participation entries must be a JSON array.';
  end if;

  delete from public.game_participation where game_id = p_game_id;

  insert into public.game_participation (game_id, profile_id, team_id, status, source, recorded_by)
  select
    p_game_id,
    (entry ->> 'profile_id')::uuid,
    (entry ->> 'team_id')::uuid,
    coalesce(entry ->> 'status', 'played'),
    coalesce(entry ->> 'source', 'admin'),
    auth.uid()
  from jsonb_array_elements(p_entries) as entry;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.set_game_participation(uuid, jsonb) from public, anon;
grant execute on function public.set_game_participation(uuid, jsonb) to authenticated;

-- ------------------- playoff scheduling on the new shape -------------------
-- The old signature took a date, a display-string time, and free text. All
-- three are gone, so the function is replaced rather than overloaded — an
-- overload would leave the legacy path callable.
drop function if exists public.schedule_playoff_match(uuid, date, text, text);

create or replace function public.schedule_playoff_match(
  p_match_id  uuid,
  p_starts_at timestamptz,
  p_venue_id  uuid
)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_match  public.playoff_matches%rowtype;
  v_league public.leagues%rowtype;
  v_game_id uuid;
begin
  perform public.assert_admin();

  select * into v_match from public.playoff_matches where id = p_match_id for update;
  if not found then raise exception 'Unknown playoff match %', p_match_id; end if;
  if v_match.status <> 'ready' or v_match.home_team_id is null or v_match.away_team_id is null then
    raise exception 'Both participants must be known before scheduling.';
  end if;
  if v_match.game_id is not null then raise exception 'This playoff match is already scheduled.'; end if;
  if p_starts_at is null or p_venue_id is null then
    raise exception 'Start time and venue are required.';
  end if;
  if not exists (select 1 from public.venues where id = p_venue_id) then
    raise exception 'Unknown venue %', p_venue_id;
  end if;

  select l.* into v_league
  from public.playoff_brackets b join public.leagues l on l.id = b.league_id
  where b.id = v_match.bracket_id;

  insert into public.games
    (league_id, sport, home_team_id, away_team_id, starts_at, venue_id, stage)
  values
    (v_league.id, v_league.sport, v_match.home_team_id, v_match.away_team_id,
     p_starts_at, p_venue_id, 'playoff')
  returning id into v_game_id;

  update public.playoff_matches set game_id = v_game_id where id = p_match_id;
  return v_game_id;
end;
$$;

revoke execute on function public.schedule_playoff_match(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.schedule_playoff_match(uuid, timestamptz, uuid) to authenticated;
