-- ============================================================================
-- CVF Leagues — pre-hosted hardening
-- Enforce that a team charge belongs to the same season as the team's league.
--
-- The invariant is checked from every mutation path that can break it:
--   * inserting or changing a team charge
--   * moving a charged team to another league
--   * changing the season of a league with charged teams
--
-- Constraint triggers are DEFERRABLE INITIALLY IMMEDIATE. They run after the
-- statement (so seasons.name ON UPDATE CASCADE can settle across leagues and
-- charges) while still failing the statement that introduced a mismatch.
-- Charge checks lock team then league rows in that consistent order, closing
-- the race with concurrent team moves or league-season changes.
-- ============================================================================

-- The upstream checks filter charges by team and teams by league. PostgreSQL
-- does not automatically index foreign-key columns.
create index charges_team_id_idx
  on public.charges (team_id)
  where team_id is not null;

create index teams_league_id_idx
  on public.teams (league_id);

-- Refuse to install the guard over pre-existing inconsistent data.
do $$
begin
  if exists (
    select 1
      from public.charges c
      join public.teams t on t.id = c.team_id
      join public.leagues l on l.id = t.league_id
     where c.team_id is not null
       and c.season is distinct from l.season
  ) then
    raise exception 'Cannot enforce charge-team season consistency: mismatched team charges already exist.';
  end if;
end;
$$;

create function public.enforce_charge_team_season()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_team_league_id uuid;
  v_team_season    text;
begin
  if tg_table_name = 'charges' then
    -- Profile-only charges have no team-season relationship to validate.
    if new.team_id is null then
      return new;
    end if;

    -- FOR SHARE blocks non-key UPDATEs while allowing concurrent readers.
    -- Lock team before league everywhere this function needs both.
    select t.league_id
      into v_team_league_id
      from public.teams t
     where t.id = new.team_id
       for share;

    if not found then
      raise exception 'Unknown team % for charge %.', new.team_id, new.id;
    end if;

    select l.season
      into v_team_season
      from public.leagues l
     where l.id = v_team_league_id
       for share;

    if not found then
      raise exception 'Unknown league % for team %.', v_team_league_id, new.team_id;
    end if;

    if new.season is distinct from v_team_season then
      raise exception
        'Team charge season (%) must match the referenced team''s league season (%).',
        new.season,
        v_team_season
        using errcode = '23514',
              constraint = 'charges_team_season_consistency';
    end if;

  elsif tg_table_name = 'teams' then
    select l.season
      into v_team_season
      from public.leagues l
     where l.id = new.league_id
       for share;

    if not found then
      raise exception 'Unknown league % for team %.', new.league_id, new.id;
    end if;

    if exists (
      select 1
        from public.charges c
       where c.team_id = new.id
         and c.season is distinct from v_team_season
    ) then
      raise exception
        'Team % cannot move to league % because an existing charge belongs to another season.',
        new.id,
        new.league_id
        using errcode = '23514',
              constraint = 'charges_team_season_consistency';
    end if;

  elsif tg_table_name = 'leagues' then
    if exists (
      select 1
        from public.teams t
        join public.charges c on c.team_id = t.id
       where t.league_id = new.id
         and c.season is distinct from new.season
    ) then
      raise exception
        'League % cannot change to season % because an existing team charge belongs to another season.',
        new.id,
        new.season
        using errcode = '23514',
              constraint = 'charges_team_season_consistency';
    end if;

  else
    raise exception 'enforce_charge_team_season() attached to unsupported table %.', tg_table_name;
  end if;

  return new;
end;
$$;

create constraint trigger charges_team_season_insert
  after insert on public.charges
  deferrable initially immediate
  for each row execute function public.enforce_charge_team_season();

create constraint trigger charges_team_season_update
  after update of season, team_id on public.charges
  deferrable initially immediate
  for each row
  when (old.season is distinct from new.season or old.team_id is distinct from new.team_id)
  execute function public.enforce_charge_team_season();

create constraint trigger teams_charge_season_update
  after update of league_id on public.teams
  deferrable initially immediate
  for each row
  when (old.league_id is distinct from new.league_id)
  execute function public.enforce_charge_team_season();

create constraint trigger leagues_charge_season_update
  after update of season on public.leagues
  deferrable initially immediate
  for each row
  when (old.season is distinct from new.season)
  execute function public.enforce_charge_team_season();

-- Trigger functions are not client-callable API endpoints.
revoke execute on function public.enforce_charge_team_season() from public, anon, authenticated;
