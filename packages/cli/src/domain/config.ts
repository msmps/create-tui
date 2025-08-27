import type { Option } from "effect";
import type { Template } from "./template";

export interface Config {
  readonly projectName: Option.Option<string>;
  readonly projectTemplate: Option.Option<Template>;
}

export interface ProjectConfig {
  readonly projectName: string;
  readonly projectPath: string;
  readonly projectTemplate: Template;
}
