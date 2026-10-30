import { NodeSink } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer, Path, Stream } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import * as Tar from "tar";
import {
  TemplateDownloadError,
  TemplateValidationError,
} from "../domain/errors";
import { GitHubTemplateSource } from "../domain/template";
import { ProjectSettings } from "../project-settings";

/** GitHub template with a guaranteed branch (after resolution) */
interface ResolvedGitHubTemplate extends GitHubTemplateSource {
  readonly branch: string;
}

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
       * Resolve the branch for a GitHub template.
       * If branch is already specified, returns as-is.
       * Otherwise fetches the default branch from GitHub API.
       */
      const resolveBranch = Effect.fn(function* (
        template: GitHubTemplateSource,
      ) {
        if (template.branch) {
          return template as ResolvedGitHubTemplate;
        }

        return yield* api.get(`/repos/${template.owner}/${template.repo}`).pipe(
          Effect.flatMap((res) => res.json),
          Effect.flatMap((data) => {
            const branch = (data as { default_branch?: string }).default_branch;
            return branch
              ? Effect.succeed(
                  new GitHubTemplateSource({
                    owner: template.owner,
                    repo: template.repo,
                    branch,
                    filePath: template.filePath,
                    alias: template.alias,
                  }) as ResolvedGitHubTemplate,
                )
              : Effect.fail(
                  new TemplateValidationError({
                    message: `Could not determine default branch for ${template.owner}/${template.repo}`,
                    hint: "Specify a branch in the URL: https://github.com/owner/repo/tree/branch",
                  }),
                );
          }),
          Effect.mapError(
            (cause) =>
              new TemplateValidationError({
                cause,
                message: `Repository not found: ${template.owner}/${template.repo}`,
                hint: "Verify the repository exists, is public, and your internet connection is available.",
              }),
          ),
        );
      });

      /**
       * Validate that the template exists on GitHub.
       */
      const validateExists = Effect.fn(function* (
        template: ResolvedGitHubTemplate,
      ) {
        // Check that the repo/branch exists
        yield* codeload
          .head(`/${template.owner}/${template.repo}/tar.gz/${template.branch}`)
          .pipe(
            Effect.mapError(
              (cause) =>
                new TemplateValidationError({
                  cause,
                  message: "Repository or branch not found.",
                  hint: "Verify the repository and branch exist and your internet connection is available.",
                }),
            ),
          );

        // If there's a file path, validate it contains a package.json
        if (template.filePath) {
          yield* api
            .get(
              `/repos/${template.owner}/${template.repo}/contents/${template.filePath}/package.json?ref=${template.branch}`,
            )
            .pipe(
              Effect.mapError(
                (cause) =>
                  new TemplateValidationError({
                    cause,
                    message: "Template path not found or missing package.json",
                    hint: "Templates must contain a package.json file at the root.",
                  }),
              ),
            );
        }
      });

      /**
       * Validate the template by resolving branch and checking existence.
       */
      const validate = Effect.fn(function* (
        template: GitHubTemplateSource,
        verbose: boolean,
      ) {
        if (verbose) {
          yield* Effect.logInfo(
            `Validating GitHub repository: ${template.repoUrl}`,
          );
        }

        const resolved = yield* resolveBranch(template);

        if (verbose) {
          yield* Effect.logInfo(`Using branch: ${resolved.branch}`);
        }

        yield* validateExists(resolved);

        if (verbose) {
          yield* Effect.logInfo("Repository validated successfully");
        }

        return resolved;
      });

      /**
       * Download and extract the template.
       * Single unified code path for all templates (built-in and custom).
       */
      const extract = (
        template: ResolvedGitHubTemplate,
        destPath: string,
        verbose: boolean,
      ) =>
        Effect.gen(function* () {
          const tarballPath = `/${template.owner}/${template.repo}/tar.gz/${template.branch}`;

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
                  message: `Failed to download: ${template.displayName}`,
                  hint: "Check your internet connection and try again.",
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
            return yield* Effect.fail(
              new TemplateDownloadError({
                message: `No files extracted for template: ${template.displayName}`,
                hint: "The template path may be incorrect. Verify it exists in the repository.",
              }),
            );
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
            return yield* Effect.fail(
              new TemplateDownloadError({
                message: "Invalid template: missing package.json",
                hint: "Templates must contain a package.json file at the root.",
              }),
            );
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
        }).pipe(Effect.scoped);

      const download = Effect.fn(function* () {
        const { projectTemplate, projectPath, verbose } =
          yield* ProjectSettings;

        const resolved = yield* validate(projectTemplate, verbose);
        yield* extract(resolved, projectPath, verbose);
      });

      return {
        download,
      };
    }),
  );
}
