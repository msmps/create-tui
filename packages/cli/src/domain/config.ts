import type { TemplateSource } from "./template";

export interface ProjectConfig {
  readonly projectName: string;
  readonly projectPath: string;
  readonly projectTemplate: TemplateSource;
  readonly skipGit: boolean;
  readonly skipInstall: boolean;
  readonly verbose: boolean;
}
