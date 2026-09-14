import { defineConfig } from "vitest/config";

// Discovers each package's own vitest.config.ts. `vitest`/`vitest run` from
// the repo root runs all of them; `vitest --project web` (or `server`) runs
// just one. Playwright, not this, owns end-to-end coverage — see
// playwright.config.ts at the root.
export default defineConfig({
  test: {
    projects: ["apps/web/vitest.config.ts", "apps/server/vitest.config.ts"],
  },
});
