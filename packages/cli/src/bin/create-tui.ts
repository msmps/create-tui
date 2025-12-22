#!/usr/bin/env node

import { CliConfig } from "@effect/cli";
import {
  NodeContext,
  NodeHttpClient,
  NodeRuntime,
} from "@effect/platform-node";
import { Cause, Console, Effect, Layer, Logger, pipe } from "effect";
import { cli } from "../cli";
import { PackageManager } from "../services/package-manager";
import { Project } from "../services/project";
import { TemplateDownloader } from "../services/template-downloader";
import { UpdateChecker } from "../services/update-checker";
import { createLogger } from "../utils/logger";

const MainLive = Layer.mergeAll(
  TemplateDownloader.layer,
  Project.layer,
  PackageManager.layer,
  UpdateChecker.layer,
).pipe(
  Layer.provide(Logger.replace(Logger.defaultLogger, createLogger())),
  Layer.provideMerge(
    CliConfig.layer({
      showBuiltIns: false,
      showTypes: false,
    }),
  ),
  Layer.provideMerge(NodeContext.layer),
  Layer.provideMerge(NodeHttpClient.layer),
);

cli(process.argv).pipe(
  Effect.catchTags({
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
