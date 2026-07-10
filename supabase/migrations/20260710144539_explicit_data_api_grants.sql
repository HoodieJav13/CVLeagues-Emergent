-- ============================================================================
-- CVF Leagues — explicit Data API privileges
--
-- Supabase no longer grants Data API access to new public-schema objects by
-- default. Keep that safer baseline for future migrations, then allowlist only
-- the tables, view, columns, and RPCs the anon/authenticated clients require.
-- RLS remains the row-level authorization layer; these grants are the outer
-- object-level boundary.
-- ============================================================================

-- Future objects created by the migration role are private until a later
-- migration grants them deliberately.
alter default privileges in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges in schema public
  revoke usage, select on sequences from anon, authenticated;

-- PostgreSQL's built-in PUBLIC EXECUTE default is global. A schema-scoped
-- REVOKE cannot override that global grant, so remove it for all functions
-- subsequently created by the migration role. Later migrations must grant
-- each client-facing function explicitly.
alter default privileges
  revoke execute on functions from public;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Reset current objects before applying the allowlist below. This makes the
-- migration deterministic on both legacy projects and new Supabase projects.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Anonymous public reads.
grant select on table
  public.games,
  public.leagues,
  public.teams,
  public.team_players,
  public.player_stats,
  public.career_baselines,
  public.league_settings,
  public.seasons,
  public.waiver_versions,
  public.hof_entries,
  public.public_profiles
to anon;

-- Anonymous intake writes. RLS supplies the field/state checks.
grant insert on table
  public.team_registrations,
  public.free_agents,
  public.waivers
to anon;

-- Signed-in clients need the same public surface.
grant select on table
  public.games,
  public.leagues,
  public.teams,
  public.team_players,
  public.player_stats,
  public.career_baselines,
  public.league_settings,
  public.seasons,
  public.waiver_versions,
  public.hof_entries,
  public.public_profiles
to authenticated;

-- Admin-only data. Non-admin sessions have the object privilege but RLS still
-- returns no rows and rejects writes.
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.leagues to authenticated;
grant select, insert, update, delete on table public.teams to authenticated;
grant select, insert, update on table public.team_players to authenticated;
grant select, insert, update, delete on table public.games to authenticated;
grant select, insert on table public.game_edit_history to authenticated;
grant select, insert, update, delete on table public.player_stats to authenticated;
grant select, insert, update, delete on table public.career_baselines to authenticated;
grant select, insert, update on table public.team_registrations to authenticated;
grant select, insert, update on table public.free_agents to authenticated;
grant select, insert on table public.waiver_versions to authenticated;
grant select, insert on table public.waivers to authenticated;
grant update (verification_status, verified_by, verified_at, profile_id)
  on table public.waivers to authenticated;
grant select, update on table public.league_settings to authenticated;
grant select, insert, update, delete on table public.seasons to authenticated;
grant select, insert, update, delete on table public.charges to authenticated;
grant select, insert, update, delete on table public.payment_entries to authenticated;
grant select, insert, update, delete on table public.hof_entries to authenticated;

-- Policy helpers must be executable by the roles whose policies call them.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_waiver_version() to anon, authenticated;

-- The seven client-facing admin RPCs. Each also calls assert_admin() inside a
-- SECURITY DEFINER body, so authenticated non-admin sessions still fail.
grant execute on function public.save_score(uuid, int, int, jsonb, jsonb) to authenticated;
grant execute on function public.lock_game(uuid) to authenticated;
grant execute on function public.unlock_game(uuid, text) to authenticated;
grant execute on function public.set_game_status(uuid, text) to authenticated;
grant execute on function public.approve_registration(uuid, uuid, boolean) to authenticated;
grant execute on function public.assign_free_agent(uuid, uuid, int, text) to authenticated;
grant execute on function public.verify_waiver(uuid, text) to authenticated;
