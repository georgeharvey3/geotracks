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
