import { Command, type CommandExecutor } from "@effect/platform";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import { Config, Console, Context, Effect, Layer } from "effect";
import { PackageManagerError } from "../domain/errors";
import { ProjectSettings } from "../project-settings";

export type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

/**
 * Detects the package manager from the `npm_config_user_agent` environment variable.
 * This variable is automatically set by npm, yarn, pnpm, and bun when running scripts.
 * Falls back to "npm" if the variable is not set or unrecognized.
 */
const detectPackageManager = Config.string("npm_config_user_agent").pipe(
  Config.withDefault("npm"),
  Config.map((userAgent) => {
    if (userAgent.startsWith("pnpm")) return "pnpm";
    if (userAgent.startsWith("yarn")) return "yarn";
    if (userAgent.startsWith("bun")) return "bun";
    return "npm";
  }),
);

/**
 * Service for detecting and invoking the package manager.
 *
 * Automatically detects which package manager was used to run the CLI
 * (npm, yarn, pnpm, or bun) and provides methods to install dependencies.
 *
 * @example
 * ```ts
 * const pm = yield* PackageManager;
 * console.log(pm.name); // "bun" | "npm" | "pnpm" | "yarn"
 * yield* pm.install();
 * ```
 */
export class PackageManager extends Context.Tag(
  "create-tui/services/package-manager",
)<
  PackageManager,
  {
    /** The detected package manager name */
    readonly name: PackageManagerName;
    /**
     * Installs project dependencies using the detected package manager.
     * Runs the equivalent of `npm install` / `yarn` / `pnpm install` / `bun install`.
     */
    readonly install: () => Effect.Effect<
      void,
      PackageManagerError,
      ProjectSettings
    >;
  }
>() {
  static readonly layer = Layer.effect(
    PackageManager,
    Effect.gen(function* () {
      const commandExecutorContext =
        yield* Effect.context<CommandExecutor.CommandExecutor>();

      const packageManagerName = yield* detectPackageManager;

      const install = Effect.fn(function* () {
        const projectSettings = yield* ProjectSettings;

        yield* Effect.logInfo(
          AnsiDoc.hsep([
            AnsiDoc.text("Installing dependencies using"),
            AnsiDoc.text(packageManagerName).pipe(AnsiDoc.annotate(Ansi.green)),
          ]),
        );

        yield* Console.log();

        yield* Command.make(packageManagerName, "install")
          .pipe(
            Command.workingDirectory(projectSettings.projectPath),
            Command.stdout("inherit"),
            Command.stderr("inherit"),
            Command.exitCode,
            Effect.flatMap((exitCode) =>
              exitCode === 0
                ? Effect.void
                : Effect.fail(new Error("Exited with non-zero exit code.")),
            ),
            Effect.provide(commandExecutorContext),
          )
          .pipe(
            Effect.mapError(
              (cause) =>
                new PackageManagerError({ cause, message: cause.message }),
            ),
          );

        yield* Console.log();
      });

      return PackageManager.of({
        name: packageManagerName,
        install,
      });
    }),
  );
}
