import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Effect, Logger, LogLevel } from "effect";
import type { ProjectConfig } from "./domain/config";
import { TemplateDownloadError } from "./domain/errors";
import type { GitHubTemplateSource } from "./domain/template";
import { createProject } from "./handler";
import { ProjectSettings } from "./project-settings";
import { PackageManager } from "./services/package-manager";
import { Project } from "./services/project";
import { TemplateDownloader } from "./services/template-downloader";
import { UpdateChecker } from "./services/update-checker";

const projectTemplate = {} as GitHubTemplateSource;

function runCreateProject(config: ProjectConfig) {
  return createProject().pipe(
    ProjectSettings.provide(config),
    Effect.provideService(TemplateDownloader, {
      download: () =>
        Effect.tryPromise(() =>
          writeFile(
            join(config.projectPath, "package.json"),
            JSON.stringify({ name: "template" }),
          ),
        ).pipe(
          Effect.mapError(
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: "Failed to write test package.json",
              }),
          ),
        ),
    }),
    Effect.provideService(Project, {
      initializeGitRepository: () => Effect.void,
    }),
    Effect.provideService(PackageManager, {
      name: "bun",
      install: () => Effect.void,
    }),
    Effect.provideService(UpdateChecker, {
      check: () => Effect.void,
    }),
    Effect.provide(NodeContext.layer),
    Logger.withMinimumLogLevel(LogLevel.Fatal),
    Effect.either,
    Effect.runPromise,
  );
}

function settings(
  projectPath: string,
  overrides: Partial<ProjectConfig> = {},
): ProjectConfig {
  return {
    projectName: "create-tui-test",
    projectPath,
    useCurrentDirectory: false,
    projectNameFromArgument: true,
    projectTemplate,
    skipGit: true,
    skipInstall: true,
    verbose: false,
    ...overrides,
  };
}

describe("createProject current-directory handling", () => {
  it("rejects an existing named directory supplied as an argument", async () => {
    const directory = await mkdtemp(join(tmpdir(), "create-tui-test-"));

    try {
      const result = await runCreateProject(settings(directory));

      expect(result).toMatchObject({
        _tag: "Left",
        left: { message: "Directory already exists." },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects a non-empty current directory without deleting its files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "create-tui-test-"));
    const existingFile = join(directory, "keep-me");
    await writeFile(existingFile, "keep");

    try {
      const result = await runCreateProject(
        settings(directory, { useCurrentDirectory: true }),
      );

      expect(result).toMatchObject({
        _tag: "Left",
        left: { message: "Current directory is not empty." },
      });
      expect(await Bun.file(existingFile).text()).toBe("keep");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("allows a current directory containing only .git", async () => {
    const directory = await mkdtemp(join(tmpdir(), "create-tui-test-"));
    const gitDirectory = join(directory, ".git");
    await mkdir(gitDirectory);

    try {
      const result = await runCreateProject(
        settings(directory, { useCurrentDirectory: true }),
      );

      expect(result).toMatchObject({ _tag: "Right" });
      expect((await stat(gitDirectory)).isDirectory()).toBe(true);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
