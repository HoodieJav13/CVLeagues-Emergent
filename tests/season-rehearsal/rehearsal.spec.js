// Season 1 rehearsal — local mock mode, through the real public and admin UI.
//
// Prerequisite: the development server in mock mode (no REACT_APP_SUPABASE_*
// variables), e.g. `cd frontend && BROWSER=none npm start`. See README.md.
//
// One serial journey carries the fictional fixture from intake to public
// records. Each step asserts the visible outcome; screenshots land in
// $REHEARSAL_ARTIFACTS (default ./artifacts).
const path = require("path");
const fs = require("fs");
const { test, expect } = require("@playwright/test");
const F = require("./fixture.cjs");

const STORAGE_KEY = "cvf_app_state_v11";
const ART = process.env.REHEARSAL_ARTIFACTS || path.join(__dirname, "artifacts");
fs.mkdirSync(ART, { recursive: true });

const errors = [];
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`), fullPage: true });

async function readState(page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).state, STORAGE_KEY);
}
async function writeState(page, state) {
  await page.evaluate(([key, s]) => window.localStorage.setItem(key, JSON.stringify({ version: 11, state: s })), [STORAGE_KEY, state]);
}
const byName = (state, collection, name) => state[collection].find((r) => r.name === name);

// The demo role is in-memory only, so in-app navigation must not reload the
// page. Push the route and let React Router pick it up from popstate.
async function nav(page, route) {
  await page.evaluate((r) => { window.history.pushState({}, "", r); window.dispatchEvent(new PopStateEvent("popstate")); }, route);
  await page.waitForURL((u) => u.pathname === route.split("?")[0]);
}

async function becomeRole(page, role) {
  await page.getByTestId("role-switcher").click();
  await page.getByTestId(`role-option-${role}`).click();
}
async function pickOption(page, trigger, name) {
  await trigger.click();
  await page.getByRole("option", { name, exact: true }).click();
}
async function adminTab(page, id) {
  if (!page.url().endsWith("/admin")) {
    await nav(page, "/admin");
  }
  await page.getByTestId(`admin-tab-${id}`).click();
}
async function saveModal(page) {
  await page.getByTestId("admin-modal-save").click();
  await expect(page.getByTestId("admin-modal")).toHaveCount(0);
}

// Aggregate entry through /score-entry, reached the way the admin does: the
// Schedule/Games "enter score" link carries the game id.
async function enterScore(page, game, { awayPeriods, homePeriods, stats, override, expectHard } = {}) {
  await adminTab(page, "games");
  await page.getByTestId(`admin-game-enter-score-${game.id}`).click();
  await expect(page).toHaveURL(/score-entry/);
  const state = await readState(page);
  for (const [i, v] of awayPeriods.entries()) await page.getByTestId(`score-away-period-${i}`).fill(String(v));
  for (const [i, v] of homePeriods.entries()) await page.getByTestId(`score-home-period-${i}`).fill(String(v));
  for (const [name, line] of stats || []) {
    const profile = byName(state, "profiles", name);
    if (!profile) throw new Error(`fixture player ${name} missing`);
    await page.getByTestId(`score-player-toggle-${profile.id}`).click();
    for (const [key, value] of Object.entries(line)) {
      await page.getByTestId(`score-stat-${profile.id}-${key}`).fill(String(value));
    }
  }
  await page.getByTestId("score-save").click();
  if (expectHard) {
    await expect(page.getByTestId("score-hard-errors")).toContainText(expectHard);
    return;
  }
  if (override) {
    await expect(page.getByTestId("score-override-dialog")).toBeVisible();
    await page.getByTestId("score-override-confirm").click(); // empty reason is refused first
    await expect(page.getByTestId("score-override-dialog")).toContainText("override reason is required");
    await page.getByTestId("score-override-reason").fill(override);
    await page.getByTestId("score-override-confirm").click();
  }
  await expect(page).toHaveURL(new RegExp(`/game/${game.id}$`));
}

async function markFinal(page, gameId) {
  await adminTab(page, "games");
  await page.getByTestId(`admin-mark-final-game-${gameId}`).click();
  await expect(page.getByTestId(`admin-game-${gameId}`)).toContainText(/final/i);
}

test.describe.configure({ mode: "serial" });

test("Season 1 rehearsal: intake → approval → rosters → schedule → scores → correction → records", async ({ page }) => {
  test.setTimeout(15 * 60_000);
  // CRA's dev-only error overlay also fires on the benign "ResizeObserver loop"
  // notice and then swallows clicks. Hide it; every error is still recorded.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "#webpack-dev-server-client-overlay{display:none!important}";
      document.head.appendChild(style);
    });
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });

  await test.step("0. fresh mock state, admin role", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("role-switcher")).toBeVisible();
    await becomeRole(page, "admin");
    await nav(page, "/admin");
    await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
  });

  await test.step("1. season, leagues, defaults, venue", async () => {
    await adminTab(page, "leagues");
    await page.getByRole("button", { name: "New Season" }).click();
    await page.getByTestId("admin-season-name").fill(F.SEASON);
    await saveModal(page);
    for (const league of Object.values(F.LEAGUES)) {
      await page.getByTestId("admin-add-league").click();
      await page.getByTestId("admin-league-name").fill(league.name);
      const modal = page.getByTestId("admin-modal");
      const [sportTrigger, seasonTrigger] = await modal.getByRole("combobox").all();
      await pickOption(page, sportTrigger, league.sport === "kickball" ? "Kickball" : "Flag Football");
      await pickOption(page, seasonTrigger, F.SEASON);
      await saveModal(page);
      await pickOption(page, page.getByTestId(`admin-current-season-${league.sport}`), F.SEASON);
    }
    const state = await readState(page);
    expect(state.settings.current_seasons).toEqual({ kickball: F.SEASON, flag_football: F.SEASON });
    for (const sport of ["kickball", "flag_football"]) {
      if (!state.settings.registration_open[sport]) await page.getByTestId(`admin-toggle-reg-${sport}`).click();
    }
    await shot(page, "01-leagues");

    await adminTab(page, "venues");
    await page.getByTestId("admin-add-venue").click();
    await page.getByTestId("admin-venue-name").fill(F.VENUE.name);
    await page.getByTestId("admin-venue-field").fill(F.VENUE.field_label);
    await page.getByTestId("admin-venue-address").fill(F.VENUE.address);
    await page.getByTestId("admin-venue-save").click();
    await expect(page.getByTestId("admin-venues-table")).toContainText(F.VENUE.name);
  });

  await test.step("2. public intake (anonymous visitor)", async () => {
    await becomeRole(page, "anonymous");
    for (const reg of F.REGISTRATIONS) {
      await nav(page, "/register-team");
      if (await page.getByTestId("registration-success").count()) await page.getByRole("button", { name: "Submit Another" }).click();
      await page.getByTestId("reg-submit").click(); // empty submit → field errors, nothing stored
      await expect(page.getByText("Captain name is required")).toBeVisible();
      await page.getByTestId("reg-captain-name").fill(reg.captain_name);
      await page.getByTestId("reg-captain-email").fill(reg.captain_email);
      await page.getByTestId("reg-captain-phone").fill(reg.captain_phone);
      await pickOption(page, page.getByTestId("reg-sport"), reg.sport === "kickball" ? "Kickball" : "Flag Football");
      await page.getByTestId("reg-team-name").fill(reg.team_name);
      await page.getByTestId("reg-roster-size").fill(String(reg.roster));
      await page.getByTestId("reg-consent").click();
      await page.getByTestId("reg-submit").click();
      await expect(page.getByTestId("registration-success")).toContainText(reg.team_name);
    }
    await shot(page, "02-registration-success");
    for (const fa of F.FREE_AGENTS) {
      // The free-agent success screen has no "submit another" (unlike Team
      // Interest), so leave the route and come back to remount the form.
      await nav(page, "/");
      await nav(page, "/free-agent-signup");
      await page.getByTestId("fa-first-name").fill(fa.first_name);
      await page.getByTestId("fa-last-name").fill(fa.last_name);
      await page.getByTestId("fa-email").fill(fa.email);
      await page.getByTestId("fa-phone").fill(fa.phone);
      await page.getByTestId(`fa-sport-${fa.sport}`).click();
      await page.getByTestId("fa-consent").click();
      await page.getByTestId("fa-submit").click();
      await expect(page.getByTestId("free-agent-success")).toBeVisible();
    }
    const state = await readState(page);
    for (const reg of F.REGISTRATIONS) {
      const row = state.registrations.find((r) => r.team_name === reg.team_name);
      expect(row).toMatchObject({ status: "new", preferred_season: F.SEASON, sport: reg.sport });
    }
    expect(state.freeAgents.filter((a) => a.email?.endsWith("@example.test"))).toHaveLength(2);
  });

  await test.step("3. admin approves registrations, creates direct teams", async () => {
    await becomeRole(page, "admin");
    await adminTab(page, "registrations");
    let state = await readState(page);
    for (const reg of F.REGISTRATIONS) {
      const row = state.registrations.find((r) => r.team_name === reg.team_name);
      await page.getByTestId(`admin-reg-contact-${row.id}`).click();
      await page.getByTestId(`admin-reg-approve-${row.id}`).click();
      await expect(page.getByTestId(`admin-registration-${row.id}`)).toContainText(/approved/i);
      await expect(page.getByTestId(`admin-reg-approve-${row.id}`)).toBeDisabled(); // double-approve guard
    }
    await shot(page, "03-registrations-approved");
    state = await readState(page);
    for (const reg of F.REGISTRATIONS) {
      const team = byName(state, "teams", reg.team_name);
      const league = state.leagues.find((l) => l.id === team.league_id);
      expect(league).toMatchObject({ name: F.LEAGUES[reg.sport].name, season: F.SEASON });
      expect(byName(state, "profiles", reg.captain_name)?.id).toBe(team.captain_id);
    }

    await adminTab(page, "teams");
    for (const t of F.DIRECT_TEAMS) {
      await page.getByTestId("admin-add-team").click();
      await page.getByTestId("admin-team-name").fill(t.name);
      const league = F.LEAGUES[t.sport];
      await pickOption(page, page.getByTestId("admin-modal").getByRole("combobox").first(),
        `${league.name} · ${t.sport === "kickball" ? "Kickball" : "Flag Football"} · ${F.SEASON}`);
      await saveModal(page);
    }
    state = await readState(page);
    for (const t of F.DIRECT_TEAMS) expect(byName(state, "teams", t.name)).toBeTruthy();
  });

  await test.step("4. players, rosters, free-agent assignment, eligibility", async () => {
    await adminTab(page, "players");
    for (const [first, last] of F.PLAYERS) {
      await page.getByTestId("admin-add-player").click();
      await page.getByTestId("admin-player-first").fill(first);
      await page.getByTestId("admin-player-last").fill(last);
      await page.getByTestId("admin-player-email").fill(`${first}.${last}@example.test`.toLowerCase());
      await page.getByTestId("admin-player-age").click();
      await saveModal(page);
    }
    await adminTab(page, "teams");
    let state = await readState(page);
    const teamsOf = [...new Set(F.PLAYERS.map((p) => p[2]))];
    for (const teamName of teamsOf) {
      const team = byName(state, "teams", teamName);
      await page.getByTestId(`admin-roster-team-${team.id}`).click();
      for (const [first, last, , jersey] of F.PLAYERS.filter((p) => p[2] === teamName)) {
        await pickOption(page, page.getByTestId("assignment-select"), `${first} ${last}`);
        await page.getByTestId("assignment-jersey_number").fill(String(jersey));
        await page.getByTestId("assignment-add").click();
        await expect(page.getByTestId("admin-roster-modal")).toContainText(`${first} ${last}`);
      }
      await expect(page.getByTestId("admin-roster-modal")).toContainText(`Season auto-stamped: ${F.SEASON}`);
      await page.getByTestId("admin-roster-done").click();
    }

    await adminTab(page, "agents");
    state = await readState(page);
    for (const fa of F.FREE_AGENTS) {
      const agent = state.freeAgents.find((a) => a.email === fa.email);
      await page.getByTestId(`admin-agent-assign-${agent.id}`).click();
      await pickOption(page, page.getByTestId("admin-assign-team"), `${fa.assign_to} (${fa.sport === "kickball" ? "Kickball" : "Flag Football"})`);
      await saveModal(page);
      await expect(page.getByTestId(`admin-agent-${agent.id}`)).toContainText(fa.assign_to);
    }

    await adminTab(page, "players");
    state = await readState(page);
    for (const name of F.VERIFIED) {
      const p = byName(state, "profiles", name);
      await page.getByTestId(`admin-edit-player-${p.id}`).click();
      await pickOption(page, page.getByTestId("admin-player-eligibility"), "Verified");
      await saveModal(page);
    }
    state = await readState(page);
    const allTeams = [...F.REGISTRATIONS.map((r) => r.team_name), ...F.DIRECT_TEAMS.map((t) => t.name)];
    for (const teamName of allTeams) {
      const team = byName(state, "teams", teamName);
      const roster = state.teamPlayers.filter((tp) => tp.team_id === team.id);
      expect(roster, teamName).toHaveLength(3);
      expect(new Set(roster.map((r) => r.season))).toEqual(new Set([F.SEASON]));
    }
    await shot(page, "04-players");
  });

  // Games are written with fixed rh-* ids because boundaries.spec.js seeds from this
  // run's final state; creating games through the New Game form is proven by
  // new-game-season.spec.js.
  await test.step("5. schedule (fixture write with fixed ids; New Game form proven separately)", async () => {
    const state = await readState(page);
    const venue = byName(state, "venues", F.VENUE.name);
    const games = F.GAMES.map((g) => {
      const home = byName(state, "teams", g.home), away = byName(state, "teams", g.away);
      return {
        id: g.id, league_id: home.league_id, sport: g.sport, home_team_id: home.id, away_team_id: away.id,
        starts_at: new Date(g.starts_at).toISOString(), venue_id: venue.id, status: "upcoming", score_status: "pending",
        stage: "regular", home_score: null, away_score: null, periods: { home: [], away: [] }, locked: false, edit_history: [],
      };
    });
    await writeState(page, { ...state, games: [...state.games, ...games] });
    await page.reload({ waitUntil: "domcontentloaded" });
    await becomeRole(page, "admin");
    // Exercise the real schedule edit + postpone controls on the injected rows.
    await adminTab(page, "games");
    await page.getByTestId("admin-edit-game-rh-kg6").click();
    await page.getByTestId("admin-game-start").fill("2026-10-13T19:00");
    await saveModal(page);
    await expect(page.getByTestId("admin-game-rh-kg6")).toContainText("Oct 13 · 7:00 PM");
    await page.getByTestId("admin-postpone-rh-kg7").click();
    await page.getByTestId("admin-confirm-postpone").click();
    await expect(page.getByTestId("admin-game-rh-kg7")).toContainText(/postponed/i);
  });

  await test.step("6. aggregate scores: entry, HARD block, SOFT override, mark final", async () => {
    for (const g of F.GAMES.filter((x) => x.away_innings || x.away_quarters)) {
      const kick = g.sport === "kickball";
      const first = g.entered || g;
      await enterScore(page, g, {
        awayPeriods: kick ? first.away_innings : g.away_quarters,
        homePeriods: kick ? first.home_innings : g.home_quarters,
        stats: kick ? F.KICKBALL_STATS[g.entered ? `${g.id}-entered` : g.id] : F.FLAG_STATS[g.id],
        override: g.override_reason,
      });
      await markFinal(page, g.id);
    }
    const tie = F.GAMES.find((g) => g.tie_attempt);
    await enterScore(page, tie, { awayPeriods: tie.tie_attempt.away_innings, homePeriods: tie.tie_attempt.home_innings, expectHard: "INV-08" });
    await shot(page, "06-hard-tie-blocked");
    const state = await readState(page);
    expect(state.games.find((x) => x.id === tie.id)).toMatchObject({ status: "upcoming", score_status: "pending" });
    const kg3 = state.games.find((x) => x.id === "rh-kg3");
    expect(kg3.edit_history.some((e) => e.override_reason)).toBe(true);
  });

  await test.step("7. justified correction of KG2 (winner changes)", async () => {
    const g = F.GAMES.find((x) => x.correction_reason);
    await adminTab(page, "games");
    await page.getByTestId(`admin-game-enter-score-${g.id}`).click();
    await expect(page.getByTestId("score-locked-notice")).toBeVisible();
    await expect(page.getByTestId("score-save")).toBeDisabled();
    await page.getByTestId("score-correction-start").click();
    await page.getByTestId("score-correction-confirm").click(); // blank reason refused
    await expect(page.getByTestId("score-correction-dialog")).toContainText("correction reason is required");
    await page.getByTestId("score-correction-reason").fill(g.correction_reason);
    await page.getByTestId("score-correction-confirm").click();
    await page.getByTestId("score-away-period-4").fill(String(g.away_innings[4]));
    const state = await readState(page);
    for (const [name, line] of F.KICKBALL_STATS[g.id].slice(0, 2)) {
      const p = byName(state, "profiles", name);
      await page.getByTestId(`score-player-toggle-${p.id}`).click();
      for (const [k, v] of Object.entries(line)) await page.getByTestId(`score-stat-${p.id}-${k}`).fill(String(v));
    }
    await page.getByTestId("score-save").click();
    await expect(page).toHaveURL(new RegExp(`/game/${g.id}$`));
    const after = (await readState(page)).games.find((x) => x.id === g.id);
    expect(after).toMatchObject({ away_score: 5, home_score: 4, locked: true, score_status: "final" });
    const correction = after.edit_history.at(-1);
    expect(correction.reason).toBe(g.correction_reason);
    expect(correction.before_state).toMatchObject({ away_score: 2, home_score: 4 });
    await shot(page, "07-corrected-game-detail");
  });

  await test.step("8. public records reflect the season (anonymous)", async () => {
    await becomeRole(page, "anonymous");
    const state = await readState(page);
    const standings = {};
    for (const sport of ["kickball", "flag_football"]) {
      await nav(page, "/standings");
      // Sport scope lives in the page's own control; record what each row shows.
      const sportLabel = sport === "kickball" ? "Kickball" : "Flag Football";
      await pickOption(page, page.getByTestId("standings-filter-sport"), sportLabel);
      for (const [teamName, [w, l]] of Object.entries(F.EXPECTED[sport])) {
        const team = byName(state, "teams", teamName);
        const row = page.getByTestId(`standings-row-${team.id}`);
        await expect(row, teamName).toBeVisible();
        await expect(row, teamName).toContainText(`${w}`);
        standings[teamName] = (await row.innerText()).replace(/\s+/g, " ");
        void l;
      }
      await shot(page, `08-standings-${sport}`);
    }
    fs.writeFileSync(path.join(ART, "standings-rows.json"), JSON.stringify(standings, null, 2));

    for (const name of ["Petroglyph Punters", "Juniper Jacks", "Sandstone Sprinters"]) {
      const team = byName(state, "teams", name);
      await nav(page, `/team/${team.id}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
      await shot(page, `08-team-${team.id}`);
    }
    for (const name of ["Rhea Testwell", "Kit Kestrel", "Lu Ledge"]) {
      const p = byName(state, "profiles", name);
      await nav(page, `/profile/${p.id}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
      await expect(page.getByText(p.email)).toHaveCount(0); // no PII on the public profile
      await shot(page, `08-profile-${name.replace(/\s/g, "-")}`);
    }
    await nav(page, "/leaderboards");
    await shot(page, "08-leaderboards");
    await nav(page, "/schedule");
    await shot(page, "08-schedule");
    await nav(page, "/game/rh-kg2");
    await expect(page.locator("body")).toContainText("Juniper Jacks");
    await shot(page, "08-game-kg2");
  });

  await test.step("9. reload/recovery: state survives a reload, admin role does not", async () => {
    const before = await readState(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const after = await readState(page);
    expect(after.games.filter((g) => g.id.startsWith("rh-"))).toEqual(before.games.filter((g) => g.id.startsWith("rh-")));
    await nav(page, "/admin");
    await expect(page.getByRole("heading", { name: "Admin Console" })).toHaveCount(0);
  });

  fs.writeFileSync(path.join(ART, "final-state.json"), JSON.stringify(await readState(page), null, 2));
  fs.writeFileSync(path.join(ART, "browser-errors.json"), JSON.stringify(errors, null, 2));
});
