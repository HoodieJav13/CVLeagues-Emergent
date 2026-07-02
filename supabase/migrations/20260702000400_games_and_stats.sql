-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 4/8
-- games, game_edit_history (append-only), player_stats, career_baselines.
--
-- Locked constraints made REAL here (not advisory):
--   * Dual status: games.status (game lifecycle) and games.score_status
--     (score lifecycle) are two parallel fields, intentionally separate.
--   * Game lock: a BEFORE UPDATE trigger rejects any change to score fields
--     while locked — EVEN BY THE ADMIN. The only way through is the
--     unlock_game RPC (migration 8), which requires a reason and writes the
--     history row in the same transaction, signalled via a transaction-local
--     setting ('cvf.bypass_lock').
--   * Edit history: its own append-only table, not a mutable jsonb array.
--     PostgREST aliasing (editHistory:game_edit_history(...)) keeps the
--     frontend key stable.
-- ============================================================================

-- -------------------------------- games ------------------------------------
create table public.games (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues (id) on delete restrict,
  sport         text not null check (sport in ('kickball', 'flag_football')),
  home_team_id  uuid not null references public.teams (id) on delete restrict,
  away_team_id  uuid not null references public.teams (id) on delete restrict,
  date          date not null,
  time          text not null,     -- display string ("6:30 PM"), matching seed; known debt
  location      text not null,
  status        text not null default 'upcoming'
                check (status in ('upcoming', 'completed', 'postponed', 'canceled')),
  score_status  text not null default 'pending'
                check (score_status in ('pending', 'submitted', 'approved', 'disputed', 'final')),
  home_score    int,               -- null until played, by design
  away_score    int,
  periods       jsonb not null default '{"home": [], "away": []}'::jsonb,
  temp_admin_id uuid references public.profiles (id) on delete set null,
  locked        boolean not null default false,
  submitted_by  uuid references auth.users (id) on delete set null,
  approved_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create trigger games_updated_at
  before update on public.games
  for each row execute procedure extensions.moddatetime (updated_at);

-- Consistency guard: game sport matches league; both teams belong to the league.
create or replace function public.enforce_game_consistency()
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
    raise exception 'Game sport (%) must match league sport (%)', new.sport, v_league_sport;
  end if;
  if not exists (select 1 from public.teams t
                 where t.id = new.home_team_id and t.league_id = new.league_id) then
    raise exception 'Home team is not in this league';
  end if;
  if not exists (select 1 from public.teams t
                 where t.id = new.away_team_id and t.league_id = new.league_id) then
    raise exception 'Away team is not in this league';
  end if;
  return new;
end;
$$;

create trigger games_consistency
  before insert or update of league_id, sport, home_team_id, away_team_id on public.games
  for each row execute procedure public.enforce_game_consistency();

-- THE LOCK. Binds every role, admin included; only the unlock/lock RPCs set
-- the transaction-local bypass. Locking a game (locked false -> true) passes
-- because the guard reads OLD.locked.
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
    or (new.locked       is distinct from old.locked) then
      raise exception 'Game % is final and locked. Unlock it (with a reason) before editing.', old.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger games_lock_enforcement
  before update on public.games
  for each row execute procedure public.enforce_game_lock();

-- -------------------------- game_edit_history ------------------------------
-- APPEND-ONLY audit log: every score save/edit, lock, unlock (with reason),
-- postpone/cancel. No update or delete, for anyone, ever.
create table public.game_edit_history (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete restrict,
  action      text not null,     -- 'Score saved' | 'Score edited' | 'Marked final' | 'Unlocked' | 'Game postponed' | ...
  reason      text,              -- required by the unlock_game RPC
  actor       uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ------------------------------ player_stats -------------------------------
-- One row per player per completed game. stats is a sport-specific jsonb map
-- (approved judgment call); keys are governed app-side by statsConfig.js.
create table public.player_stats (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete restrict,
  team_id     uuid not null references public.teams (id) on delete restrict,
  sport       text not null check (sport in ('kickball', 'flag_football')),
  stats       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (game_id, profile_id)
);
-- (game_id cascades: stats rows are meaningless without their game, and a
-- game with history rows can't be deleted anyway — RESTRICT above wins first.)

create trigger player_stats_updated_at
  before update on public.player_stats
  for each row execute procedure extensions.moddatetime (updated_at);

-- Stats of a locked game are locked too (insert/update/delete).
create or replace function public.enforce_stats_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_game_id uuid := coalesce(new.game_id, old.game_id);
  v_locked  boolean;
begin
  select locked into v_locked from public.games where id = v_game_id;
  if coalesce(v_locked, false)
     and coalesce(current_setting('cvf.bypass_lock', true), '') <> 'on' then
    raise exception 'Stats for game % are locked. Unlock the game first.', v_game_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger player_stats_lock_enforcement
  before insert or update or delete on public.player_stats
  for each row execute procedure public.enforce_stats_lock();

-- ---------------------------- career_baselines -----------------------------
-- Pre-Summer-2026 totals per profile per sport. Production seed ships EMPTY
-- (approved: demo baselines dropped); the table exists for real historical
-- imports if they ever happen.
create table public.career_baselines (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete restrict,
  sport       text not null check (sport in ('kickball', 'flag_football')),
  stats       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, sport)
);

create trigger career_baselines_updated_at
  before update on public.career_baselines
  for each row execute procedure extensions.moddatetime (updated_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.games enable row level security;
alter table public.game_edit_history enable row level security;
alter table public.player_stats enable row level security;
alter table public.career_baselines enable row level security;

-- games: world-readable; admin writes; delete only while nothing has happened
-- (pending score AND no history rows — the FK RESTRICT enforces the latter).
create policy games_public_read on public.games
  for select to anon, authenticated using (true);
create policy games_admin_insert on public.games
  for insert to authenticated with check (public.is_admin());
create policy games_admin_update on public.games
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy games_admin_delete on public.games
  for delete to authenticated
  using (public.is_admin() and score_status = 'pending');

-- game_edit_history: admin eyes only; append-only for everyone.
create policy geh_admin_read on public.game_edit_history
  for select to authenticated using (public.is_admin());
create policy geh_admin_insert on public.game_edit_history
  for insert to authenticated with check (public.is_admin());
revoke update, delete on table public.game_edit_history from anon, authenticated;

-- player_stats: the public product; admin writes (lock trigger still applies).
create policy player_stats_public_read on public.player_stats
  for select to anon, authenticated using (true);
create policy player_stats_admin_write on public.player_stats
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- career_baselines: public career leaderboards; admin maintains.
create policy career_baselines_public_read on public.career_baselines
  for select to anon, authenticated using (true);
create policy career_baselines_admin_write on public.career_baselines
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
