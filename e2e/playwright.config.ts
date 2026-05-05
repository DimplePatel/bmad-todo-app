import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

const webServer: PlaywrightTestConfig["webServer"] = process.env.SKIP_WEBSERVER
  ? []
  : [
      {
        command: "npm run dev --workspace=backend",
        cwd: "..",
        url: `${BACKEND_URL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
      {
        command: "npm run dev --workspace=frontend -- --host",
        cwd: "..",
        url: FRONTEND_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
    ];

export default defineConfig({
  testDir: "./tests",
  // v1 has no per-user data isolation — every test shares the same SQLite
  // backend. Run serially so resetServerState in beforeEach owns the database
  // for the duration of each test. Once auth + per-user partitioning land in
  // v2, this can switch back to fullyParallel: true.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["line"]] : [["list"]],
  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      "x-e2e": "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer,
});
