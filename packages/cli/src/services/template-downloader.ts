import { NodeSink } from "@effect/platform-node";
import {
  Context,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  Schema,
  Stream,
} from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import * as Tar from "tar";
import {
  TemplateDownloadError,
  TemplateValidationError,
} from "../domain/errors";
import type { GitHubTemplateSource } from "../domain/template";
import { ProjectSettings } from "../project-settings";

const GitHubRepositorySchema = Schema.Struct({
  default_branch: Schema.String,
});

/** Which GitHub request failed; used to explain the failure to the user. */
type GitHubLookup =
  | { readonly _tag: "Repository" }
  | { readonly _tag: "Branch"; readonly branch: string }
  | {
      readonly _tag: "TemplatePath";
      readonly branch: string;
      readonly filePath: string;
    }
  | { readonly _tag: "Download"; readonly branch: string };

/** What went wrong with a GitHub request, independent of which request it was. */
type GitHubFailure =
  | { readonly _tag: "NotFound" }
  | { readonly _tag: "RateLimited"; readonly resetsAt: Option.Option<string> }
  | { readonly _tag: "AccessDenied"; readonly status: number }
  | { readonly _tag: "ServerError"; readonly status: number }
  | { readonly _tag: "Unreachable" }
  | {
      readonly _tag: "UnexpectedResponse";
      readonly status: Option.Option<number>;
    };

const formatRateLimitReset = (
  header: string | undefined,
): Option.Option<string> =>
  Option.fromNullishOr(header).pipe(
    Option.map(Number),
    Option.filter(Number.isFinite),
    Option.flatMap((epochSeconds) => DateTime.make(epochSeconds * 1000)),
    Option.map((resetsAt) =>
      DateTime.formatUtc(resetsAt, {
        locale: "en-GB",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    ),
  );

const classifyGitHubFailure = (
  error: HttpClientError.HttpClientError,
): GitHubFailure => {
  const reason = error.reason;
  switch (reason._tag) {
    case "TransportError":
      return { _tag: "Unreachable" };
    case "StatusCodeError": {
      const { status, headers } = reason.response;
      if (status === 404) {
        return { _tag: "NotFound" };
      }
      if (
        status === 429 ||
        (status === 403 && headers["x-ratelimit-remaining"] === "0")
      ) {
        return {
          _tag: "RateLimited",
          resetsAt: formatRateLimitReset(headers["x-ratelimit-reset"]),
        };
      }
      if (status === 401 || status === 403) {
        return { _tag: "AccessDenied", status };
      }
      if (status >= 500) {
        return { _tag: "ServerError", status };
      }
      return { _tag: "UnexpectedResponse", status: Option.some(status) };
    }
    case "DecodeError":
    case "EmptyBodyError":
      return {
        _tag: "UnexpectedResponse",
        status: Option.some(reason.response.status),
      };
    case "EncodeError":
    case "InvalidUrlError":
      return { _tag: "UnexpectedResponse", status: Option.none() };
  }
};

interface FailureDescription {
  readonly message: string;
  readonly hint: string;
}

const describeNotFound = (
  repository: string,
  lookup: GitHubLookup,
): FailureDescription => {
  switch (lookup._tag) {
    case "Repository":
      return {
        message: `Repository not found: ${repository}`,
        hint: "Check the owner and repository name. Only public repositories are supported.",
      };
    case "Branch":
      return {
        message: `Branch "${lookup.branch}" not found in ${repository}`,
        hint: "Check the branch name in the template URL.",
      };
    case "TemplatePath":
      return {
        message: `No package.json found at "${lookup.filePath}" in ${repository} (branch ${lookup.branch})`,
        hint: "Check the template path. Templates must have a package.json at their root.",
      };
    case "Download":
      return {
        message: `Template archive not found for ${repository} (branch ${lookup.branch})`,
        hint: "Check that the repository and branch exist.",
      };
  }
};

const describeGitHubFailure = (
  failure: GitHubFailure,
  template: GitHubTemplateSource,
  lookup: GitHubLookup,
): FailureDescription => {
  const repository = `${template.owner}/${template.repo}`;
  const activity =
    lookup._tag === "Download"
      ? `downloading ${repository}`
      : `checking ${repository}`;

  switch (failure._tag) {
    case "NotFound":
      return describeNotFound(repository, lookup);
    case "RateLimited":
      return {
        message: `GitHub API rate limit reached while ${activity}`,
        hint: Option.match(failure.resetsAt, {
          onNone: () => "Wait a few minutes, then try again.",
          onSome: (resetsAt) =>
            `The limit resets at ${resetsAt}. Try again after that.`,
        }),
      };
    case "AccessDenied":
      return {
        message: `GitHub refused access to ${repository} (HTTP ${failure.status})`,
        hint: "Only public repositories are supported.",
      };
    case "ServerError":
      return {
        message: `GitHub returned a server error (HTTP ${failure.status}) while ${activity}`,
        hint: "GitHub may be having problems. Try again in a few minutes.",
      };
    case "Unreachable":
      return {
        message: `Could not connect to GitHub while ${activity}`,
        hint: "Check your internet connection, proxy, or firewall settings.",
      };
    case "UnexpectedResponse":
      return {
        message: Option.match(failure.status, {
          onNone: () =>
            `Could not send the request to GitHub while ${activity}`,
          onSome: (status) =>
            `Unexpected response from GitHub (HTTP ${status}) while ${activity}`,
        }),
        hint: "Try again. If it keeps happening, run with --verbose and report the details.",
      };
  }
};

const gitHubValidationError =
  (template: GitHubTemplateSource, lookup: GitHubLookup) =>
  (cause: HttpClientError.HttpClientError) =>
    new TemplateValidationError({
      cause,
      ...describeGitHubFailure(classifyGitHubFailure(cause), template, lookup),
    });

const encodePath = (filePath: string) =>
  filePath.split("/").map(encodeURIComponent).join("/");

/**
 * Service for downloading project templates from GitHub.
 *
 * All templates (including "built-in" ones) are fetched from GitHub.
 * Built-in templates are simply aliases that resolve to paths in the
 * create-tui repository.
 *
 * @example
 * ```ts
 * const downloader = yield* TemplateDownloader;
 * yield* downloader.download();
 * ```
 */
export class TemplateDownloader extends Context.Service<
  TemplateDownloader,
  {
    /**
     * Downloads and extracts the project template.
     *
     * This will:
     * 1. Resolve the branch if not specified (fetches default branch from GitHub API)
     * 2. Validate the template exists and contains a package.json
     * 3. Download the repository tarball
     * 4. Extract only the template files to the project directory
     *
     * Uses the template configuration from {@link ProjectSettings}.
     */
    readonly download: () => Effect.Effect<
      void,
      TemplateValidationError | TemplateDownloadError,
      ProjectSettings
    >;
  }
>()("create-tui/services/template-downloader") {
  static readonly layer = Layer.effect(
    TemplateDownloader,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const httpClient = yield* HttpClient.HttpClient;
      const path = yield* Path.Path;

      const codeload = httpClient.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://codeload.github.com"),
        ),
        HttpClient.mapRequest(
          HttpClientRequest.setHeader("User-Agent", "create-tui"),
        ),
        HttpClient.filterStatusOk,
      );

      const api = httpClient.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://api.github.com"),
        ),
        HttpClient.mapRequest(
          HttpClientRequest.setHeader("User-Agent", "create-tui"),
        ),
        HttpClient.filterStatusOk,
      );

      /**
       * Returns the template's branch, looking up the repository's default
       * branch on GitHub when the template does not name one.
       */
      const resolveBranch = Effect.fn("TemplateDownloader.resolveBranch")(
        function* (template: GitHubTemplateSource) {
          if (template.branch !== undefined) {
            return template.branch;
          }

          const response = yield* api
            .get(`/repos/${template.owner}/${template.repo}`)
            .pipe(
              Effect.flatMap(
                HttpClientResponse.schemaBodyJson(GitHubRepositorySchema),
              ),
              Effect.catchTags({
                HttpClientError: (cause) =>
                  Effect.fail(
                    gitHubValidationError(template, { _tag: "Repository" })(
                      cause,
                    ),
                  ),
                SchemaError: (cause) =>
                  Effect.fail(
                    new TemplateValidationError({
                      cause,
                      message: `Could not determine the default branch of ${template.owner}/${template.repo}`,
                      hint: "Include the branch in the URL: https://github.com/owner/repo/tree/<branch>",
                    }),
                  ),
              }),
            );

          return response.default_branch;
        },
      );

      /**
       * Validate that the branch exists and, for nested templates, that the
       * template path contains a package.json.
       */
      const validateExists = Effect.fn("TemplateDownloader.validateExists")(
        function* (template: GitHubTemplateSource, branch: string) {
          yield* codeload
            .head(`/${template.owner}/${template.repo}/tar.gz/${branch}`)
            .pipe(
              Effect.mapError(
                gitHubValidationError(template, { _tag: "Branch", branch }),
              ),
            );

          if (template.filePath) {
            yield* api
              .get(
                `/repos/${template.owner}/${template.repo}/contents/${encodePath(template.filePath)}/package.json?ref=${encodeURIComponent(branch)}`,
              )
              .pipe(
                Effect.mapError(
                  gitHubValidationError(template, {
                    _tag: "TemplatePath",
                    branch,
                    filePath: template.filePath,
                  }),
                ),
              );
          }
        },
      );

      /**
       * Resolve the branch and check that the template exists.
       */
      const validate = Effect.fn("TemplateDownloader.validate")(function* (
        template: GitHubTemplateSource,
        verbose: boolean,
      ) {
        if (verbose) {
          yield* Effect.logInfo(
            `Validating GitHub repository: ${template.repoUrl}`,
          );
        }

        const branch = yield* resolveBranch(template);

        if (verbose) {
          yield* Effect.logInfo(`Using branch: ${branch}`);
        }

        yield* validateExists(template, branch);

        if (verbose) {
          yield* Effect.logInfo("Repository validated successfully");
        }

        return branch;
      });

      /**
       * Download and extract the template.
       * Single unified code path for all templates (built-in and custom).
       */
      const extract = Effect.fn("TemplateDownloader.extract")(function* (
        template: GitHubTemplateSource,
        branch: string,
        destPath: string,
        verbose: boolean,
      ) {
        const tarballPath = `/${template.owner}/${template.repo}/tar.gz/${branch}`;

        // Calculate strip count: repo-branch prefix + any file path segments
        const stripCount =
          1 + (template.filePath ? template.filePath.split("/").length : 0);

        if (verbose) {
          yield* Effect.logInfo(`Downloading from: ${tarballPath}`);
        }

        // Create temp directory for extraction
        const tmpDir = yield* fs.makeTempDirectoryScoped().pipe(
          Effect.mapError(
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: "Failed to create temporary directory",
                hint: "Check that you have write permissions to the system temp directory.",
              }),
          ),
        );

        if (verbose) {
          yield* Effect.logInfo("Extracting to temporary directory...");
        }

        yield* codeload.get(tarballPath).pipe(
          HttpClientResponse.stream,
          Stream.mapError(
            (cause) =>
              new TemplateDownloadError({
                cause,
                ...describeGitHubFailure(
                  classifyGitHubFailure(cause),
                  template,
                  { _tag: "Download", branch },
                ),
              }),
          ),
          Stream.run(
            NodeSink.fromWritable({
              evaluate: () =>
                Tar.x({
                  cwd: tmpDir,
                  strip: stripCount,
                  filter: (path: string) => {
                    const parts = path.split("/");
                    if (parts.length < 2) return false;

                    if (!template.filePath) {
                      return true;
                    }

                    const relativePath = parts.slice(1).join("/");
                    return (
                      relativePath === template.filePath ||
                      relativePath.startsWith(`${template.filePath}/`)
                    );
                  },
                }),
              onError: (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Failed to extract archive",
                  hint: "The downloaded archive may be corrupted. Try again.",
                }),
            }),
          ),
        );

        const entries = yield* fs.readDirectory(tmpDir).pipe(
          Effect.mapError(
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: "Failed to read extracted files",
              }),
          ),
        );

        if (entries.length === 0) {
          return yield* new TemplateDownloadError({
            message: `No files extracted for template: ${template.displayName}`,
            hint: "The template path may be incorrect. Verify it exists in the repository.",
          });
        }

        const hasPackageJson = yield* fs
          .exists(path.join(tmpDir, "package.json"))
          .pipe(
            Effect.mapError(
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Failed to verify package.json",
                }),
            ),
          );

        if (!hasPackageJson) {
          return yield* new TemplateDownloadError({
            message: "Invalid template: missing package.json",
            hint: "Templates must contain a package.json file at the root.",
          });
        }

        if (verbose) {
          yield* Effect.logInfo("Copying to project directory...");
        }

        yield* fs.copy(tmpDir, destPath).pipe(
          Effect.mapError(
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: "Failed to copy template to project directory",
                hint: "Check that you have write permissions to the target directory.",
              }),
          ),
        );
      }, Effect.scoped);

      const download = Effect.fn("TemplateDownloader.download")(function* () {
        const { projectTemplate, projectPath, verbose } =
          yield* ProjectSettings;

        const branch = yield* validate(projectTemplate, verbose);
        yield* extract(projectTemplate, branch, projectPath, verbose);
      });

      return TemplateDownloader.of({ download });
    }),
  );
}
