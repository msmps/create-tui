import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, FileSystem, Layer, Option, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  InitializeGitRepositoryError,
  PackageManagerError,
} from "./domain/errors";
import { parseTemplateSource } from "./domain/template";
import { createProject } from "./handler";
import { ProjectSettings } from "./project-settings";
import { PackageManager } from "./services/package-manager";
import { type GitSetupOutcome, Project } from "./services/project";
import { TemplateDownloader } from "./services/template-downloader";
import { UpdateChecker } from "./services/update-checker";
import { captureOutput } from "./testing/capture-output";

interface Scenario {
  /** Contents of the template's package.json. */
  readonly packageJson?: string;
  readonly install?: Effect.Effect<void, PackageManagerError>;
  readonly git?: Effect.Effect<GitSetupOutcome, InitializeGitRepositoryError>;
  readonly verbose?: boolean;
}

/** A template "download" that just writes the template's package.json. */
const templateWriting = (packageJson: string) =>
  Layer.effect(
    TemplateDownloader,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      return TemplateDownloader.of({
        download: () =>
          Effect.gen(function* () {
            const { projectPath } = yield* ProjectSettings;
            yield* fs.makeDirectory(projectPath, { recursive: true });
            yield* fs.writeFileString(
              path.join(projectPath, "package.json"),
              packageJson,
            );
          }).pipe(Effect.orDie),
      });
    }),
  );

const create = (scenario: Scenario) => {
  const output = captureOutput();
  const run = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped();
    const projectPath = path.join(root, "my-app");
    const projectTemplate = yield* parseTemplateSource("core");

    const exit = yield* createProject().pipe(
      ProjectSettings.provide({
        projectName: "my-app",
        projectPath,
        projectTemplate,
        skipGit: false,
        skipInstall: false,
        verbose: scenario.verbose ?? false,
      }),
      Effect.exit,
    );
    const writtenPackageJson = yield* fs
      .readFileString(path.join(projectPath, "package.json"))
      .pipe(Effect.option);
    return { exit, writtenPackageJson, projectPath };
  }).pipe(
    Effect.scoped,
    Effect.provide(
      Layer.mergeAll(
        templateWriting(
          scenario.packageJson ?? '{ "name": "template", "private": true }',
        ),
        Layer.succeed(
          PackageManager,
          PackageManager.of({
            name: "pnpm",
            install: () => scenario.install ?? Effect.void,
          }),
        ),
        Layer.succeed(
          Project,
          Project.of({
            initializeGitRepository: () =>
              scenario.git ?? Effect.succeed({ _tag: "Initialized" }),
          }),
        ),
        Layer.succeed(
          UpdateChecker,
          UpdateChecker.of({ check: () => Effect.void }),
        ),
        output.layer,
      ).pipe(Layer.provideMerge(NodeServices.layer)),
    ),
    Effect.runPromise,
  );
  return { run, output };
};

const installFailure = new PackageManagerError({
  cause: new Error("spawn pnpm ENOENT"),
  message: "pnpm is not installed or not on your PATH.",
  hint: "Install pnpm, or install the dependencies with another package manager.",
});

describe("createProject", () => {
  it("renames the template package and reports success", async () => {
    const { run, output } = create({});
    const { exit, writtenPackageJson, projectPath } = await run;

    expect(exit).toStrictEqual(Exit.void);
    expect(writtenPackageJson).toStrictEqual(
      Option.some('{\n  "name": "my-app",\n  "private": true\n}\n'),
    );
    expect(output.stdout.at(-1)).toBe(
      `[create-tui] Success! Project created at: ${projectPath}`,
    );
  });

  it("finishes the other steps, then fails with next steps when install fails", async () => {
    const { run, output } = create({ install: Effect.fail(installFailure) });
    const { exit, projectPath } = await run;

    expect(Option.getOrUndefined(Exit.findErrorOption(exit))).toMatchObject({
      _tag: "ProjectSetupIncompleteError",
      message: `Project created at ${projectPath}, but setup did not finish.`,
      hint: "The template files are in place. In that folder, install dependencies (pnpm install).",
    });
    expect(output.stderr).toStrictEqual([
      "[create-tui] pnpm is not installed or not on your PATH.",
      "[create-tui] ↳ Install pnpm, or install the dependencies with another package manager.",
    ]);
    expect(output.stdout).toContain(
      "[create-tui] Git repository initialized successfully",
    );
    expect(output.stdout.join("\n")).not.toContain("Success!");
  });

  it("lists every unfinished step when install and git both fail", async () => {
    const { run } = create({
      install: Effect.fail(installFailure),
      git: Effect.fail(
        new InitializeGitRepositoryError({
          message: "Git is not installed or not on your PATH.",
        }),
      ),
    });
    const { exit } = await run;

    expect(Option.getOrUndefined(Exit.findErrorOption(exit))).toMatchObject({
      hint: "The template files are in place. In that folder, install dependencies (pnpm install) and set up git (git init, git add -A, git commit).",
    });
  });

  it("succeeds and says why git was skipped inside an existing repository", async () => {
    const { run, output } = create({
      git: Effect.succeed({ _tag: "SkippedInsideRepository" }),
    });
    const { exit } = await run;

    expect(exit).toStrictEqual(Exit.void);
    expect(output.stdout).toContain(
      "[create-tui] Skipped git initialization: the project is inside an existing git repository",
    );
  });

  it("shows the underlying cause with --verbose", async () => {
    const { run, output } = create({
      install: Effect.fail(installFailure),
      verbose: true,
    });
    await run;

    expect(output.stderr).toStrictEqual([
      "[create-tui] pnpm is not installed or not on your PATH.",
      "[create-tui] ↳ Install pnpm, or install the dependencies with another package manager.",
      "[create-tui]   caused by Error: spawn pnpm ENOENT",
    ]);
  });

  it.each(["{ not json", "[1, 2, 3]"])(
    "rejects a template package.json that is not a JSON object: %s",
    async (packageJson) => {
      const { run } = create({ packageJson });
      const { exit } = await run;

      expect(Option.getOrUndefined(Exit.findErrorOption(exit))).toMatchObject({
        _tag: "CreateProjectError",
        message: "The template's package.json is not a valid JSON object.",
        hint: "The template may be malformed. Try a different template.",
      });
    },
  );
});
