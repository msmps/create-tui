import type { GitHubTemplateSource } from "./template";

export interface ProjectConfig {
  readonly projectName: string;
  readonly projectPath: string;
  readonly projectTemplate: GitHubTemplateSource;
  readonly skipGit: boolean;
  readonly skipInstall: boolean;
  readonly verbose: boolean;
}
