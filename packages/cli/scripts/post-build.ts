import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem, Path, Schema } from "effect";

const PackageJson = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown),
);

/** The package.json fields this script rewrites. */
const PublishedPaths = Schema.Struct({
  bin: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  main: Schema.optionalKey(Schema.String),
});

const DEVELOPMENT_ONLY_FIELDS: ReadonlySet<string> = new Set([
  "scripts",
  "devDependencies",
  "peerDependencies",
]);

/** Drop the `dist/` prefix: the published package root is the dist folder. */
const stripDist = (value: string) => value.replace(/^dist\//, "");

const postBuild = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const rootDir = path.resolve(".");
  const distDir = path.join(rootDir, "dist");

  yield* Console.log("📦 Starting post-build process...");

  yield* Console.log("📄 Reading package.json...");
  const packageJson = yield* fs
    .readFileString(path.join(rootDir, "package.json"))
    .pipe(Effect.flatMap(Schema.decodeEffect(PackageJson)));

  const { bin, main } =
    yield* Schema.decodeUnknownEffect(PublishedPaths)(packageJson);
  const publishedBin =
    bin === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(bin).map(([command, binPath]) => [
            command,
            stripDist(binPath),
          ]),
        );

  // Keep the original key order; drop fields that only matter in development.
  const published = Object.fromEntries(
    Object.entries(packageJson)
      .filter(([key]) => !DEVELOPMENT_ONLY_FIELDS.has(key))
      .map(([key, value]) =>
        key === "bin"
          ? [key, publishedBin]
          : key === "main" && main !== undefined
            ? [key, stripDist(main)]
            : [key, value],
      ),
  );

  yield* Console.log("💾 Writing updated package.json to dist/...");
  const json = JSON.stringify(published, null, 2);
  yield* fs.writeFileString(path.join(distDir, "package.json"), `${json}\n`);

  yield* Console.log("📖 Copying README.md to dist/...");
  yield* fs.copyFile(
    path.join(rootDir, "README.md"),
    path.join(distDir, "README.md"),
  );

  yield* Console.log("✅ Post-build process completed successfully!");
  for (const [command, binPath] of Object.entries(publishedBin ?? {})) {
    yield* Console.log(`🔗 ${command}: ${binPath}`);
  }
});

postBuild.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
