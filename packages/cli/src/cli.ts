import { Console, Effect, Option } from "effect";
import { Argument, CliError, Command, Flag, Prompt } from "effect/cli";
import packageJson from "../package.json" with { type: "json" };
import {
  type GitHubTemplateSource,
  parseTemplateSource,
  templateAliases,
} from "./domain/template";
import { isCreateTuiError } from "./domain/errors";
import { createProject } from "./handler";
import { ProjectSettings } from "./project-settings";
import { reportFailure } from "./utils/logger";
import {
  resolveProjectPath,
  validateProjectName,
} from "./utils/validate-project-name";

const packageVersion = packageJson.version;

const projectName = Argument.String("project-name").pipe(
  Argument.withDescription("The folder to bootstrap the project in"),
  Argument.mapEffect(validateProjectName),
  Argument.optional,
);

const noGit = Flag.Boolean("no-git").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip initializing a git repository"),
);

const noInstall = Flag.Boolean("no-install").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip installing dependencies"),
);

const showVersion = Flag.Boolean("version").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Show version information"),
);

const verbose = Flag.Boolean("verbose").pipe(
  Flag.withDefault(false),
  Flag.withAlias("v"),
  Flag.withDescription("Show detailed progress during template operations"),
);

const projectTemplate = Flag.String("template").pipe(
  Flag.withAlias("t"),
  Flag.withDescription(
    `Template: alias (${templateAliases.join(", ")}), shorthand (owner/repo), or GitHub URL`,
  ),
  Flag.mapEffect((value) =>
    parseTemplateSource(value).pipe(
      Effect.mapError((message) => new CliError.ValidationError({ message })),
    ),
  ),
  Flag.optional,
);

function handleCommand(args: {
  readonly projectName: Option.Option<string>;
  readonly projectTemplate: Option.Option<GitHubTemplateSource>;
  readonly noGit: boolean;
  readonly noInstall: boolean;
  readonly showVersion: boolean;
  readonly verbose: boolean;
}) {
  return Effect.gen(function* () {
    if (args.showVersion) {
      yield* Console.log(packageVersion);
      return;
    }
    const resolvedProjectName = Option.isSome(args.projectName)
      ? args.projectName.value
      : yield* Prompt.String({
          message: "What is your project named?",
          default: "my-opentui-project",
          validate: (name) =>
            validateProjectName(name).pipe(
              Effect.mapError((error) => error.message),
            ),
        });

    const resolvedProjectTemplate = Option.isSome(args.projectTemplate)
      ? args.projectTemplate.value
      : yield* Prompt.Select({
          message: "Which template do you want to use?",
          choices: [
            { title: "Core", value: "core" },
            { title: "React", value: "react" },
            { title: "Solid", value: "solid" },
            {
              title: "Custom (GitHub URL or shorthand)",
              value: "__custom__",
            },
          ],
        }).pipe(
          Effect.flatMap((value) =>
            value === "__custom__"
              ? Prompt.String({
                  message:
                    "Enter template (owner/repo, owner/repo/path, or full GitHub URL):",
                })
              : Effect.succeed(value),
          ),
          Effect.flatMap(parseTemplateSource),
          Effect.mapError((error) =>
            typeof error === "string"
              ? new CliError.ValidationError({ message: error })
              : error,
          ),
        );

    const projectPath = yield* resolveProjectPath(resolvedProjectName);

    return yield* createProject().pipe(
      Effect.tapError((error) =>
        isCreateTuiError(error)
          ? reportFailure("Error", error, args.verbose)
          : Effect.void,
      ),
      ProjectSettings.provide({
        projectName: resolvedProjectName,
        projectPath,
        projectTemplate: resolvedProjectTemplate,
        skipGit: args.noGit,
        skipInstall: args.noInstall,
        verbose: args.verbose,
      }),
    );
  });
}

const command = Command.make(
  "create-tui",
  {
    projectName,
    projectTemplate,
    noGit,
    noInstall,
    showVersion,
    verbose,
  },
  handleCommand,
).pipe(Command.withDescription("Create a new OpenTUI project from a template"));

export const cli = Command.run(command, { version: packageVersion });
