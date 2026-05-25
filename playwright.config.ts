import { defineConfig, devices } from "@playwright/test";

const playwrightPort = process.env.PLAYWRIGHT_PORT || "3000";
const playwrightBaseUrl = `http://localhost:${playwrightPort}`;
const shouldStartWebServer = process.env.PLAYWRIGHT_START_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  retries: 0,
  workers: 1,
  reporter: "list",
  // M4 Part 5: wipe the heatmap_test schema once after the suite (guarded to
  // never touch production). No-op when not running against the test schema.
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: playwrightBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: shouldStartWebServer
    ? {
        command: `npm run dev -- -p ${playwrightPort}`,
        url: playwrightBaseUrl,
        reuseExistingServer: true,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
        timeout: 30000,
      }
    : undefined,
});
