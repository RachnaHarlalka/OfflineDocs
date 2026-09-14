import { defineConfig } from "vitest/config";

// Common to every project (apps/web, apps/server). Environment, plugins, and
// setup files are project-specific — they differ enough (jsdom vs node,
// React plugin, tsconfig-paths) that putting them here would just mean
// overriding them again per project. Individual project configs can't
// `extend` the root config once it uses `test.projects`, hence this file.
export default defineConfig({
  test: {
    watch: false,
  },
});
