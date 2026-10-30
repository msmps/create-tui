import { Cause, Logger } from "effect";

function renderMessage(message: unknown): string {
  return Array.isArray(message)
    ? message.map(renderMessage).join(" ")
    : String(message);
}

export function createLogger() {
  return Logger.make(({ cause, logLevel, message }) => {
    const output = renderMessage(message);

    if (logLevel === "Error" || logLevel === "Fatal") {
      console.error(output);
    } else if (logLevel === "Warn") {
      console.warn(output);
    } else {
      console.log(output);
    }

    if (cause.reasons.length > 0) {
      console.error(Cause.pretty(cause));
    }
  });
}
