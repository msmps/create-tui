import {
  Console,
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Schema,
} from "effect";
import { HttpClient } from "effect/http";
import semver from "semver";
import packageJson from "../../package.json" with { type: "json" };
import type { PackageManagerName } from "./package-manager";

const currentVersion = packageJson.version;

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

export class UpdateChecker extends Context.Service<
  UpdateChecker,
  {
    readonly check: (options: {
      readonly packageManager: PackageManagerName;
    }) => Effect.Effect<void>;
  }
>()("create-tui/services/update-checker") {
  static readonly layer = Layer.effect(
    UpdateChecker,
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;

      const fetchLatestVersion = httpClient
        .get("https://registry.npmjs.org/create-tui")
        .pipe(
          Effect.flatMap((response) => response.json),
          Effect.flatMap(Schema.decodeUnknownEffect(NpmRegistryResponseSchema)),
          Effect.map((response) => response["dist-tags"].latest),
        );

      const displayUpdateNotification = (
        latestVersion: string,
        packageManager: PackageManagerName,
      ) =>
        Effect.gen(function* () {
          yield* Console.log();
          yield* Effect.logWarning(
            `Update available! ${currentVersion} -> ${latestVersion}`,
          );
          yield* Effect.logWarning(
            `Run ${getUpdateCommand(packageManager)} to update`,
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
          Effect.catch(() => Effect.void),
        );

      return { check };
    }),
  );
}
