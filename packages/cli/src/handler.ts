import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";
import type { ProjectConfig } from "./domain/config";
import { GitHub } from "./services/github";

export function createProject(config: ProjectConfig) {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;

    yield* Effect.logInfo(`Creating a new project in ${config.projectPath}`);

    yield* fs.makeDirectory(config.projectPath, { recursive: true });
    yield* Effect.logDebug(`Created directory: ${config.projectPath}`);

    yield* Effect.logInfo(
      `Initializing project with the ${config.projectTemplate} template`,
    );

    yield* GitHub.downloadTemplate(config);
    yield* Effect.logDebug(`Template download completed`);

    const packageJson = yield* fs
      .readFileString(path.join(config.projectPath, "package.json"))
      .pipe(Effect.map((json) => JSON.parse(json)));

    packageJson.name = config.projectName;

    yield* fs.writeFileString(
      path.join(config.projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );

    yield* Effect.logDebug(
      `Updated package.json with project name: ${config.projectName}`,
    );

    yield* Effect.logInfo(`Success! Project created in: ${config.projectPath}`);
  });
}
