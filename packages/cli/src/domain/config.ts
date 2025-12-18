import type { Option } from "effect";
import type { TemplateSource } from "./template";

export interface Config {
  readonly projectName: Option.Option<string>;
  readonly projectTemplate: Option.Option<TemplateSource>;
  readonly disableGitRepositoryInitialization: boolean;
  readonly verbose: boolean;
}

export interface ProjectConfig {
  readonly projectName: string;
  readonly projectPath: string;
  readonly projectTemplate: TemplateSource;
  readonly initializedGitRepository: boolean;
  readonly verbose: boolean;
}
