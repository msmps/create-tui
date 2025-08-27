import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

const postBuild = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  // Define paths
  const rootDir = path.resolve(".");
  const distDir = path.join(rootDir, "dist");
  const packageJsonPath = path.join(rootDir, "package.json");
  const readmePath = path.join(rootDir, "README.md");
  const distPackageJsonPath = path.join(distDir, "package.json");
  const distReadmePath = path.join(distDir, "README.md");

  yield* Console.log("📦 Starting post-build process...");

  // Read and parse package.json
  yield* Console.log("📄 Reading package.json...");
  const packageJson = yield* fs
    .readFileString(packageJsonPath)
    .pipe(Effect.map((json) => JSON.parse(json)));

  // Update bin paths to be relative to dist
  yield* Console.log("🔧 Updating bin paths...");
  if (packageJson.bin) {
    const updatedBin: Record<string, string> = {};
    for (const [command, binPath] of Object.entries(packageJson.bin)) {
      // Remove 'dist/' prefix if it exists since we're now in the dist folder
      const cleanPath = (binPath as string).replace(/^dist\//, "");
      updatedBin[command] = cleanPath;
    }
    packageJson.bin = updatedBin;
  }

  // Update main entry point
  if (packageJson.main) {
    packageJson.main = (packageJson.main as string).replace(/^dist\//, "");
  }

  // Remove scripts that don't make sense in the published package
  delete packageJson.scripts;

  // Remove devDependencies for published package
  delete packageJson.devDependencies;
  delete packageJson.peerDependencies;

  // Write updated package.json to dist
  yield* Console.log("💾 Writing updated package.json to dist/...");
  yield* fs.writeFileString(
    distPackageJsonPath,
    JSON.stringify(packageJson, null, 2),
  );

  // Copy README.md to dist
  yield* Console.log("📖 Copying README.md to dist/...");
  const readmeContent = yield* fs.readFileString(readmePath);
  yield* fs.writeFileString(distReadmePath, readmeContent);

  yield* Console.log("✅ Post-build process completed successfully!");

  // Log the updated bin paths for verification
  if (packageJson.bin) {
    yield* Console.log("🔗 Updated bin paths:");
    for (const [command, binPath] of Object.entries(packageJson.bin)) {
      yield* Console.log(`  ${command}: ${binPath}`);
    }
  }
});

// Run the post-build script
const program = postBuild.pipe(
  Effect.catchAll((error) =>
    Console.error(`❌ Post-build failed: ${error}`).pipe(
      Effect.flatMap(() => Effect.fail(error)),
    ),
  ),
  Effect.provide(NodeContext.layer),
);

Effect.runPromise(program).catch((error) => {
  console.error("❌ Post-build script failed:", error);
  process.exit(1);
});
