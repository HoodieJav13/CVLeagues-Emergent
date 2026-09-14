const { test, expect } = require("@playwright/test");
const { TABLES, LEAGUE_SETTINGS_ROW, SEEDED_GAME_ID, SEEDED_GAME_TEAM, ADMIN_ONLY_TABLES, SEEDED_PII } = require("./seed.cjs");

const SUPABASE_HOST = "ci-placeholder.supabase.co";
const PUBLIC_ROUTES = ["/", "/schedule", "/standings", `/game/${SEEDED_GAME_ID}`, "/leaderboards", "/playoffs"];
// Routes gated by RoleGate (login card in place) ...
const ADMIN_ROUTES = ["/admin", "/admin/security", "/score-entry"];
// ... plus the two admin auth-flow pages that render their own forms. All five
// must show an unauthenticated visitor zero seeded PII and never request an
// admin-only table.
const ADMIN_SURFACE_ROUTES = [...ADMIN_ROUTES, "/admin/recover", "/admin/reset-password"];

// Answer the production bundle's Supabase REST calls from the seed fixtures.
async function stubBackend(page) {
  const unexpected = [];
  const served = [];
  await page.route(`**/${SUPABASE_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    const restMatch = url.pathname.match(/^\/rest\/v1\/([^/]+)$/);
    if (restMatch) {
      const table = restMatch[1];
      served.push(table);
      const wantsObject = (route.request().headers().accept || "").includes("vnd.pgrst.object");
      let body;
      if (table === "league_settings") body = wantsObject ? LEAGUE_SETTINGS_ROW : [LEAGUE_SETTINGS_ROW];
      else if (table === "rpc") body = false;
      else body = TABLES[table] || [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "false" });
    }
    unexpected.push(`${route.request().method()} ${url.pathname}`);
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  // Turnstile is a third-party script; stand in for it so the admin login
  // card renders deterministically offline.
  await page.route("**/challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.turnstile={render:function(){return 'stub'},reset:function(){},remove:function(){}};",
    }),
  );
  return { unexpected, served };
}

function collectErrors(page) {
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`); });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function settled(page) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Loading league data…")).toHaveCount(0);
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), clientWidth: doc.clientWidth };
  });
}

for (const route of PUBLIC_ROUTES) {
  test(`public route ${route} renders without console errors or horizontal overflow`, async ({ page }, testInfo) => {
    const { unexpected, served } = await stubBackend(page);
    const errors = collectErrors(page);
    await page.goto(route);
    await settled(page);
    await expect(page.locator("h1").first()).toBeVisible();
    // The bundle must have loaded league data through the stubbed boundary,
    // otherwise an empty-state render would pass this smoke vacuously.
    expect(served, `seed tables served on ${route}`).toContain("games");
    if (route.startsWith("/game/")) await expect(page.getByText(SEEDED_GAME_TEAM, { exact: false }).first()).toBeVisible();
    expect(page.url()).toContain(route === "/" ? "/" : route);
    const { scrollWidth, clientWidth } = await noHorizontalOverflow(page);
    expect(scrollWidth, `${testInfo.project.name} ${route} overflow`).toBeLessThanOrEqual(clientWidth);
    expect(errors, `console errors on ${route}`).toEqual([]);
    expect(unexpected, `unstubbed backend calls on ${route}`).toEqual([]);
  });
}

for (const route of ADMIN_ROUTES) {
  test(`admin route ${route} gates an unauthenticated visitor at the login card`, async ({ page }) => {
    await stubBackend(page);
    const errors = collectErrors(page);
    await page.goto(route);
    await settled(page);
    await expect(page.getByTestId("admin-login")).toBeVisible();
    await expect(page.getByTestId("admin-sign-out")).toHaveCount(0);
    await expect(page.getByTestId("admin-security")).toHaveCount(0);
    expect(errors, `console errors on ${route}`).toEqual([]);
  });
}

for (const route of ADMIN_SURFACE_ROUTES) {
  test(`admin surface ${route} shows an unauthenticated visitor no seeded PII and requests no admin-only table`, async ({ page }) => {
    const { served } = await stubBackend(page);
    const errors = collectErrors(page);
    await page.goto(route);
    await settled(page);
    // (a) no seeded email / phone string anywhere in the rendered text
    const text = await page.evaluate(() => document.body.innerText);
    const leaked = SEEDED_PII.filter((value) => text.includes(value));
    expect(leaked, `seeded PII rendered on ${route}`).toEqual([]);
    // (b) the bundle never asked for an admin-only table
    const requestedAdminTables = served.filter((table) => ADMIN_ONLY_TABLES.includes(table));
    expect(requestedAdminTables, `admin-only tables requested on ${route}`).toEqual([]);
    expect(errors, `console errors on ${route}`).toEqual([]);
  });
}
