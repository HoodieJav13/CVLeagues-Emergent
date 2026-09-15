// Production-build smoke. Prerequisites (run from the repository root):
//   cd frontend && REACT_APP_SUPABASE_URL=https://ci-placeholder.supabase.co \
//     REACT_APP_SUPABASE_ANON_KEY=ci-placeholder-anon-key \
//     REACT_APP_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build
//   cd tests/e2e-smoke && npm install && npx playwright install chromium && npm run smoke
// The placeholder values only satisfy the prebuild preflight; every request the
// bundle makes to that host is answered by the test from the seed fixtures.
const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js/,
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Full Chromium rather than the headless-shell build, so one download
    // (`npx playwright install chromium`) serves headed and headless runs.
    // PW_CHANNEL=chrome reuses an installed Google Chrome with no download.
    channel: process.env.PW_CHANNEL || "chromium",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile-375", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `npx serve -s ../../frontend/build -l ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
