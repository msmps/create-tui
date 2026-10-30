import { Context, Effect, Layer } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { InitializeGitRepositoryError } from "../domain/errors";
import { ProjectSettings } from "../project-settings";

export class Project extends Context.Service<
  Project,
  {
    readonly initializeGitRepository: () => Effect.Effect<
      void,
      InitializeGitRepositoryError,
      ProjectSettings
    >;
  }
>()("create-tui/services/project") {
  static readonly layer = Layer.effect(
    Project,
    Effect.gen(function* () {
      const childProcessSpawner =
        yield* ChildProcessSpawner.ChildProcessSpawner;

      const executeCommand = Effect.fn(function* (
        command: string,
        ...args: string[]
      ) {
        const projectSettings = yield* ProjectSettings;
        const childProcess = ChildProcess.make(command, args, {
          cwd: projectSettings.projectPath,
        });

        return yield* childProcessSpawner.exitCode(childProcess).pipe(
          Effect.map((exitCode) => exitCode === 0),
          Effect.catch(() => Effect.succeed(false)),
        );
      });

      const initializeGitRepository = Effect.fn(function* () {
        const isInsideWorkTree = yield* executeCommand(
          "git",
          "rev-parse",
          "--is-inside-work-tree",
        );

        if (isInsideWorkTree) {
          return yield* new InitializeGitRepositoryError({
            message: "Already inside a git repository.",
          });
        }

        if (!(yield* executeCommand("git", "init"))) {
          return yield* new InitializeGitRepositoryError({
            message: "Failed to initialize git repository.",
          });
        }

        const hasDefaultBranch = yield* executeCommand(
          "git",
          "config",
          "init.defaultBranch",
        );

        if (!hasDefaultBranch) {
          yield* executeCommand("git", "checkout", "-b", "main");
        }

        if (!(yield* executeCommand("git", "add", "-A"))) {
          return yield* new InitializeGitRepositoryError({
            message: "Failed to add all files to git repository.",
          });
        }

        if (
          !(yield* executeCommand(
            "git",
            "commit",
            "-m",
            "Initial commit from create-tui",
          ))
        ) {
          return yield* new InitializeGitRepositoryError({
            message: "Failed to commit to git repository.",
          });
        }
      });

      return { initializeGitRepository };
    }),
  );
}
