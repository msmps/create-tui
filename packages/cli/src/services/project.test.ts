import { Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseTemplateSource } from "../domain/template";
import { ProjectSettings } from "../project-settings";
import {
  fakeChildProcessSpawner,
  type ScriptedCommand,
  type SpawnedCommand,
} from "../testing/fake-child-process";
import { Project } from "./project";

const exits = (exitCode: number, output = ""): ScriptedCommand => ({
  _tag: "Exits",
  exitCode,
  output,
});

/** A git that is not inside a repository, has no default branch configured, and succeeds otherwise. */
const healthyGit =
  (
    overrides: (args: string) => ScriptedCommand | undefined = () => undefined,
  ) =>
  ({ args }: SpawnedCommand): ScriptedCommand => {
    const joined = args.join(" ");
    return (
      overrides(joined) ??
      (joined === "rev-parse --is-inside-work-tree"
        ? exits(
            128,
            "fatal: not a git repository (or any of the parent directories): .git",
          )
        : joined === "config --get init.defaultBranch"
          ? exits(1)
          : exits(0))
    );
  };

const initializeGit = (
  script: (command: SpawnedCommand) => ScriptedCommand,
) => {
  const spawner = fakeChildProcessSpawner(script);
  const run = Effect.gen(function* () {
    const projectTemplate = yield* parseTemplateSource("core");
    const project = yield* Project;
    return yield* project.initializeGitRepository().pipe(
      ProjectSettings.provide({
        projectName: "my-app",
        projectPath: "/work/my-app",
        projectTemplate,
        skipGit: false,
        skipInstall: true,
        verbose: false,
      }),
    );
  }).pipe(
    Effect.provide(Project.layer),
    Effect.provide(spawner.layer),
    Effect.runPromiseExit,
  );
  return { run, spawned: spawner.spawned };
};

const failureOf = async (exit: Promise<Exit.Exit<unknown, unknown>>) =>
  Option.getOrUndefined(Exit.findErrorOption(await exit));

describe("Project.initializeGitRepository", () => {
  it("initializes on main and commits when no default branch is configured", async () => {
    const { run, spawned } = initializeGit(healthyGit());

    expect(await run).toStrictEqual(Exit.succeed({ _tag: "Initialized" }));
    expect(spawned.map(({ args }) => args.join(" "))).toStrictEqual([
      "rev-parse --is-inside-work-tree",
      "config --get init.defaultBranch",
      "init --initial-branch=main",
      "add -A",
      "commit -m Initial commit from create-tui",
    ]);
  });

  it("skips (without failing) inside an existing repository", async () => {
    const { run, spawned } = initializeGit(
      healthyGit((args) =>
        args === "rev-parse --is-inside-work-tree"
          ? exits(0, "true\n")
          : undefined,
      ),
    );

    expect(await run).toStrictEqual(
      Exit.succeed({ _tag: "SkippedInsideRepository" }),
    );
    expect(spawned).toHaveLength(1);
  });

  it("explains that git is missing instead of reporting a generic failure", async () => {
    const { run } = initializeGit(() => ({ _tag: "NotFound" }));

    expect(await failureOf(run)).toMatchObject({
      _tag: "InitializeGitRepositoryError",
      message: "Git is not installed or not on your PATH.",
      hint: "Install git to have new projects initialized as a repository, or pass --no-git.",
    });
  });

  it("includes git's own error and a fix when the commit identity is missing", async () => {
    const { run } = initializeGit(
      healthyGit((args) =>
        args.startsWith("commit")
          ? exits(
              128,
              "Author identity unknown\n\n*** Please tell me who you are.\n\nfatal: unable to auto-detect email address (got 'dev@laptop.(none)')\n",
            )
          : undefined,
      ),
    );

    expect(await failureOf(run)).toMatchObject({
      message:
        "git commit failed (exit code 128): fatal: unable to auto-detect email address (got 'dev@laptop.(none)')",
      hint: 'Set your identity with git config --global user.name "Your Name" and git config --global user.email "you@example.com", then commit manually.',
    });
  });

  it("reports which git step failed and why", async () => {
    const { run } = initializeGit(
      healthyGit((args) =>
        args === "add -A"
          ? exits(
              128,
              'error: open("secret.pem"): Permission denied\nfatal: adding files failed\n',
            )
          : undefined,
      ),
    );

    expect(await failureOf(run)).toMatchObject({
      message:
        'git add failed (exit code 128): error: open("secret.pem"): Permission denied',
    });
  });
});
