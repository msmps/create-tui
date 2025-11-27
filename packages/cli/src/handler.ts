import { Prompt } from "@effect/cli";
import { FileSystem, Path } from "@effect/platform";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import { Effect } from "effect";
import { ProjectSettings } from "./context";
import { GitHub } from "./services/github";
import { Project } from "./services/project";

export function createProject() {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const project = yield* Project;
    const github = yield* GitHub;
    const fs = yield* FileSystem.FileSystem;
    const projectSettings = yield* ProjectSettings;

    if ((yield* fs.exists(projectSettings.projectPath)) === true) {
      yield* Effect.logWarning(
        AnsiDoc.hsep([
          AnsiDoc.text("Directory"),
          AnsiDoc.text(projectSettings.projectPath).pipe(
            AnsiDoc.annotate(Ansi.yellow),
          ),
          AnsiDoc.text("already exists"),
        ]),
      );

      if (yield* Prompt.confirm({ message: "Would you like to delete it?" })) {
        yield* fs.remove(projectSettings.projectPath, { recursive: true });
      } else {
        return yield* Effect.fail("Aborting creation of project...");
      }
    }

    yield* Effect.logInfo(
      AnsiDoc.hsep([
        AnsiDoc.text("Creating a new project in"),
        AnsiDoc.text(projectSettings.projectPath).pipe(
          AnsiDoc.annotate(Ansi.green),
        ),
      ]),
    );

    yield* Effect.logInfo(
      AnsiDoc.hsep([
        AnsiDoc.text("Initializing project with the"),
        AnsiDoc.text(projectSettings.projectTemplate).pipe(
          AnsiDoc.annotate(Ansi.green),
        ),
        AnsiDoc.text("template"),
      ]),
    );

    yield* github.downloadTemplate();

    const packageJson = yield* fs
      .readFileString(path.join(projectSettings.projectPath, "package.json"))
      .pipe(Effect.map((json) => JSON.parse(json)));

    packageJson.name = projectSettings.projectName;

    yield* fs.writeFileString(
      path.join(projectSettings.projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );

    if (!projectSettings.disableGitHubRepositoryInitialization) {
      const initializeGitHubRepositoryResult =
        yield* project.initializeGitHubRepository();

      if (!initializeGitHubRepositoryResult) {
        yield* Effect.logError(
          AnsiDoc.text("Failed to initialize GitHub repository"),
        );
      } else {
        yield* Effect.logInfo(
          AnsiDoc.hsep([
            AnsiDoc.text("GitHub repository initialized successfully"),
          ]),
        );
      }
    }

    yield* Effect.logInfo(
      AnsiDoc.hsep([
        AnsiDoc.text("Success!").pipe(AnsiDoc.annotate(Ansi.green)),
        AnsiDoc.text("Project created at:"),
        AnsiDoc.text(projectSettings.projectPath).pipe(
          AnsiDoc.annotate(Ansi.green),
        ),
      ]),
    );
  });
}
