import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: "/geotracks/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: true,
    // Vitest's 5s default is a unit-test budget, and the integration suite in
    // App.test.tsx plays whole games: the competition test alone drives ten
    // rounds of typing, submitting and advancing against the real map. That
    // lands around 2s on a dev machine and around 5s on a CI runner — i.e. on
    // the wrong side of the default, intermittently. Give the long tests room
    // rather than have the suite fail on runner speed.
    testTimeout: 20000,
    // Agent worktrees under .claude/ carry their own (often stale) copy of the
    // suite; only this checkout's tests should run.
    exclude: [...configDefaults.exclude, ".claude/**"],
    coverage: {
      // V8 coverage report on demand (`npm run test:coverage`). Reported only —
      // no enforced percentage gate.
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/test-utils.tsx",
        "src/setupTests.ts",
        "src/**/*.d.ts",
        "src/index.tsx",
        "src/vite-env.d.ts",
      ],
    },
  },
});
