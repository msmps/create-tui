import { Console, Effect, FileSystem, Path } from "effect";
import { Prompt } from "effect/cli";
import { CreateProjectError } from "./domain/errors";
import { ProjectSettings } from "./project-settings";
import { PackageManager } from "./services/package-manager";
import { Project } from "./services/project";
import { TemplateDownloader } from "./services/template-downloader";
import { UpdateChecker } from "./services/update-checker";

export function createProject() {
  return Effect.gen(function* () {
    const templateDownloader = yield* TemplateDownloader;
    const path = yield* Path.Path;
    const project = yield* Project;
    const fs = yield* FileSystem.FileSystem;
    const updateChecker = yield* UpdateChecker;
    const packageManager = yield* PackageManager;
    const projectSettings = yield* ProjectSettings;

    const directoryExists = yield* fs.exists(projectSettings.projectPath).pipe(
      Effect.mapError(
        (cause) =>
          new CreateProjectError({
            cause,
            message: "Failed to check if directory exists.",
            hint: "Check that you have read permissions for the parent directory.",
          }),
      ),
    );

    if (directoryExists) {
      yield* Console.warn(
        `Directory ${projectSettings.projectPath} already exists`,
      );

      const shouldDelete = yield* Prompt.Confirm({
        message: "Would you like to delete it?",
      });

      if (!shouldDelete) {
        return yield* new CreateProjectError({
          message: "Directory already exists.",
          hint: "Use a different project name or remove it.",
        });
      }

      yield* fs.remove(projectSettings.projectPath, { recursive: true }).pipe(
        Effect.mapError(
          (cause) =>
            new CreateProjectError({
              cause,
              message: "Failed to delete directory.",
              hint: "Try manually removing it.",
            }),
        ),
      );
    }

    yield* Console.log(
      `Creating a new project in ${projectSettings.projectPath}`,
    );
    yield* Console.log(
      `Initializing project with the ${projectSettings.projectTemplate.displayName} template`,
    );

    yield* templateDownloader.download();

    const packageJsonPath = path.join(
      projectSettings.projectPath,
      "package.json",
    );

    const packageJson = yield* fs.readFileString(packageJsonPath).pipe(
      Effect.flatMap((json) =>
        Effect.try({
          try: () => JSON.parse(json),
          catch: (cause) =>
            new CreateProjectError({
              cause,
              message: "Failed to parse package.json",
              hint: "The template's package.json may be malformed. Try a different template.",
            }),
        }),
      ),
    );

    packageJson.name = projectSettings.projectName;

    yield* fs.writeFileString(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
    );

    if (!projectSettings.skipInstall) {
      yield* packageManager
        .install()
        .pipe(
          Effect.catch((cause) =>
            Console.warn(`Skipping package installation: ${cause.message}`),
          ),
        );
    }

    if (!projectSettings.skipGit) {
      yield* project.initializeGitRepository().pipe(
        Effect.andThen(Console.log("Git repository initialized successfully")),
        Effect.catch((cause) =>
          Console.warn(
            `Skipping initialization of git repository: ${cause.message}`,
          ),
        ),
      );
    }

    yield* Console.log(
      `Success! Project created at: ${projectSettings.projectPath}`,
    );

    yield* updateChecker.check({
      packageManager: packageManager.name,
    });
  });
}
