import { Context, Effect } from "effect";
import type { ProjectConfig } from "./domain/config";

export class ProjectSettings extends Context.Tag(
  "create-tui/context/project-settings",
)<ProjectSettings, ProjectConfig>() {
  static readonly provide = (config: ProjectConfig) =>
    Effect.provideService(this, config);
}
