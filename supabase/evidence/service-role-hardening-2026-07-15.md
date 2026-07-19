# Service-role least-privilege hardening — 2026-07-15

## Accepted boundary

The protected intake server requires only `INSERT` on `public.team_registrations` and `public.free_agents`. It does not require reads, updates, deletes, table-administration privileges, sequence access, or execution of public functions.

The enforceable customer-controlled boundary is:

- every current public table is revoked from `service_role`, then only the two intake `INSERT` grants are restored;
- every current public sequence privilege and public-function `EXECUTE` privilege is revoked from `service_role`;
- default privileges for future objects created by the repository migration owner (`postgres`) grant `service_role` nothing; and
- the global default `PUBLIC` function-execution grant is revoked for future functions created by `postgres`, preventing inherited execution by `service_role`.

Supabase also maintains default ACL entries owned by its platform superuser, `supabase_admin`. Customer migrations run as `postgres`; that role cannot alter `supabase_admin` defaults or acquire the reserved membership required to do so. Supabase's documented customer hardening procedure likewise targets `ALTER DEFAULT PRIVILEGES FOR ROLE postgres`. The platform-owned entries are therefore an accepted, understood platform boundary rather than an unresolved application privilege gap. They do not change the explicit revocation on every current public object, and repository migrations create future application objects as `postgres`.

## Verification record

Local verification completed before hosted application:

- the full local Supabase core stack (Postgres, GoTrue, PostgREST, and Kong) reset cleanly and applied all 22 migrations in filename order;
- the complete assertions passed 213/213 against the real Supabase database;
- the independent plain-Postgres harness, initialized under the Supabase-accurate `postgres` migration owner, also passed 213/213;
- the literal catalog check returned only `INSERT` on `team_registrations` and `free_agents`, zero public-sequence privileges, zero public-function `EXECUTE` privileges, and zero customer-controlled `postgres` default-ACL leaks;
- the catalog separately reported the 12 accepted `supabase_admin` platform-owned default entries described above;
- a clean-reset Security Advisor run returned only the known intentional `admin_users` deny-all/RLS-without-policy INFO; and
- a clean-reset Performance Advisor run returned 45 expected unused-index INFOs on the empty database and four already-accepted overlapping-permissive-policy WARNs, with no new finding from this migration.

Hosted verification completed:

- the dedicated dry-run listed only `20260715201257_fully_restrict_service_role_privileges.sql`, once;
- the migration applied successfully and a fresh ledger listed all 22 migrations locally and remotely;
- the post-push row/settings baseline remained exact: only `admin_users = 1`, `seasons = 1`, and `league_settings = 1`; all other base tables and `public_hof_entries` were zero; season defaults remained `Summer 2026`, Hall of Fame remained unpublished, no waiver version existed, and registration flags remained kickball open/flag football closed;
- the hosted literal catalog result returned `pass: true`, with only the two intake `INSERT` privileges, no sequence privileges, no public-function execution, no `postgres` default-ACL leak, and the same 12 accepted `supabase_admin` platform entries;
- hosted Security Advisor returned 23 findings: one known `admin_users` INFO, two intentional allowlisted definer-view ERRORs, two intentional anonymous helper WARNs, 17 authenticated helper/admin-RPC WARNs, and the known leaked-password-protection WARN;
- hosted Performance Advisor returned 20 expected unused-index INFOs and four already-deferred permissive-policy WARNs; and
- the CLI emitted its known non-blocking post-push pg-delta cache warning after the migration completed; the fresh ledger and catalog checks independently confirmed application.

At this July 15 checkpoint, the expanded authorization matrix did not start because `frontend/.env.local` lacked `REACT_APP_TURNSTILE_SITE_KEY`. The runner failed before reading credentials or seeding its fixture, so hosted row counts were unchanged.

## Later authorization acceptance

The missing public site key was subsequently configured and the expanded real-session matrix completed on July 17. The accepted rerun passed 150/150 checks with fixture cleanup and exact baseline restoration; see [`hosted-auth-matrix-2026-07-17-final.md`](hosted-auth-matrix-2026-07-17-final.md). This later result closes the incomplete item recorded at the July 15 checkpoint without rewriting the dated verification sequence above.
