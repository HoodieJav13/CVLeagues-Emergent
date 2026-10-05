// Small fictional season whose games are CREATED through the admin New Game
// form (mock mode). Only prerequisites are seeded — season, league, venue,
// teams, and one fictional player per team — then the journey creates games
// in the UI (including refused inputs), reloads, scores, checks standings
// against explicit expectations, corrects a score with a reason, and checks
// standings again. Phone layouts are measured along the way.
const path = require("path");
const fs = require("fs");
const { test, expect } = require("@playwright/test");

const STORAGE_KEY = "cvf_app_state_v11";
const ART = process.env.REHEARSAL_ARTIFACTS || path.join(__dirname, "artifacts");
const DIR = path.join(ART, "new-game-season");
fs.mkdirSync(DIR, { recursive: true });

const SEASON = "Rehearsal 2028";
const LEAGUE = { id: "ng-l1", name: "New Game Kickball", sport: "kickball", season: SEASON, kind: "league", playoff_format: "single_elim", description: "Fictional rehearsal league." };
const VENUE = { id: "ng-v1", name: "Mesa Vista Rehearsal Park", field_label: "Field R2", address: "100 Fictional Way NE", status: "active" };
const TEAMS = [
  { id: "ng-t1", name: "Petroglyph Punters", color: "#f59e0b", player: ["Pia", "Pendleton"] },
  { id: "ng-t2", name: "Juniper Jacks", color: "#22d3ee", player: ["Juno", "Juniper"] },
  { id: "ng-t3", name: "Arroyo Alley Cats", color: "#a855f7", player: ["Ada", "Arroyo"] },
];
// away @ home, league-time kickoff, final innings (away, home).
const GAMES = [
  { key: "NG1", away: "ng-t2", home: "ng-t1", start: "2027-04-06T18:30", away_innings: [0, 1, 0, 2, 0], home_innings: [2, 0, 1, 0, 2] },
  { key: "NG2", away: "ng-t3", home: "ng-t2", start: "2027-04-13T18:30", away_innings: [1, 0, 2, 1, 0], home_innings: [0, 3, 0, 1, 2] },
  { key: "NG3", away: "ng-t1", home: "ng-t3", start: "2027-04-20T18:30", away_innings: [3, 0, 2, 0, 2], home_innings: [0, 1, 0, 1, 0] },
  { key: "NG4", away: "ng-t3", home: "ng-t1", start: "2027-04-27T19:45", unscored: true },
];
const CORRECTION = { key: "NG2", away_innings: [1, 0, 2, 1, 2], home_innings: [0, 3, 0, 1, 0], reason: "Umpire's sheet swapped the fifth-inning run lines; confirmed by both captains." };
// [team id, wins, losses] in expected rank order.
const STANDINGS_BEFORE = [["ng-t1", 2, 0], ["ng-t2", 1, 1], ["ng-t3", 0, 2]];
const STANDINGS_AFTER = [["ng-t1", 2, 0], ["ng-t3", 1, 1], ["ng-t2", 0, 2]];

const sum = (a) => a.reduce((x, y) => x + y, 0);
const teamName = (id) => TEAMS.find((t) => t.id === id).name;
const playerId = (teamId) => `ng-p-${teamId}`;

async function nav(page, route) {
  await page.evaluate((r) => { window.history.pushState({}, "", r); window.dispatchEvent(new PopStateEvent("popstate")); }, route);
  await page.waitForURL((u) => u.pathname === route);
}
const readState = (page) => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k)).state, STORAGE_KEY);
async function asAdmin(page) {
  await page.getByTestId("role-switcher").click();
  await page.getByTestId("role-option-admin").click();
}
async function openGames(page) {
  await nav(page, "/admin");
  await page.getByTestId("admin-tab-games").click();
}
async function createGame(page, g) {
  await openGames(page);
  await page.getByTestId("admin-add-game").click();
  await page.getByTestId("new-game-league").selectOption(LEAGUE.id);
  await page.getByTestId("new-game-away").selectOption(g.away);
  await page.getByTestId("new-game-home").selectOption(g.home);
  await page.getByTestId("new-game-start").fill(g.start);
  await page.getByTestId("new-game-venue").selectOption(VENUE.id);
}
const findGame = (state, g) => state.games.find((x) => x.league_id === LEAGUE.id && x.home_team_id === g.home && x.away_team_id === g.away);

async function scoreGame(page, gameId, away, home, { correction } = {}) {
  await openGames(page);
  await page.getByTestId(`admin-game-enter-score-${gameId}`).click();
  if (correction) {
    await page.getByTestId("score-correction-start").click();
    await page.getByTestId("score-correction-reason").fill(correction);
    await page.getByTestId("score-correction-confirm").click();
  }
  for (const [i, v] of away.entries()) await page.getByTestId(`score-away-period-${i}`).fill(String(v));
  for (const [i, v] of home.entries()) await page.getByTestId(`score-home-period-${i}`).fill(String(v));
  // Player runs reconcile with the score so no SOFT override is needed.
  const state = await readState(page);
  const game = state.games.find((x) => x.id === gameId);
  for (const [teamId, runs] of [[game.away_team_id, sum(away)], [game.home_team_id, sum(home)]]) {
    const pid = playerId(teamId);
    await page.getByTestId(`score-player-toggle-${pid}`).click();
    await page.getByTestId(`score-stat-${pid}-runs`).fill(String(runs));
    await page.getByTestId(`score-stat-${pid}-rbis`).fill(String(runs));
  }
  await page.getByTestId("score-save").click();
  await expect(page).toHaveURL(new RegExp(`/game/${gameId}$`));
}

async function standingsOrder(page) {
  await nav(page, "/standings");
  await page.getByTestId("standings-filter-season").click();
  await page.getByRole("option", { name: SEASON, exact: true }).click();
  const rows = page.locator('[data-testid^="standings-row-ng-"]');
  await expect(rows).toHaveCount(3);
  const out = [];
  for (let i = 0; i < 3; i += 1) {
    const row = rows.nth(i);
    out.push({ id: (await row.getAttribute("data-testid")).replace("standings-row-", ""), text: (await row.innerText()).replace(/\s+/g, " ") });
  }
  return out;
}

const measure = (page) => page.evaluate(() => ({ vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth }));

test("fictional season: games created in the New Game form, scored, corrected", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "#webpack-dev-server-client-overlay,[class*='styles-module__toolbar']{display:none!important}";
      document.head.appendChild(style);
    });
  });

  await test.step("seed prerequisites only (season, league, venue, teams, one player each)", async () => {
    await page.setViewportSize({ width: 390, height: 860 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("role-switcher")).toBeVisible();
    const base = await readState(page); // the app persists its seed fixtures on mount
    const next = {
      ...base,
      seasons: [...base.seasons, { name: SEASON, status: "upcoming" }],
      leagues: [...base.leagues, LEAGUE],
      venues: [...base.venues, VENUE],
      teamIdentities: [...base.teamIdentities, ...TEAMS.map((t) => ({ id: `${t.id}-i`, name: t.name, logo_color: t.color, founded: "2027", status: "active" }))],
      teams: [...base.teams, ...TEAMS.map((t) => ({ id: t.id, identity_id: `${t.id}-i`, name: t.name, sport: "kickball", league_id: LEAGUE.id, captain_id: null, logo_color: t.color, founded: "2027", status: "active" }))],
      profiles: [...base.profiles, ...TEAMS.map((t, i) => ({ id: playerId(t.id), first_name: t.player[0], last_name: t.player[1], name: t.player.join(" "), email: `${t.player.join(".").toLowerCase()}@example.test`, sports: ["kickball"], avatar_color: t.color, eligibility_status: i === 0 ? "verified" : "not_verified" }))],
      teamPlayers: [...base.teamPlayers, ...TEAMS.map((t, i) => ({ id: `ng-tp-${i}`, team_id: t.id, profile_id: playerId(t.id), season: SEASON, jersey_number: 10 + i, position: "", roster_status: "pending_waiver" }))],
    };
    expect(next.games.some((g) => g.league_id === LEAGUE.id)).toBe(false); // no games seeded
    await page.evaluate(([k, s]) => window.localStorage.setItem(k, JSON.stringify({ version: 11, state: s })), [STORAGE_KEY, next]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await asAdmin(page);
  });

  await test.step("refused inputs write nothing (390px)", async () => {
    const before = (await readState(page)).games.length;
    // Same team on both sides.
    await createGame(page, { ...GAMES[0], away: "ng-t1", home: "ng-t1" });
    await page.getByTestId("new-game-save").click();
    await expect(page.getByTestId("new-game-errors")).toContainText("different teams");
    // A kickoff the clocks skip (spring forward 2027-03-14).
    await page.getByTestId("new-game-away").selectOption("ng-t2");
    await page.getByTestId("new-game-start").fill("2027-03-14T02:30");
    await page.getByTestId("new-game-save").click();
    await expect(page.getByTestId("new-game-errors")).toContainText("does not exist");
    // A fall-back kickoff that happens twice (2027-11-07): unresolved policy, refused.
    await page.getByTestId("new-game-start").fill("2027-11-07T01:30");
    await page.getByTestId("new-game-save").click();
    await expect(page.getByTestId("new-game-errors")).toContainText("happens twice");
    const m = await measure(page);
    await page.screenshot({ path: path.join(DIR, "01-new-game-refusals-390.png") });
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    await page.getByTestId("new-game-cancel").click();
    await expect(page.getByTestId("new-game-dialog")).toHaveCount(0);
    expect((await readState(page)).games.length).toBe(before);
  });

  await test.step("create every game through the form (360px and 1280px; double-click saves once)", async () => {
    for (const [i, g] of GAMES.entries()) {
      await page.setViewportSize(i % 2 === 0 ? { width: 360, height: 800 } : { width: 1280, height: 900 });
      const before = (await readState(page)).games.length;
      await createGame(page, g);
      if (i === 0) await page.screenshot({ path: path.join(DIR, "02-new-game-filled-360.png") });
      await page.getByTestId("new-game-save").dblclick();
      await expect(page.getByTestId("new-game-dialog")).toHaveCount(0);
      const state = await readState(page);
      expect(state.games.length, `${g.key} created exactly once`).toBe(before + 1);
      const created = findGame(state, g);
      expect(created).toMatchObject({ sport: "kickball", venue_id: VENUE.id, stage: "regular", status: "upcoming", score_status: "pending", locked: false, home_score: null, away_score: null });
      await expect(page.getByTestId(`admin-game-${created.id}`)).toContainText(`${teamName(g.away)} @ ${teamName(g.home)}`);
    }
    const kickoff = findGame(await readState(page), GAMES[3]).starts_at;
    expect(kickoff).toBe("2027-04-28T01:45:00.000Z"); // 7:45 PM MDT
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(DIR, "03-admin-games-created-1280.png"), fullPage: true });
  });

  await test.step("reload: created games persist and appear on the public schedule", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    const state = await readState(page);
    for (const g of GAMES) expect(findGame(state, g), `${g.key} survives reload`).toBeTruthy();
    await nav(page, "/schedule");
    await page.getByTestId("schedule-filter-more").click(); // season lives in "More filters"
    await page.getByTestId("schedule-filter-season").click();
    await page.getByRole("option", { name: SEASON, exact: true }).click();
    for (const g of GAMES) await expect(page.locator("main")).toContainText(teamName(g.home));
    await expect(page.locator("main")).toContainText("Apr 27");
    await page.screenshot({ path: path.join(DIR, "04-schedule-after-reload-1280.png"), fullPage: true });
    await asAdmin(page);
  });

  await test.step("score three games (score entry checked at 360px), mark final, verify standings", async () => {
    const state = await readState(page);
    for (const [i, g] of GAMES.filter((x) => !x.unscored).entries()) {
      const id = findGame(state, g).id;
      if (i === 0) {
        await page.setViewportSize({ width: 360, height: 800 });
        await openGames(page);
        await page.getByTestId(`admin-game-enter-score-${id}`).click();
        await expect(page.getByTestId("score-home-period-4")).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        const bounds = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const rights = [...document.querySelectorAll('[data-testid^="score-away-period-"],[data-testid^="score-home-period-"],[data-testid$="-total"]')].map((el) => el.getBoundingClientRect().right);
          return { vw, scrollW: document.documentElement.scrollWidth, maxRight: Math.max(...rights), count: rights.length };
        });
        fs.writeFileSync(path.join(DIR, "05-score-entry-360-bounds.json"), JSON.stringify(bounds, null, 2));
        // Usable, not just laid out: centred in the viewport, every period input
        // is the topmost element at its own centre (not under the sticky bar/nav).
        await page.evaluate(() => document.querySelector('[data-testid="score-period-table"]').scrollIntoView({ block: "center" }));
        const covered = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="score-away-period-"],[data-testid^="score-home-period-"]')]
          .filter((el) => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== el; })
          .map((el) => el.dataset.testid));
        await page.screenshot({ path: path.join(DIR, "05-score-entry-periods-360.png") });
        expect(covered).toEqual([]);
        expect(bounds.count).toBe(12); // 5 + 5 inputs, 2 totals
        expect(bounds.maxRight).toBeLessThanOrEqual(bounds.vw);
        expect(bounds.scrollW).toBeLessThanOrEqual(bounds.vw);
      }
      await scoreGame(page, id, g.away_innings, g.home_innings);
      await page.setViewportSize({ width: 1280, height: 900 });
      await openGames(page);
      await page.getByTestId(`admin-mark-final-game-${id}`).click();
      await expect(page.getByTestId(`admin-game-${id}`)).toContainText(/final/i);
    }
    const order = await standingsOrder(page);
    fs.writeFileSync(path.join(DIR, "06-standings-before.json"), JSON.stringify(order, null, 2));
    await page.screenshot({ path: path.join(DIR, "06-standings-before-1280.png"), fullPage: true });
    expect(order.map((r) => r.id)).toEqual(STANDINGS_BEFORE.map((r) => r[0]));
    for (const [i, [, w, l]] of STANDINGS_BEFORE.entries()) expect(order[i].text).toContain(`${w}-${l}`);
  });

  await test.step("correct NG2 with a reason (winner flips) and verify standings", async () => {
    await asAdmin(page);
    const state = await readState(page);
    const id = findGame(state, GAMES.find((g) => g.key === CORRECTION.key)).id;
    await page.setViewportSize({ width: 390, height: 860 });
    await scoreGame(page, id, CORRECTION.away_innings, CORRECTION.home_innings, { correction: CORRECTION.reason });
    const game = (await readState(page)).games.find((x) => x.id === id);
    expect(game).toMatchObject({ away_score: 6, home_score: 4, locked: true, score_status: "final" });
    expect(game.edit_history.at(-1)).toMatchObject({ reason: CORRECTION.reason });
    expect(game.edit_history.at(-1).before_state).toMatchObject({ away_score: 4, home_score: 6 });
    await page.setViewportSize({ width: 1280, height: 900 });
    const order = await standingsOrder(page);
    fs.writeFileSync(path.join(DIR, "07-standings-after.json"), JSON.stringify(order, null, 2));
    await page.screenshot({ path: path.join(DIR, "07-standings-after-1280.png"), fullPage: true });
    expect(order.map((r) => r.id)).toEqual(STANDINGS_AFTER.map((r) => r[0]));
    for (const [i, [, w, l]] of STANDINGS_AFTER.entries()) expect(order[i].text).toContain(`${w}-${l}`);
    // The unscored game is still pending and unlocked.
    const ng4 = findGame(await readState(page), GAMES[3]);
    expect(ng4).toMatchObject({ status: "upcoming", score_status: "pending", locked: false });
  });

  await test.step("phone checks on the same season: admin Teams at 360px and 390px", async () => {
    await asAdmin(page);
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await nav(page, "/admin");
      await page.getByTestId("admin-tab-teams").click();
      const m = await measure(page);
      await page.screenshot({ path: path.join(DIR, `08-admin-teams-${width}.png`), fullPage: true });
      expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    }
  });

  fs.writeFileSync(path.join(DIR, "final-state.json"), JSON.stringify(await readState(page), null, 2));
  fs.writeFileSync(path.join(DIR, "page-errors.json"), JSON.stringify(errors, null, 2));
  expect(errors).toEqual([]);
});
