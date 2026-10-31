import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  resolveProjectPath,
  validateProjectName,
} from "./validate-project-name";

const failureMessage = <A>(
  exit: Exit.Exit<A, { readonly message: string }>,
): string | undefined =>
  Option.getOrUndefined(Exit.findErrorOption(exit))?.message;

describe("validateProjectName", () => {
  const validate = (name: string) =>
    Effect.runSyncExit(validateProjectName(name));

  it.each(["my-app", "app2", "@scope/my-app"])("accepts %s", (name) => {
    expect(validate(name)).toStrictEqual(Exit.succeed(name));
  });

  it.each([
    ["/", "Project name must only contain URL-friendly characters"],
    ["/home/user", "Project name must only contain URL-friendly characters"],
    ["foo/../..", "Project name must only contain URL-friendly characters"],
    ["a/b/c", "Project name must only contain URL-friendly characters"],
    ["a\\b", "Project name must only contain URL-friendly characters"],
    ["..", "Project name must not start with a period"],
    [
      "@scope/..",
      "Project name must not start with a period or underscore after the scope",
    ],
    ["My-App", "Project name must not contain capital letters"],
    ["fs", "Project name must not be a NodeJS built-in module name"],
  ])("rejects %s", (name, message) => {
    expect(failureMessage(validate(name))).toBe(message);
  });
});

describe("resolveProjectPath", () => {
  const resolve = (name: string) =>
    Effect.runPromiseExit(
      resolveProjectPath(name).pipe(Effect.provide(NodeServices.layer)),
    );

  it("resolves a folder inside the current directory", async () => {
    expect(await resolve("my-app")).toStrictEqual(
      Exit.succeed(`${process.cwd()}/my-app`),
    );
  });

  it.each(["/", ".", "..", "../sibling", "nested/../.."])(
    "refuses %s because it is not a new folder inside the current directory",
    async (name) => {
      expect(failureMessage(await resolve(name))).toBe(
        `Project folder must be inside the current directory (${process.cwd()})`,
      );
    },
  );
});
