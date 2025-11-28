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
    QuitException: Effect.die,
    InvalidArgument: Effect.die, // These are handled by the CLI/HelpDoc library
    InvalidValue: Effect.die, // These are handled by the CLI/HelpDoc library
  }),
  Effect.catchAll(Effect.logError),
  Effect.provide(MainLive),
  NodeRuntime.runMain({
    disablePrettyLogger: true,
    disableErrorReporting: true,
  }),
);
