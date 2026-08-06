# Recovery, revocation, and break-glass session — owner runbook

**Date prepared:** 2026-08-06 · **Status:** ready to run; scheduled before
Season 1 data entry. Roughly 30–40 minutes as one sitting. Each phase is a
complete checkpoint — stopping *between* phases is safe; stopping *inside*
Phase 2 or Phase 4 is not (both create a deliberate in-between state that
must be closed before walking away).

**Division of labor:** every password, TOTP code, and email link is the
owner's alone. The assistant (or the owner, solo) runs the verification
queries between phases and records evidence; it never sees or types a
credential.

## Before starting — all three in reach

1. Authenticator app (the one holding the current admin TOTP factor).
2. The admin email inbox, open.
3. A NEW password chosen and ready — Phase 2 performs a real reset.
4. The frontend running in HOSTED mode: launch config `cvf-frontend`
   (`npm start` with the real `.env.local` values), at `localhost:3000`.
   Mock mode cannot run this session.

Baseline (captured 2026-08-05): 1 linked administrator (`Owner`), 2 auth
users, 1 verified TOTP factor, 6 accumulated live sessions.

## Phase 1 — Session revocation

1. Log into `localhost:3000/admin` with password + TOTP (the real flow).
2. Dashboard → Authentication → Users → the admin user → **Sign out user**
   (revokes all sessions).
3. Back in the app: the next admin action must fail / bounce to sign-in.
   *Acceptance: a revoked session is actually dead, not merely expired-later.*
4. Log in again — revocation must not strand the administrator.
5. Verify: `auth.sessions` count drops to ~1 (the fresh login only).

## Phase 2 — Recovery (do not stop midway)

1. Sign out. Go to `localhost:3000/admin/recover`, complete the Turnstile,
   submit the admin email.
2. Open the recovery email; the link lands on `/admin/reset-password`.
   Set the NEW password.
3. **The acceptance check that matters:** immediately after the reset,
   BEFORE entering any TOTP code, attempt an admin action. It must fail —
   a recovered session is AAL1, and if it could administrate, password
   recovery would be a TOTP bypass.
4. Complete the TOTP challenge; confirm admin capability returns at AAL2.
5. Verify: the TOTP factor survived the reset (still exactly 1 verified
   factor); admin works only after step 4.

## Phase 3 — Leaked-password protection

Dashboard → Authentication → Providers → Email → enable **"Prevent use of
leaked passwords."** Done BEFORE Phase 4 so the break-glass password is
HIBP-checked at creation. If the toggle is unavailable on the Free plan,
record that and fold enabling it into the Pro upgrade at deployment.

## Phase 4 — Break-glass administrator (do not stop midway)

1. Dashboard → Authentication → **Add user**: a real email the owner
   controls (distinct from the primary), with a strong generated password.
   Auto-confirm the email.
2. Link it: insert the `admin_users` row (label `Break-glass`) via the SQL
   editor or linked CLI — the table is deny-all under RLS, so this is a
   `postgres`-role write by design:
   ```sql
   insert into public.admin_users (auth_user_id, label)
   select id, 'Break-glass' from auth.users where email = '<the new email>';
   ```
3. Log into the app as that account; enroll TOTP at `/admin/security` —
   ideally in a DIFFERENT authenticator app or device than the primary, or
   at minimum record the enrollment secret during setup.
4. Confirm the break-glass account reaches AAL2 and can administrate.
5. **Write the password and the TOTP secret on paper. Store offline, at
   home, not in a password manager that shares fate with the phone.**
6. Verify: 2 `admin_users` rows, 2 verified factors.

## Phase 5 — Primary re-check and evidence

1. Sign back in as the primary administrator; confirm nothing locked out.
2. Capture post-session state (admin links, factors, sessions) and write
   the dated evidence file under `supabase/evidence/`.
3. Update the CLAUDE.md queue: recovery acceptance complete, break-glass
   created, password protection state recorded.

## Failure notes

- Phase 2, recovery email never arrives: check the dashboard's Auth logs
  and rate limits; Supabase's built-in mailer is limited per hour — wait
  rather than hammering.
- Phase 2, locked at AAL1 with authenticator unavailable: the dashboard
  (owner platform login) can still administrate Supabase itself; the app
  admin surface stays closed until the factor is available. This is the
  scenario Phase 4 exists to insure against.
- Phase 4, TOTP enrollment fails at `/admin/security`: confirm the row
  from step 2 exists and the session is the NEW account, not the primary.
