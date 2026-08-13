# Recovery, revocation, and break-glass acceptance — session record

**Status: IN PROGRESS — Phases 1–2 PASS, Phase 3 resolved (Pro-gated);
Phases 4–5 remain.** Nothing in a degraded state; Phase 4 (break-glass
creation) must not be stopped midway once begun. Procedure:
[`../../docs/operations/RECOVERY_SESSION_RUNBOOK_2026-08-06.md`](../../docs/operations/RECOVERY_SESSION_RUNBOOK_2026-08-06.md).

## Baseline (2026-08-06, pre-session)

1 linked administrator (`Owner`) · 2 auth users · 1 verified TOTP factor ·
6 live sessions (1 admin + 5 accumulated by the disposable non-admin matrix
account).

## Phase 1 — Session revocation: **PASS**

- Owner signed into the hosted-mode frontend (`127.0.0.1:3000/admin`) with
  password + TOTP, confirming the real AAL2 flow end to end.
- Owner executed the revocation from the dashboard SQL editor (the per-user
  dashboard control was not locatable in the current UI; the SQL targets the
  same rows): `delete from auth.sessions where user_id in (select
  auth_user_id from public.admin_users);`
- **The app ejected the owner immediately** — no stateless-JWT coasting was
  observed; the client's next session check hit the dead server session.
- Server-side verification: admin sessions **0**; the 5 residual sessions all
  belong to the disposable non-admin test account (optional hygiene cleanup
  offered, owner's discretion).
- Owner signed back in successfully — revocation does not strand the
  administrator. TOTP factor count unchanged at 1.

## Findings so far (both fixed during the session)

1. **Turnstile hostname allowlist does not include `localhost`.** The admin
   login's human-verification widget fails on `http://localhost:3000` and
   works on `http://127.0.0.1:3000` — the site key allowlists the numeric
   host (which the hosted-auth matrix always used) but not the name. Use
   `127.0.0.1` for local hosted-mode work, or add `localhost` to the widget's
   hostnames in the Cloudflare dashboard.
2. **The Supabase redirect allowlist was empty**, so the first recovery
   email's requested redirect (`http://127.0.0.1:3000/admin/reset-password`)
   was rejected and the link failed at the reset page's session guard
   ("Recovery Link Required"). Fixed by the owner during the session:
   Redirect URLs now `http://127.0.0.1:3000/**` and
   `http://localhost:3000/**` (2 entries). At Phase 10 the production domain
   joins this list — already on the config-session checklist.

## Phase 2 — Recovery: **PASS** (completed at the resume sitting)

- The fresh link (post-redirect-allowlist fix, copied not clicked) delivered
  a recovery session — which exposed **Finding 3, the session's most
  important**: Supabase refuses password changes on MFA-enrolled accounts
  below AAL2, so the app's reset form was NEVER completable for the only
  kind of administrator this app has. It failed closed — the right way to
  be broken — but recovery would have dead-ended on game day.
- Fixed live during the session and committed as `5c24d89`: the reset page
  now runs the login gate's TOTP challenge first (verify code → AAL2 → then
  the password form). The security property preserved is the point: email
  compromise alone cannot rotate the admin password.
- Owner proved the full corrected flow end to end: reset link → TOTP code →
  new password → global sign-out of all sessions → fresh login held at the
  challenge screen (AAL1 structurally gated; DB-level denial separately
  proven 33-ways by the 291/291 matrix) → TOTP → admin restored.
- Server-side verification: exactly 1 admin session (global sign-out swept
  the rest), newest session at **aal2**, TOTP factor survived the reset
  (still exactly 1 verified factor).

## Remaining phases (resume point)
- **Phase 3 — leaked-password protection: RESOLVED as Pro-gated (2026-08-06).**
  The dashboard presents the toggle but save fails: "Configuring leaked
  password protection via HaveIBeenPwned.org is available on Pro Plans and
  up." The 2026-07-15 note was right. Folds into the already-decided Pro
  upgrade at deployment — and note the toggle only checks passwords set
  AFTER enabling, so flip it immediately at upgrade time. Consequence for
  Phase 4: use the dashboard's GENERATED password for the break-glass
  account (a random 20+ char string is not in any breach corpus).
- **Phase 4 — break-glass administrator** (create → link → enroll → paper).
- **Phase 5 — primary re-check; finalize this record.**

Resume requires the hosted-mode frontend (`cvf-frontend` launch config) at
`127.0.0.1:3000`; note the Site URL value from Authentication → URL
Configuration at resume, which was not recorded this sitting.
