import { Command, type CommandExecutor } from "@effect/platform";
import { Context, Effect, Layer } from "effect";

export class Project extends Context.Tag("create-tui/services/project")<
  Project,
  {
    readonly initializeGitHubRepository: () => Effect.Effect<boolean, never>;
  }
>() {
  static readonly layer = Layer.effect(
    Project,
    Effect.gen(function* () {
      const commandExecutorContext =
        yield* Effect.context<CommandExecutor.CommandExecutor>();

      const executeCommand = Effect.fn("Project.executeCommand")(function* (
        command: string,
        ...args: string[]
      ) {
        return yield* Command.make(command, ...args).pipe(
          Command.exitCode,
          Effect.flatMap((exitCode) =>
            exitCode === 0 ? Effect.succeed(true) : Effect.fail(false),
          ),
          Effect.orElseSucceed(() => false),
          Effect.provide(commandExecutorContext),
        );
      });

      const initializeGitHubRepository = () =>
        Effect.gen(function* () {
          const isInsideWorkTree = yield* executeCommand(
            "git",
            "rev-parse",
            "--is-inside-work-tree",
          );

          if (isInsideWorkTree) {
            return false;
          }

          const initializeRepositoryResult = yield* executeCommand(
            "git",
            "init",
          );

          if (!initializeRepositoryResult) {
            return false;
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
            return false;
          }

          const commitResult = yield* executeCommand(
            "git",
            "commit",
            "-m",
            "Initial commit from create-tui",
          );

          if (!commitResult) {
            return false;
          }

          return true;
        });

      return Project.of({
        initializeGitHubRepository,
      });
    }),
  );
}
