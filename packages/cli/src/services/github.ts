import {
  FileSystem,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { NodeSink } from "@effect/platform-node";
import { Context, Data, Effect, Layer, Stream } from "effect";
import * as Tar from "tar";
import { ProjectSettings } from "../context";

export class TemplateDownloadError extends Data.TaggedError(
  "TemplateDownloadError",
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export class GitHub extends Context.Tag("create-tui/services/github")<
  GitHub,
  {
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

      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://codeload.github.com"),
        ),
        HttpClient.filterStatusOk,
      );

      const fetchRepositoryStream = () =>
        client.get("/msmps/create-tui/tar.gz/main").pipe(
          HttpClientResponse.stream,
          Stream.mapError(
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: "Failed to download template",
              }),
          ),
        );

      const downloadTemplate = () =>
        Effect.gen(function* () {
          const projectSettings = yield* ProjectSettings;
          const tmpDir = yield* fs.makeTempDirectoryScoped().pipe(
            Effect.mapError(
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Failed to create temporary directory.",
                }),
            ),
          );

          const sink = NodeSink.fromWritable(
            () =>
              Tar.x(
                {
                  cwd: tmpDir,
                  strip: 3 + projectSettings.projectTemplate.split("/").length,
                },
                [
                  `create-tui-main/packages/templates/${projectSettings.projectTemplate}`,
                ],
              ),
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: "Failed to extract archive.",
              }),
          );

          yield* Stream.run(fetchRepositoryStream(), sink);

          yield* fs.readDirectory(tmpDir).pipe(
            Effect.mapError(
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: "Could not verify archive was extracted correctly.",
                }),
            ),
            Effect.filterOrFail(
              (e) => e.length > 0,
              (cause) =>
                new TemplateDownloadError({
                  cause,
                  message: `No files found for template. Verify template '${projectSettings.projectTemplate}' exists in repository.`,
                }),
            ),
          );

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
        downloadTemplate,
      });
    }),
  );
}
