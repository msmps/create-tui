import { Layer, Logger, References } from "effect";
import { createLogger } from "../utils/logger";

/**
 * The production logger, writing uncolored lines to arrays instead of the
 * console, so tests assert exactly what a user would see.
 */
export const captureOutput = () => {
  const stdout: Array<string> = [];
  const stderr: Array<string> = [];

  const logger = createLogger(
    { stdoutColor: false, stderrColor: false },
    {
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    },
  );

  return {
    layer: Layer.mergeAll(
      Logger.layer([logger]),
      Layer.succeed(References.MinimumLogLevel, "Debug"),
    ),
    stdout,
    stderr,
  };
};
