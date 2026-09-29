import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { validateProjectDestination } from "./validate-project-name";

describe("validateProjectDestination", () => {
  it("accepts a dot for the current directory", () => {
    expect(Effect.runSync(validateProjectDestination("."))).toBe(".");
  });

  it("continues to reject other dot-prefixed names", () => {
    expect(() => Effect.runSync(validateProjectDestination(".hidden"))).toThrow(
      "Project name must not start with a period",
    );
  });
});
