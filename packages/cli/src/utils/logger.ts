import { Cause, Effect, Formatter, Logger, Predicate } from "effect";
import type { CreateTuiError } from "../domain/errors";

const ANSI = {
  reset: "\u001b[0m",
  black: "\u001b[30m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  cyan: "\u001b[36m",
  white: "\u001b[37m",
  backgroundRedBright: "\u001b[101m",
} as const;

/** Terminal capabilities, read once at startup by the CLI entrypoint. */
export interface LoggerOptions {
  /** Whether ANSI colors may be written to stdout (info and debug logs). */
  readonly stdoutColor: boolean;
  /** Whether ANSI colors may be written to stderr (warnings and errors). */
  readonly stderrColor: boolean;
}

/** Where rendered log lines go; the console in production. */
export interface LogSink {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

const consoleSink: LogSink = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

const levelColor = (logLevel: string): string => {
  switch (logLevel) {
    case "Debug":
      return ANSI.blue;
    case "Info":
      return ANSI.green;
    case "Warn":
      return ANSI.yellow;
    case "Error":
      return ANSI.red;
    case "Fatal":
      return `${ANSI.backgroundRedBright}${ANSI.black}`;
    default:
      return ANSI.white;
  }
};

const renderMessage = (message: unknown): string =>
  Array.isArray(message)
    ? message.map(renderMessage).join(" ")
    : String(message);

const writesToStderr = (logLevel: string) =>
  logLevel === "Error" || logLevel === "Fatal" || logLevel === "Warn";

export function createLogger(
  options: LoggerOptions,
  sink: LogSink = consoleSink,
) {
  return Logger.make(({ cause, logLevel, message }) => {
    const toStderr = writesToStderr(logLevel);
    const useColor = toStderr ? options.stderrColor : options.stdoutColor;
    const colorize = (value: string, color: string) =>
      useColor ? `${color}${value}${ANSI.reset}` : value;

    const write = (line: string) => {
      const prefix = colorize("[create-tui]", levelColor(logLevel));
      const output = line.length > 0 ? `${prefix} ${line}` : prefix;
      if (toStderr) {
        sink.stderr(output);
      } else {
        sink.stdout(output);
      }
    };

    const renderedMessage = renderMessage(message);
    if (renderedMessage.length > 0) {
      write(renderedMessage);
    }

    for (const error of Cause.prettyErrors(cause)) {
      write(error.message);

      if ("hint" in error && typeof error.hint === "string") {
        write(colorize(`↳ ${error.hint}`, ANSI.cyan));
      }
    }
  });
}

const MAX_CAUSE_DEPTH = 5;

/**
 * Describes an error's `cause` chain, one line per cause, outermost first.
 * Used for `--verbose` output so the underlying failure is never hidden.
 */
export const describeCauseChain = (cause: unknown): ReadonlyArray<string> => {
  const lines: Array<string> = [];
  let current = cause;
  while (current !== undefined && lines.length < MAX_CAUSE_DEPTH) {
    const name =
      Predicate.hasProperty(current, "_tag") && Predicate.isString(current._tag)
        ? current._tag
        : Predicate.hasProperty(current, "name") &&
            Predicate.isString(current.name)
          ? current.name
          : "Cause";
    const message =
      Predicate.hasProperty(current, "message") &&
      Predicate.isString(current.message)
        ? current.message
        : Formatter.format(current);
    lines.push(`${name}: ${message}`);
    current = Predicate.hasProperty(current, "cause")
      ? current.cause
      : undefined;
  }
  return lines;
};

/**
 * Reports a create-tui failure: its message and hint, plus (with `verbose`)
 * the underlying cause chain.
 */
export const reportFailure = Effect.fn("reportFailure")(function* (
  level: "Error" | "Warn",
  error: CreateTuiError,
  verbose: boolean,
) {
  const log = level === "Error" ? Effect.logError : Effect.logWarning;
  yield* log(Cause.fail(error));
  if (verbose && "cause" in error) {
    for (const line of describeCauseChain(error.cause)) {
      yield* log(`  caused by ${line}`);
    }
  }
});
