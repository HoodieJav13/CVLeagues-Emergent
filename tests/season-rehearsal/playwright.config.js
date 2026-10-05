// Season 1 rehearsal against the local mock-mode development server.
// Run from this directory with the e2e-smoke install on NODE_PATH (no new
// dependencies): see README.md.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /(rehearsal|boundaries|ux-capture|score-entry-layout|admin-teams-layout|new-game-season)\.spec\.js/,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.REHEARSAL_BASE_URL || "http://localhost:3000",
    channel: process.env.PW_CHANNEL || "chromium",
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
  },
});
