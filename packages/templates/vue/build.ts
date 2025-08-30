import { pluginVue3 } from "bun-plugin-vue3";

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  plugins: [
    pluginVue3({
      isProduction: true,
    }),
  ],
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production" ? "external" : "none",
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
}

console.log("✅ Build completed successfully!");
console.log("Files generated:");
result.outputs.forEach((output) => {
  console.log(`  ${output.path}`);
});
