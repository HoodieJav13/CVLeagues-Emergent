/* global supabase, CVF_LEDGER_MATRIX_CONTRACT */

const output = document.getElementById("output");
const runButton = document.getElementById("run");
const mfaStep = document.getElementById("mfa-step");
const mfaContinueButton = document.getElementById("mfa-continue");
const fields = {
  adminEmail: document.getElementById("admin-email"),
  adminPassword: document.getElementById("admin-password"),
  adminTotp: document.getElementById("admin-totp"),
  nonadminEmail: document.getElementById("nonadmin-email"),
  nonadminPassword: document.getElementById("nonadmin-password"),
};

const checks = [];
let config;
let admin;
let nonadmin;
let anon;
let startedAt;

const {
  tables: LEDGER_TABLES,
  operations: LEDGER_OPERATIONS,
  roles: LEDGER_ROLES,
  checkName: ledgerCheckName,
} = CVF_LEDGER_MATRIX_CONTRACT;

function log(message) {
  output.textContent += `${message}\n`;
  output.scrollTop = output.scrollHeight;
}

function cleanDetail(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-token]")
    .slice(0, 240);
}

async function check(category, name, action) {
  try {
    const detail = await action();
    checks.push({ category, name, status: "PASS", detail: cleanDetail(detail || "Expected behavior observed.") });
    log(`PASS [${category}] ${name}`);
  } catch (error) {
    checks.push({ category, name, status: "FAIL", detail: cleanDetail(error.message || error) });
    log(`FAIL [${category}] ${name}: ${cleanDetail(error.message || error)}`);
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function requireSuccess(result, message = "Request failed") {
  if (result.error) throw new Error(`${message}: ${result.error.message}`);
  return result.data;
}

function requireDenied(result, message = "Request unexpectedly succeeded") {
  if (!result.error) throw new Error(message);
  return "Denied as required.";
}

function requirePrivilegeDenied(result) {
  if (!result.error || !/permission denied/i.test(result.error.message || "")) {
    throw new Error("Ledger mutation did not fail at the table-privilege boundary.");
  }
  return "Denied at the table-privilege boundary.";
}

function requireAdminGuard(result) {
  if (!result.error || !/admin only/i.test(result.error.message || "")) {
    throw new Error("RPC did not fail at the admin authorization guard.");
  }
  return "Rejected by assert_admin().";
}

function requireNoWrite(result, message = "Write affected a protected row") {
  if (result.error) return "Denied with an API/RLS error.";
  requireCondition(Array.isArray(result.data) && result.data.length === 0, message);
  return "RLS affected zero rows.";
}

function requireHidden(result, message = "Private rows were exposed") {
  if (result.error) return "Denied at the Data API boundary.";
  requireCondition(Array.isArray(result.data) && result.data.length === 0, message);
  return "RLS returned zero private rows.";
}

function requireRlsEmpty(result, message = "Private ledger rows were exposed") {
  const data = requireSuccess(result, "Authenticated ledger SELECT failed");
  requireCondition(Array.isArray(data) && data.length === 0, message);
  return "SELECT grant reached RLS and returned zero private rows.";
}

function client() {
  return supabase.createClient(config.supabaseUrl, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function runLedgerBoundary(roleKey, targetClient) {
  const role = LEDGER_ROLES.find((candidate) => candidate.key === roleKey);
  requireCondition(Boolean(role), `Unknown ledger matrix role ${roleKey}.`);

  for (const table of LEDGER_TABLES) {
    await check(role.category, ledgerCheckName(role, "read", table), async () => {
      const result = await targetClient.from(table).select("*").limit(1);
      if (role.readMode === "denied") return requirePrivilegeDenied(result);
      if (role.readMode === "hidden") return requireRlsEmpty(result);
      const data = requireSuccess(result, `AAL2 query failed for ${table}`);
      requireCondition(Array.isArray(data), `${table} did not return a row array.`);
      return "Authorized query completed.";
    });

    for (const operation of LEDGER_OPERATIONS.filter((candidate) => candidate !== "read")) {
      await check(role.category, ledgerCheckName(role, operation, table), async () => {
        const targetId = crypto.randomUUID();
        let result;
        if (operation === "insert") result = await targetClient.from(table).insert({ id: targetId });
        if (operation === "update") result = await targetClient.from(table).update({ id: crypto.randomUUID() }).eq("id", targetId).select("id");
        if (operation === "delete") result = await targetClient.from(table).delete().eq("id", targetId).select("id");
        return requirePrivilegeDenied(result);
      });
    }
  }
}

function captchaToken(containerId) {
  return document.querySelector(`#${containerId} input[name="cf-turnstile-response"]`)?.value || "";
}

function missingInitialFields(credentials) {
  return [
    ["administrator email", credentials.adminEmail],
    ["administrator password", credentials.adminPassword],
    ["non-admin email", credentials.nonadminEmail],
    ["non-admin password", credentials.nonadminPassword],
  ].filter(([, value]) => !value).map(([label]) => label);
}

function requestAdminTotp() {
  mfaStep.hidden = false;
  fields.adminTotp.value = "";
  fields.adminTotp.focus();
  log("ACTION REQUIRED: Enter a fresh administrator authenticator code to continue with AAL2 checks.");

  return new Promise((resolve) => {
    const submit = () => {
      const code = fields.adminTotp.value.trim();
      if (!code) {
        log("WAITING: Administrator authenticator code is required.");
        fields.adminTotp.focus();
        return;
      }
      mfaContinueButton.removeEventListener("click", submit);
      fields.adminTotp.removeEventListener("keydown", submitOnEnter);
      fields.adminTotp.value = "";
      mfaStep.hidden = true;
      resolve(code);
    };
    const submitOnEnter = (event) => {
      if (event.key === "Enter") submit();
    };
    mfaContinueButton.addEventListener("click", submit);
    fields.adminTotp.addEventListener("keydown", submitOnEnter);
  });
}

async function signIn(targetClient, email, password, captchaTokenValue) {
  const result = await targetClient.auth.signInWithPassword({ email, password, options: { captchaToken: captchaTokenValue } });
  if (result.error || !result.data.session) throw new Error(result.error?.message || "No Auth session returned.");
  return result.data.session;
}

async function completeAdminMfa(targetClient, code) {
  const factors = await targetClient.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  const factor = (factors.data.totp || []).find((entry) => entry.status === "verified");
  if (!factor) throw new Error("Administrator has no verified TOTP factor. Enroll through the application first.");
  const challenge = await targetClient.auth.mfa.challenge({ factorId: factor.id });
  if (challenge.error) throw challenge.error;
  const verified = await targetClient.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code });
  if (verified.error) throw verified.error;
}

function rpcArguments(name) {
  return {
    submit_score: {
      p_game_id: config.ids.game,
      p_home_score: 1,
      p_away_score: 0,
      p_periods: { home: [1, 0, 0, 0, 0], away: [0, 0, 0, 0, 0] },
      p_stats: {},
      p_override_reason: "Hosted matrix uses a team-only aggregate score",
    },
    lock_game: { p_game_id: config.ids.game },
    correct_final_score: {
      p_game_id: config.ids.game,
      p_home_score: 2,
      p_away_score: 0,
      p_periods: { home: [2, 0, 0, 0, 0], away: [0, 0, 0, 0, 0] },
      p_stats: {},
      p_reason: "Hosted matrix verified final-score correction reason",
      p_override_reason: "Hosted matrix uses a team-only aggregate score",
    },
    set_game_status: { p_game_id: config.ids.game, p_status: "postponed" },
    approve_registration: { p_registration_id: config.ids.registration, p_league_id: config.ids.league, p_create_captain_profile: true },
    assign_free_agent: { p_free_agent_id: config.ids.freeAgent, p_team_id: config.ids.homeTeam, p_jersey_number: 31, p_position: "Utility" },
    verify_waiver: { p_waiver_id: config.ids.waiver, p_decision: "verified" },
    generate_single_elim_bracket: {
      p_league_id: config.ids.league,
      p_seed_team_ids: [config.ids.homeTeam, config.ids.awayTeam, config.ids.extraTeam1, config.ids.extraTeam2],
    },
    schedule_playoff_match: { p_match_id: config.ids.unknownPlayoffMatch, p_starts_at: "2099-07-14T19:00:00-06:00", p_venue_id: config.ids.venue },
    link_playoff_game: { p_match_id: config.ids.unknownPlayoffMatch, p_game_id: config.ids.game },
    advance_playoff_match: { p_match_id: config.ids.unknownPlayoffMatch },
    enroll_team_identity: {
      p_identity_id: config.ids.unknownTeamIdentity,
      p_league_id: config.ids.identityLeague,
      p_captain_id: null,
      p_division: null,
    },
    create_team_identity_and_enroll: {
      p_name: `${config.runId} denied identity`,
      p_logo_color: "#5BB8CC",
      p_founded: "2099",
      p_league_id: config.ids.identityLeague,
      p_captain_id: null,
      p_division: null,
    },
    update_team_identity: {
      p_identity_id: config.ids.unknownTeamIdentity,
      p_patch: { status: "inactive" },
    },
    update_team_enrollment: {
      p_team_id: config.ids.homeTeam,
      p_patch: { status: "inactive" },
    },
    start_scorekeeping_session: {
      p_game_id: config.ids.game, p_rule_version: "CVF-MATRIX", p_regulation_period_count: 5,
      p_overtime_start_setting: null, p_allow_ties: false, p_rules_snapshot: {},
    },
    renew_scorekeeping_session: {
      p_session_id: config.ids.game, p_lease_token: "denied", p_lease_version: 1,
    },
    resume_scorekeeping_session: { p_session_id: config.ids.game, p_reason: "Denied matrix probe" },
    append_scorekeeping_event: {
      p_session_id: config.ids.game, p_lease_token: "denied", p_lease_version: 1,
      p_idempotency_key: config.runId, p_action: "record", p_event_type: "run",
      p_period_type: "regulation", p_period_number: 1, p_credited_team_id: config.ids.homeTeam,
      p_points: 1, p_voids_event_id: null, p_replaces_event_id: null, p_payload: {}, p_attributions: [],
    },
    replace_scorekeeping_event: {
      p_session_id: config.ids.game, p_lease_token: "denied", p_lease_version: 1,
      p_void_idempotency_key: `${config.runId}-void`, p_replacement_idempotency_key: `${config.runId}-replace`,
      p_target_event_id: config.ids.game, p_event_type: "run", p_period_type: "regulation",
      p_period_number: 1, p_credited_team_id: config.ids.homeTeam, p_points: 1, p_payload: {}, p_attributions: [],
    },
    finalize_scorekeeping_session: {
      p_session_id: config.ids.game, p_lease_token: "denied", p_lease_version: 1,
      p_idempotency_key: config.runId, p_override_reason: null,
    },
    cancel_scorekeeping_session: {
      p_session_id: config.ids.game, p_lease_token: "denied", p_lease_version: 1, p_reason: "Denied matrix probe",
    },
    declare_ledger_forfeit: {
      p_game_id: config.ids.game, p_winner_team_id: config.ids.homeTeam,
      p_reason: "Denied matrix probe", p_idempotency_key: config.runId,
    },
    set_game_participation: {
      p_game_id: config.ids.game,
      p_entries: [{ profile_id: config.ids.profile, team_id: config.ids.homeTeam, status: "played" }],
    },
    start_scorekeeping_correction: { p_game_id: config.ids.game, p_reason: "Denied matrix probe" },
    finalize_scorekeeping_correction: {
      p_session_id: config.ids.game, p_lease_token: "denied", p_lease_version: 1,
      p_idempotency_key: config.runId, p_override_reason: null,
    },
  }[name];
}

const ADMIN_RPC_NAMES = [
  "submit_score",
  "lock_game",
  "correct_final_score",
  "set_game_status",
  "approve_registration",
  "assign_free_agent",
  "verify_waiver",
  "generate_single_elim_bracket",
  "schedule_playoff_match",
  "link_playoff_game",
  "advance_playoff_match",
  "enroll_team_identity",
  "create_team_identity_and_enroll",
  "update_team_identity",
  "update_team_enrollment",
  "start_scorekeeping_session",
  "renew_scorekeeping_session",
  "resume_scorekeeping_session",
  "append_scorekeeping_event",
  "replace_scorekeeping_event",
  "finalize_scorekeeping_session",
  "cancel_scorekeeping_session",
  "declare_ledger_forfeit",
  "start_scorekeeping_correction",
  "finalize_scorekeeping_correction",
  "set_game_participation",
];

async function runMatrix() {
  runButton.disabled = true;
  output.textContent = "";
  const credentials = {
    adminEmail: fields.adminEmail.value.trim(),
    adminPassword: fields.adminPassword.value,
    nonadminEmail: fields.nonadminEmail.value.trim(),
    nonadminPassword: fields.nonadminPassword.value,
    adminCaptcha: captchaToken("admin-captcha"),
    nonadminCaptcha: captchaToken("nonadmin-captcha"),
  };

  const missing = missingInitialFields(credentials);
  if (missing.length > 0) {
    log(`MISSING: ${missing.join(", ")}.`);
    runButton.disabled = false;
    return;
  }
  if (!credentials.adminCaptcha || !credentials.nonadminCaptcha) {
    log("MISSING: Complete both human-verification widgets.");
    runButton.disabled = false;
    return;
  }

  startedAt = new Date().toISOString();
  config = await fetch("/config.json", { cache: "no-store" }).then((response) => response.json());
  anon = client();
  admin = client();
  nonadmin = client();

  try {
    await signIn(admin, credentials.adminEmail, credentials.adminPassword, credentials.adminCaptcha);
    credentials.adminPassword = "";
    fields.adminPassword.value = "";
    await signIn(nonadmin, credentials.nonadminEmail, credentials.nonadminPassword, credentials.nonadminCaptcha);
    credentials.nonadminPassword = "";
    fields.nonadminPassword.value = "";
    credentials.adminCaptcha = "";
    credentials.nonadminCaptcha = "";

    await check("MFA authorization", "linked password-only administrator resolves identity", async () => {
      const data = requireSuccess(await admin.rpc("is_admin_identity"));
      requireCondition(data === true, "Linked administrator identity did not resolve at AAL1.");
    });
    await check("MFA authorization", "linked password-only administrator is not authorized", async () => {
      const data = requireSuccess(await admin.rpc("is_admin"));
      requireCondition(data === false, "AAL1 administrator was incorrectly authorized.");
    });
    for (const rpc of ADMIN_RPC_NAMES) {
      await check("MFA authorization", `linked password-only administrator cannot execute ${rpc}`, async () => {
        return requireAdminGuard(await admin.rpc(rpc, rpcArguments(rpc)));
      });
    }
    await runLedgerBoundary("aal1Admin", admin);

    const adminTotp = await requestAdminTotp();
    await completeAdminMfa(admin, adminTotp);
    credentials.adminEmail = "";
    credentials.nonadminEmail = "";
    fields.adminEmail.value = "";
    fields.nonadminEmail.value = "";

    await check("identity", "anonymous is_admin() is false", async () => {
      const data = requireSuccess(await anon.rpc("is_admin"));
      requireCondition(data === false, "Anonymous is_admin() did not return false.");
    });
    await check("identity", "authenticated non-admin is_admin() is false", async () => {
      const data = requireSuccess(await nonadmin.rpc("is_admin"));
      requireCondition(data === false, "Non-admin is_admin() did not return false.");
    });
    await check("identity", "administrator is_admin() is true", async () => {
      const data = requireSuccess(await admin.rpc("is_admin"));
      requireCondition(data === true, "Administrator is_admin() did not return true.");
    });
    await runLedgerBoundary("anonymous", anon);
    await runLedgerBoundary("nonadmin", nonadmin);
    await runLedgerBoundary("aal2Admin", admin);

    const registration = {
      id: crypto.randomUUID(),
      captain_name: `${config.runId} Captain`,
      captain_email: `${config.runId}.captain@example.invalid`,
      sport: "kickball",
      team_name: `${config.runId} approved team`,
      preferred_season: config.season,
      consent_to_contact: true,
    };
    const freeAgent = {
      id: crypto.randomUUID(),
      first_name: config.runId,
      last_name: "Agent",
      email: `${config.runId}.agent@example.invalid`,
      sports: ["kickball"],
      consent_to_contact: true,
    };
    const waiver = {
      id: crypto.randomUUID(),
      signed_name: `${config.runId} Agent`,
      email: `${config.runId}.agent@example.invalid`,
      waiver_version: config.waiverVersion,
      accepted_terms: true,
      age_confirmed: true,
      media_consent: false,
      user_agent: "cvf-hosted-auth-matrix",
    };

    await check("protected intake", "anonymous direct team-interest write is denied", async () => {
      return requireDenied(await anon.from("team_registrations").insert(registration));
    });
    await check("protected intake", "anonymous direct free-agent write is denied", async () => {
      return requireDenied(await anon.from("free_agents").insert(freeAgent));
    });
    await check("protected intake", "anonymous direct waiver write is denied", async () => {
      return requireDenied(await anon.from("waivers").insert(waiver));
    });
    await check("protected intake", "authenticated non-admin direct intake is denied by RLS", async () => {
      return requireDenied(await nonadmin.from("team_registrations").insert(registration));
    });

    const publicReads = [
      ["seasons", "name", config.season],
      ["leagues", "id", config.ids.league],
      ["team_identities", "name", `${config.runId} home`],
      ["teams", "id", config.ids.homeTeam],
      ["team_players", "id", config.ids.roster],
      ["games", "id", config.ids.game],
      ["league_settings", "id", 1],
      ["waiver_versions", "version", config.waiverVersion],
    ];
    for (const [table, column, value] of publicReads) {
      await check("public reads", `anonymous can read fixture ${table}`, async () => {
        const data = requireSuccess(await anon.from(table).select("*").eq(column, value));
        requireCondition(Array.isArray(data) && data.length === 1, `${table} fixture row was not public.`);
      });
    }
    for (const table of ["venues", "game_participation"]) {
      await check("public reads", `anonymous can query ${table}`, async () => {
        requireSuccess(await anon.from(table).select("*").limit(1));
      });
    }
    for (const table of ["playoff_brackets", "playoff_seeds", "playoff_matches"]) {
      await check("public reads", `anonymous can query ${table}`, async () => {
        requireSuccess(await anon.from(table).select("*").limit(1));
      });
    }
    await check("public reads", "public_profiles exposes allowlisted fixture profile", async () => {
      const data = requireSuccess(await anon.from("public_profiles").select("id,name,eligibility_status").eq("id", config.ids.profile));
      requireCondition(data.length === 1, "Fixture public profile was not visible.");
    });
    await check("public reads", "public_profiles rejects PII column selection", async () => {
      return requireDenied(await anon.from("public_profiles").select("id,email").eq("id", config.ids.profile));
    });
    await check("public reads", "public_hof_entries rejects curator attribution", async () => {
      return requireDenied(await anon.from("public_hof_entries").select("id,created_by").limit(1));
    });

    for (const table of ["admin_users", "profiles", "waivers", "team_registrations", "free_agents", "game_edit_history", "charges", "payment_entries", "hof_entries"]) {
      await check("private reads", `anonymous cannot read ${table}`, async () => requireHidden(await anon.from(table).select("*").limit(1)));
      await check("private reads", `non-admin cannot read ${table}`, async () => requireHidden(await nonadmin.from(table).select("*").limit(1)));
    }

    // Migration 28 surface. Publicly readable, admin-write, never client-deletable
    // for venues because historical games reference them.
    const deniedVenue = { name: `${config.runId} denied venue` };
    const deniedParticipation = {
      game_id: config.ids.game, profile_id: config.ids.profile,
      team_id: config.ids.homeTeam, status: "played",
    };
    for (const [roleKey, roleClient] of [["anonymous", anon], ["non-admin", nonadmin]]) {
      await check("migration 28 authorization", `${roleKey} cannot insert venues`, async () =>
        requireDenied(await roleClient.from("venues").insert(deniedVenue)));
      await check("migration 28 authorization", `${roleKey} cannot update venues`, async () =>
        requireNoWrite(await roleClient.from("venues").update({ name: config.runId }).eq("id", config.ids.venue).select()));
      await check("migration 28 authorization", `${roleKey} cannot insert participation`, async () =>
        requireDenied(await roleClient.from("game_participation").insert(deniedParticipation)));
      await check("migration 28 authorization", `${roleKey} cannot set participation by RPC`, async () =>
        requireAdminGuard(await roleClient.rpc("set_game_participation", rpcArguments("set_game_participation"))));
    }
    await check("migration 28 authorization", "no client role can delete a venue", async () =>
      requireNoWrite(await admin.from("venues").delete().eq("id", config.ids.venue).select()));

    const deniedCharge = { season: config.season, profile_id: config.ids.profile, amount_due_cents: 100, kind: "other", notes: config.runId };
    const deniedPayment = { charge_id: config.ids.charge, amount_cents: 100, method: "matrix", note: config.runId };
    await check("payments authorization", "anonymous cannot insert charges", async () => requireDenied(await anon.from("charges").insert(deniedCharge)));
    await check("payments authorization", "anonymous cannot update charges", async () => requireDenied(await anon.from("charges").update({ amount_due_cents: 999 }).eq("id", config.ids.charge).select()));
    await check("payments authorization", "anonymous cannot delete charges", async () => requireDenied(await anon.from("charges").delete().eq("id", config.ids.charge).select()));
    await check("payments authorization", "anonymous cannot insert payment entries", async () => requireDenied(await anon.from("payment_entries").insert(deniedPayment)));
    await check("payments authorization", "anonymous cannot update payment entries", async () => requireDenied(await anon.from("payment_entries").update({ amount_cents: 999 }).eq("id", config.ids.payment).select()));
    await check("payments authorization", "anonymous cannot delete payment entries", async () => requireDenied(await anon.from("payment_entries").delete().eq("id", config.ids.payment).select()));
    await check("payments authorization", "non-admin cannot insert charges", async () => requireDenied(await nonadmin.from("charges").insert(deniedCharge)));
    await check("payments authorization", "non-admin cannot update charges", async () => requireNoWrite(await nonadmin.from("charges").update({ amount_due_cents: 999 }).eq("id", config.ids.charge).select()));
    await check("payments authorization", "non-admin cannot delete charges", async () => requireNoWrite(await nonadmin.from("charges").delete().eq("id", config.ids.charge).select()));
    await check("payments authorization", "non-admin cannot insert payment entries", async () => requireDenied(await nonadmin.from("payment_entries").insert(deniedPayment)));
    await check("payments authorization", "non-admin cannot update payment entries", async () => requireNoWrite(await nonadmin.from("payment_entries").update({ amount_cents: 999 }).eq("id", config.ids.payment).select()));
    await check("payments authorization", "non-admin cannot delete payment entries", async () => requireNoWrite(await nonadmin.from("payment_entries").delete().eq("id", config.ids.payment).select()));

    const deniedHofEntry = {
      entry_type: "game",
      game_id: config.ids.game,
      sport: "kickball",
      season: config.season,
      title: `${config.runId} denied Hall of Fame entry`,
    };
    await check("Hall of Fame authorization", "anonymous cannot insert Hall of Fame entries", async () => requireDenied(await anon.from("hof_entries").insert(deniedHofEntry)));
    await check("Hall of Fame authorization", "anonymous cannot update Hall of Fame entries", async () => requireDenied(await anon.from("hof_entries").update({ title: "Denied" }).eq("id", config.ids.hof).select()));
    await check("Hall of Fame authorization", "anonymous cannot delete Hall of Fame entries", async () => requireDenied(await anon.from("hof_entries").delete().eq("id", config.ids.hof).select()));
    await check("Hall of Fame authorization", "non-admin cannot insert Hall of Fame entries", async () => requireDenied(await nonadmin.from("hof_entries").insert(deniedHofEntry)));
    await check("Hall of Fame authorization", "non-admin cannot update Hall of Fame entries", async () => requireNoWrite(await nonadmin.from("hof_entries").update({ title: "Denied" }).eq("id", config.ids.hof).select()));
    await check("Hall of Fame authorization", "non-admin cannot delete Hall of Fame entries", async () => requireNoWrite(await nonadmin.from("hof_entries").delete().eq("id", config.ids.hof).select()));

    for (const rpc of ADMIN_RPC_NAMES) {
      await check("RPC denial", `anonymous cannot execute ${rpc}`, async () => requireDenied(await anon.rpc(rpc, rpcArguments(rpc))));
      await check("RPC denial", `non-admin cannot execute ${rpc}`, async () => requireAdminGuard(await nonadmin.rpc(rpc, rpcArguments(rpc))));
    }

    await check("direct-write guards", "anonymous direct game insert is denied", async () => requireDenied(await anon.from("games").insert({
      id: config.ids.deniedGame,
      league_id: config.ids.league,
      sport: "kickball",
      home_team_id: config.ids.homeTeam,
      away_team_id: config.ids.awayTeam,
      date: "2099-07-14",
      time: "6:30 PM",
      location: config.runId,
    })));
    await check("direct-write guards", "non-admin direct score update is denied", async () => requireNoWrite(await nonadmin.from("games").update({ home_score: 99 }).eq("id", config.ids.game).select()));
    await check("direct-write guards", "administrator cannot directly update an unlocked score", async () => requireDenied(await admin.from("games").update({ home_score: 99 }).eq("id", config.ids.game).select()));
    await check("direct-write guards", "administrator cannot insert a score-bearing game directly", async () => requireDenied(await admin.from("games").insert({
      id: config.ids.deniedGame,
      league_id: config.ids.league,
      sport: "kickball",
      home_team_id: config.ids.homeTeam,
      away_team_id: config.ids.awayTeam,
      date: "2099-07-14",
      time: "6:45 PM",
      location: config.runId,
      home_score: 1,
      away_score: 0,
    })));
    await check("direct-write guards", "administrator cannot insert player stats directly", async () => requireDenied(await admin.from("player_stats").insert({
      game_id: config.ids.game,
      profile_id: config.ids.profile,
      team_id: config.ids.homeTeam,
      sport: "kickball",
      stats: { runs: 1 },
    })));
    await check("direct-write guards", "administrator cannot insert game history directly", async () => requireDenied(await admin.from("game_edit_history").insert({
      game_id: config.ids.game,
      action: "Bypass",
      reason: config.runId,
    })));
    await check("direct-write guards", "non-admin direct bracket insertion is denied", async () => requireDenied(await nonadmin.from("playoff_brackets").insert({ league_id: config.ids.league, bracket_size: 4 })));
    await check("direct-write guards", "non-admin cannot alter a team identity", async () => requireNoWrite(await nonadmin.from("team_identities").update({ name: "Changed" }).eq("name", `${config.runId} home`).select()));
    await check("direct-write guards", "administrator cannot directly insert a team identity", async () => requireDenied(await admin.from("team_identities").insert({ name: `${config.runId} bypass identity`, logo_color: "#000000" })));
    await check("direct-write guards", "administrator cannot directly update a team identity", async () => requireDenied(await admin.from("team_identities").update({ status: "inactive" }).eq("name", `${config.runId} home`).select()));
    await check("direct-write guards", "administrator cannot directly delete a team identity", async () => requireDenied(await admin.from("team_identities").delete().eq("id", config.ids.unknownTeamIdentity).select()));
    await check("direct-write guards", "administrator cannot directly insert a team enrollment", async () => {
      const source = requireSuccess(await admin.from("teams").select("identity_id").eq("id", config.ids.homeTeam).single());
      return requireDenied(await admin.from("teams").insert({
        identity_id: source.identity_id,
        league_id: config.ids.identityLeague,
        name: `${config.runId} bypass enrollment`,
        sport: "flag_football",
        logo_color: "#000000",
        status: "active",
      }));
    });
    await check("direct-write guards", "administrator cannot directly update a team enrollment", async () => requireDenied(await admin.from("teams").update({ division: "Bypass" }).eq("id", config.ids.homeTeam).select()));
    await check("direct-write guards", "administrator cannot directly delete a team enrollment", async () => requireDenied(await admin.from("teams").delete().eq("id", config.ids.unknownPlayoffMatch).select()));
    await check("direct-write guards", "administrator cannot directly mutate bracket headers", async () => requireDenied(await admin.from("playoff_brackets").update({ status: "complete" }).eq("id", config.ids.unknownPlayoffMatch).select()));
    await check("direct-write guards", "administrator cannot directly mutate locked seeds", async () => requireDenied(await admin.from("playoff_seeds").update({ seed: 99 }).eq("bracket_id", config.ids.unknownPlayoffMatch).select()));
    await check("direct-write guards", "administrator cannot directly mutate match topology", async () => requireDenied(await admin.from("playoff_matches").update({ label: "Tampered" }).eq("id", config.ids.unknownPlayoffMatch).select()));
    await check("direct-write guards", "admin cannot mutate signed waiver fields", async () => requireDenied(await admin.from("waivers").update({ signed_name: "Changed" }).eq("id", config.ids.waiver).select()));
    await check("direct-write guards", "admin cannot update append-only history", async () => requireDenied(await admin.from("game_edit_history").update({ action: "Changed" }).eq("id", config.ids.seedHistory).select()));
    await check("direct-write guards", "admin cannot delete append-only history", async () => requireDenied(await admin.from("game_edit_history").delete().eq("id", config.ids.seedHistory).select()));

    await check("payments authorization", "administrator can insert a charge", async () => {
      requireSuccess(await admin.from("charges").insert({
        id: config.ids.adminCharge,
        season: config.season,
        profile_id: config.ids.profile,
        amount_due_cents: 2500,
        kind: "other",
        notes: config.runId,
      }));
    });
    await check("payments authorization", "administrator can update a charge", async () => {
      const rows = requireSuccess(await admin.from("charges").update({ amount_due_cents: 3000 }).eq("id", config.ids.adminCharge).select("amount_due_cents"));
      requireCondition(rows.length === 1 && rows[0].amount_due_cents === 3000, "Admin charge update did not persist.");
    });
    await check("payments authorization", "administrator can insert a payment entry", async () => {
      requireSuccess(await admin.from("payment_entries").insert({
        id: config.ids.adminPayment,
        charge_id: config.ids.adminCharge,
        amount_cents: 1000,
        method: "matrix",
        note: config.runId,
      }));
    });
    await check("payments authorization", "administrator can update a payment entry", async () => {
      const rows = requireSuccess(await admin.from("payment_entries").update({ amount_cents: 1500 }).eq("id", config.ids.adminPayment).select("amount_cents"));
      requireCondition(rows.length === 1 && rows[0].amount_cents === 1500, "Admin payment update did not persist.");
    });
    await check("payments authorization", "administrator can delete a payment entry", async () => {
      const rows = requireSuccess(await admin.from("payment_entries").delete().eq("id", config.ids.adminPayment).select("id"));
      requireCondition(rows.length === 1, "Admin payment delete did not remove the row.");
    });
    await check("payments authorization", "administrator can delete a charge after its entries are removed", async () => {
      const rows = requireSuccess(await admin.from("charges").delete().eq("id", config.ids.adminCharge).select("id"));
      requireCondition(rows.length === 1, "Admin charge delete did not remove the row.");
    });

    await check("admin RPC success", "set_game_status succeeds", async () => {
      requireSuccess(await admin.rpc("set_game_status", { p_game_id: config.ids.game, p_status: "postponed" }));
      requireSuccess(await admin.rpc("set_game_status", { p_game_id: config.ids.game, p_status: "upcoming" }));
    });
    await check("admin RPC success", "submit_score succeeds and writes score", async () => {
      requireSuccess(await admin.rpc("submit_score", rpcArguments("submit_score")));
      const data = requireSuccess(await admin.from("games").select("home_score,away_score,score_status").eq("id", config.ids.game).single());
      requireCondition(data.home_score === 1 && data.away_score === 0 && data.score_status === "submitted", "Saved score did not persist.");
    });
    await check("admin RPC success", "lock_game succeeds", async () => {
      requireSuccess(await admin.rpc("lock_game", rpcArguments("lock_game")));
      const data = requireSuccess(await admin.from("games").select("locked,score_status").eq("id", config.ids.game).single());
      requireCondition(data.locked === true && data.score_status === "final", "Game did not lock.");
    });
    await check("locked-game guards", "empty correction reason is rejected", async () => {
      const args = { ...rpcArguments("correct_final_score"), p_reason: "   " };
      requireDenied(await admin.rpc("correct_final_score", args));
    });
    await check("locked-game guards", "direct locked score update is rejected", async () => requireDenied(await admin.from("games").update({ home_score: 77 }).eq("id", config.ids.game).select()));
    await check("locked-game guards", "direct locked stage update is rejected", async () => requireDenied(await admin.from("games").update({ stage: "playoff" }).eq("id", config.ids.game).select()));
    await check("admin RPC success", "correct_final_score succeeds with a reason and preserves final lock", async () => {
      requireSuccess(await admin.rpc("correct_final_score", rpcArguments("correct_final_score")));
      const data = requireSuccess(await admin.from("games").select("home_score,away_score,locked,score_status,status").eq("id", config.ids.game).single());
      requireCondition(
        data.home_score === 2 && data.away_score === 0 && data.locked === true && data.score_status === "final" && data.status === "completed",
        "Corrected game did not remain completed, final, and locked.",
      );
    });

    let scheduledPlayoffGame;
    await check("playoff RPC success", "administrator generates a fixed single-elimination bracket", async () => {
      const bracketId = requireSuccess(await admin.rpc("generate_single_elim_bracket", rpcArguments("generate_single_elim_bracket")));
      requireCondition(Boolean(bracketId), "Bracket RPC did not return an ID.");
      const rows = requireSuccess(await anon.from("playoff_brackets").select("id,bracket_size").eq("id", bracketId));
      requireCondition(rows.length === 1 && rows[0].bracket_size === 4, "Generated bracket was not public or correctly sized.");
    });
    await check("playoff RPC success", "administrator schedules a ready bracket match", async () => {
      const matches = requireSuccess(await admin.from("playoff_matches").select("id").eq("status", "ready").order("match_number").limit(1));
      requireCondition(matches.length === 1, "No ready playoff match was generated.");
      scheduledPlayoffGame = requireSuccess(await admin.rpc("schedule_playoff_match", {
        p_match_id: matches[0].id,
        p_date: "2099-07-14",
        p_time: "7:00 PM",
        p_location: config.runId,
      }));
      requireCondition(Boolean(scheduledPlayoffGame), "Schedule RPC did not return a game ID.");
    });
    await check("playoff RPC success", "administrator links a matching existing playoff game", async () => {
      const matches = requireSuccess(await admin.from("playoff_matches").select("id,home_team_id,away_team_id").eq("status", "ready").is("game_id", null).order("match_number").limit(1));
      requireCondition(matches.length === 1, "No second ready playoff match was available.");
      requireSuccess(await admin.from("games").insert({
        id: config.ids.linkedPlayoffGame,
        league_id: config.ids.league,
        sport: "kickball",
        home_team_id: matches[0].home_team_id,
        away_team_id: matches[0].away_team_id,
        date: "2099-07-14",
        time: "8:00 PM",
        location: config.runId,
        stage: "playoff",
      }));
      requireSuccess(await admin.rpc("link_playoff_game", { p_match_id: matches[0].id, p_game_id: config.ids.linkedPlayoffGame }));
    });
    await check("playoff RPC success", "administrator advances a final locked playoff result", async () => {
      requireCondition(Boolean(scheduledPlayoffGame), "Scheduled playoff game was unavailable.");
      requireSuccess(await admin.rpc("submit_score", {
        p_game_id: scheduledPlayoffGame,
        p_home_score: 3,
        p_away_score: 1,
        p_periods: { home: [3], away: [1] },
        p_stats: {},
        p_override_reason: "Hosted matrix uses a team-only aggregate playoff score",
      }));
      requireSuccess(await admin.rpc("lock_game", { p_game_id: scheduledPlayoffGame }));
      const match = requireSuccess(await admin.from("playoff_matches").select("id").eq("game_id", scheduledPlayoffGame).single());
      requireSuccess(await admin.rpc("advance_playoff_match", { p_match_id: match.id }));
      const result = requireSuccess(await anon.from("playoff_matches").select("status,winner_team_id").eq("id", match.id).single());
      requireCondition(result.status === "completed" && result.winner_team_id, "Final result did not advance publicly.");
    });

    await check("admin RPC success", "approve_registration succeeds", async () => {
      const data = requireSuccess(await admin.rpc("approve_registration", rpcArguments("approve_registration")));
      requireCondition(Boolean(data?.identity_id && data?.team_id && data?.captain_profile_id), "Approval did not return linked identity, enrollment, and captain IDs.");
    });
    await check("admin RPC success", "assign_free_agent succeeds", async () => {
      const data = requireSuccess(await admin.rpc("assign_free_agent", rpcArguments("assign_free_agent")));
      requireCondition(Boolean(data?.profile_id && data?.team_player_id), "Assignment did not return linked IDs.");
    });
    await check("admin RPC success", "verify_waiver succeeds and updates eligibility", async () => {
      requireSuccess(await admin.rpc("verify_waiver", rpcArguments("verify_waiver")));
      const data = requireSuccess(await admin.from("waivers").select("verification_status,profile_id").eq("id", config.ids.waiver).single());
      requireCondition(data.verification_status === "verified" && data.profile_id, "Waiver did not become verified and linked.");
    });
    await check("edit history", "admin RPCs created append-only correction history with before/after state", async () => {
      const data = requireSuccess(await admin.from("game_edit_history").select("action,reason,before_state,after_state,override_reason").eq("game_id", config.ids.game));
      requireCondition(data.length >= 6, "Expected RPC history rows were not created.");
      requireCondition(data.some((row) => (
        row.action === "Final score corrected"
        && row.reason === "Hosted matrix verified final-score correction reason"
        && row.before_state?.home_score === 1
        && row.after_state?.home_score === 2
        && row.override_reason === "Hosted matrix uses a team-only aggregate score"
      )), "Correction reason, before/after state, or override reason was not retained.");
    });

    await check("team identity RPC success", "administrator enrolls a persistent identity cross-sport without history", async () => {
      const source = requireSuccess(await admin.from("teams").select("identity_id").eq("id", config.ids.homeTeam).single());
      const teamId = requireSuccess(await admin.rpc("enroll_team_identity", {
        p_identity_id: source.identity_id,
        p_league_id: config.ids.identityLeague,
        p_captain_id: null,
        p_division: "Matrix",
      }));
      requireSuccess(await admin.rpc("update_team_enrollment", {
        p_team_id: teamId,
        p_patch: { division: "RPC verified", status: "active" },
      }));
      const enrollment = requireSuccess(await admin.from("teams").select("identity_id,sport,name,division,status").eq("id", teamId).single());
      const roster = requireSuccess(await admin.from("team_players").select("id").eq("team_id", teamId));
      const charges = requireSuccess(await admin.from("charges").select("id").eq("team_id", teamId));
      requireCondition(enrollment.identity_id === source.identity_id && enrollment.sport === "flag_football", "Enrollment did not reuse the identity in the target sport.");
      requireCondition(enrollment.division === "RPC verified" && enrollment.status === "active", "Enrollment RPC edit did not persist.");
      requireCondition(roster.length === 0 && charges.length === 0, "Enrollment unexpectedly copied roster or payment rows.");
    });
    await check("team identity RPC success", "administrator updates the canonical identity and propagation persists", async () => {
      const source = requireSuccess(await admin.from("teams").select("identity_id").eq("id", config.ids.homeTeam).single());
      const name = `${config.runId} home updated`;
      requireSuccess(await admin.rpc("update_team_identity", {
        p_identity_id: source.identity_id,
        p_patch: { name, logo_color: "#112233" },
      }));
      const enrollments = requireSuccess(await admin.from("teams").select("name,logo_color").eq("identity_id", source.identity_id));
      requireCondition(enrollments.length === 2 && enrollments.every((row) => row.name === name && row.logo_color === "#112233"), "Canonical identity edit did not propagate to every enrollment.");
    });
    await check("team identity RPC success", "administrator creates an identity and first enrollment atomically", async () => {
      const data = requireSuccess(await admin.rpc("create_team_identity_and_enroll", {
        p_name: `${config.runId} atomic identity`,
        p_logo_color: "#A855F7",
        p_founded: "2099",
        p_league_id: config.ids.identityLeague,
        p_captain_id: null,
        p_division: null,
      }));
      requireCondition(Boolean(data?.identity_id && data?.team_id), "Atomic RPC did not return both IDs.");
      const team = requireSuccess(await admin.from("teams").select("identity_id,sport").eq("id", data.team_id).single());
      requireCondition(team.identity_id === data.identity_id && team.sport === "flag_football", "Atomic enrollment was not linked correctly.");
    });

    await check("Hall of Fame gate", "admin can create unpublished Hall of Fame entry", async () => {
      requireSuccess(await admin.from("league_settings").update({ hof_published: false }).eq("id", 1));
      requireSuccess(await admin.from("hof_entries").insert({
        id: config.ids.hof,
        entry_type: "game",
        game_id: config.ids.game,
        sport: "kickball",
        season: config.season,
        title: `${config.runId} Hall of Fame`,
        blurb: "Disposable authorization fixture",
      }));
      const data = requireSuccess(await admin.from("hof_entries").select("id").eq("id", config.ids.hof));
      requireCondition(data.length === 1, "Admin could not read unpublished entry.");
    });
    await check("Hall of Fame gate", "anonymous cannot see unpublished entry", async () => {
      const data = requireSuccess(await anon.from("public_hof_entries").select("id").eq("id", config.ids.hof));
      requireCondition(data.length === 0, "Anonymous saw unpublished entry.");
    });
    await check("Hall of Fame gate", "non-admin cannot see unpublished entry", async () => {
      const data = requireSuccess(await nonadmin.from("public_hof_entries").select("id").eq("id", config.ids.hof));
      requireCondition(data.length === 0, "Non-admin saw unpublished entry.");
    });
    await check("Hall of Fame gate", "published entry becomes public", async () => {
      requireSuccess(await admin.from("league_settings").update({ hof_published: true }).eq("id", 1));
      const anonRows = requireSuccess(await anon.from("public_hof_entries").select("id").eq("id", config.ids.hof));
      const nonadminRows = requireSuccess(await nonadmin.from("public_hof_entries").select("id").eq("id", config.ids.hof));
      requireCondition(anonRows.length === 1 && nonadminRows.length === 1, "Published entry did not become public.");
      requireSuccess(await admin.from("league_settings").update({ hof_published: config.baselineHofPublished }).eq("id", 1));
    });
    await check("Hall of Fame authorization", "administrator can update a Hall of Fame entry", async () => {
      const data = requireSuccess(await admin.from("hof_entries").update({ title: `${config.runId} Hall of Fame updated` }).eq("id", config.ids.hof).select("title").single());
      requireCondition(data.title.endsWith("updated"), "Administrator Hall of Fame update did not persist.");
    });
    await check("Hall of Fame authorization", "administrator can delete a Hall of Fame entry", async () => {
      const data = requireSuccess(await admin.from("hof_entries").delete().eq("id", config.ids.hof).select("id"));
      requireCondition(data.length === 1, "Administrator Hall of Fame delete did not remove one row.");
    });
  } catch (error) {
    checks.push({ category: "harness", name: "matrix execution", status: "FAIL", detail: cleanDetail(error.message || error) });
    log(`FAIL [harness] ${cleanDetail(error.message || error)}`);
  } finally {
    credentials.adminPassword = "";
    credentials.nonadminPassword = "";
    Object.values(fields).forEach((field) => { field.value = ""; });
    mfaStep.hidden = true;
    await Promise.allSettled([admin?.auth.signOut({ scope: "local" }), nonadmin?.auth.signOut({ scope: "local" })]);
    const finishedAt = new Date().toISOString();
    log("Finalizing sanitized report and privileged fixture cleanup…");
    try {
      const response = await fetch("/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startedAt, finishedAt, checks }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Report finalization failed.");
      log(`REPORT SAVED: ${result.report}`);
      log(`CLEANUP: ${result.cleanup ? "PASS" : "FAIL"}`);
    } catch (error) {
      log(`FINALIZATION FAILED: ${cleanDetail(error.message || error)}`);
    }
  }
}

runButton.addEventListener("click", runMatrix);
