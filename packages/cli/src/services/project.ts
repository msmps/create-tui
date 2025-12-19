import { Command, type CommandExecutor } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { InitializeGitRepositoryError } from "../domain/errors";
import { ProjectSettings } from "../project-settings";

/**
 * Service for project-level operations.
 *
 * Provides functionality for initializing and configuring the project,
 * such as setting up a git repository.
 *
 * @example
 * ```ts
 * const project = yield* Project;
 * yield* project.initializeGitRepository();
 * ```
 */
export class Project extends Context.Tag("create-tui/services/project")<
  Project,
  {
    /**
     * Initializes a new git repository in the project directory.
     *
     * This will:
     * 1. Check if already inside a git repository (fails if so)
     * 2. Run `git init`
     * 3. Create a `main` branch if no default branch is configured
     * 4. Stage all files with `git add -A`
     * 5. Create an initial commit
     */
    readonly initializeGitRepository: () => Effect.Effect<
      void,
      InitializeGitRepositoryError,
      ProjectSettings
    >;
  }
>() {
  static readonly layer = Layer.effect(
    Project,
    Effect.gen(function* () {
      const commandExecutorContext =
        yield* Effect.context<CommandExecutor.CommandExecutor>();

      const executeCommand = Effect.fn(function* (
        command: string,
        ...args: string[]
      ) {
        const projectSettings = yield* ProjectSettings;

        return yield* Command.make(command, ...args).pipe(
          Command.workingDirectory(projectSettings.projectPath),
          Command.exitCode,
          Effect.flatMap((exitCode) =>
            exitCode === 0 ? Effect.succeed(true) : Effect.fail(false),
          ),
          Effect.orElseSucceed(() => false),
          Effect.provide(commandExecutorContext),
        );
      });

      const initializeGitRepository = Effect.fn(function* () {
        const isInsideWorkTree = yield* executeCommand(
          "git",
          "rev-parse",
          "--is-inside-work-tree",
        );

        if (isInsideWorkTree) {
          return yield* Effect.fail(
            new InitializeGitRepositoryError({
              message: "Already inside a git repository.",
            }),
          );
        }

        const initializeRepositoryResult = yield* executeCommand("git", "init");

        if (!initializeRepositoryResult) {
          return yield* Effect.fail(
            new InitializeGitRepositoryError({
              message: "Failed to initialize git repository.",
            }),
          );
        }

        const hasDefaultBranch = yield* executeCommand(
          "git",
          "config",
          "init.defaultBranch",
        );

        if (!hasDefaultBranch) {
          yield* executeCommand("git", "checkout", "-b", "main");
        }

        const addAllResult = yield* executeCommand("git", "add", "-A");
        if (!addAllResult) {
          return yield* Effect.fail(
            new InitializeGitRepositoryError({
              message: "Failed to add all files to git repository.",
            }),
          );
        }

        const commitResult = yield* executeCommand(
          "git",
          "commit",
          "-m",
          "Initial commit from create-tui",
        );

        if (!commitResult) {
          return yield* Effect.fail(
            new InitializeGitRepositoryError({
              message: "Failed to commit to git repository.",
            }),
          );
        }
      });

      return Project.of({
        initializeGitRepository,
      });
    }),
  );
}
