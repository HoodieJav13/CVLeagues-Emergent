// Stage 3 — high-risk boundaries around the rehearsal season (local mock mode).
// Seeds the browser with the state the rehearsal journey produced
// ($REHEARSAL_STATE, default artifacts/final-state.json), so it reuses the same
// fictional records instead of rebuilding them.
const path = require("path");
const fs = require("fs");
const { test, expect } = require("@playwright/test");
const F = require("./fixture.cjs");

const STORAGE_KEY = "cvf_app_state_v11";
const ART = process.env.REHEARSAL_ARTIFACTS || path.join(__dirname, "artifacts");
const SEED = process.env.REHEARSAL_STATE || path.join(ART, "final-state.json");
fs.mkdirSync(ART, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`), fullPage: true });

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
const readState = (page) => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k)).state, STORAGE_KEY);
const byName = (state, c, n) => state[c].find((r) => r.name === n);

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
  await page.addInitScript(([key, s]) => {
    if (!window.sessionStorage.getItem("rehearsal-seeded")) {
      window.localStorage.setItem(key, JSON.stringify({ version: 11, state: s }));
      window.sessionStorage.setItem("rehearsal-seeded", "1");
    }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "#webpack-dev-server-client-overlay{display:none!important}";
      document.head.appendChild(style);
    });
  }, [STORAGE_KEY, seed]);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("role-switcher")).toBeVisible();
});

test("permissions: every non-admin demo role is gated from admin and score entry", async ({ page }) => {
  for (const role of ["anonymous", "player", "captain", "temp_admin"]) {
    await becomeRole(page, role);
    for (const route of ["/admin", "/score-entry"]) {
      await nav(page, route);
      await expect(page.getByTestId("role-gate-denied"), `${role} ${route}`).toBeVisible();
      await expect(page.getByRole("heading", { name: "Admin Console" })).toHaveCount(0);
    }
  }
  // Public profile and team pages never show contact PII.
  const state = await readState(page);
  const captain = byName(state, "profiles", "Rhea Testwell");
  await becomeRole(page, "anonymous");
  for (const route of [`/profile/${captain.id}`, `/team/${captain && state.teams.find((t) => t.captain_id === captain.id).id}`, "/free-agents"]) {
    await nav(page, route);
    await expect(page.locator("main")).not.toContainText(captain.email);
    await expect(page.locator("main")).not.toContainText("505-555-01");
  }
});

test("duplicate: archived registration re-approval and free-agent re-assignment fail cleanly", async ({ page }) => {
  await becomeRole(page, "admin");
  await nav(page, "/admin");
  let state = await readState(page);
  const reg = state.registrations.find((r) => r.team_name === F.REGISTRATIONS[0].team_name);
  const teamsBefore = state.teams.length;

  // An approved registration cannot be approved twice from the UI.
  await page.getByTestId("admin-tab-registrations").click();
  await expect(page.getByTestId(`admin-reg-approve-${reg.id}`)).toBeDisabled();
  // Archive it, then try to approve again (the button re-enables).
  await page.getByTestId(`admin-reg-archive-${reg.id}`).click();
  await page.getByTestId(`admin-reg-approve-${reg.id}`).click();
  await page.waitForTimeout(500);
  await shot(page, "b-reapprove-archived");
  const crashed1 = await page.getByText(/something went wrong/i).count();
  state = await readState(page);
  test.info().annotations.push({ type: "reapprove-archived", description: JSON.stringify({ crashed: crashed1 > 0, errors: [...errors], teamsDelta: state.teams.length - teamsBefore }) });
  expect(state.teams.length, "no duplicate team").toBe(teamsBefore);

  // Re-assigning an already assigned free agent.
  if (crashed1) await page.reload({ waitUntil: "domcontentloaded" }), await becomeRole(page, "admin"), await nav(page, "/admin");
  errors.length = 0;
  state = await readState(page);
  const fa = state.freeAgents.find((a) => a.email === F.FREE_AGENTS[0].email);
  const rosterBefore = state.teamPlayers.length;
  await page.getByTestId("admin-tab-agents").click();
  await page.getByTestId(`admin-agent-assign-${fa.id}`).click();
  await page.getByTestId("admin-modal-save").click();
  await page.waitForTimeout(500);
  await shot(page, "b-reassign-free-agent");
  const crashed2 = await page.getByText(/something went wrong/i).count();
  state = await readState(page);
  test.info().annotations.push({ type: "reassign-free-agent", description: JSON.stringify({ crashed: crashed2 > 0, errors: [...errors], rosterDelta: state.teamPlayers.length - rosterBefore }) });
  expect(state.teamPlayers.length, "no duplicate roster row").toBe(rosterBefore);
  expect(crashed1 + crashed2, "app keeps running and reports the refusal").toBe(0);
});

test("duplicate: double-clicking Save on a score records one save", async ({ page }) => {
  await becomeRole(page, "admin");
  await nav(page, "/admin");
  await page.getByTestId("admin-tab-games").click();
  await page.getByTestId("admin-game-enter-score-rh-fg3").click();
  for (const [i, v] of [7, 0, 7, 0].entries()) await page.getByTestId(`score-away-period-${i}`).fill(String(v));
  for (const [i, v] of [0, 7, 0, 0].entries()) await page.getByTestId(`score-home-period-${i}`).fill(String(v));
  await page.getByTestId("score-save").dblclick();
  // Flag scores without stats raise SOFT warnings: save requires a reason.
  await expect(page.getByTestId("score-override-dialog")).toBeVisible();
  await page.getByTestId("score-override-reason").fill("Stat sheet lost; score confirmed by both captains.");
  await page.getByTestId("score-override-confirm").dblclick();
  await expect(page).toHaveURL(/\/game\/rh-fg3$/);
  const game = (await readState(page)).games.find((g) => g.id === "rh-fg3");
  expect(game.edit_history.filter((e) => /saved|edited/i.test(e.action))).toHaveLength(1);
  expect(game).toMatchObject({ away_score: 14, home_score: 7, score_status: "submitted" });
});

test("failed save: HARD-invalid input keeps the form and changes nothing", async ({ page }) => {
  await becomeRole(page, "admin");
  await nav(page, "/admin");
  await page.getByTestId("admin-tab-games").click();
  await page.getByTestId("admin-game-enter-score-rh-fg3").click();
  // Flag football with a stat for a player not in this game is impossible from
  // the UI; the reachable HARD case is a tie.
  for (const i of [0, 1, 2, 3]) await page.getByTestId(`score-away-period-${i}`).fill(i === 0 ? "7" : "0");
  for (const i of [0, 1, 2, 3]) await page.getByTestId(`score-home-period-${i}`).fill(i === 0 ? "7" : "0");
  await page.getByTestId("score-save").click();
  await expect(page.getByTestId("score-hard-errors")).toContainText("INV-08");
  await expect(page).toHaveURL(/score-entry/);
  expect((await readState(page)).games.find((g) => g.id === "rh-fg3")).toMatchObject({ status: "upcoming", score_status: "pending" });
});

test("correction propagation: corrected KG2 reaches standings, player totals, and history", async ({ page }) => {
  const state = await readState(page);
  const juno = byName(state, "profiles", "Juno Juniper");
  const kg2 = state.games.find((g) => g.id === "rh-kg2");
  expect(kg2.edit_history.map((e) => e.action)).toEqual(["Score saved", "Marked final", "Final score corrected"]);
  const junoRuns = state.playerStats.filter((s) => s.profile_id === juno.id).reduce((t, s) => t + (s.stats.runs || 0), 0);
  expect(junoRuns).toBe(3 + 2); // corrected KG2 (3) + KG4 (2)
  await nav(page, `/profile/${juno.id}`);
  await shot(page, "b-juno-profile");
  await nav(page, "/admin");
  await becomeRole(page, "admin");
  await nav(page, "/admin");
  await page.getByTestId("admin-tab-scores").click();
  await page.getByTestId("admin-history-rh-kg2").click();
  await expect(page.getByTestId("admin-history-list-rh-kg2")).toContainText("2-4 → 5-4");
  await expect(page.getByTestId("admin-history-list-rh-kg2")).toContainText(F.GAMES[1].correction_reason);
  await shot(page, "b-kg2-history");
});

test("reload/recovery: a malformed store falls back to the seed without crashing", async ({ page }) => {
  await page.evaluate((k) => window.localStorage.setItem(k, "{not json"), STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("role-switcher")).toBeVisible();
  const state = await readState(page);
  expect(state.games.some((g) => g.id.startsWith("rh-"))).toBe(false);
  expect(errors).toEqual([]);
});

test("practice mode: a no-consequence rehearsal publishes nothing", async ({ page }) => {
  await becomeRole(page, "admin");
  const before = await readState(page);
  await nav(page, "/score-entry");
  await page.getByTestId("practice-mode-entry").getByRole("button", { name: "Open practice mode" }).click();
  await expect(page.getByTestId("practice-scorekeeper")).toBeVisible();
  await expect(page.getByTestId("practice-chip")).toBeVisible();
  await shot(page, "b-practice-open");
  const after = await readState(page);
  expect(after.games).toEqual(before.games);
  expect(after.playerStats).toEqual(before.playerStats);
});
