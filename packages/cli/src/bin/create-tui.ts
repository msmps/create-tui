#!/usr/bin/env node

import { CliConfig } from "@effect/cli";
import {
  NodeContext,
  NodeHttpClient,
  NodeRuntime,
} from "@effect/platform-node";
import { Cause, Console, Effect, Layer, Logger, pipe } from "effect";
import { cli } from "../cli";
import { GitHub } from "../services/github";
import { PackageManager } from "../services/package-manager";
import { Project } from "../services/project";
import { createLogger } from "../utils/logger";

const MainLive = Layer.mergeAll(
  GitHub.layer,
  Project.layer,
  PackageManager.layer,
).pipe(
  Layer.provide(Logger.replace(Logger.defaultLogger, createLogger())),
  Layer.provide(CliConfig.layer({ showBuiltIns: false })),
  Layer.provideMerge(NodeContext.layer),
  Layer.provide(NodeHttpClient.layer),
);

cli(process.argv).pipe(
  Effect.catchTags({
    TemplateDownloadError: (cause) =>
      Effect.logError(`Failed to download template: ${cause.message}`),
    CreateProjectError: (cause) =>
      Effect.logError(`Failed to create project: ${cause.message}`),
    QuitException: () =>
      pipe(
        Console.log(),
        Effect.andThen(() => Effect.logWarning("Quitting...")),
      ),
    InvalidValue: Effect.succeed, // Weird conflict with the HelpDoc impl
    InvalidArgument: Effect.succeed, // Weird conflict with the HelpDoc impl
  }),
  Effect.tapErrorCause((cause) => {
    if (Cause.isInterruptedOnly(cause)) {
      return Effect.void;
    }
    return Effect.logError(cause);
  }),
  Effect.provide(MainLive),
  NodeRuntime.runMain({
    disablePrettyLogger: true,
    disableErrorReporting: true,
  }),
);
