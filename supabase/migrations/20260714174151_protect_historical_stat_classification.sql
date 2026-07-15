-- Player statistics derive their season and competition domain through
-- player_stats -> games -> leagues. Once granular statistics exist, moving a
-- game to another league or reclassifying its league would silently rewrite
-- historical season, career, and tournament totals. Keep the normalized
-- relationship model, but make those classification links immutable.

create or replace function public.prevent_stat_game_reclassification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.league_id is distinct from old.league_id
     and exists (
       select 1
         from public.player_stats stats
        where stats.game_id = old.id
     ) then
    raise exception
      'Recorded statistics lock game % to league %; delete or migrate the statistics through a reviewed correction before changing league_id.',
      old.id,
      old.league_id;
  end if;
  return new;
end;
$$;

create trigger a_games_prevent_stat_reclassification
  before update of league_id on public.games
  for each row execute procedure public.prevent_stat_game_reclassification();

create or replace function public.prevent_stat_league_reclassification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_has_stats boolean;
begin
  if new.season is not distinct from old.season
     and new.kind is not distinct from old.kind then
    return new;
  end if;

  select exists (
    select 1
      from public.games games
      join public.player_stats stats on stats.game_id = games.id
     where games.league_id = old.id
  ) into v_has_stats;

  if not v_has_stats then
    return new;
  end if;

  if new.kind is distinct from old.kind then
    raise exception
      'Recorded statistics lock league % to kind %; create a separate container instead of reclassifying history.',
      old.id,
      old.kind;
  end if;

  -- A direct reassignment leaves the old season row in place. During the
  -- supported seasons.name ON UPDATE CASCADE, the old key no longer exists;
  -- allow that atomic rename without treating it as historical reassignment.
  if new.season is distinct from old.season
     and exists (select 1 from public.seasons where name = old.season) then
    raise exception
      'Recorded statistics lock league % to season %; create a separate season enrollment instead of reclassifying history.',
      old.id,
      old.season;
  end if;

  return new;
end;
$$;

create trigger leagues_prevent_stat_reclassification
  before update of season, kind on public.leagues
  for each row execute procedure public.prevent_stat_league_reclassification();

revoke execute on function public.prevent_stat_game_reclassification() from public, anon, authenticated;
revoke execute on function public.prevent_stat_league_reclassification() from public, anon, authenticated;

comment on function public.prevent_stat_game_reclassification() is
  'Prevents a game with granular player statistics from moving to another league and silently changing historical stat classification.';
comment on function public.prevent_stat_league_reclassification() is
  'Prevents season/domain reassignment after granular statistics exist while preserving atomic season-name cascades.';
