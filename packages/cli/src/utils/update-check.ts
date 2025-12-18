import { HttpClient } from "@effect/platform";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import { Console, Duration, Effect, Option, Schema } from "effect";
import semver from "semver";
import { version as currentVersion } from "../../package.json" with {
  type: "json",
};
import type { PackageManagerName } from "../services/package-manager";

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
 * Checks if a newer version of create-tui is available on npm.
 *
 * This function is designed to be completely resilient:
 * - Times out after 3 seconds to avoid slowing down the CLI
 * - Silently ignores all errors (network issues, parsing errors, etc.)
 * - Never interrupts or fails the main CLI flow
 *
 * If an update is available, displays a friendly message to the user.
 *
 * @example
 * ```ts
 * yield* checkForUpdates({ packageManager: "bun" });
 * ```
 */
export function checkForUpdates(options: {
  readonly packageManager: PackageManagerName;
}) {
  const fetchLatestVersion = Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    const response = yield* httpClient
      .get("https://registry.npmjs.org/create-tui")
      .pipe(
        Effect.flatMap((res) => res.json),
        Effect.flatMap(Schema.decodeUnknown(NpmRegistryResponseSchema)),
      );

    return response["dist-tags"].latest;
  });

  const displayUpdateNotification = (latestVersion: string) =>
    Effect.gen(function* () {
      const updateCommand = getUpdateCommand(options.packageManager);

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

  return fetchLatestVersion.pipe(
    Effect.timeoutOption(UPDATE_CHECK_TIMEOUT),
    Effect.flatMap((maybeLatestVersion) => {
      if (Option.isNone(maybeLatestVersion)) {
        return Effect.void;
      }

      const latestVersion = maybeLatestVersion.value;

      if (!semver.gt(latestVersion, currentVersion)) {
        return Effect.void;
      }

      return displayUpdateNotification(latestVersion);
    }),
    Effect.catchAll(() => Effect.void),
    Effect.uninterruptible,
  );
}
