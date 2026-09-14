import { defineConfig, mergeConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
// No extension, deliberately: apps/web's tsconfig doesn't have
// allowImportingTsExtensions enabled and this file falls within its
// typecheck scope (unlike apps/server's, whose tsconfig only includes
// `src`) — `.ts` here passes Vite's loader but fails `tsc`.
import sharedConfig from "../../vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    plugins: [tsconfigPaths(), react()],
    test: {
      name: "web",
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      include: ["**/*.test.{ts,tsx}"],
      exclude: ["node_modules/**", ".next/**"],
    },
  }),
);
