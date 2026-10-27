import { defineConfig } from "@playwright/test";

// End-to-end tests on two phone sizes and desktop, against a local server on
// its own throwaway JSON store — never a real database. Locally they reuse
// `npm run dev:local` if it's running; in CI they start the built app.
const PORT = 3100;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "iphone-14", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "iphone-se", use: { browserName: "chromium", viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: ci ? `npx next start -p ${PORT}` : "node scripts/dev-local.mjs",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !ci,
    timeout: 240_000,
    env: { CARAVAN_LOCAL_STORE: "1", CARAVAN_LOCAL_STORE_FILE: ".data/e2e-db.json" },
  },
});
