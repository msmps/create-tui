import { Prompt } from "@effect/cli";
import { FileSystem, Path } from "@effect/platform";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import { Effect } from "effect";
import type { ProjectConfig } from "./domain/config";
import { GitHub } from "./services/github";

export function createProject(config: ProjectConfig) {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;

    if ((yield* fs.exists(config.projectPath)) === true) {
      yield* Effect.logWarning(
        AnsiDoc.hsep([
          AnsiDoc.text("Directory"),
          AnsiDoc.text(config.projectPath).pipe(AnsiDoc.annotate(Ansi.yellow)),
          AnsiDoc.text("already exists"),
        ]),
      );

      if (yield* Prompt.confirm({ message: "Would you like to delete it?" })) {
        yield* fs.remove(config.projectPath, { recursive: true });
      } else {
        return yield* Effect.fail("Aborting creation of project...");
      }
    }

    yield* Effect.logInfo(
      AnsiDoc.hsep([
        AnsiDoc.text("Creating a new project in"),
        AnsiDoc.text(config.projectPath).pipe(AnsiDoc.annotate(Ansi.green)),
      ]),
    );

    yield* Effect.logInfo(
      AnsiDoc.hsep([
        AnsiDoc.text("Initializing project with the"),
        AnsiDoc.text(config.projectTemplate).pipe(AnsiDoc.annotate(Ansi.green)),
        AnsiDoc.text("template"),
      ]),
    );

    yield* GitHub.downloadTemplate(config);

    const packageJson = yield* fs
      .readFileString(path.join(config.projectPath, "package.json"))
      .pipe(Effect.map((json) => JSON.parse(json)));

    packageJson.name = config.projectName;

    yield* fs.writeFileString(
      path.join(config.projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );

    yield* Effect.logInfo(
      AnsiDoc.hsep([
        AnsiDoc.text("Success!").pipe(AnsiDoc.annotate(Ansi.green)),
        AnsiDoc.text("Project created in:"),
        AnsiDoc.text(config.projectPath).pipe(AnsiDoc.annotate(Ansi.green)),
      ]),
    );
  });
}
