import {
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
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(
        HttpClientRequest.prependUrl("https://codeload.github.com")
      ),
      HttpClient.filterStatusOk
    );

    const fetchTemplate = () =>
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

    const downloadTemplate = Effect.fn("Github.downloadTemplate")(function* (
      config: ProjectConfig
    ) {
      const sink = NodeSink.fromWritable(
        () =>
          Tar.extract({
            cwd: config.projectPath,
            strip: 3 + config.projectTemplate.split("/").length,
            filter: (path) =>
              path.includes(
                `create-tui-main/packages/templates/${config.projectTemplate}`
              ),
          }),
        (cause) =>
          new TemplateDownloadError({
            cause,
            message: "Failed to extract template",
          })
      );

      yield* Stream.run(fetchTemplate(), sink);
    });

    return {
      downloadTemplate,
    } as const;
  }),
}) {}
