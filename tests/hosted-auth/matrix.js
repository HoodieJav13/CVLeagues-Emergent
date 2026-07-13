/* global supabase */

const output = document.getElementById("output");
const runButton = document.getElementById("run");
const fields = {
  adminEmail: document.getElementById("admin-email"),
  adminPassword: document.getElementById("admin-password"),
  nonadminEmail: document.getElementById("nonadmin-email"),
  nonadminPassword: document.getElementById("nonadmin-password"),
};

const checks = [];
let config;
let admin;
let nonadmin;
let anon;
let startedAt;

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

function client() {
  return supabase.createClient(config.supabaseUrl, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(targetClient, email, password) {
  const result = await targetClient.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session) throw new Error(result.error?.message || "No Auth session returned.");
  return result.data.session;
}

function rpcArguments(name) {
  return {
    save_score: { p_game_id: config.ids.game, p_home_score: 1, p_away_score: 0, p_periods: { home: [1, 0, 0, 0, 0], away: [0, 0, 0, 0, 0] }, p_stats: {} },
    lock_game: { p_game_id: config.ids.game },
    unlock_game: { p_game_id: config.ids.game, p_reason: "matrix negative authorization check" },
    set_game_status: { p_game_id: config.ids.game, p_status: "postponed" },
    approve_registration: { p_registration_id: config.ids.registration, p_league_id: config.ids.league, p_create_captain_profile: true },
    assign_free_agent: { p_free_agent_id: config.ids.freeAgent, p_team_id: config.ids.homeTeam, p_jersey_number: 31, p_position: "Utility" },
    verify_waiver: { p_waiver_id: config.ids.waiver, p_decision: "verified" },
  }[name];
}

async function runMatrix() {
  runButton.disabled = true;
  output.textContent = "";
  startedAt = new Date().toISOString();
  config = await fetch("/config.json", { cache: "no-store" }).then((response) => response.json());
  anon = client();
  admin = client();
  nonadmin = client();

  const credentials = {
    adminEmail: fields.adminEmail.value.trim(),
    adminPassword: fields.adminPassword.value,
    nonadminEmail: fields.nonadminEmail.value.trim(),
    nonadminPassword: fields.nonadminPassword.value,
  };
  Object.values(fields).forEach((field) => { field.value = ""; });

  try {
    requireCondition(credentials.adminEmail && credentials.adminPassword && credentials.nonadminEmail && credentials.nonadminPassword, "Both account credentials are required.");
    await signIn(admin, credentials.adminEmail, credentials.adminPassword);
    credentials.adminPassword = "";
    await signIn(nonadmin, credentials.nonadminEmail, credentials.nonadminPassword);
    credentials.nonadminPassword = "";
    credentials.adminEmail = "";
    credentials.nonadminEmail = "";

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

    const registration = {
      id: config.ids.registration,
      captain_name: `${config.runId} Captain`,
      captain_email: `${config.runId}.captain@example.invalid`,
      sport: "kickball",
      team_name: `${config.runId} approved team`,
      preferred_season: config.season,
      consent_to_contact: true,
    };
    const freeAgent = {
      id: config.ids.freeAgent,
      first_name: config.runId,
      last_name: "Agent",
      email: `${config.runId}.agent@example.invalid`,
      sports: ["kickball"],
      consent_to_contact: true,
    };
    const waiver = {
      id: config.ids.waiver,
      signed_name: `${config.runId} Agent`,
      email: `${config.runId}.agent@example.invalid`,
      waiver_version: config.waiverVersion,
      accepted_terms: true,
      age_confirmed: true,
      media_consent: false,
      user_agent: "cvf-hosted-auth-matrix",
    };

    await check("anonymous submissions", "clean team-interest submission succeeds", async () => {
      requireSuccess(await anon.from("team_registrations").insert(registration));
    });
    await check("anonymous submissions", "clean free-agent submission succeeds", async () => {
      requireSuccess(await anon.from("free_agents").insert(freeAgent));
    });
    await check("anonymous submissions", "clean current-version waiver submission succeeds", async () => {
      requireSuccess(await anon.from("waivers").insert(waiver));
    });
    await check("anonymous submissions", "anonymous intake cannot set triage state", async () => {
      return requireDenied(await anon.from("team_registrations").insert({ ...registration, id: crypto.randomUUID(), status: "approved" }));
    });

    const publicReads = [
      ["seasons", "name", config.season],
      ["leagues", "id", config.ids.league],
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
    await check("public reads", "public_profiles exposes allowlisted fixture profile", async () => {
      const data = requireSuccess(await anon.from("public_profiles").select("id,name,eligibility_status").eq("id", config.ids.profile));
      requireCondition(data.length === 1, "Fixture public profile was not visible.");
    });
    await check("public reads", "public_profiles rejects PII column selection", async () => {
      return requireDenied(await anon.from("public_profiles").select("id,email").eq("id", config.ids.profile));
    });

    for (const table of ["admin_users", "profiles", "waivers", "team_registrations", "free_agents", "game_edit_history", "charges", "payment_entries"]) {
      await check("private reads", `anonymous cannot read ${table}`, async () => requireHidden(await anon.from(table).select("*").limit(1)));
      await check("private reads", `non-admin cannot read ${table}`, async () => requireHidden(await nonadmin.from(table).select("*").limit(1)));
    }

    for (const rpc of ["save_score", "lock_game", "unlock_game", "set_game_status", "approve_registration", "assign_free_agent", "verify_waiver"]) {
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
    await check("direct-write guards", "admin cannot mutate signed waiver fields", async () => requireDenied(await admin.from("waivers").update({ signed_name: "Changed" }).eq("id", config.ids.waiver).select()));
    await check("direct-write guards", "admin cannot update append-only history", async () => requireDenied(await admin.from("game_edit_history").update({ action: "Changed" }).eq("id", config.ids.seedHistory).select()));
    await check("direct-write guards", "admin cannot delete append-only history", async () => requireDenied(await admin.from("game_edit_history").delete().eq("id", config.ids.seedHistory).select()));

    await check("admin RPC success", "set_game_status succeeds", async () => {
      requireSuccess(await admin.rpc("set_game_status", { p_game_id: config.ids.game, p_status: "postponed" }));
      requireSuccess(await admin.rpc("set_game_status", { p_game_id: config.ids.game, p_status: "upcoming" }));
    });
    await check("admin RPC success", "save_score succeeds and writes score", async () => {
      requireSuccess(await admin.rpc("save_score", rpcArguments("save_score")));
      const data = requireSuccess(await admin.from("games").select("home_score,away_score,score_status").eq("id", config.ids.game).single());
      requireCondition(data.home_score === 1 && data.away_score === 0 && data.score_status === "submitted", "Saved score did not persist.");
    });
    await check("admin RPC success", "lock_game succeeds", async () => {
      requireSuccess(await admin.rpc("lock_game", rpcArguments("lock_game")));
      const data = requireSuccess(await admin.from("games").select("locked,score_status").eq("id", config.ids.game).single());
      requireCondition(data.locked === true && data.score_status === "final", "Game did not lock.");
    });
    await check("locked-game guards", "empty unlock reason is rejected", async () => requireDenied(await admin.rpc("unlock_game", { p_game_id: config.ids.game, p_reason: "   " })));
    await check("locked-game guards", "direct locked score update is rejected", async () => requireDenied(await admin.from("games").update({ home_score: 77 }).eq("id", config.ids.game).select()));
    await check("locked-game guards", "direct locked stage update is rejected", async () => requireDenied(await admin.from("games").update({ stage: "playoff" }).eq("id", config.ids.game).select()));
    await check("admin RPC success", "unlock_game succeeds with a reason", async () => {
      requireSuccess(await admin.rpc("unlock_game", { p_game_id: config.ids.game, p_reason: "hosted matrix verified unlock reason" }));
      const data = requireSuccess(await admin.from("games").select("locked,score_status").eq("id", config.ids.game).single());
      requireCondition(data.locked === false && data.score_status === "approved", "Game did not unlock.");
    });
    await check("admin RPC success", "approve_registration succeeds", async () => {
      const data = requireSuccess(await admin.rpc("approve_registration", rpcArguments("approve_registration")));
      requireCondition(Boolean(data?.team_id && data?.captain_profile_id), "Approval did not return linked IDs.");
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
    await check("edit history", "admin RPCs created append-only history with unlock reason", async () => {
      const data = requireSuccess(await admin.from("game_edit_history").select("action,reason").eq("game_id", config.ids.game));
      requireCondition(data.length >= 6, "Expected RPC history rows were not created.");
      requireCondition(data.some((row) => row.action === "Unlocked" && row.reason === "hosted matrix verified unlock reason"), "Unlock reason was not retained.");
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
      const data = requireSuccess(await anon.from("hof_entries").select("id").eq("id", config.ids.hof));
      requireCondition(data.length === 0, "Anonymous saw unpublished entry.");
    });
    await check("Hall of Fame gate", "non-admin cannot see unpublished entry", async () => {
      const data = requireSuccess(await nonadmin.from("hof_entries").select("id").eq("id", config.ids.hof));
      requireCondition(data.length === 0, "Non-admin saw unpublished entry.");
    });
    await check("Hall of Fame gate", "published entry becomes public", async () => {
      requireSuccess(await admin.from("league_settings").update({ hof_published: true }).eq("id", 1));
      const anonRows = requireSuccess(await anon.from("hof_entries").select("id").eq("id", config.ids.hof));
      const nonadminRows = requireSuccess(await nonadmin.from("hof_entries").select("id").eq("id", config.ids.hof));
      requireCondition(anonRows.length === 1 && nonadminRows.length === 1, "Published entry did not become public.");
      requireSuccess(await admin.from("league_settings").update({ hof_published: config.baselineHofPublished }).eq("id", 1));
    });
  } catch (error) {
    checks.push({ category: "harness", name: "matrix execution", status: "FAIL", detail: cleanDetail(error.message || error) });
    log(`FAIL [harness] ${cleanDetail(error.message || error)}`);
  } finally {
    credentials.adminPassword = "";
    credentials.nonadminPassword = "";
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
