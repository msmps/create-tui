import { Config, Console, Context, Effect, Layer } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { PackageManagerError } from "../domain/errors";
import { ProjectSettings } from "../project-settings";

export type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

export const packageManagerFromUserAgent = (
  userAgent: string,
): PackageManagerName => {
  if (userAgent.startsWith("pnpm")) return "pnpm";
  if (userAgent.startsWith("yarn")) return "yarn";
  if (userAgent.startsWith("bun")) return "bun";
  return "npm";
};

const detectPackageManager = Config.String("npm_config_user_agent").pipe(
  Config.withDefault("npm"),
  Config.map(packageManagerFromUserAgent),
);

export class PackageManager extends Context.Service<
  PackageManager,
  {
    readonly name: PackageManagerName;
    readonly install: () => Effect.Effect<
      void,
      PackageManagerError,
      ProjectSettings
    >;
  }
>()("create-tui/services/package-manager") {
  static readonly layer = Layer.effect(
    PackageManager,
    Effect.gen(function* () {
      const childProcessSpawner =
        yield* ChildProcessSpawner.ChildProcessSpawner;
      const packageManagerName = yield* detectPackageManager;

      const install = Effect.fn(function* () {
        const projectSettings = yield* ProjectSettings;

        yield* Effect.logInfo(
          `Installing dependencies using ${packageManagerName}`,
        );
        yield* Console.log();

        const command = ChildProcess.make(packageManagerName, ["install"], {
          cwd: projectSettings.projectPath,
          stdout: "inherit",
          stderr: "inherit",
        });

        const exitCode = yield* childProcessSpawner.exitCode(command).pipe(
          Effect.mapError(
            (cause) =>
              new PackageManagerError({
                cause,
                message: cause.message,
              }),
          ),
        );

        if (exitCode !== 0) {
          return yield* new PackageManagerError({
            message: `Package installation exited with code ${exitCode}.`,
          });
        }

        yield* Console.log();
      });

      return {
        name: packageManagerName,
        install,
      };
    }),
  );
}
