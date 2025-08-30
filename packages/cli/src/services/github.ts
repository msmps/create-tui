import {
  FileSystem,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { NodeSink } from "@effect/platform-node";
import { Data, Effect, Stream } from "effect";
import * as Tar from "tar";
import type { ProjectConfig } from "../domain/config";

export class TemplateDownloadError extends Data.TaggedError(
  "TemplateDownloadError"
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export class GitHub extends Effect.Service<GitHub>()("app/GitHub", {
  accessors: true,
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(
        HttpClientRequest.prependUrl("https://codeload.github.com")
      ),
      HttpClient.filterStatusOk
    );

    const fetchRepositoryStream = () =>
      client.get("/msmps/create-tui/tar.gz/main").pipe(
        HttpClientResponse.stream,
        Stream.mapError(
          (cause) =>
            new TemplateDownloadError({
              cause,
              message: "Failed to download template",
            })
        )
      );

    const downloadTemplate = (config: ProjectConfig) =>
      Effect.gen(function* () {
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        const sink = NodeSink.fromWritable(
          () =>
            Tar.x(
              {
                cwd: tmpDir,
                strip: 3 + config.projectTemplate.split("/").length,
              },
              [`create-tui-main/packages/templates/${config.projectTemplate}`]
            ),
          (cause) =>
            new TemplateDownloadError({
              cause,
              message: "Failed to extract archive.",
            })
        );

        yield* Stream.run(fetchRepositoryStream(), sink);

        yield* fs.readDirectory(tmpDir).pipe(
          Effect.mapError(
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: "Could not verify archive was extracted correctly.",
              })
          ),
          Effect.filterOrFail(
            (e) => e.length > 0,
            (cause) =>
              new TemplateDownloadError({
                cause,
                message: `No files found for template. Verify template '${config.projectTemplate}' exists in repository.`,
              })
          )
        );

        yield* fs.copy(tmpDir, config.projectPath);
      }).pipe(Effect.scoped);

    return {
      downloadTemplate,
    } as const;
  }),
}) {}
