// Phone layout regression: score entry (mock mode, seed data). Every
// regulation period input and BOTH live totals must sit entirely inside the
// viewport at the initial scroll position, with no document-level sideways
// scroll, at 44px touch size; the total stays live.
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

// The live total next to a side's period inputs. Prefer the explicit hook;
// fall back to the cell that ends the input's table row (pre-fix layout).
const measureScoreEntry = () => {
  const vw = document.documentElement.clientWidth;
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; };
  const sides = {};
  for (const side of ["away", "home"]) {
    const inputs = [...document.querySelectorAll(`[data-testid^="score-${side}-period-"]`)];
    const total = document.querySelector(`[data-testid="score-${side}-total"]`) || inputs[0]?.closest("tr")?.lastElementChild;
    sides[side] = { inputs: inputs.map(box), total: total ? box(total) : null, totalText: total?.textContent.trim() };
  }
  return { vw, scrollW: document.documentElement.scrollWidth, sides };
};

for (const width of WIDTHS) {
  test(`score entry keeps every period and both totals on screen at ${width}px`, async ({ page }) => {
    await openAsAdmin(page, width);
    for (const [gameId, periods] of [["g4", 5], ["g7", 4]]) {
      await nav(page, "/admin");
      await page.getByTestId("admin-tab-games").click();
      await page.getByTestId(`admin-game-enter-score-${gameId}`).click();
      await expect(page.getByTestId("score-away-period-0")).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      const m = await page.evaluate(measureScoreEntry);
      fs.mkdirSync(path.join(ART, "layout"), { recursive: true });
      fs.writeFileSync(path.join(ART, "layout", `score-entry-${gameId}-${width}.json`), JSON.stringify(m, null, 2));
      await page.getByTestId("score-away-period-0").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(ART, "layout", `score-entry-${gameId}-${width}.png`) });
      expect(m.scrollW, "no document-level sideways scroll").toBeLessThanOrEqual(m.vw);
      for (const side of ["away", "home"]) {
        const s = m.sides[side];
        expect(s.inputs, `${side} regulation inputs`).toHaveLength(periods);
        for (const [i, b] of s.inputs.entries()) {
          expect(b.left, `${side} period ${i + 1} left edge`).toBeGreaterThanOrEqual(0);
          expect(b.right, `${side} period ${i + 1} right edge`).toBeLessThanOrEqual(m.vw);
          expect(Math.min(b.w, b.h), `${side} period ${i + 1} touch size`).toBeGreaterThanOrEqual(width < 768 ? 44 : 40);
        }
        expect(s.total, `${side} total exists`).not.toBeNull();
        expect(s.total.right, `${side} total right edge`).toBeLessThanOrEqual(m.vw);
        expect(s.total.left, `${side} total left edge`).toBeGreaterThanOrEqual(0);
      }
      // The total is live: typing a period updates it to the sum of the inputs.
      await page.getByTestId(`score-away-period-${periods - 1}`).fill("3");
      const after = await page.evaluate(measureScoreEntry);
      const sum = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="score-away-period-"]')]
        .reduce((total, input) => total + (Number(input.value) || 0), 0));
      // The cell may carry a visible "Total" caption on phones; compare its number.
      expect(after.sides.away.totalText.match(/(\d+)\s*$/)?.[1]).toBe(String(sum));
      if (periods === 5) {
        // An extra inning wraps (phones) instead of widening the page.
        await page.getByTestId("score-add-inning").click();
        const extra = await page.evaluate(measureScoreEntry);
        expect(extra.scrollW, "extra inning keeps the page width").toBeLessThanOrEqual(extra.vw);
        expect(extra.sides.home.inputs).toHaveLength(6);
        if (width < 768) expect(extra.sides.home.inputs[5].right).toBeLessThanOrEqual(extra.vw);
      }
    }
  });
}
