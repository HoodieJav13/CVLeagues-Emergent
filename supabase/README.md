# CVF Leagues — Supabase backend (Phase 9)

Schema migrations for CVF Leagues' **own Supabase project** (fully separate
from ZonAthletica's — no shared backend, no cross-project references).

## Migrations (apply in filename order)

| File | Contents |
|---|---|
| `20260702000100_extensions_and_admin.sql` | moddatetime, `admin_users` (deny-all RLS), `is_admin()` / `assert_admin()` |
| `20260702000200_profiles.sql` | `profiles` — nullable `auth_user_id` (Auth User ≠ Player), generated `name`, admin-only RLS, no deletes |
| `20260702000300_leagues_teams_rosters.sql` | `leagues`, `teams` (sport trigger-locked to league), `team_players` (roster_status lifecycle, no deletes) |
| `20260702000400_games_and_stats.sql` | `games` (dual status, lock trigger binding even admin), `game_edit_history` (append-only), `player_stats`, `career_baselines` |
| `20260702000500_intake.sql` | `team_registrations`, `free_agents` — anon INSERT-only with forced-clean triage state; no deletes |
| `20260702000600_waivers.sql` | `waiver_versions` (immutable), `waivers` (append-only: column grants + immutability trigger + no deletes) |
| `20260702000700_settings_and_views.sql` | `league_settings` singleton (seeded) + `public_profiles` view (the PII boundary; derives `claimed` + `eligibility_status`) |
| `20260702000800_rpcs.sql` | `save_score`, `lock_game`, `unlock_game(reason)`, `set_game_status`, `approve_registration`, `assign_free_agent`, `verify_waiver` |

## First validation (before touching the hosted project)

These migrations have **not** been executed anywhere yet (no local Postgres on
the authoring machine). First act of the wiring step:

```sh
supabase init          # if not already
supabase start         # local stack
supabase db reset      # applies ./supabase/migrations in order
```

Then smoke-test the invariants in the SQL editor / psql:

1. Anonymous can `select` from `games`/`teams`/`public_profiles` but NOT `profiles`/`waivers`/intake tables.
2. Anonymous can `insert` into `team_registrations`/`free_agents` only with `status='new'` and consent true.
3. `update games set home_score = 1` on a locked game fails **even as admin**; `unlock_game(id, 'reason')` then succeeds; `unlock_game(id, '')` fails.
4. `update waivers set signed_name = 'x'` fails for everyone; verification columns update; second `profile_id` change fails.
5. `approve_registration` / `assign_free_agent` round-trips create the full chain (team → captain profile → roster row → waiver linkage).

## Manual steps after applying (hosted project)

1. **Create the admin:** add your auth user (dashboard → Authentication),
   then as service role:
   `insert into admin_users (auth_user_id, label) values ('<your-auth-uid>', 'Jav');`
2. **Waiver version:** when the NM-attorney-reviewed language lands, insert the
   `waiver_versions` row (e.g. `CVF-WAIVER-2026-…-v1` + exact body text +
   `effective_at`). Until then the public waiver flow has nothing to sign
   against and computed eligibility is truthfully `not_verified` for everyone.
3. **League + season rows:** create the two Season 1 leagues via the admin UI
   once wired (or SQL). `league_settings` row ships in migration 7
   (`Summer 2026`, kickball open / flag closed — current app values).

## Deliberately NOT seeded (approved decisions)

- Demo data (profiles/teams/games/stats from `seed.js`) — production starts
  clean. If a translated demo seed is wanted for wiring tests, generate it as
  `supabase/seed.sql` (dev-only) in the wiring step.
- The fossil intake rows (`reg1` with its dead roster array, old-shape free
  agents) and `careerBaselines` demo data — dropped; the `career_baselines`
  table exists for real historical imports only.

## Invariants the database now owns (not the app)

- **Game lock:** score fields on a locked game are immutable for every role;
  the only path is `unlock_game(id, reason)` which records the reason in
  `game_edit_history` in the same transaction.
- **Append-only waivers:** signature fields can never change; re-signing
  inserts; `profile_id` may be set exactly once (NULL → value); no deletes.
- **Append-only edit history:** insert-only for admin, immutable for all.
- **RLS everywhere:** all 14 tables; public reads scoreboard data only;
  contact PII (`profiles`, intake, waivers) is admin-only; public profile
  reads go through the `public_profiles` view.

## Next steps (queued, in order)

1. Frontend field-rename sweep (approved: snake_case) — own commit, before wiring.
2. Local `supabase db reset` + invariant smoke tests above.
3. Wire `AppStateContext` actions to Supabase queries/RPCs (same signatures — swap points marked `// PHASE 2` in the frontend).
