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
  },
  fmt: {
    ignorePatterns: [".repos/**", "**/dist/**", "packages/templates/**"],
    printWidth: 80,
    semi: true,
    singleQuote: false,
  },
});
