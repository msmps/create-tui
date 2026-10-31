import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["packages/cli/src/**/*.test.ts"],
  },
  lint: {
    ignorePatterns: [".repos/**", "**/dist/**"],
    options: {
      typeAware: true,
      // Bun templates are typechecked independently by check:templates.
      // The root check script runs tsc against the CLI-only root tsconfig.
      typeCheck: false,
    },
    env: {
      node: true,
    },
    overrides: [
      {
        // Templates are Bun projects with uninstalled dependencies here; they
        // are type-checked by check:templates, so strict rules target the CLI.
        files: ["packages/cli/**/*.ts", "vite.config.ts"],
        rules: {
          // Type escape hatches: parse unknown input instead of asserting its type.
          "typescript/no-explicit-any": "error",
          "typescript/no-non-null-assertion": "error",
          "typescript/ban-ts-comment": "error",
          "typescript/consistent-type-assertions": [
            "error",
            { assertionStyle: "never" },
          ],
          "typescript/no-unsafe-argument": "error",
          "typescript/no-unsafe-assignment": "error",
          "typescript/no-unsafe-call": "error",
          "typescript/no-unsafe-member-access": "error",
          "typescript/no-unsafe-return": "error",
          // Unhandled promises hide failures.
          "typescript/no-floating-promises": "error",
          "typescript/no-misused-promises": "error",
        },
      },
    ],
  },
  fmt: {
    ignorePatterns: [".repos/**", "**/dist/**", "packages/templates/**"],
    printWidth: 80,
    semi: true,
    singleQuote: false,
  },
});
