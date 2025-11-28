import type { Option } from "effect";
import type { Template } from "./template";

export interface Config {
  readonly projectName: Option.Option<string>;
  readonly projectTemplate: Option.Option<Template>;
  readonly disableGitRepositoryInitialization: boolean;
}

export interface ProjectConfig {
  readonly projectName: string;
  readonly projectPath: string;
  readonly projectTemplate: Template;
  readonly initializedGitRepository: boolean;
}
