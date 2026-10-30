#!/usr/bin/env node

import {
  NodeHttpClient,
  NodeRuntime,
  NodeServices,
} from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { CliConfig, GlobalFlag } from "effect/cli";
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
  Layer.provideMerge(
    CliConfig.layer({
      builtIns: GlobalFlag.BuiltIns.filter(
        (builtIn) => builtIn !== GlobalFlag.Version,
      ),
    }),
  ),
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(NodeHttpClient.layerFetch),
  Layer.provideMerge(Logger.layer([createLogger()])),
);

cli.pipe(
  Effect.provide(MainLive),
  NodeRuntime.runMain({
    disableErrorReporting: true,
  }),
);
