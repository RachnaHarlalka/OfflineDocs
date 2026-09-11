import { defineConfig, devices } from "@playwright/test";

// End-to-end only — unit/integration coverage lives in Vitest (vitest.config.ts).
// Needs Postgres already running (`docker compose up -d`) and a migrated schema;
// Playwright starts the app servers themselves but doesn't manage the database.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",

  use: {
    baseURL: "http://localhost:4000",
    trace: "on-first-retry",
  },

  projects: [
    // Mints one storage state per role. Everything else depends on it.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "owner",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/owner.json" },
      dependencies: ["setup"],
    },
    {
      name: "editor",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/editor.json" },
      dependencies: ["setup"],
    },
    {
      name: "viewer",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/viewer.json" },
      dependencies: ["setup"],
    },
    // Signed out on purpose — this is where authorisation holes show up.
    { name: "anon", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "pnpm --filter server dev",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter web dev",
      url: "http://localhost:4000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
