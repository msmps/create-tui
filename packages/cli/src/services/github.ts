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

export class GitHub extends Context.Tag("create-tui/services/github")<
  GitHub,
  {
    readonly validateTemplate: () => Effect.Effect<
      void,
      TemplateValidationError,
      ProjectSettings
    >;
    readonly downloadTemplate: () => Effect.Effect<
      void,
      TemplateDownloadError,
      ProjectSettings
    >;
  }
>() {
  static readonly layer = Layer.effect(
    GitHub,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const httpClient = yield* HttpClient.HttpClient;

      const codeloadClient = httpClient.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://codeload.github.com"),
        ),
        HttpClient.filterStatusOk,
      );

      const validateTemplate = () =>
        Effect.gen(function* () {
          const projectSettings = yield* ProjectSettings;
          const template = projectSettings.projectTemplate;

          // Built-in templates are always valid
          if (template._tag === "BuiltinTemplate") {
            return;
          }

          if (projectSettings.verbose) {
            yield* Effect.logInfo(
              `Validating GitHub repository: ${template.owner}/${template.repo}`,
            );
          }

          yield* codeloadClient
            .head(`/${template.owner}/${template.repo}/tar.gz/main`)
            .pipe(
              Effect.catchTag("RequestError", (cause) =>
                Effect.fail(
                  new TemplateValidationError({
                    cause,
                    message: "Failed to connect to GitHub",
                  }),
                ),
              ),
              Effect.catchTag("ResponseError", (cause) =>
                Effect.fail(
                  new TemplateValidationError({
                    cause,
                    message: `Template repository not found: ${template.owner}/${template.repo}`,
                  }),
                ),
              ),
            );

          if (projectSettings.verbose) {
            yield* Effect.logInfo("Repository validated successfully");
          }
        });

      const downloadTemplate = () =>
        Effect.gen(function* () {
          const projectSettings = yield* ProjectSettings;
          const template = projectSettings.projectTemplate;

          // Determine download configuration based on template type
          const isBuiltin = template._tag === "BuiltinTemplate";

          const downloadPath = isBuiltin
            ? "/msmps/create-tui/tar.gz/main"
            : `/${template.owner}/${template.repo}/tar.gz/main`;

          const stripCount = isBuiltin
            ? 3 + template.name.split("/").length
            : 1; // Custom templates: just strip root folder (repo-main/)

          if (projectSettings.verbose) {
            yield* Effect.logInfo(`Downloading template from: ${downloadPath}`);
          }

          const fetchRepositoryStream = () =>
            codeloadClient.get(downloadPath).pipe(
              HttpClientResponse.stream,
              Stream.mapError(
                (cause) =>
                  new TemplateDownloadError({
                    cause,
                    message: `Failed to download template: ${template.displayName}`,
                  }),
              ),
            );

          const tmpDir = yield* fs.makeTempDirectoryScoped().pipe(
            Effect.mapError(
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Failed to create temporary directory.",
                }),
            ),
          );

          if (projectSettings.verbose) {
            yield* Effect.logInfo("Extracting to temporary directory...");
          }

          const tarFilter = isBuiltin
            ? [`create-tui-main/packages/templates/${template.name}`]
            : [];

          yield* Stream.run(
            fetchRepositoryStream(),
            NodeSink.fromWritable(
              () =>
                Tar.x(
                  {
                    cwd: tmpDir,
                    strip: stripCount,
                  },
                  tarFilter,
                ),
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Failed to download and extract archive.",
                }),
            ),
          );

          // Verify extraction succeeded
          yield* fs.readDirectory(tmpDir).pipe(
            Effect.mapError(
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Could not verify archive was extracted correctly.",
                }),
            ),
            Effect.filterOrFail(
              (entries) => entries.length > 0,
              () =>
                new TemplateDownloadError({
                  message: `No files found for template: ${template.displayName}`,
                }),
            ),
          );

          // Verify package.json exists (template validity check)
          const hasPackageJson = yield* fs
            .exists(`${tmpDir}/package.json`)
            .pipe(
              Effect.mapError(
                (cause) =>
                  new TemplateDownloadError({
                    cause,
                    message: "Failed to check for package.json.",
                  }),
              ),
            );

          if (!hasPackageJson) {
            return yield* Effect.fail(
              new TemplateDownloadError({
                message:
                  "Invalid template: missing package.json at repository root.",
              }),
            );
          }

          if (projectSettings.verbose) {
            yield* Effect.logInfo(
              "Template validated, copying to project directory...",
            );
          }

          yield* fs.copy(tmpDir, projectSettings.projectPath).pipe(
            Effect.mapError(
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Failed to copy template.",
                }),
            ),
          );
        }).pipe(Effect.scoped);

      return GitHub.of({
        validateTemplate,
        downloadTemplate,
      });
    }),
  );
}
