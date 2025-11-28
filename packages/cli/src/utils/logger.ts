import * as Ansi from "@effect/printer-ansi/Ansi";
import * as AnsiDoc from "@effect/printer-ansi/AnsiDoc";
import { Cause, Inspectable } from "effect";
import * as Arr from "effect/Array";
import * as Logger from "effect/Logger";
import type * as LogLevel from "effect/LogLevel";

const logLevelColors: Record<LogLevel.LogLevel["_tag"], Ansi.Ansi> = {
  None: Ansi.white,
  All: Ansi.white,
  Trace: Ansi.white,
  Debug: Ansi.blue,
  Info: Ansi.green,
  Warning: Ansi.yellow,
  Error: Ansi.red,
  Fatal: Ansi.combine(Ansi.bgRedBright, Ansi.black),
};

export function createLogger() {
  return Logger.make(({ logLevel, message, cause }) => {
    const messages = Arr.ensure(message);

    let firstLine = AnsiDoc.text("create-tui").pipe(
      AnsiDoc.annotate(logLevelColors[logLevel._tag]),
      AnsiDoc.squareBracketed,
    );

    let messageIndex = 0;
    if (messages.length > 0) {
      const firstMaybe = messages[0];

      if (AnsiDoc.isDoc(firstMaybe)) {
        firstLine = AnsiDoc.catWithSpace(
          firstLine,
          firstMaybe as AnsiDoc.AnsiDoc,
        );
        messageIndex++;
      }

      if (typeof firstMaybe === "string") {
        firstLine = AnsiDoc.catWithSpace(firstLine, AnsiDoc.text(firstMaybe));
        messageIndex++;
      }

      console.log(AnsiDoc.render(firstLine, { style: "pretty" }));
    }

    if (!Cause.isEmpty(cause)) {
      firstLine = AnsiDoc.catWithSpace(
        firstLine,
        AnsiDoc.text(Cause.pretty(cause, { renderErrorCause: true })),
      );
      console.log(AnsiDoc.render(firstLine, { style: "pretty" }));
    }

    if (messageIndex < messages.length) {
      for (; messageIndex < messages.length; messageIndex++) {
        const message = messages[messageIndex];

        if (AnsiDoc.isDoc(message)) {
          console.log(
            AnsiDoc.render(Inspectable.redact(message) as AnsiDoc.AnsiDoc, {
              style: "pretty",
            }),
          );
        } else {
          console.log(Inspectable.redact(message));
        }
      }
    }
  });
}
