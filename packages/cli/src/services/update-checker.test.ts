import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { describe, expect, it } from "vite-plus/test";
import packageJson from "../../package.json" with { type: "json" };
import { captureOutput } from "../testing/capture-output";
import { UpdateChecker } from "./update-checker";

const currentVersion = packageJson.version;

const registryResponding = (response: Response | "unreachable") =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      response === "unreachable"
        ? Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                description: "getaddrinfo ENOTFOUND registry.npmjs.org",
              }),
            }),
          )
        : Effect.succeed(HttpClientResponse.fromWeb(request, response)),
    ),
  );

const latestVersionResponse = (latest: string) =>
  new Response(JSON.stringify({ "dist-tags": { latest } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const runCheck = async (registry: Layer.Layer<HttpClient.HttpClient>) => {
  const output = captureOutput();
  await Effect.gen(function* () {
    const updateChecker = yield* UpdateChecker;
    yield* updateChecker.check({ packageManager: "bun" });
  }).pipe(
    Effect.provide(UpdateChecker.layer.pipe(Layer.provide(registry))),
    Effect.provide(output.layer),
    Effect.runPromise,
  );
  return output;
};

describe("UpdateChecker", () => {
  it("warns when a newer version is available", async () => {
    const { stderr } = await runCheck(
      registryResponding(latestVersionResponse("99.99.99")),
    );

    expect(stderr).toStrictEqual([
      `[create-tui] Update available! ${currentVersion} -> 99.99.99`,
      "[create-tui] Run bun add -g create-tui@latest to update",
    ]);
  });

  it.each([currentVersion, "0.0.1"])(
    "stays silent when the latest version is %s",
    async (latest) => {
      const { stdout, stderr } = await runCheck(
        registryResponding(latestVersionResponse(latest)),
      );

      expect(stderr).toStrictEqual([]);
      expect(stdout).toStrictEqual([]);
    },
  );

  it("logs a registry error at debug level instead of discarding it", async () => {
    const { stdout, stderr } = await runCheck(
      registryResponding(new Response("Service Unavailable", { status: 503 })),
    );

    expect(stderr).toStrictEqual([]);
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(/^\[create-tui\] Update check failed: .*503/);
  });

  it("logs when the registry cannot be reached", async () => {
    const { stdout } = await runCheck(registryResponding("unreachable"));

    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(
      /^\[create-tui\] Update check failed: .*ENOTFOUND registry\.npmjs\.org/,
    );
  });

  it("rejects a malformed version instead of crashing on it", async () => {
    const { stdout, stderr } = await runCheck(
      registryResponding(latestVersionResponse("not-a-version")),
    );

    expect(stderr).toStrictEqual([]);
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(
      /^\[create-tui\] Update check failed: .*a semver version/,
    );
  });
});
