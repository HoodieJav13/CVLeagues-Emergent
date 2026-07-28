(function installSurfaceContract(target) {
  /* ==========================================================================
   * MATRIX SURFACE CONTRACT
   * --------------------------------------------------------------------------
   * Migrations 28 and 29 publish as SEPARATE approved actions, so there is a
   * real intermediate hosted state between them. The matrix has to be runnable
   * against that state, otherwise "accept 28, then accept 29" is prose the
   * harness cannot execute.
   *
   * Before this file existed the harness was hard-wired to the Migration 29
   * shape: it seeded a venue, inserted games with starts_at/venue_id, counted
   * venues and game_participation in the baseline, and probed
   * schedule_playoff_match with its post-29 signature. Run against a hosted
   * database at Migration 28 it would have died during FIXTURE SEEDING, before
   * a single authorization check — producing no evidence at all rather than a
   * partial pass.
   *
   * One object, read by both the privileged Node runner and the browser
   * matrix, so the two halves cannot disagree about which surface is under
   * test. Every surface-dependent choice belongs here, not inline at a call
   * site, because an inline choice is one nobody can assert against.
   * ======================================================================== */

  // Tables present at every surface from Sequence 4 onward. Order is the
  // baseline/cleanup order; it is asserted, so do not reorder casually.
  const BASE_TABLES = Object.freeze([
    "admin_users", "profiles", "leagues", "team_identities", "teams", "team_players",
    "games", "game_edit_history", "player_stats", "career_baselines",
    "team_registrations", "free_agents", "waiver_versions", "waivers",
    "league_settings", "seasons", "charges", "payment_entries", "hof_entries",
    "playoff_brackets", "playoff_seeds", "playoff_matches",
    "scorekeeping_sessions", "scorekeeping_participants",
    "scorekeeping_events", "scorekeeping_event_attributions",
  ]);

  // The 25 client-facing admin RPCs accepted at the Sequence 4 baseline.
  const BASE_RPCS = Object.freeze([
    "submit_score", "lock_game", "correct_final_score", "set_game_status",
    "approve_registration", "assign_free_agent", "verify_waiver",
    "generate_single_elim_bracket", "schedule_playoff_match", "link_playoff_game",
    "advance_playoff_match", "enroll_team_identity", "create_team_identity_and_enroll",
    "update_team_identity", "update_team_enrollment",
    "start_scorekeeping_session", "renew_scorekeeping_session", "resume_scorekeeping_session",
    "append_scorekeeping_event", "replace_scorekeeping_event", "finalize_scorekeeping_session",
    "cancel_scorekeeping_session", "declare_ledger_forfeit",
    "start_scorekeeping_correction", "finalize_scorekeeping_correction",
  ]);

  // Migration 29 adds these. Nothing else changes the table or RPC census:
  // Migration 28 adds no table and no net new RPC, it only changes signatures.
  const M29_TABLES = Object.freeze(["venues", "game_participation"]);
  const M29_RPCS = Object.freeze(["set_game_participation"]);

  const SURFACES = Object.freeze({
    // Hosted at Migration 28: Sequence 5A published, venues NOT yet published.
    m28: Object.freeze({
      key: "m28",
      label: "Migration 28 (Sequence 5A overtime and paired-stat rules)",
      migrations: 28,
      tables: Object.freeze([...BASE_TABLES]),
      rpcs: Object.freeze([...BASE_RPCS]),
      tableCount: BASE_TABLES.length,
      rpcCount: BASE_RPCS.length,
      // games still carries date/time/location; venues does not exist.
      gameShape: "legacy",
      seedsVenue: false,
      // schedule_playoff_match keeps its pre-29 signature here. Probing it with
      // the post-29 arguments returns "function not found", which reads as an
      // authorization anomaly when it is really a stale fixture.
      schedulePlayoffMatchArgs: Object.freeze(["p_match_id", "p_date", "p_time", "p_location"]),
    }),
    // Hosted at Migration 29: the full current repository surface.
    m29: Object.freeze({
      key: "m29",
      label: "Migration 29 (venues, authoritative start times, participation)",
      migrations: 29,
      tables: Object.freeze([...BASE_TABLES, ...M29_TABLES]),
      rpcs: Object.freeze([...BASE_RPCS, ...M29_RPCS]),
      tableCount: BASE_TABLES.length + M29_TABLES.length,
      rpcCount: BASE_RPCS.length + M29_RPCS.length,
      gameShape: "starts_at",
      seedsVenue: true,
      schedulePlayoffMatchArgs: Object.freeze(["p_match_id", "p_starts_at", "p_venue_id"]),
    }),
  });

  const DEFAULT_SURFACE = "m29";

  function resolveSurface(key) {
    const resolved = SURFACES[key || DEFAULT_SURFACE];
    if (!resolved) {
      throw new Error(`Unknown matrix surface "${key}". Expected one of: ${Object.keys(SURFACES).join(", ")}.`);
    }
    return resolved;
  }

  // True when the surface under test includes a Migration 29 relation. Call
  // sites use this instead of testing the surface key, so adding a later
  // surface does not mean auditing every `=== "m29"` in the harness.
  function hasTable(surface, table) {
    return surface.tables.includes(table);
  }

  function hasRpc(surface, rpc) {
    return surface.rpcs.includes(rpc);
  }

  target.CVF_MATRIX_SURFACES = Object.freeze({
    SURFACES, DEFAULT_SURFACE, BASE_TABLES, BASE_RPCS, M29_TABLES, M29_RPCS,
    resolveSurface, hasTable, hasRpc,
  });
})(globalThis);
