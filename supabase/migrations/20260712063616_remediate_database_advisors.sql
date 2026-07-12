-- Resolve the actionable findings from the first hosted Security and
-- Performance Advisor review. The remaining findings are intentional or
-- separately tracked in CLAUDE.md.

alter function public.cvf_palette_color(integer)
  set search_path = pg_catalog;

alter function public.current_waiver_version()
  security invoker;

-- Foreign-key columns are commonly used for joins and parent-row checks.
-- Index every currently uncovered public-schema foreign key reported by the
-- Performance Advisor. Existing covering indexes are left unchanged.
create index if not exists charges_profile_id_idx
  on public.charges (profile_id);
create index if not exists charges_season_idx
  on public.charges (season);

create index if not exists free_agents_assigned_team_id_idx
  on public.free_agents (assigned_team_id);
create index if not exists free_agents_profile_id_idx
  on public.free_agents (profile_id);

create index if not exists game_edit_history_actor_idx
  on public.game_edit_history (actor);
create index if not exists game_edit_history_game_id_idx
  on public.game_edit_history (game_id);

create index if not exists games_approved_by_idx
  on public.games (approved_by);
create index if not exists games_away_team_id_idx
  on public.games (away_team_id);
create index if not exists games_home_team_id_idx
  on public.games (home_team_id);
create index if not exists games_league_id_idx
  on public.games (league_id);
create index if not exists games_submitted_by_idx
  on public.games (submitted_by);
create index if not exists games_temp_admin_id_idx
  on public.games (temp_admin_id);

create index if not exists hof_entries_created_by_idx
  on public.hof_entries (created_by);
create index if not exists hof_entries_game_id_idx
  on public.hof_entries (game_id);
create index if not exists hof_entries_profile_id_idx
  on public.hof_entries (profile_id);
create index if not exists hof_entries_season_idx
  on public.hof_entries (season);
create index if not exists hof_entries_team_id_idx
  on public.hof_entries (team_id);

create index if not exists league_settings_current_season_idx
  on public.league_settings (current_season);
create index if not exists leagues_season_idx
  on public.leagues (season);

create index if not exists payment_entries_charge_id_idx
  on public.payment_entries (charge_id);
create index if not exists payment_entries_recorded_by_idx
  on public.payment_entries (recorded_by);

create index if not exists player_stats_profile_id_idx
  on public.player_stats (profile_id);
create index if not exists player_stats_team_id_idx
  on public.player_stats (team_id);

create index if not exists team_players_profile_id_idx
  on public.team_players (profile_id);
create index if not exists team_players_season_idx
  on public.team_players (season);

create index if not exists team_registrations_approved_team_id_idx
  on public.team_registrations (approved_team_id);
create index if not exists team_registrations_processed_by_idx
  on public.team_registrations (processed_by);

create index if not exists teams_captain_id_idx
  on public.teams (captain_id);

create index if not exists waivers_profile_id_idx
  on public.waivers (profile_id);
create index if not exists waivers_verified_by_idx
  on public.waivers (verified_by);
create index if not exists waivers_waiver_version_idx
  on public.waivers (waiver_version);
