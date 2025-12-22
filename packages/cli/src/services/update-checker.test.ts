import { beforeEach, describe, expect, it } from "bun:test";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import * as AnsiDoc from "@effect/printer-ansi/AnsiDoc";
import { Effect, Layer, Logger, LogLevel } from "effect";
import { version as currentVersion } from "../../package.json" with {
  type: "json",
};
import { UpdateChecker } from "./update-checker";

/**
 * Creates a mock HttpClient layer that returns the specified latest version
 */
function createMockHttpClient(latestVersion: string) {
  const mockClient: HttpClient.HttpClient = HttpClient.make((request) => {
    return Effect.succeed(
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
    );
  });

  return Layer.succeed(HttpClient.HttpClient, mockClient);
}

/**
 * Renders an AnsiDoc message to a plain string for testing.
 * The message from Logger can be a single value or an array.
 */
function renderMessage(message: unknown): string {
  // Handle array of messages
  if (Array.isArray(message)) {
    return message.map(renderMessage).join(" ");
  }
  // Handle AnsiDoc
  if (AnsiDoc.isDoc(message)) {
    return AnsiDoc.render(message as AnsiDoc.AnsiDoc, { style: "pretty" });
  }
  return String(message);
}

describe("UpdateChecker", () => {
  let warnings: string[] = [];

  const customLogger = Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ message }) => {
      warnings.push(renderMessage(message));
    }),
  );

  beforeEach(async () => {
    warnings = [];
  });

  /**
   * Helper to run the update checker with a given HTTP client layer
   */
  const runWithHttpClient = (
    httpClientLayer: Layer.Layer<HttpClient.HttpClient>,
  ): Promise<void> => {
    const testLayer = UpdateChecker.layer.pipe(Layer.provide(httpClientLayer));

    return Effect.gen(function* () {
      const updateChecker = yield* UpdateChecker;
      yield* updateChecker.check({ packageManager: "bun" });
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Warning),
      Effect.provide(Layer.merge(testLayer, customLogger)),
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
