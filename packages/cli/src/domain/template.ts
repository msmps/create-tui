import { Data, Effect } from "effect";

/**
 * Template aliases map friendly names to their GitHub URLs.
 * Adding a new built-in template is as simple as adding a new entry here.
 */
export const TEMPLATE_ALIASES = {
  core: "https://github.com/msmps/create-tui/tree/main/packages/templates/core",
  react:
    "https://github.com/msmps/create-tui/tree/main/packages/templates/react",
  solid:
    "https://github.com/msmps/create-tui/tree/main/packages/templates/solid",
} as const;

export type TemplateAlias = keyof typeof TEMPLATE_ALIASES;
export const templateAliases = Object.keys(TEMPLATE_ALIASES) as TemplateAlias[];

/**
 * Parses a GitHub URL and extracts repo information.
 * Supports formats like:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/tree/branch/path/to/template
 */
const parseGitHubUrl = (
  value: string,
): {
  owner: string;
  repo: string;
  branch: string | undefined;
  filePath: string;
} | null => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.origin !== "https://github.com") {
    return null;
  }

  const [, owner, repo, type, branch, ...fileParts] = url.pathname.split("/");

  if (!owner || !repo) {
    return null;
  }

  // Handle URLs like https://github.com/owner/repo or https://github.com/owner/repo/
  if (type === undefined || (type === "" && branch === undefined)) {
    return { owner, repo, branch: undefined, filePath: "" };
  }

  // Handle URLs like https://github.com/owner/repo/tree/branch/path
  if (type === "tree" && branch) {
    const filePath = fileParts.join("/");
    return { owner, repo, branch, filePath };
  }

  return null;
};

/**
 * Parses shorthand syntax for GitHub repositories.
 * Supports formats like:
 * - owner/repo
 * - owner/repo/path/to/template
 */
const parseShorthand = (
  value: string,
): {
  owner: string;
  repo: string;
  branch: string | undefined;
  filePath: string;
} | null => {
  // Must contain at least one slash and not start with a protocol
  if (!value.includes("/") || value.includes("://")) {
    return null;
  }

  const parts = value.split("/");
  if (parts.length < 2) {
    return null;
  }

  const [owner, repo, ...pathParts] = parts;

  // Validate owner and repo look reasonable (not empty, no special chars that would break URLs)
  if (!owner || !repo || owner.includes(".") || repo.includes(".")) {
    return null;
  }

  return {
    owner,
    repo,
    branch: undefined,
    filePath: pathParts.join("/"),
  };
};

/**
 * Unified template source - all templates are GitHub templates.
 * "Built-in" templates are simply aliases that resolve to GitHub URLs.
 */
export class GitHubTemplateSource extends Data.TaggedClass("GitHubTemplate")<{
  readonly owner: string;
  readonly repo: string;
  readonly branch: string | undefined;
  readonly filePath: string;
  /** If this template came from an alias, store it for friendly display */
  readonly alias?: TemplateAlias;
}> {
  /** User-friendly name for display */
  readonly displayName: string = this.alias
    ? this.alias
    : this.filePath
      ? `${this.owner}/${this.repo}/${this.filePath}`
      : `${this.owner}/${this.repo}`;

  readonly repoUrl = `https://github.com/${this.owner}/${this.repo}`;
}

/**
 * Parses and validates a template string.
 *
 * Accepts aliases, GitHub shorthand, and full GitHub URLs.
 */
export const parseTemplateSource = (
  value: string,
): Effect.Effect<GitHubTemplateSource, string> => {
  if (value in TEMPLATE_ALIASES) {
    const aliasUrl = TEMPLATE_ALIASES[value as TemplateAlias];
    const parsed = parseGitHubUrl(aliasUrl);
    if (parsed) {
      return Effect.succeed(
        new GitHubTemplateSource({
          owner: parsed.owner,
          repo: parsed.repo,
          branch: parsed.branch,
          filePath: parsed.filePath,
          alias: value as TemplateAlias,
        }),
      );
    }
  }

  const urlParsed = parseGitHubUrl(value);
  if (urlParsed) {
    return Effect.succeed(
      new GitHubTemplateSource({
        owner: urlParsed.owner,
        repo: urlParsed.repo,
        branch: urlParsed.branch,
        filePath: urlParsed.filePath,
      }),
    );
  }

  const shorthandParsed = parseShorthand(value);
  if (shorthandParsed) {
    return Effect.succeed(
      new GitHubTemplateSource({
        owner: shorthandParsed.owner,
        repo: shorthandParsed.repo,
        branch: shorthandParsed.branch,
        filePath: shorthandParsed.filePath,
      }),
    );
  }

  return Effect.fail(
    `Invalid template: "${value}". Use an alias (${templateAliases.join(", ")}), shorthand (owner/repo), or GitHub URL (https://github.com/owner/repo)`,
  );
};
