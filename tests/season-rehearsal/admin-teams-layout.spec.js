// Phone layout regression: admin Teams (mock mode, seed data). The document
// must not be wider than the phone, and every identity/enrollment action must
// stay reachable (scrollable into view, at touch size) — the wide enrollment
// table scrolls inside its own card rather than widening the page.
//
// Geometry is measured in a real browser; jsdom cannot lay out.
const path = require("path");
const fs = require("fs");
const { test, expect } = require("@playwright/test");

const ART = process.env.REHEARSAL_ARTIFACTS || path.join(__dirname, "artifacts");
const WIDTHS = [320, 360, 375, 390, 768, 1280];

async function nav(page, route) {
  await page.evaluate((r) => { window.history.pushState({}, "", r); window.dispatchEvent(new PopStateEvent("popstate")); }, route);
  await page.waitForURL((u) => u.pathname === route);
}

async function openAsAdmin(page, width) {
  await page.setViewportSize({ width, height: 860 });
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("layout-fresh")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("layout-fresh", "1");
    }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      // Dev-only chrome, never in a production build: CRA's error overlay and
      // the agentation annotation toolbar (App.js loads it only in development).
      style.textContent = "#webpack-dev-server-client-overlay,[class*='styles-module__toolbar']{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("role-switcher").click();
  await page.getByTestId("role-option-admin").click();
}

for (const width of WIDTHS) {
  test(`admin Teams fits the page and keeps every action reachable at ${width}px`, async ({ page }) => {
    await openAsAdmin(page, width);
    await nav(page, "/admin");
    await page.getByTestId("admin-tab-teams").click();
    await expect(page.getByTestId("admin-teams-table")).toBeVisible();
    await page.waitForTimeout(300);
    const doc = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth }));
    fs.mkdirSync(path.join(ART, "layout"), { recursive: true });
    await page.screenshot({ path: path.join(ART, "layout", `admin-teams-${width}.png`), fullPage: true });
    expect(doc.scrollW, "document is no wider than the viewport").toBeLessThanOrEqual(doc.vw);

    const actions = page.locator('[data-testid^="admin-roster-team-"], [data-testid^="admin-edit-team-"], [data-testid^="admin-toggle-team-"], [data-testid^="admin-edit-identity-"], [data-testid^="admin-enroll-identity-"]');
    const count = await actions.count();
    expect(count).toBeGreaterThan(20);
    const problems = [];
    for (let i = 0; i < count; i += 1) {
      const action = actions.nth(i);
      await action.scrollIntoViewIfNeeded();
      const b = await action.boundingBox();
      const id = await action.getAttribute("data-testid");
      if (!b || b.x < 0 || b.x + b.width > doc.vw + 0.5) problems.push(`${id} off-screen ${JSON.stringify(b)}`);
      else if (width < 768 && Math.min(b.width, b.height) < 44) problems.push(`${id} below touch size ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    expect(problems).toEqual([]);
    // The long-name fixture keeps its full name available to assistive tech.
    await expect(page.getByTestId("admin-team-identities")).toContainText("Los Ranchos de Albuquerque Roadrunners");
    const after = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(after, "scrolling the table into view does not widen the page").toBe(true);
  });
}
