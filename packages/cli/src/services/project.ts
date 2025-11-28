import { Command, type CommandExecutor } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { ProjectSettings } from "../context";
import { InitializeGitRepositoryError } from "../domain/errors";

export class Project extends Context.Tag("create-tui/services/project")<
  Project,
  {
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

      const initializeGitRepository = () =>
        Effect.gen(function* () {
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

          const initializeRepositoryResult = yield* executeCommand(
            "git",
            "init",
          );

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

          return yield* Effect.void;
        });

      return Project.of({
        initializeGitRepository,
      });
    }),
  );
}
