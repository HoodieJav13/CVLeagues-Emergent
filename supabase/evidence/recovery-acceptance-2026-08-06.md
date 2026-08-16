# Recovery, revocation, and break-glass acceptance — session record

**Status: COMPLETE — all five phases closed (Phases 1–2 PASS 2026-08-06,
Phase 3 resolved as Pro-gated, Phases 4–5 PASS 2026-08-16).** Procedure:
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

## Phase 3 — leaked-password protection: RESOLVED as Pro-gated (2026-08-06)

The dashboard presents the toggle but save fails: "Configuring leaked
password protection via HaveIBeenPwned.org is available on Pro Plans and
up." The 2026-07-15 note was right. Folds into the already-decided Pro
upgrade at deployment — and note the toggle only checks passwords set
AFTER enabling, so flip it immediately at upgrade time. Consequence for
Phase 4: use a generated random password for the break-glass account
(a random 20+ char string is not in any breach corpus).

## Phase 4 — break-glass administrator: **PASS** (2026-08-16)

- Resume-point verification preceded everything: the pre-Phase-4 baseline
  (1 admin link, 2 auth users, 1 verified factor, 6 sessions) was
  re-confirmed by direct query before any action, per the handoff rule
  that the database is the truth.
- Owner created the auth user `javien25@yahoo.com` in the dashboard
  (auto-confirmed) with a generated random 20+ char password — the current
  dashboard's Add-user dialog no longer offers a generate button, so the
  password came from an external generator, per the Phase 3 consequence.
- Owner linked it via the SQL-editor insert; verified server-side: 2
  `admin_users` rows (`Owner` = jantc7@yahoo.com, `Break-glass` =
  javien25@yahoo.com), both confirmed.
- **Detour, no security impact:** the generated password was lost before
  first login. Reset via the app's own `/admin/recover` flow — which
  incidentally proved the reset page's no-factor path in production: an
  admin account still in enrollment (no verified factor) goes straight to
  the password form at AAL1, exactly as the Phase 2 fix documented.
- **Finding 4 (UX, non-blocking):** navigating back mid-TOTP-enrollment
  strands an `unverified` factor, and re-entry fails with `A factor with
  the friendly name "CVF Admin Authenticator" for this user already
  exists`. Cleaned by deleting the unverified row by id in the SQL editor;
  enrollment then completed in one sitting. Consider a future cleanup:
  the security page could delete stale unverified factors on entry.
- Break-glass TOTP enrolled and verified; admin capability confirmed at
  AAL2; password and TOTP secret written on paper for offline storage.

## Phase 5 — primary re-check: **PASS** (2026-08-16)

- Owner signed out of break-glass and back in as the primary
  administrator; nothing locked out.
- Final server-side state: **2 admin links · 3 auth users · 2 verified
  TOTP factors** (one per administrator) · 6 total sessions = 1 admin
  session (primary, **aal2**, fresh) + 5 residual sessions on the
  disposable non-admin matrix account (hygiene cleanup remains optional,
  owner's discretion) + 0 break-glass sessions (signed out cleanly).
- **Auth Site URL (owed since 2026-08-06): `http://localhost:3000`.**
  At the Phase 10 configuration session this must become the production
  domain; note it is the `localhost` name — acceptable now because the
  redirect allowlist carries both local forms, but the Turnstile hostname
  finding (Finding 1) is a reminder that the two hosts are not
  interchangeable everywhere.

## Session outcome

The runbook's target state is fully achieved: revocation proven live,
recovery proven end-to-end (with the AAL2 reset fix `5c24d89` it forced),
leaked-password protection recorded as Pro-gated with an at-upgrade
action, a second independent administrator existing on paper, and the
primary unaffected. Recovery/session-revocation acceptance is closed;
remaining related work lives in the Phase 10 gates (Pro upgrade + toggle,
production Site URL, production redirect allowlist).
