import { Context, Effect } from "effect";
import type { ProjectConfig } from "./domain/config";

export class ProjectSettings extends Context.Tag(
  "create-tui/context/project-settings",
)<
  ProjectSettings,
  {
    readonly projectName: string;
    readonly projectPath: string;
    readonly projectTemplate: string;
    readonly disableGitHubRepositoryInitialization: boolean;
  }
>() {
  static readonly provide = (projectConfig: ProjectConfig) =>
    Effect.provideService(this, projectConfig);
}
