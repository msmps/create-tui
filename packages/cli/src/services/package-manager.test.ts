import { ConfigProvider, Effect, Exit, Layer, Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseTemplateSource } from "../domain/template";
import { ProjectSettings } from "../project-settings";
import {
  fakeChildProcessSpawner,
  type ScriptedCommand,
} from "../testing/fake-child-process";
import {
  type PackageManagerName,
  PackageManager,
  packageManagerFromUserAgent,
} from "./package-manager";

describe("packageManagerFromUserAgent", () => {
  const supportedPackageManagers: ReadonlyArray<
    readonly [string, PackageManagerName]
  > = [
    ["npm/11.19.1 node/v24.11.0 linux x64", "npm"],
    ["pnpm/10.0.0 npm/? node/v22.18.0 linux x64", "pnpm"],
    ["yarn/4.0.0 npm/? node/v22.18.0 linux x64", "yarn"],
    ["bun/1.3.0 npm/? node/v24.3.0 linux x64", "bun"],
  ];

  it.each(supportedPackageManagers)(
    "detects %s as %s",
    (userAgent, expectedPackageManager) => {
      expect(packageManagerFromUserAgent(userAgent)).toBe(
        expectedPackageManager,
      );
    },
  );

  it("falls back to npm for missing or unrecognized package managers", () => {
    expect(packageManagerFromUserAgent("unknown/1.0.0")).toBe("npm");
    expect(packageManagerFromUserAgent("")).toBe("npm");
  });
});

describe("PackageManager.install", () => {
  const install = (scripted: ScriptedCommand) => {
    const spawner = fakeChildProcessSpawner(() => scripted);
    const run = Effect.gen(function* () {
      const projectTemplate = yield* parseTemplateSource("core");
      const packageManager = yield* PackageManager;
      return yield* packageManager.install().pipe(
        ProjectSettings.provide({
          projectName: "my-app",
          projectPath: "/work/my-app",
          projectTemplate,
          skipGit: true,
          skipInstall: false,
          verbose: false,
        }),
      );
    }).pipe(
      Effect.provide(PackageManager.layer),
      Effect.provide(
        Layer.mergeAll(
          spawner.layer,
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              npm_config_user_agent:
                "pnpm/10.0.0 npm/? node/v24.11.0 linux x64",
            }),
          ),
        ),
      ),
      Effect.runPromiseExit,
    );
    return { run, spawned: spawner.spawned };
  };

  it("runs the detected package manager", async () => {
    const { run, spawned } = install({ _tag: "Exits", exitCode: 0 });

    expect(await run).toStrictEqual(Exit.void);
    expect(spawned).toStrictEqual([{ command: "pnpm", args: ["install"] }]);
  });

  it("explains that the package manager is missing", async () => {
    const { run } = install({ _tag: "NotFound" });

    expect(
      Option.getOrUndefined(Exit.findErrorOption(await run)),
    ).toMatchObject({
      _tag: "PackageManagerError",
      message: "pnpm is not installed or not on your PATH.",
      hint: "Install pnpm, or install the dependencies with another package manager.",
    });
  });

  it("reports a failed install with its exit code", async () => {
    const { run } = install({ _tag: "Exits", exitCode: 1 });

    expect(
      Option.getOrUndefined(Exit.findErrorOption(await run)),
    ).toMatchObject({
      message: "pnpm install failed (exit code 1).",
      hint: "See the pnpm output above for details.",
    });
  });
});
