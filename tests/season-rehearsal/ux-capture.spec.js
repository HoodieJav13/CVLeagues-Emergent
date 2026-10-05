// Stage 4 — captures and mechanical accessibility checks of the rehearsal
// journey at phone / tablet / desktop widths, seeded from the rehearsal's
// final state. Judgement (hierarchy, clarity, voice) is recorded separately in
// the audit report; this spec gathers the evidence and the measurable checks.
const path = require("path");
const fs = require("fs");
const { test, expect } = require("@playwright/test");

const STORAGE_KEY = "cvf_app_state_v11";
const ART = process.env.REHEARSAL_ARTIFACTS || path.join(__dirname, "artifacts");
const SEED = process.env.REHEARSAL_STATE || path.join(ART, "final-state.json");
const VIEWPORTS = { phone: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 900 } };

async function nav(page, route) {
  await page.evaluate((r) => { window.history.pushState({}, "", r); window.dispatchEvent(new PopStateEvent("popstate")); }, route);
  await page.waitForURL((u) => u.pathname === route.split("?")[0]);
  await page.waitForTimeout(700); // let settle beats finish before capture
}

// In-page checks that need no extra dependency.
const scan = () => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const name = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim()
    || (el.getAttribute("aria-labelledby") || "").split(" ").map((id) => document.getElementById(id)?.textContent || "").join("").trim();
  const issues = [];
  if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push(`horizontal overflow ${document.documentElement.scrollWidth}>${window.innerWidth}`);
  document.querySelectorAll("button, a[href], [role=button], [role=combobox], [role=tab]").forEach((el) => {
    if (!visible(el)) return;
    if (!name(el) && !el.querySelector("img[alt]:not([alt=''])")) issues.push(`unnamed control <${el.tagName.toLowerCase()} ${el.getAttribute("data-testid") || el.className.toString().slice(0, 40)}>`);
    const r = el.getBoundingClientRect();
    if (window.innerWidth <= 430 && (r.height < 24 || r.width < 24)) issues.push(`tiny target ${Math.round(r.width)}x${Math.round(r.height)} "${name(el).slice(0, 30)}"`);
  });
  document.querySelectorAll("input:not([type=hidden]), textarea, select").forEach((el) => {
    if (!visible(el)) return;
    const labelled = el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title");
    if (!labelled) issues.push(`unlabelled field ${el.getAttribute("data-testid") || el.name || el.type}`);
  });
  document.querySelectorAll("img").forEach((el) => { if (visible(el) && !el.hasAttribute("alt")) issues.push(`img without alt ${el.src.slice(-30)}`); });
  const h1 = [...document.querySelectorAll("h1")].filter((h) => h.offsetParent !== null || getComputedStyle(h).position === "absolute");
  if (document.querySelectorAll("h1").length !== 1) issues.push(`h1 count ${document.querySelectorAll("h1").length}`);
  void h1;
  return [...new Set(issues)];
};

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test(`capture ${vpName}`, async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await page.setViewportSize(viewport);
    const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
    const id = (c, n) => seed[c].find((r) => r.name === n).id;
    await page.addInitScript(([key, s]) => {
      if (!window.sessionStorage.getItem("seeded")) {
        window.localStorage.setItem(key, JSON.stringify({ version: 11, state: s }));
        window.sessionStorage.setItem("seeded", "1");
      }
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "#webpack-dev-server-client-overlay{display:none!important}";
        document.head.appendChild(style);
      });
    }, [STORAGE_KEY, seed]);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("role-switcher")).toBeVisible();
    const dir = path.join(ART, "ux", vpName);
    fs.mkdirSync(dir, { recursive: true });
    const report = {};
    const capture = async (label, route, before) => {
      await nav(page, route);
      if (before) await before();
      await page.screenshot({ path: path.join(dir, `${label}.png`), fullPage: true });
      report[label] = await page.evaluate(scan);
    };

    const sel = async (testid, option) => { await page.getByTestId(testid).click(); await page.getByRole("option", { name: option, exact: true }).click(); await page.waitForTimeout(500); };
    await capture("home", "/");
    await capture("schedule", "/schedule", () => sel("schedule-filter-season", "Rehearsal 2027").catch(() => {}));
    await capture("standings-kickball", "/standings");
    await capture("standings-flag", "/standings", () => sel("standings-filter-sport", "Flag Football"));
    await capture("leaderboards", "/leaderboards");
    await capture("game-kg2-corrected", "/game/rh-kg2");
    await capture("game-kg5-day", "/game/rh-kg5");
    await capture("game-kg7-postponed", "/game/rh-kg7");
    await capture("game-fg1", "/game/rh-fg1");
    await capture("game-kg6-upcoming", "/game/rh-kg6");
    await capture("team-jacks", `/team/${id("teams", "Juniper Jacks")}`);
    await capture("profile-rhea", `/profile/${id("profiles", "Rhea Testwell")}`);
    await capture("profile-felix", `/profile/${id("profiles", "Felix Freeagent")}`);
    await capture("register-team", "/register-team", () => page.getByTestId("reg-submit").click());
    await capture("free-agent", "/free-agent-signup");
    await capture("admin-gate-anonymous", "/admin");
    await page.getByTestId("role-switcher").click();
    await page.getByTestId("role-option-admin").click();
    await capture("admin-overview", "/admin");
    await capture("admin-games", "/admin", () => page.getByTestId("admin-tab-games").click());
    await capture("admin-scores", "/admin", () => page.getByTestId("admin-tab-scores").click());
    await capture("admin-teams", "/admin", () => page.getByTestId("admin-tab-teams").click());
    await capture("score-entry-kg6", "/admin", async () => {
      await page.getByTestId("admin-tab-games").click();
      await page.getByTestId("admin-game-enter-score-rh-kg6").click();
      await page.waitForTimeout(500);
    });
    await capture("score-entry-locked-kg2", "/admin", async () => {
      await page.getByTestId("admin-tab-games").click();
      await page.getByTestId("admin-game-enter-score-rh-kg2").click();
      await page.waitForTimeout(500);
    });
    fs.writeFileSync(path.join(dir, "scan.json"), JSON.stringify(report, null, 2));
  });
}
