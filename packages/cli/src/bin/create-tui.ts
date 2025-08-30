#!/usr/bin/env node

import { CliConfig } from "@effect/cli";
import {
  NodeContext,
  NodeHttpClient,
  NodeRuntime,
} from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { cli } from "../cli";
import { GitHub } from "../services/github";
import { createLogger } from "../utils/logger";

const Live = GitHub.Default.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      Logger.replace(Logger.defaultLogger, createLogger()),
      CliConfig.layer({ showBuiltIns: false }),
      NodeContext.layer,
      NodeHttpClient.layer,
    ),
  ),
);

cli(process.argv).pipe(
  Effect.catchTags({
    QuitException: Effect.die,
    InvalidArgument: Effect.die, // These are handled by the CLI/HelpDoc library
    InvalidValue: Effect.die, // These are handled by the CLI/HelpDoc library
  }),
  Effect.tapError(Effect.logError),
  Effect.orDie,
  Effect.provide(Live),
  NodeRuntime.runMain({
    disablePrettyLogger: true,
    disableErrorReporting: true,
  }),
);
