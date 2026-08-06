# Season 1 hosted data entry — order of operations

**Date:** 2026-08-05 · **Status:** ready to execute whenever the owner begins
entering real Season 1 data. All entry happens through the admin UI against
hosted Supabase — no SQL, no fixtures, no mock participation.

Hosted baseline when this was written: 1 admin, 1 league, 2 seasons,
1 profile, 1 team identity, 1 team, 1 roster row, 0 venues, 0 games, and
0 rows in all four private ledger tables.

## Why order matters

Games require a `venue_id` and two enrolled teams; rosters require profiles
and an enrollment; enrollments require a league/season and an identity.
Entering in dependency order means every step's dropdowns are already
populated and nothing has to be revisited. Two later gates also hang off this
work: the durable ledger pilot's trigger condition ("real teams and rosters
exist hosted") is satisfied at step 5, and the calendar-subscription
verification needs step 6's schedule.

## The order

1. **Venues first.** Admin → Venues: every park/field with name, field label,
   address, and coordinates. Coordinates feed the public Directions link, so
   enter them rather than skipping. Venues are never deletable once games
   reference them — prefer `retired` status later over duplicates now.
2. **Confirm league and season.** Verify the existing league/season rows and
   per-sport current-season defaults are the real Season 1 values before
   anything enrolls into them.
3. **Team identities + enrollments.** One persistent identity per franchise
   (name, color, founded), then enroll each into the league/season. Captain
   contact lands on the enrollment.
4. **Profiles.** Add Player for each rostered person. Real names and contact
   only — no placeholder people, ever; profiles referenced by ledger
   snapshots become permanent.
5. **Rosters.** Assign profiles to teams with jersey numbers; season is
   auto-stamped; roster status follows the waiver workflow.
   → *The durable ledger pilot is now runnable
   ([`../scoring/DURABLE_LEDGER_PILOT_2026-08-04.md`](../scoring/DURABLE_LEDGER_PILOT_2026-08-04.md));
   it still needs its own explicit approval.*
6. **Schedule.** Create games with real `starts_at` timestamps and venue
   references.
7. **Verify public pages** render the real data correctly — this doubles as
   the start of live-flow acceptance.

## Rules that bind throughout

- Waiver records remain append-only and must not be created with draft legal
  text; the waiver flow stays gated on attorney-approved language.
- Nothing in this document authorizes the ledger pilot, practice sessions
  against real rosters, or deployment — each keeps its own gate.
- Take an off-platform export after entry completes (and before any
  subsequent hosted procedure), per the runbook's backup discipline.
