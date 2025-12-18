import { Prompt } from "@effect/cli";
import { FileSystem, Path } from "@effect/platform";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import { Effect } from "effect";
import { ProjectSettings } from "./context";
import { CreateProjectError } from "./domain/errors";
import { GitHub } from "./services/github";
import { PackageManager } from "./services/package-manager";
import { Project } from "./services/project";

export function createProject() {
  return Effect.gen(function* () {
    const github = yield* GitHub;
    const path = yield* Path.Path;
    const project = yield* Project;
    const fs = yield* FileSystem.FileSystem;
    const packageManager = yield* PackageManager;
    const projectSettings = yield* ProjectSettings;

    const directoryExists = yield* fs.exists(projectSettings.projectPath).pipe(
      Effect.mapError(
        (cause) =>
          new CreateProjectError({
            cause,
            message: "Failed to check if directory exists.",
          }),
      ),
    );

    if (directoryExists) {
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
        yield* fs.remove(projectSettings.projectPath, { recursive: true }).pipe(
          Effect.mapError(
            (cause) =>
              new CreateProjectError({
                cause,
                message: "Failed to delete directory.",
              }),
          ),
        );
      } else {
        return yield* new CreateProjectError({
          message: "Directory already exists.",
        });
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
        AnsiDoc.text(projectSettings.projectTemplate.displayName).pipe(
          AnsiDoc.annotate(Ansi.green),
        ),
        AnsiDoc.text("template"),
      ]),
    );

    // Validate custom templates before downloading
    yield* github.validateTemplate();

    yield* github.downloadTemplate(); // Short-circuit if download fails

    const packageJson = yield* fs
      .readFileString(path.join(projectSettings.projectPath, "package.json"))
      .pipe(Effect.map((json) => JSON.parse(json)));

    packageJson.name = projectSettings.projectName;

    yield* fs.writeFileString(
      path.join(projectSettings.projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );

    yield* packageManager
      .install()
      .pipe(
        Effect.catchAll((cause) =>
          Effect.logError(`Package installation failed: ${cause.message}`),
        ),
      );

    if (projectSettings.initializedGitRepository) {
      yield* project.initializeGitRepository().pipe(
        Effect.andThen(
          Effect.logInfo(
            AnsiDoc.hsep([
              AnsiDoc.text("Git repository initialized successfully"),
            ]),
          ),
        ),
        Effect.catchAll((cause) =>
          Effect.logWarning(
            AnsiDoc.hsep([
              AnsiDoc.text("Skipping initialization of git repository:"),
              AnsiDoc.text(cause.message).pipe(AnsiDoc.annotate(Ansi.red)),
            ]),
          ),
        ),
      );
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
