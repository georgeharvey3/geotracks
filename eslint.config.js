import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // Paths ESLint should never look at.
  {
    ignores: ["dist", "build", "coverage", "node_modules", "cypress"],
  },

  // Base JS + typescript-eslint recommended (non-type-checked) rules.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // App + test sources.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Allow deliberately-unused identifiers when prefixed with `_`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Files that deliberately export non-components alongside (or instead of)
  // components: test/test-utility files (not fast-refresh boundaries) and the
  // context module, which co-locates its provider with the useGame/
  // useLeaderboard hook seams by design.
  {
    files: [
      "**/*.test.{ts,tsx}",
      "src/test-utils.tsx",
      "src/setupTests.ts",
      "src/context/GameContext.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  // Turn off formatting-related rules that Prettier owns. Must stay last.
  prettier,
);
