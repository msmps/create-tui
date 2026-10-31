import { Effect, FileSystem, Path, Schema } from "effect";
import { Prompt } from "effect/cli";
import {
  CreateProjectError,
  type InitializeGitRepositoryError,
  type PackageManagerError,
  ProjectSetupIncompleteError,
} from "./domain/errors";
import { ProjectSettings } from "./project-settings";
import { PackageManager } from "./services/package-manager";
import { Project } from "./services/project";
import { TemplateDownloader } from "./services/template-downloader";
import { UpdateChecker } from "./services/update-checker";
import { reportFailure } from "./utils/logger";

/** A template's package.json: any JSON object; only `name` is rewritten. */
const PackageJsonFromString = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown),
  { space: 2 },
);

/** Outcome of an optional setup step (dependency install, git). */
type SetupStep<E> =
  | { readonly _tag: "Completed" }
  | { readonly _tag: "Skipped" }
  | { readonly _tag: "Failed"; readonly error: E };

const completed = { _tag: "Completed" } as const;
const skipped = { _tag: "Skipped" } as const;

export const createProject = Effect.fn("createProject")(function* () {
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
    yield* Effect.logWarning(
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

  yield* Effect.logInfo(
    `Creating a new project in ${projectSettings.projectPath}`,
  );
  yield* Effect.logInfo(
    `Initializing project with the ${projectSettings.projectTemplate.displayName} template`,
  );

  yield* templateDownloader.download();

  const packageJsonPath = path.join(
    projectSettings.projectPath,
    "package.json",
  );

  const packageJson = yield* fs.readFileString(packageJsonPath).pipe(
    Effect.mapError(
      (cause) =>
        new CreateProjectError({
          cause,
          message: `Failed to read ${packageJsonPath}`,
        }),
    ),
    Effect.flatMap(Schema.decodeEffect(PackageJsonFromString)),
    Effect.catchTag("SchemaError", (cause) =>
      Effect.fail(
        new CreateProjectError({
          cause,
          message: "The template's package.json is not a valid JSON object.",
          hint: "The template may be malformed. Try a different template.",
        }),
      ),
    ),
  );

  yield* Schema.encodeEffect(PackageJsonFromString)({
    ...packageJson,
    name: projectSettings.projectName,
  }).pipe(
    Effect.flatMap((json) => fs.writeFileString(packageJsonPath, `${json}\n`)),
    Effect.mapError(
      (cause) =>
        new CreateProjectError({
          cause,
          message: `Failed to update ${packageJsonPath}`,
        }),
    ),
  );

  const install: SetupStep<PackageManagerError> = projectSettings.skipInstall
    ? skipped
    : yield* packageManager.install().pipe(
        Effect.as(completed),
        Effect.catchTag("PackageManagerError", (error) =>
          reportFailure("Warn", error, projectSettings.verbose).pipe(
            Effect.as({ _tag: "Failed", error } as const),
          ),
        ),
      );

  const git: SetupStep<InitializeGitRepositoryError> = projectSettings.skipGit
    ? skipped
    : yield* project.initializeGitRepository().pipe(
        Effect.tap((outcome) =>
          outcome._tag === "Initialized"
            ? Effect.logInfo("Git repository initialized successfully")
            : Effect.logInfo(
                "Skipped git initialization: the project is inside an existing git repository",
              ),
        ),
        Effect.as(completed),
        Effect.catchTag("InitializeGitRepositoryError", (error) =>
          reportFailure("Warn", error, projectSettings.verbose).pipe(
            Effect.as({ _tag: "Failed", error } as const),
          ),
        ),
      );

  yield* updateChecker.check({ packageManager: packageManager.name });

  const remainingSteps = [
    install._tag === "Failed"
      ? `install dependencies (${packageManager.name} install)`
      : undefined,
    git._tag === "Failed"
      ? "set up git (git init, git add -A, git commit)"
      : undefined,
  ].filter((step) => step !== undefined);

  if (remainingSteps.length > 0) {
    return yield* new ProjectSetupIncompleteError({
      message: `Project created at ${projectSettings.projectPath}, but setup did not finish.`,
      hint: `The template files are in place. In that folder, ${remainingSteps.join(" and ")}.`,
    });
  }

  yield* Effect.logInfo(
    `Success! Project created at: ${projectSettings.projectPath}`,
  );
});
