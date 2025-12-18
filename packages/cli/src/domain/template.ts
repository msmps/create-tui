import { Data, Schema } from "effect";

export const builtinTemplates = ["core", "react", "solid"] as const;
export type BuiltinTemplate = (typeof builtinTemplates)[number];

// Discriminated union for template sources
export type TemplateSource = BuiltinTemplateSource | GitHubTemplateSource;

// Helper to check if a string is a built-in template
const isBuiltinTemplate = (value: string): value is BuiltinTemplate =>
  builtinTemplates.includes(value as BuiltinTemplate);

// Schema to parse and validate template string
export const TemplateSourceSchema = Schema.transform(
  Schema.String,
  Schema.Any as Schema.Schema<TemplateSource>,
  {
    decode: (value: string): TemplateSource => {
      if (isBuiltinTemplate(value)) {
        return new BuiltinTemplateSource({ name: value });
      }

      const parts = value.split("/");
      if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
        return new GitHubTemplateSource({ owner: parts[0], repo: parts[1] });
      }

      throw new Error(
        `Invalid template: "${value}". Use a built-in template (${builtinTemplates.join(", ")}) or GitHub format (user/repo)`,
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
}> {
  readonly displayName = `${this.owner}/${this.repo}`;
}
