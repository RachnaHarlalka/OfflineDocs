import { test as setup } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Produces an authenticated storage state per role before any spec runs.
 *
 * The work happens in apps/server, not here, because the seed imports the app's
 * own token-signing and cookie code. Running it inside that workspace means the
 * imports, the generated Prisma client and the env schema all resolve exactly as
 * they do for the running server — no duplicate config to drift.
 */
setup("authenticate every role", async () => {
  const root = path.resolve(import.meta.dirname, "../..");

  execFileSync("pnpm", ["--filter", "server", "seed:e2e"], {
    cwd: root,
    stdio: "inherit",
  });

  for (const role of ["owner", "editor", "viewer"]) {
    const file = path.join(root, "e2e", ".auth", `${role}.json`);
    if (!existsSync(file)) {
      throw new Error(
        `seed did not produce ${file}. Check DATABASE_URL and JWT_SECRET are set for the test environment.`,
      );
    }
  }
});
