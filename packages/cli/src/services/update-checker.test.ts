import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import { Effect, Layer, Logger } from "effect";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { version as currentVersion } from "../../package.json" with { type: "json" };
import { UpdateChecker } from "./update-checker";

function createMockHttpClient(latestVersion: string) {
  const mockClient: HttpClient.HttpClient = HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        HttpClientRequest.get(request.url),
        new Response(
          JSON.stringify({
            "dist-tags": {
              latest: latestVersion,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    ),
  );

  return Layer.succeed(HttpClient.HttpClient, mockClient);
}

function renderMessage(message: unknown): string {
  return Array.isArray(message)
    ? message.map(renderMessage).join(" ")
    : String(message);
}

describe("UpdateChecker", () => {
  let warnings: string[] = [];

  const customLogger = Logger.make(({ message }) => {
    warnings.push(renderMessage(message));
  });

  beforeEach(() => {
    warnings = [];
  });

  const runWithHttpClient = (
    httpClientLayer: Layer.Layer<HttpClient.HttpClient>,
  ): Promise<void> => {
    const testLayer = UpdateChecker.layer.pipe(Layer.provide(httpClientLayer));

    return Effect.gen(function* () {
      const updateChecker = yield* UpdateChecker;
      yield* updateChecker.check({ packageManager: "bun" });
    }).pipe(
      Effect.provide(Layer.mergeAll(testLayer, Logger.layer([customLogger]))),
      Effect.runPromise,
    );
  };

  describe("when a newer version is available", () => {
    it("should log an update notification", async () => {
      const newerVersion = "99.99.99";
      await runWithHttpClient(createMockHttpClient(newerVersion));

      const allWarnings = warnings.join(" ");
      expect(allWarnings).toContain("Update available!");
      expect(allWarnings).toContain(`${currentVersion} -> ${newerVersion}`);
      expect(allWarnings).toContain("bun add -g create-tui@latest");
    });
  });

  describe("when the current version is up to date", () => {
    it("should not log anything when versions are equal", async () => {
      await runWithHttpClient(createMockHttpClient(currentVersion));
      expect(warnings).toEqual([]);
    });

    it("should not log anything when current version is newer", async () => {
      await runWithHttpClient(createMockHttpClient("0.0.1"));
      expect(warnings).toEqual([]);
    });
  });
});
