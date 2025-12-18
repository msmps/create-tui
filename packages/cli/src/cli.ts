import { Args, Command, Options, Prompt } from "@effect/cli";
import { Path } from "@effect/platform";
import { Effect, Option } from "effect";
import { version } from "../package.json" with { type: "json" };
import { ProjectSettings } from "./context";
import type { Config } from "./domain/config";
import {
  BuiltinTemplateSource,
  builtinTemplates,
  TemplateSourceSchema,
} from "./domain/template";
import { createProject } from "./handler";
import {
  validateProjectName,
  validateProjectNameWithHelpDoc,
} from "./utils/validate-project-name";

const projectName = Args.directory({
  name: "project-name",
  exists: "no",
}).pipe(
  Args.withDescription("The folder to bootstrap the project in"),
  Args.mapEffect(validateProjectNameWithHelpDoc),
  Args.optional,
);

const disableGitRepositoryInitialization = Options.boolean("disable-git").pipe(
  Options.withDescription("Skip initializing a git repository"),
);

const verbose = Options.boolean("verbose").pipe(
  Options.withAlias("v"),
  Options.withDescription("Show detailed progress during template operations"),
);

const projectTemplate = Options.text("template").pipe(
  Options.withAlias("t"),
  Options.withDescription(
    `Template: built-in (${builtinTemplates.join(", ")}) or GitHub (user/repo)`,
  ),
  Options.withSchema(TemplateSourceSchema),
  Options.optional,
);

function handleCommand({
  projectName,
  projectTemplate,
  disableGitRepositoryInitialization,
  verbose,
}: Config) {
  return Effect.gen(function* () {
    const resolvedProjectName = yield* Option.getOrElse(
      Option.map(projectName, Effect.succeed),
      () =>
        Prompt.text({
          message: "What is your project named?",
          default: "my-opentui-project",
        }).pipe(Effect.flatMap(validateProjectName)),
    );

    const resolvedProjectTemplate = yield* Option.getOrElse(
      Option.map(projectTemplate, Effect.succeed),
      () =>
        Prompt.select({
          message: "Which template do you want to use?",
          choices: [
            { title: "Core", value: "core" as const },
            { title: "React", value: "react" as const },
            { title: "Solid", value: "solid" as const },
          ],
        }).pipe(Effect.map((name) => new BuiltinTemplateSource({ name }))),
    );

    const initializedGitRepository =
      disableGitRepositoryInitialization === false
        ? yield* Prompt.confirm({
            message: "Do you want to initialize a git repository?",
            initial: true,
          })
        : false;

    const projectPath = yield* Path.Path.pipe(
      Effect.map((path) => path.resolve(resolvedProjectName)),
    );

    return yield* createProject().pipe(
      ProjectSettings.provide({
        projectName: resolvedProjectName,
        projectPath,
        projectTemplate: resolvedProjectTemplate,
        initializedGitRepository,
        verbose,
      }),
    );
  });
}

const command = Command.make("create-tui", {
  projectName,
  projectTemplate,
  disableGitRepositoryInitialization,
  verbose,
}).pipe(
  Command.withDescription("Create a new OpenTUI project from a template"),
  Command.withHandler(handleCommand),
);

export const cli = Command.run(command, {
  name: "create-tui",
  version,
});
