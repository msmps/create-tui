import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, Layer, Option } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { describe, expect, it } from "vite-plus/test";
import { parseTemplateSource } from "../domain/template";
import { ProjectSettings } from "../project-settings";
import { TemplateDownloader } from "./template-downloader";

type Route = (request: {
  readonly method: string;
  readonly url: string;
}) => Response | "unreachable";

/** An HttpClient that answers GitHub requests from `route` instead of the network. */
const fakeGitHub = (route: Route) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      const answer = route(request);
      return answer === "unreachable"
        ? Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                description: "getaddrinfo ENOTFOUND api.github.com",
              }),
            }),
          )
        : Effect.succeed(HttpClientResponse.fromWeb(request, answer));
    }),
  );

const json = (
  status: number,
  body: unknown,
  headers?: Readonly<Record<string, string>>,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const ok = () => new Response(null, { status: 200 });

const download = (template: string, route: Route) =>
  Effect.gen(function* () {
    const projectTemplate = yield* parseTemplateSource(template);
    const downloader = yield* TemplateDownloader;
    return yield* downloader.download().pipe(
      ProjectSettings.provide({
        projectName: "my-app",
        projectPath: "/nonexistent/my-app",
        projectTemplate,
        skipGit: true,
        skipInstall: true,
        verbose: false,
      }),
    );
  }).pipe(
    Effect.provide(
      TemplateDownloader.layer.pipe(
        Layer.provide([fakeGitHub(route), NodeServices.layer]),
      ),
    ),
    Effect.runPromiseExit,
  );

const failure = async (template: string, route: Route) => {
  const exit = await download(template, route);
  const error = Option.getOrUndefined(Exit.findErrorOption(exit));
  if (error === undefined || typeof error === "string") {
    throw new Error(`Expected a download error, got ${String(exit)}`);
  }
  return error;
};

describe("TemplateDownloader failures", () => {
  it("reports a missing repository", async () => {
    const error = await failure("owner/missing", () =>
      json(404, { message: "Not Found" }),
    );

    expect(error._tag).toBe("TemplateValidationError");
    expect(error.message).toBe("Repository not found: owner/missing");
    expect(error.hint).toBe(
      "Check the owner and repository name. Only public repositories are supported.",
    );
  });

  it("reports the GitHub rate limit and when it resets, instead of 'not found'", async () => {
    const error = await failure("owner/repo", () =>
      json(
        403,
        { message: "API rate limit exceeded" },
        { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1793567100" },
      ),
    );

    expect(error.message).toBe(
      "GitHub API rate limit reached while checking owner/repo",
    );
    expect(error.hint).toBe(
      "The limit resets at 21:05 UTC. Try again after that.",
    );
  });

  it("reports access denied for a 403 that is not a rate limit", async () => {
    const error = await failure("owner/private", () =>
      json(403, { message: "Forbidden" }, { "x-ratelimit-remaining": "42" }),
    );

    expect(error.message).toBe(
      "GitHub refused access to owner/private (HTTP 403)",
    );
    expect(error.hint).toBe("Only public repositories are supported.");
  });

  it("reports GitHub server errors as retryable", async () => {
    const error = await failure("owner/repo", () =>
      json(502, { message: "Bad Gateway" }),
    );

    expect(error.message).toBe(
      "GitHub returned a server error (HTTP 502) while checking owner/repo",
    );
    expect(error.hint).toBe(
      "GitHub may be having problems. Try again in a few minutes.",
    );
  });

  it("reports network failures as a connection problem", async () => {
    const error = await failure("owner/repo", () => "unreachable");

    expect(error.message).toBe(
      "Could not connect to GitHub while checking owner/repo",
    );
    expect(error.hint).toBe(
      "Check your internet connection, proxy, or firewall settings.",
    );
  });

  it("keeps the 'default branch' error instead of replacing it with 'not found'", async () => {
    const error = await failure("owner/repo", () => json(200, { id: 1 }));

    expect(error.message).toBe(
      "Could not determine the default branch of owner/repo",
    );
    expect(error.hint).toBe(
      "Include the branch in the URL: https://github.com/owner/repo/tree/<branch>",
    );
  });

  it("reports a missing branch", async () => {
    const error = await failure(
      "https://github.com/owner/repo/tree/next",
      ({ url }) =>
        url.startsWith("https://codeload.github.com/") ? json(404, {}) : ok(),
    );

    expect(error.message).toBe('Branch "next" not found in owner/repo');
  });

  it("reports a template path without a package.json", async () => {
    const error = await failure(
      "https://github.com/owner/repo/tree/main/templates/core",
      ({ url }) => (url.includes("/contents/") ? json(404, {}) : ok()),
    );

    expect(error.message).toBe(
      'No package.json found at "templates/core" in owner/repo (branch main)',
    );
  });

  it("keeps the underlying HTTP error as the cause for --verbose output", async () => {
    const error = await failure("owner/repo", () => json(502, {}));

    expect(error.cause).toBeInstanceOf(HttpClientError.HttpClientError);
  });
});
