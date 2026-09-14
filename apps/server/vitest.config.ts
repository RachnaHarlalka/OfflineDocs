import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared.ts";

// `dotenv/config` (imported by src/config/env.ts) resolves `.env` relative to
// `process.cwd()` — fine for `tsx watch` run from this directory, wrong when
// `vitest` runs from the repo root instead. Load it explicitly, relative to
// this config file's own location, so env.ts sees the same values either way.
const dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(dirname, ".env") });

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: "server",
      environment: "node",
      include: ["**/*.test.ts"],
      exclude: ["node_modules/**", "dist/**"],
    },
  }),
);
