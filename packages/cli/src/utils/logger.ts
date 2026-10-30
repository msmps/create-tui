import { Cause, Logger } from "effect";

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

const useColor = process.stderr.isTTY && process.env.NO_COLOR === undefined;

const colorize = (value: string, color: string) =>
  useColor ? `${color}${value}${ANSI.reset}` : value;

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

const write = (logLevel: string, message: string) => {
  const prefix = colorize("[create-tui]", levelColor(logLevel));
  const output = message.length > 0 ? `${prefix} ${message}` : prefix;

  if (logLevel === "Error" || logLevel === "Fatal") {
    console.error(output);
  } else if (logLevel === "Warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
};

export function createLogger() {
  return Logger.make(({ cause, logLevel, message }) => {
    const renderedMessage = renderMessage(message);
    if (renderedMessage.length > 0) {
      write(logLevel, renderedMessage);
    }

    for (const error of Cause.prettyErrors(cause)) {
      write(logLevel, error.message);

      if ("hint" in error && typeof error.hint === "string") {
        write(logLevel, colorize(`↳ ${error.hint}`, ANSI.cyan));
      }
    }
  });
}
