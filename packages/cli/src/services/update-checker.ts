import { HttpClient } from "@effect/platform";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import {
  Console,
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Schema,
} from "effect";
import semver from "semver";
import { version as currentVersion } from "../../package.json" with {
  type: "json",
};
import type { PackageManagerName } from "./package-manager";

const NpmRegistryResponseSchema = Schema.Struct({
  "dist-tags": Schema.Struct({
    latest: Schema.String,
  }),
});

const UPDATE_CHECK_TIMEOUT = Duration.seconds(3);

function getUpdateCommand(packageManager: PackageManagerName): string {
  switch (packageManager) {
    case "bun":
      return "bun add -g create-tui@latest";
    case "pnpm":
      return "pnpm add -g create-tui@latest";
    case "yarn":
      return "yarn global add create-tui@latest";
    case "npm":
      return "npm install -g create-tui@latest";
  }
}

/**
 * Service for checking if a newer version of create-tui is available.
 *
 * Designed to be completely resilient:
 * - Times out after 3 seconds to avoid slowing down the CLI
 * - Silently ignores all errors (network issues, parsing errors, etc.)
 * - Never interrupts or fails the main CLI flow
 *
 * @example
 * ```ts
 * const updateChecker = yield* UpdateChecker;
 * yield* updateChecker.check({ packageManager: "bun" });
 * ```
 */
export class UpdateChecker extends Context.Tag(
  "create-tui/services/update-checker",
)<
  UpdateChecker,
  {
    /**
     * Checks npm for a newer version and displays a notification if available.
     * This operation is fire-and-forget - it will never fail or block the CLI.
     */
    readonly check: (options: {
      readonly packageManager: PackageManagerName;
    }) => Effect.Effect<void>;
  }
>() {
  static readonly layer = Layer.effect(
    UpdateChecker,
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;

      const fetchLatestVersion = httpClient
        .get("https://registry.npmjs.org/create-tui")
        .pipe(
          Effect.flatMap((res) => res.json),
          Effect.flatMap(Schema.decodeUnknown(NpmRegistryResponseSchema)),
          Effect.map((response) => response["dist-tags"].latest),
        );

      const displayUpdateNotification = (
        latestVersion: string,
        packageManager: PackageManagerName,
      ) =>
        Effect.gen(function* () {
          const updateCommand = getUpdateCommand(packageManager);

          yield* Console.log();

          yield* Effect.logWarning(
            AnsiDoc.hsep([
              AnsiDoc.text("Update available!").pipe(
                AnsiDoc.annotate(Ansi.combine(Ansi.yellow, Ansi.bold)),
              ),
              AnsiDoc.text(`${currentVersion} -> ${latestVersion}`),
            ]),
          );
          yield* Effect.logWarning(
            AnsiDoc.hsep([
              AnsiDoc.text("Run"),
              AnsiDoc.text(updateCommand).pipe(AnsiDoc.annotate(Ansi.cyan)),
              AnsiDoc.text("to update"),
            ]),
          );
        });

      const check = (options: {
        readonly packageManager: PackageManagerName;
      }) =>
        fetchLatestVersion.pipe(
          Effect.timeoutOption(UPDATE_CHECK_TIMEOUT),
          Effect.flatMap((maybeLatestVersion) => {
            if (Option.isNone(maybeLatestVersion)) {
              return Effect.void;
            }

            const latestVersion = maybeLatestVersion.value;

            if (!semver.gt(latestVersion, currentVersion)) {
              return Effect.void;
            }

            return displayUpdateNotification(
              latestVersion,
              options.packageManager,
            );
          }),
          Effect.catchAll(() => Effect.void),
        );

      return UpdateChecker.of({ check });
    }),
  );
}
