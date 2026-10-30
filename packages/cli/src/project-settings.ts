import { Context, Effect } from "effect";
import type { ProjectConfig } from "./domain/config";

export class ProjectSettings extends Context.Service<
  ProjectSettings,
  ProjectConfig
>()("create-tui/context/project-settings") {
  static readonly provide = (config: ProjectConfig) =>
    Effect.provideService(this, config);
}
