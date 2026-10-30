import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { bin: "src/bin/create-tui.ts" },
    clean: true,
    dts: false,
    format: ["esm"],
    minify: true,
    outDir: "dist",
    outExtensions: () => ({ js: ".js" }),
    platform: "node",
    sourcemap: false,
    target: "node22",
  },
});
