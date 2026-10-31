import { Context, Effect, Layer, PlatformError, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { InitializeGitRepositoryError } from "../domain/errors";
import { ProjectSettings } from "../project-settings";

/** Result of setting up git for a new project. */
export type GitSetupOutcome =
  | { readonly _tag: "Initialized" }
  | { readonly _tag: "SkippedInsideRepository" };

interface GitCommandResult {
  readonly exitCode: number;
  readonly output: string;
}

const INITIAL_COMMIT_MESSAGE = "Initial commit from create-tui";

/** The most useful line of git output: the first fatal/error line, else the last line. */
const summarizeGitOutput = (output: string): string => {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return (
    lines.find((line) => /^(fatal|error):/i.test(line)) ?? lines.at(-1) ?? ""
  );
};

const gitSpawnError = (cause: PlatformError.PlatformError) =>
  cause.reason._tag === "NotFound"
    ? new InitializeGitRepositoryError({
        cause,
        message: "Git is not installed or not on your PATH.",
        hint: "Install git to have new projects initialized as a repository, or pass --no-git.",
      })
    : new InitializeGitRepositoryError({
        cause,
        message: `Could not run git: ${cause.message}`,
      });

const gitCommandError = (
  args: ReadonlyArray<string>,
  result: GitCommandResult,
): InitializeGitRepositoryError => {
  const summary = summarizeGitOutput(result.output);
  const command = `git ${args[0] ?? ""}`.trim();
  const message = `${command} failed (exit code ${result.exitCode})${summary ? `: ${summary}` : ""}`;

  if (
    /Author identity unknown|Please tell me who you are/i.test(result.output)
  ) {
    return new InitializeGitRepositoryError({
      message,
      hint: 'Set your identity with git config --global user.name "Your Name" and git config --global user.email "you@example.com", then commit manually.',
    });
  }

  return new InitializeGitRepositoryError({ message });
};

export class Project extends Context.Service<
  Project,
  {
    /**
     * Initializes a git repository with an initial commit in the project
     * folder. Skips (without failing) when the folder is already inside a git
     * work tree.
     */
    readonly initializeGitRepository: () => Effect.Effect<
      GitSetupOutcome,
      InitializeGitRepositoryError,
      ProjectSettings
    >;
  }
>()("create-tui/services/project") {
  static readonly layer = Layer.effect(
    Project,
    Effect.gen(function* () {
      const childProcessSpawner =
        yield* ChildProcessSpawner.ChildProcessSpawner;

      const runGit = Effect.fn("Project.runGit")(
        function* (cwd: string, args: ReadonlyArray<string>) {
          const handle = yield* childProcessSpawner.spawn(
            ChildProcess.make("git", args, { cwd }),
          );
          const [output, exitCode] = yield* Effect.all(
            [
              handle.all.pipe(Stream.decodeText(), Stream.mkString),
              handle.exitCode,
            ],
            { concurrency: "unbounded" },
          );
          return { exitCode, output } satisfies GitCommandResult;
        },
        Effect.scoped,
        Effect.mapError(gitSpawnError),
      );

      /** Runs a git command that must succeed. */
      const git = Effect.fn("Project.git")(function* (
        cwd: string,
        args: ReadonlyArray<string>,
      ) {
        const result = yield* runGit(cwd, args);
        if (result.exitCode !== 0) {
          return yield* gitCommandError(args, result);
        }
        return result;
      });

      const initializeGitRepository = Effect.fn(
        "Project.initializeGitRepository",
      )(function* () {
        const { projectPath } = yield* ProjectSettings;

        const insideWorkTree = yield* runGit(projectPath, [
          "rev-parse",
          "--is-inside-work-tree",
        ]);
        if (
          insideWorkTree.exitCode === 0 &&
          insideWorkTree.output.trim() === "true"
        ) {
          return { _tag: "SkippedInsideRepository" } satisfies GitSetupOutcome;
        }

        // `git config --get` exits with 1 when the key is not set.
        const defaultBranchArgs = ["config", "--get", "init.defaultBranch"];
        const defaultBranch = yield* runGit(projectPath, defaultBranchArgs);
        if (defaultBranch.exitCode !== 0 && defaultBranch.exitCode !== 1) {
          return yield* gitCommandError(defaultBranchArgs, defaultBranch);
        }

        yield* git(
          projectPath,
          defaultBranch.exitCode === 0
            ? ["init"]
            : ["init", "--initial-branch=main"],
        );
        yield* git(projectPath, ["add", "-A"]);
        yield* git(projectPath, ["commit", "-m", INITIAL_COMMIT_MESSAGE]);

        return { _tag: "Initialized" } satisfies GitSetupOutcome;
      });

      return Project.of({ initializeGitRepository });
    }),
  );
}
