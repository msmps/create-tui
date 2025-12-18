import { Data, Schema } from "effect";

export const builtinTemplates = ["core", "react", "solid"] as const;
export type BuiltinTemplate = (typeof builtinTemplates)[number];

// Discriminated union for template sources
export type TemplateSource = BuiltinTemplateSource | GitHubTemplateSource;

// Helper to check if a string is a built-in template
const isBuiltinTemplate = (value: string): value is BuiltinTemplate =>
  builtinTemplates.includes(value as BuiltinTemplate);

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
  branch?: string;
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

// Schema to parse and validate template string (sync parsing, no API calls)
export const TemplateSourceSchema = Schema.transform(
  Schema.String,
  Schema.Any as Schema.Schema<TemplateSource>,
  {
    decode: (value: string): TemplateSource => {
      if (isBuiltinTemplate(value)) {
        return new BuiltinTemplateSource({ name: value });
      }

      const parsed = parseGitHubUrl(value);
      if (parsed) {
        // Branch will be resolved later via API if not specified
        return new GitHubTemplateSource({
          owner: parsed.owner,
          repo: parsed.repo,
          branch: parsed.branch,
          filePath: parsed.filePath,
        });
      }

      throw new Error(
        `Invalid template: "${value}". Use a built-in template (${builtinTemplates.join(", ")}) or a GitHub URL (https://github.com/owner/repo)`,
      );
    },
    encode: (source) => source.displayName,
  },
);

export class BuiltinTemplateSource extends Data.TaggedClass("BuiltinTemplate")<{
  readonly name: BuiltinTemplate;
}> {
  readonly displayName = this.name;
}

export class GitHubTemplateSource extends Data.TaggedClass("GitHubTemplate")<{
  readonly owner: string;
  readonly repo: string;
  readonly branch: string | undefined;
  readonly filePath: string;
}> {
  readonly displayName = this.filePath
    ? `${this.owner}/${this.repo}/${this.filePath}`
    : `${this.owner}/${this.repo}`;

  readonly repoUrl = `https://github.com/${this.owner}/${this.repo}`;
}
