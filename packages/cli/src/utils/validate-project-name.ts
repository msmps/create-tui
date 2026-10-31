import { isBuiltin } from "node:module";
import { Effect, Path } from "effect";
import { CliError } from "effect/cli";

const SCOPED_PACKAGE_REGEX = /^(?:@([^/]+?)[/])?([^/]+?)$/;

const blockList = ["node_modules", "favicon.ico"];

const invalid = (message: string) =>
  Effect.fail(new CliError.ValidationError({ message }));

export function validateProjectName(
  name: string,
): Effect.Effect<string, CliError.ValidationError> {
  if (name.length === 0) {
    return invalid("Project name must be a non-empty string");
  }
  if (name.length > 214) {
    return invalid("Project name must not contain more than 214 characters");
  }
  if (name.toLowerCase() !== name) {
    return invalid("Project name must not contain capital letters");
  }
  if (name.trim() !== name) {
    return invalid(
      "Project name must not contain leading or trailing whitespace",
    );
  }
  if (name.match(/^\./)) {
    return invalid("Project name must not start with a period");
  }
  if (name.match(/^_/)) {
    return invalid("Project name must not start with an underscore");
  }
  if (/[~'!()*]/.test(name.split("/").at(-1) ?? "")) {
    return invalid(
      "Project name must not contain the special characters ~'!()*",
    );
  }
  if (isBuiltin(name)) {
    return invalid("Project name must not be a NodeJS built-in module name");
  }
  const isBlockedName = blockList.some((blockedName) => {
    return name.toLowerCase() === blockedName;
  });
  if (isBlockedName) {
    return invalid(`Project name '${name}' is blocked from use`);
  }
  if (encodeURIComponent(name) !== name) {
    // Only a scoped package name (@scope/name) may contain a slash.
    const result = name.match(SCOPED_PACKAGE_REGEX);
    const scope = result?.[1];
    const pkg = result?.[2];
    if (
      scope === undefined ||
      pkg === undefined ||
      encodeURIComponent(scope) !== scope ||
      encodeURIComponent(pkg) !== pkg
    ) {
      return invalid("Project name must only contain URL-friendly characters");
    }
    if (pkg.startsWith(".") || pkg.startsWith("_")) {
      return invalid(
        "Project name must not start with a period or underscore after the scope",
      );
    }
  }
  return Effect.succeed(name);
}

/**
 * Resolves the project folder and guarantees it is a new folder strictly
 * inside the current working directory, so later steps (including deleting an
 * existing folder) can never touch anything outside it.
 */
export const resolveProjectPath = Effect.fn("resolveProjectPath")(function* (
  name: string,
) {
  const path = yield* Path.Path;
  const cwd = path.resolve(".");
  const projectPath = path.resolve(cwd, name);
  const relative = path.relative(cwd, projectPath);

  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return yield* invalid(
      `Project folder must be inside the current directory (${cwd})`,
    );
  }

  return projectPath;
});
