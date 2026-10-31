import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseTemplateSource } from "./template";

const parse = (value: string) => Effect.runPromise(parseTemplateSource(value));

describe("parseTemplateSource", () => {
  it("resolves built-in aliases", async () => {
    const template = await parse("react");

    expect(template.alias).toBe("react");
    expect(template.owner).toBe("msmps");
    expect(template.repo).toBe("create-tui");
    expect(template.branch).toBe("main");
    expect(template.filePath).toBe("packages/templates/react");
  });

  it("parses repository shorthand", async () => {
    const template = await parse("owner/repository");

    expect(template.owner).toBe("owner");
    expect(template.repo).toBe("repository");
    expect(template.branch).toBeUndefined();
    expect(template.filePath).toBe("");
  });

  it("parses nested shorthand paths", async () => {
    const template = await parse("owner/repository/templates/core");

    expect(template.filePath).toBe("templates/core");
  });

  it("parses full GitHub URLs with branches and paths", async () => {
    const template = await parse(
      "https://github.com/owner/repository/tree/next/templates/core",
    );

    expect(template.owner).toBe("owner");
    expect(template.repo).toBe("repository");
    expect(template.branch).toBe("next");
    expect(template.filePath).toBe("templates/core");
  });

  it("rejects invalid template sources", async () => {
    await expect(parse("not-a-template")).rejects.toMatchObject({
      _tag: "InvalidTemplateSourceError",
      input: "not-a-template",
      message:
        'Invalid template: "not-a-template". Use an alias (core, react, solid), shorthand (owner/repo), or GitHub URL (https://github.com/owner/repo)',
    });
  });

  it.each(["toString", "constructor", "__proto__"])(
    "does not treat the object property %s as an alias",
    async (value) => {
      await expect(parse(value)).rejects.toMatchObject({
        _tag: "InvalidTemplateSourceError",
      });
    },
  );
});
