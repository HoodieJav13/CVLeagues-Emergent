-- Season 1 playoff brackets. Seeds are snapshotted so later standings edits do
-- not silently rewrite a published bracket. Matches are separate from games:
-- future-round participants may be unknown, while games always have two real
-- teams. A ready match is scheduled into games through an RPC.

create table public.playoff_brackets (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null unique references public.leagues (id) on delete restrict,
  status      text not null default 'active' check (status in ('active', 'complete')),
  bracket_size int not null check (bracket_size >= 4 and bracket_size <= 64),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger playoff_brackets_updated_at
  before update on public.playoff_brackets
  for each row execute procedure extensions.moddatetime (updated_at);

create table public.playoff_seeds (
  bracket_id uuid not null references public.playoff_brackets (id) on delete cascade,
  seed       int not null check (seed > 0),
  team_id    uuid not null references public.teams (id) on delete restrict,
  primary key (bracket_id, seed),
  unique (bracket_id, team_id)
);

create table public.playoff_matches (
  id                    uuid primary key default gen_random_uuid(),
  bracket_id            uuid not null references public.playoff_brackets (id) on delete cascade,
  round_number          int not null check (round_number > 0),
  match_number          int not null check (match_number > 0),
  label                 text not null,
  home_team_id          uuid references public.teams (id) on delete restrict,
  away_team_id          uuid references public.teams (id) on delete restrict,
  home_seed             int check (home_seed > 0),
  away_seed             int check (away_seed > 0),
  game_id               uuid unique references public.games (id) on delete set null,
  status                text not null default 'pending'
                        check (status in ('pending', 'ready', 'bye', 'completed')),
  winner_team_id        uuid references public.teams (id) on delete restrict,
  loser_team_id         uuid references public.teams (id) on delete restrict,
  winner_to_match_id    uuid,
  winner_to_slot        text check (winner_to_slot in ('home', 'away')),
  loser_to_match_id     uuid,
  loser_to_slot         text check (loser_to_slot in ('home', 'away')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (bracket_id, round_number, match_number),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  check ((winner_to_match_id is null) = (winner_to_slot is null)),
  check ((loser_to_match_id is null) = (loser_to_slot is null))
);

alter table public.playoff_matches
  add constraint playoff_matches_winner_to_match_fkey
    foreign key (winner_to_match_id) references public.playoff_matches (id),
  add constraint playoff_matches_loser_to_match_fkey
    foreign key (loser_to_match_id) references public.playoff_matches (id);

create trigger playoff_matches_updated_at
  before update on public.playoff_matches
  for each row execute procedure extensions.moddatetime (updated_at);

create or replace function public.enforce_playoff_match_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_league_id uuid;
  v_game public.games%rowtype;
begin
  select league_id into v_league_id from public.playoff_brackets where id = new.bracket_id;
  if v_league_id is null then raise exception 'Unknown playoff bracket %', new.bracket_id; end if;
  if (new.home_team_id is null) <> (new.home_seed is null)
     or (new.away_team_id is null) <> (new.away_seed is null) then
    raise exception 'Every playoff participant must have its snapshotted seed.';
  end if;
  if exists (
    select 1 from public.teams t
    where t.id in (new.home_team_id, new.away_team_id, new.winner_team_id, new.loser_team_id)
      and t.league_id <> v_league_id
  ) then raise exception 'Every playoff match team must belong to the bracket league.'; end if;
  if new.home_team_id is not null and not exists (
    select 1 from public.playoff_seeds s
    where s.bracket_id = new.bracket_id and s.team_id = new.home_team_id and s.seed = new.home_seed
  ) then raise exception 'Home participant and seed do not match the bracket snapshot.'; end if;
  if new.away_team_id is not null and not exists (
    select 1 from public.playoff_seeds s
    where s.bracket_id = new.bracket_id and s.team_id = new.away_team_id and s.seed = new.away_seed
  ) then raise exception 'Away participant and seed do not match the bracket snapshot.'; end if;
  if new.winner_team_id is not null
     and new.winner_team_id is distinct from new.home_team_id
     and new.winner_team_id is distinct from new.away_team_id then
    raise exception 'Winner must be one of the match participants.';
  end if;
  if new.loser_team_id is not null
     and new.loser_team_id is distinct from new.home_team_id
     and new.loser_team_id is distinct from new.away_team_id then
    raise exception 'Loser must be one of the match participants.';
  end if;
  if new.winner_team_id is not null and new.winner_team_id = new.loser_team_id then
    raise exception 'Winner and loser must be different teams.';
  end if;
  if new.status = 'pending' and (new.game_id is not null or new.winner_team_id is not null or new.loser_team_id is not null) then
    raise exception 'A pending match cannot have a game or result.';
  elsif new.status = 'ready' and (
    new.home_team_id is null or new.away_team_id is null
    or new.winner_team_id is not null or new.loser_team_id is not null
  ) then
    raise exception 'A ready match requires both participants and no result.';
  elsif new.status = 'bye' and not (
    new.game_id is null and new.loser_team_id is null
    and ((new.home_team_id is not null and new.away_team_id is null and new.winner_team_id = new.home_team_id)
      or (new.away_team_id is not null and new.home_team_id is null and new.winner_team_id = new.away_team_id))
  ) then
    raise exception 'A bye must advance its only participant without a game.';
  elsif new.status = 'completed' and (
    new.game_id is null or new.home_team_id is null or new.away_team_id is null
    or new.winner_team_id is null or new.loser_team_id is null
  ) then
    raise exception 'A completed match requires a game, both participants, and a result.';
  end if;
  if new.winner_to_match_id is not null and not exists (
    select 1 from public.playoff_matches m where m.id = new.winner_to_match_id and m.bracket_id = new.bracket_id
  ) then raise exception 'Winner destination must be in the same bracket.'; end if;
  if new.loser_to_match_id is not null and not exists (
    select 1 from public.playoff_matches m where m.id = new.loser_to_match_id and m.bracket_id = new.bracket_id
  ) then raise exception 'Loser destination must be in the same bracket.'; end if;
  if new.game_id is not null then
    select * into v_game from public.games where id = new.game_id;
    if v_game.league_id <> v_league_id or v_game.stage <> 'playoff' then
      raise exception 'Linked game must be a playoff game in the bracket league.';
    end if;
    if not (
      (v_game.home_team_id = new.home_team_id and v_game.away_team_id = new.away_team_id)
      or (v_game.home_team_id = new.away_team_id and v_game.away_team_id = new.home_team_id)
    ) then raise exception 'Linked game participants must match the bracket match.'; end if;
  end if;
  return new;
end;
$$;

create trigger playoff_matches_consistency
  before insert or update on public.playoff_matches
  for each row execute procedure public.enforce_playoff_match_consistency();

revoke execute on function public.enforce_playoff_match_consistency() from public, anon, authenticated;

create index playoff_brackets_league_id_idx on public.playoff_brackets (league_id);
create index playoff_seeds_team_id_idx on public.playoff_seeds (team_id);
create index playoff_matches_bracket_id_idx on public.playoff_matches (bracket_id);
create index playoff_matches_home_team_id_idx on public.playoff_matches (home_team_id);
create index playoff_matches_away_team_id_idx on public.playoff_matches (away_team_id);
create index playoff_matches_game_id_idx on public.playoff_matches (game_id);
create index playoff_matches_winner_team_id_idx on public.playoff_matches (winner_team_id);
create index playoff_matches_loser_team_id_idx on public.playoff_matches (loser_team_id);
create index playoff_matches_winner_to_match_id_idx on public.playoff_matches (winner_to_match_id);
create index playoff_matches_loser_to_match_id_idx on public.playoff_matches (loser_to_match_id);

alter table public.playoff_brackets enable row level security;
alter table public.playoff_seeds enable row level security;
alter table public.playoff_matches enable row level security;

create policy playoff_brackets_public_read on public.playoff_brackets
  for select to anon, authenticated using (true);
create policy playoff_brackets_admin_insert on public.playoff_brackets
  for insert to authenticated with check (public.is_admin());
create policy playoff_brackets_admin_update on public.playoff_brackets
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy playoff_brackets_admin_delete on public.playoff_brackets
  for delete to authenticated using (public.is_admin());
create policy playoff_seeds_public_read on public.playoff_seeds
  for select to anon, authenticated using (true);
create policy playoff_seeds_admin_insert on public.playoff_seeds
  for insert to authenticated with check (public.is_admin());
create policy playoff_seeds_admin_update on public.playoff_seeds
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy playoff_seeds_admin_delete on public.playoff_seeds
  for delete to authenticated using (public.is_admin());
create policy playoff_matches_public_read on public.playoff_matches
  for select to anon, authenticated using (true);
create policy playoff_matches_admin_insert on public.playoff_matches
  for insert to authenticated with check (public.is_admin());
create policy playoff_matches_admin_update on public.playoff_matches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy playoff_matches_admin_delete on public.playoff_matches
  for delete to authenticated using (public.is_admin());

grant select on table public.playoff_brackets, public.playoff_seeds, public.playoff_matches to anon;
grant select, insert, update, delete on table public.playoff_brackets, public.playoff_seeds, public.playoff_matches to authenticated;

create or replace function public.generate_single_elim_bracket(
  p_league_id uuid,
  p_seed_team_ids uuid[]
)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_league public.leagues%rowtype;
  v_bracket_id uuid;
  v_existing public.playoff_brackets%rowtype;
  v_team_count int := cardinality(p_seed_team_ids);
  v_size int := 1;
  v_rounds int := 0;
  v_round int;
  v_match_count int;
  v_match int;
  v_seed_order int[] := array[1, 2];
  v_new_order int[];
  v_current_size int := 2;
  v_seed int;
  v_home_seed int;
  v_away_seed int;
  v_home_team uuid;
  v_away_team uuid;
  v_label text;
  v_third_place_id uuid;
  v_row record;
begin
  perform public.assert_admin();

  select * into v_league from public.leagues where id = p_league_id for update;
  if not found then raise exception 'Unknown league %', p_league_id; end if;
  if v_league.kind <> 'league' or v_league.playoff_format <> 'single_elim' then
    raise exception 'Bracket generation requires a league with playoff_format=single_elim.';
  end if;
  if v_team_count < 4 then raise exception 'Single-elimination brackets require at least four teams.'; end if;
  if v_team_count <> (select count(*) from public.teams where league_id = p_league_id and status = 'active') then
    raise exception 'Every active league team must appear exactly once in the seed list.';
  end if;
  if v_team_count <> (select count(distinct team_id) from unnest(p_seed_team_ids) as seeded(team_id)) then
    raise exception 'Seed list contains a duplicate team.';
  end if;
  if exists (
    select 1 from unnest(p_seed_team_ids) as seeded(team_id)
    where not exists (
      select 1 from public.teams t
      where t.id = seeded.team_id and t.league_id = p_league_id and t.status = 'active'
    )
  ) then raise exception 'Seed list contains a team outside this league.'; end if;

  select * into v_existing from public.playoff_brackets where league_id = p_league_id;
  if found then
    if exists (select 1 from public.playoff_matches where bracket_id = v_existing.id and game_id is not null) then
      raise exception 'A bracket with scheduled games cannot be regenerated.';
    end if;
    delete from public.playoff_brackets where id = v_existing.id;
  end if;

  while v_size < v_team_count loop v_size := v_size * 2; end loop;
  while (1 << v_rounds) < v_size loop v_rounds := v_rounds + 1; end loop;

  insert into public.playoff_brackets (league_id, bracket_size)
  values (p_league_id, v_size)
  returning id into v_bracket_id;

  insert into public.playoff_seeds (bracket_id, seed, team_id)
  select v_bracket_id, ordinality::int, team_id
  from unnest(p_seed_team_ids) with ordinality as seeded(team_id, ordinality);

  while v_current_size < v_size loop
    v_new_order := array[]::int[];
    foreach v_seed in array v_seed_order loop
      v_new_order := v_new_order || v_seed || (v_current_size * 2 + 1 - v_seed);
    end loop;
    v_seed_order := v_new_order;
    v_current_size := v_current_size * 2;
  end loop;

  for v_round in 1..v_rounds loop
    v_match_count := v_size / (1 << v_round);
    for v_match in 1..v_match_count loop
      if v_round = 1 then
        v_home_seed := v_seed_order[(v_match * 2) - 1];
        v_away_seed := v_seed_order[v_match * 2];
        v_home_team := case when v_home_seed <= v_team_count then p_seed_team_ids[v_home_seed] end;
        v_away_team := case when v_away_seed <= v_team_count then p_seed_team_ids[v_away_seed] end;
      else
        v_home_seed := null; v_away_seed := null; v_home_team := null; v_away_team := null;
      end if;
      v_label := case
        when v_round = v_rounds then 'Championship'
        when v_round = v_rounds - 1 then 'Semifinal'
        when v_round = v_rounds - 2 then 'Quarterfinal'
        else 'Round of ' || (v_size / (1 << (v_round - 1)))::text
      end;
      insert into public.playoff_matches
        (bracket_id, round_number, match_number, label, home_team_id, away_team_id,
         home_seed, away_seed, status)
      values
        (v_bracket_id, v_round, v_match, v_label, v_home_team, v_away_team,
         case when v_home_team is not null then v_home_seed end,
         case when v_away_team is not null then v_away_seed end,
         case when v_round = 1 and (v_home_team is null or v_away_team is null) then 'bye'
              when v_round = 1 then 'ready' else 'pending' end);
    end loop;
  end loop;

  insert into public.playoff_matches (bracket_id, round_number, match_number, label)
  values (v_bracket_id, v_rounds, 2, 'Third Place')
  returning id into v_third_place_id;

  for v_round in 1..(v_rounds - 1) loop
    update public.playoff_matches source
       set winner_to_match_id = destination.id,
           winner_to_slot = case when source.match_number % 2 = 1 then 'home' else 'away' end
      from public.playoff_matches destination
     where source.bracket_id = v_bracket_id
       and source.round_number = v_round
       and destination.bracket_id = v_bracket_id
       and destination.round_number = v_round + 1
       and destination.match_number = ((source.match_number + 1) / 2);
  end loop;

  update public.playoff_matches
     set loser_to_match_id = v_third_place_id,
         loser_to_slot = case when match_number = 1 then 'home' else 'away' end
   where bracket_id = v_bracket_id and round_number = v_rounds - 1;

  for v_row in
    select * from public.playoff_matches
    where bracket_id = v_bracket_id and status = 'bye'
    order by match_number
  loop
    v_home_team := coalesce(v_row.home_team_id, v_row.away_team_id);
    v_home_seed := coalesce(v_row.home_seed, v_row.away_seed);
    update public.playoff_matches
       set winner_team_id = v_home_team
     where id = v_row.id;
    if v_row.winner_to_slot = 'home' then
      update public.playoff_matches set home_team_id = v_home_team, home_seed = v_home_seed
      where id = v_row.winner_to_match_id;
    else
      update public.playoff_matches set away_team_id = v_home_team, away_seed = v_home_seed
      where id = v_row.winner_to_match_id;
    end if;
  end loop;

  update public.playoff_matches
     set status = 'ready'
   where bracket_id = v_bracket_id and status = 'pending'
     and home_team_id is not null and away_team_id is not null;

  return v_bracket_id;
end;
$$;

create or replace function public.schedule_playoff_match(
  p_match_id uuid,
  p_date date,
  p_time text,
  p_location text
)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_match public.playoff_matches%rowtype;
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
  if p_date is null or length(trim(coalesce(p_time, ''))) = 0 or length(trim(coalesce(p_location, ''))) = 0 then
    raise exception 'Date, time, and location are required.';
  end if;
  select l.* into v_league
  from public.playoff_brackets b join public.leagues l on l.id = b.league_id
  where b.id = v_match.bracket_id;
  insert into public.games
    (league_id, sport, home_team_id, away_team_id, date, time, location, stage)
  values
    (v_league.id, v_league.sport, v_match.home_team_id, v_match.away_team_id,
     p_date, trim(p_time), trim(p_location), 'playoff')
  returning id into v_game_id;
  update public.playoff_matches set game_id = v_game_id where id = p_match_id;
  return v_game_id;
end;
$$;

create or replace function public.link_playoff_game(p_match_id uuid, p_game_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_match public.playoff_matches%rowtype;
  v_game public.games%rowtype;
  v_league_id uuid;
begin
  perform public.assert_admin();
  select * into v_match from public.playoff_matches where id = p_match_id for update;
  if not found then raise exception 'Unknown playoff match %', p_match_id; end if;
  if v_match.status <> 'ready' or v_match.game_id is not null then
    raise exception 'Only an unscheduled ready match can link a game.';
  end if;
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'Unknown game %', p_game_id; end if;
  select league_id into v_league_id from public.playoff_brackets where id = v_match.bracket_id;
  if v_game.league_id <> v_league_id or v_game.stage <> 'playoff' then
    raise exception 'The linked game must be a playoff game in this league.';
  end if;
  if not (
    (v_game.home_team_id = v_match.home_team_id and v_game.away_team_id = v_match.away_team_id)
    or (v_game.home_team_id = v_match.away_team_id and v_game.away_team_id = v_match.home_team_id)
  ) then raise exception 'The linked game participants do not match this bracket match.'; end if;
  update public.playoff_matches set game_id = p_game_id where id = p_match_id;
end;
$$;

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
  select * into v_match from public.playoff_matches where id = p_match_id for update;
  if not found then raise exception 'Unknown playoff match %', p_match_id; end if;
  if v_match.status = 'completed' then return; end if;
  if v_match.game_id is null then raise exception 'Schedule and complete the linked game first.'; end if;
  select * into v_game from public.games where id = v_match.game_id for update;
  if v_game.status <> 'completed' or v_game.score_status <> 'final' or not v_game.locked then
    raise exception 'The linked game must be completed, marked final, and locked before advancement.';
  end if;
  if v_game.home_score = v_game.away_score then raise exception 'Single-elimination games cannot advance from a tie.'; end if;
  if v_game.home_score > v_game.away_score then
    v_winner := v_game.home_team_id; v_loser := v_game.away_team_id;
  else
    v_winner := v_game.away_team_id; v_loser := v_game.home_team_id;
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

  update public.playoff_matches
     set status = 'completed', winner_team_id = v_winner, loser_team_id = v_loser
   where id = p_match_id;
  update public.playoff_matches
     set status = 'ready'
   where bracket_id = v_match.bracket_id and status = 'pending'
     and home_team_id is not null and away_team_id is not null;
  update public.playoff_brackets
     set status = 'complete'
   where id = v_match.bracket_id
     and not exists (
       select 1 from public.playoff_matches
       where bracket_id = v_match.bracket_id and status not in ('completed', 'bye')
     );
end;
$$;

revoke execute on function public.generate_single_elim_bracket(uuid, uuid[]) from public, anon;
revoke execute on function public.schedule_playoff_match(uuid, date, text, text) from public, anon;
revoke execute on function public.link_playoff_game(uuid, uuid) from public, anon;
revoke execute on function public.advance_playoff_match(uuid) from public, anon;
grant execute on function public.generate_single_elim_bracket(uuid, uuid[]) to authenticated;
grant execute on function public.schedule_playoff_match(uuid, date, text, text) to authenticated;
grant execute on function public.link_playoff_game(uuid, uuid) to authenticated;
grant execute on function public.advance_playoff_match(uuid) to authenticated;

-- Unlocking a game whose result already advanced the bracket must retract that
-- advancement in the same transaction. Once a downstream game is scheduled,
-- the result can no longer be safely retracted without an explicit reschedule.
create or replace function public.unlock_game(p_game_id uuid, p_reason text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_locked boolean;
  v_match public.playoff_matches%rowtype;
  v_destination public.playoff_matches%rowtype;
begin
  perform public.assert_admin();

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Unlocking a final game requires a reason.';
  end if;

  select locked into v_locked from public.games where id = p_game_id for update;
  if not found then raise exception 'Unknown game %', p_game_id; end if;
  if not v_locked then raise exception 'Game % is not locked.', p_game_id; end if;

  select * into v_match
  from public.playoff_matches
  where game_id = p_game_id
  for update;

  if found and v_match.status = 'completed' then
    if v_match.winner_to_match_id is not null then
      select * into v_destination
      from public.playoff_matches where id = v_match.winner_to_match_id for update;
      if v_destination.game_id is not null or v_destination.status = 'completed' then
        raise exception 'Cannot unlock after the next playoff match has been scheduled.';
      end if;
    end if;
    if v_match.loser_to_match_id is not null then
      select * into v_destination
      from public.playoff_matches where id = v_match.loser_to_match_id for update;
      if v_destination.game_id is not null or v_destination.status = 'completed' then
        raise exception 'Cannot unlock after the third-place match has been scheduled.';
      end if;
    end if;

    if v_match.winner_to_match_id is not null then
      if v_match.winner_to_slot = 'home' then
        update public.playoff_matches
           set home_team_id = null, home_seed = null, status = 'pending'
         where id = v_match.winner_to_match_id;
      else
        update public.playoff_matches
           set away_team_id = null, away_seed = null, status = 'pending'
         where id = v_match.winner_to_match_id;
      end if;
    end if;
    if v_match.loser_to_match_id is not null then
      if v_match.loser_to_slot = 'home' then
        update public.playoff_matches
           set home_team_id = null, home_seed = null, status = 'pending'
         where id = v_match.loser_to_match_id;
      else
        update public.playoff_matches
           set away_team_id = null, away_seed = null, status = 'pending'
         where id = v_match.loser_to_match_id;
      end if;
    end if;

    update public.playoff_matches
       set status = 'ready', winner_team_id = null, loser_team_id = null
     where id = v_match.id;
    update public.playoff_brackets set status = 'active' where id = v_match.bracket_id;
  end if;

  perform set_config('cvf.bypass_lock', 'on', true);
  update public.games set locked = false, score_status = 'approved' where id = p_game_id;
  insert into public.game_edit_history (game_id, action, reason, actor)
  values (p_game_id, 'Unlocked', trim(p_reason), auth.uid());
end;
$$;

revoke execute on function public.unlock_game(uuid, text) from public, anon;
grant execute on function public.unlock_game(uuid, text) to authenticated;
