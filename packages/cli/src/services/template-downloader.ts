import {
  FileSystem,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { NodeSink } from "@effect/platform-node";
import { Context, Effect, Layer, Stream } from "effect";
import * as Tar from "tar";
import { ProjectSettings } from "../context";
import {
  TemplateDownloadError,
  TemplateValidationError,
} from "../domain/errors";
import {
  type BuiltinTemplateSource,
  GitHubTemplateSource,
  type TemplateSource,
} from "../domain/template";

/** GitHub template with a guaranteed branch (after resolution) */
interface ResolvedGitHubTemplate extends GitHubTemplateSource {
  readonly branch: string;
}

/** Template ready for download (either builtin or resolved GitHub) */
type ResolvedTemplate = BuiltinTemplateSource | ResolvedGitHubTemplate;

/**
 * Service for downloading project templates from GitHub.
 *
 * Supports both built-in templates (hosted in the create-tui repo)
 * and custom GitHub repository templates.
 */
export class TemplateDownloader extends Context.Tag(
  "create-tui/services/template-downloader",
)<
  TemplateDownloader,
  {
    readonly download: () => Effect.Effect<
      void,
      TemplateValidationError | TemplateDownloadError,
      ProjectSettings
    >;
  }
>() {
  static readonly layer = Layer.effect(
    TemplateDownloader,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const httpClient = yield* HttpClient.HttpClient;

      const codeload = httpClient.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://codeload.github.com"),
        ),
        HttpClient.filterStatusOk,
      );

      const api = httpClient.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://api.github.com"),
        ),
        HttpClient.filterStatusOk,
      );

      /**
       * Resolve the branch for a GitHub template.
       * @param template - The GitHub template to resolve the branch for.
       * @returns The resolved GitHub template with the branch.
       * @throws TemplateValidationError if the branch cannot be resolved.
       */
      const resolveBranch = (
        template: GitHubTemplateSource,
      ): Effect.Effect<ResolvedGitHubTemplate, TemplateValidationError> => {
        if (template.branch) {
          return Effect.succeed(template as ResolvedGitHubTemplate);
        }

        return api.get(`/repos/${template.owner}/${template.repo}`).pipe(
          Effect.flatMap((res) => res.json),
          Effect.flatMap((data) => {
            const branch = (data as { default_branch?: string }).default_branch;
            return branch
              ? Effect.succeed(
                  new GitHubTemplateSource({
                    ...template,
                    branch,
                  }) as ResolvedGitHubTemplate,
                )
              : Effect.fail(
                  new TemplateValidationError({
                    message: `Could not determine default branch for ${template.owner}/${template.repo}`,
                  }),
                );
          }),
          Effect.catchTags({
            RequestError: (cause) =>
              Effect.fail(
                new TemplateValidationError({
                  cause,
                  message: "Failed to connect to GitHub API",
                }),
              ),
            ResponseError: (cause) =>
              Effect.fail(
                new TemplateValidationError({
                  cause,
                  message: `Repository not found: ${template.owner}/${template.repo}`,
                }),
              ),
          }),
        );
      };

      /**
       * Validate that the template exists on GitHub.
       * @param template - The resolved GitHub template to validate.
       * @returns A void effect if the template exists.
       * @throws TemplateValidationError if the template does not exist.
       */
      const validateExists = (
        template: ResolvedGitHubTemplate,
      ): Effect.Effect<void, TemplateValidationError> =>
        Effect.gen(function* () {
          yield* codeload
            .head(
              `/${template.owner}/${template.repo}/tar.gz/${template.branch}`,
            )
            .pipe(
              Effect.catchTags({
                RequestError: (cause) =>
                  Effect.fail(
                    new TemplateValidationError({
                      cause,
                      message: "Failed to connect to GitHub",
                    }),
                  ),
                ResponseError: (cause) =>
                  Effect.fail(
                    new TemplateValidationError({
                      cause,
                      message: `Repository or branch not found: ${template.owner}/${template.repo}@${template.branch}`,
                    }),
                  ),
              }),
            );

          if (template.filePath) {
            yield* api
              .get(
                `/repos/${template.owner}/${template.repo}/contents/${template.filePath}/package.json?ref=${template.branch}`,
              )
              .pipe(
                Effect.catchTags({
                  RequestError: (cause) =>
                    Effect.fail(
                      new TemplateValidationError({
                        cause,
                        message: "Failed to connect to GitHub API",
                      }),
                    ),
                  ResponseError: (cause) =>
                    Effect.fail(
                      new TemplateValidationError({
                        cause,
                        message: `Template path not found or missing package.json: ${template.displayName}`,
                      }),
                    ),
                }),
              );
          }
        });

      /**
       * Validate the template.
       * @param template - The template to validate.
       * @param verbose - Whether to log verbose output.
       * @returns The validated template.
       * @throws TemplateValidationError if the template is invalid.
       */
      const validate = (
        template: TemplateSource,
        verbose: boolean,
      ): Effect.Effect<ResolvedTemplate, TemplateValidationError> =>
        Effect.gen(function* () {
          if (template._tag === "BuiltinTemplate") {
            return template;
          }

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
       * @param template - The template to download and extract.
       * @param destPath - The destination path to extract the template to.
       * @param verbose - Whether to log verbose output.
       * @returns A void effect if the template is downloaded and extracted.
       * @throws TemplateDownloadError if the template cannot be downloaded or extracted.
       */
      const extract = (
        template: ResolvedTemplate,
        destPath: string,
        verbose: boolean,
      ): Effect.Effect<void, TemplateDownloadError> =>
        Effect.gen(function* () {
          const isBuiltin = template._tag === "BuiltinTemplate";

          const tarballPath = isBuiltin
            ? "/msmps/create-tui/tar.gz/main"
            : `/${template.owner}/${template.repo}/tar.gz/${template.branch}`;

          // Calculate how many path segments to strip from the tarball:
          // - Built-in: strip "create-tui-main/packages/templates/<name>"
          // - GitHub: strip "<repo>-<branch>/" plus any filePath
          const stripCount = isBuiltin
            ? 3 + template.name.split("/").length
            : 1 + (template.filePath ? template.filePath.split("/").length : 0);

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
                }),
            ),
          );

          if (verbose) {
            yield* Effect.logInfo("Extracting to temporary directory...");
          }

          yield* Stream.run(
            codeload.get(tarballPath).pipe(
              HttpClientResponse.stream,
              Stream.mapError(
                (cause) =>
                  new TemplateDownloadError({
                    cause,
                    message: `Failed to download: ${template.displayName}`,
                  }),
              ),
            ),
            NodeSink.fromWritable(
              () =>
                Tar.x({
                  cwd: tmpDir,
                  strip: stripCount,
                  filter: (path: string) => {
                    const parts = path.split("/");
                    if (parts.length < 2) return false;
                    const relativePath = parts.slice(1).join("/");

                    if (template._tag === "BuiltinTemplate") {
                      return relativePath.startsWith(
                        `packages/templates/${template.name}`,
                      );
                    }

                    if (!template.filePath) {
                      return true;
                    }

                    return (
                      relativePath === template.filePath ||
                      relativePath.startsWith(`${template.filePath}/`)
                    );
                  },
                }),
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Failed to extract archive",
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
              }),
            );
          }

          const hasPackageJson = yield* fs
            .exists(`${tmpDir}/package.json`)
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
                }),
            ),
          );
        }).pipe(Effect.scoped);

      return TemplateDownloader.of({
        download: () =>
          Effect.gen(function* () {
            const { projectTemplate, projectPath, verbose } =
              yield* ProjectSettings;

            const resolved = yield* validate(projectTemplate, verbose);
            yield* extract(resolved, projectPath, verbose);
          }),
      });
    }),
  );
}
