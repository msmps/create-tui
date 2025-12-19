import { Context, Effect } from "effect";
import type { ProjectConfig } from "./domain/config";
import type { TemplateSource } from "./domain/template";

export class ProjectSettings extends Context.Tag(
  "create-tui/context/project-settings",
)<
  ProjectSettings,
  {
    readonly projectName: string;
    readonly projectPath: string;
    readonly projectTemplate: TemplateSource;
    readonly initializeGitRepository: boolean;
    readonly installDependencies: boolean;
    readonly verbose: boolean;
  }
>() {
  static readonly provide = (projectConfig: ProjectConfig) =>
    Effect.provideService(this, projectConfig);
}
