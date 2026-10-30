import { describe, expect, it } from "vite-plus/test";
import {
  type PackageManagerName,
  packageManagerFromUserAgent,
} from "./package-manager";

describe("packageManagerFromUserAgent", () => {
  const supportedPackageManagers: ReadonlyArray<
    readonly [string, PackageManagerName]
  > = [
    ["npm/11.19.1 node/v24.11.0 linux x64", "npm"],
    ["pnpm/10.0.0 npm/? node/v22.18.0 linux x64", "pnpm"],
    ["yarn/4.0.0 npm/? node/v22.18.0 linux x64", "yarn"],
    ["bun/1.3.0 npm/? node/v24.3.0 linux x64", "bun"],
  ];

  it.each(supportedPackageManagers)(
    "detects %s as %s",
    (userAgent, expectedPackageManager) => {
      expect(packageManagerFromUserAgent(userAgent)).toBe(
        expectedPackageManager,
      );
    },
  );

  it("falls back to npm for missing or unrecognized package managers", () => {
    expect(packageManagerFromUserAgent("unknown/1.0.0")).toBe("npm");
    expect(packageManagerFromUserAgent("")).toBe("npm");
  });
});
