import { Command } from "@effect/platform";
import { Data, Effect } from "effect";

export class InstallationError extends Data.TaggedError("InstallationError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export class Installer extends Effect.Service<Installer>()("app/Installer", {
  accessors: true,
  effect: Effect.gen(function* () {
    const installDependencies = (projectPath: string) =>
      Effect.gen(function* () {
        yield* Effect.logInfo("Installing dependencies with bun install...\n");

        const exitCode = yield* Command.make("bun", "install").pipe(
          Command.workingDirectory(projectPath),
          Command.stdout("inherit"),
          Command.stderr("inherit"),
          Command.exitCode,
        );

        if (exitCode !== 0) {
          return yield* Effect.fail(
            new InstallationError({
              cause: exitCode,
              message: "Failed to install dependencies",
            }),
          );
        }

        return yield* Effect.void;
      });

    const checkBunInstalled = () =>
      Effect.gen(function* () {
        const checkCommand = Command.make("bun", "--version");
        return yield* Command.exitCode(checkCommand).pipe(
          Effect.mapError(
            (cause) =>
              new InstallationError({
                cause,
                message:
                  "Bun is not installed. Please install Bun first: https://bun.sh",
              }),
          ),
        );
      });

    return {
      installDependencies,
      checkBunInstalled,
    } as const;
  }),
}) {}
