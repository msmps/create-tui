import { Command, type CommandExecutor } from "@effect/platform";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import { Config, Console, Context, Effect, Layer } from "effect";
import { PackageManagerError } from "../domain/errors";
import { ProjectSettings } from "../project-settings";

export type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

const detectPackageManager = Config.string("npm_config_user_agent").pipe(
  Config.withDefault("npm"),
  Config.map((userAgent) => {
    if (userAgent.startsWith("pnpm")) return "pnpm";
    if (userAgent.startsWith("yarn")) return "yarn";
    if (userAgent.startsWith("bun")) return "bun";
    return "npm";
  }),
);

export class PackageManager extends Context.Tag(
  "create-tui/services/package-manager",
)<
  PackageManager,
  {
    readonly name: PackageManagerName;
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

        yield* Command.make(packageManagerName, "install").pipe(
          Command.workingDirectory(projectSettings.projectPath),
          Command.stdout("inherit"),
          Command.stderr("inherit"),
          Command.exitCode,
          Effect.flatMap((exitCode) =>
            exitCode === 0
              ? Effect.void
              : Effect.fail("Exited with non-zero exit code."),
          ),
          Effect.mapError(
            (cause) =>
              new PackageManagerError({
                cause,
                message: "Failed to install dependencies.",
              }),
          ),
          Effect.provide(commandExecutorContext),
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
