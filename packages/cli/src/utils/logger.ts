import { ValidationError } from "@effect/cli";
import { isQuitException } from "@effect/platform/Terminal";
import * as Ansi from "@effect/printer-ansi/Ansi";
import * as AnsiDoc from "@effect/printer-ansi/AnsiDoc";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";

const createPrefixDoc = (color: Ansi.Ansi = Ansi.cyan) =>
  AnsiDoc.text("create-tui").pipe(
    AnsiDoc.annotate(color),
    AnsiDoc.squareBracketed,
  );

export function createLogger() {
  return Logger.make(({ logLevel, message, cause }) => {
    const messages = Arr.ensure(message);
    const documents: AnsiDoc.AnsiDoc[] = [];

    const prefixColor = LogLevel.lessThan(logLevel, LogLevel.Error)
      ? Ansi.green
      : Ansi.red;

    if (!Cause.isEmpty(cause)) {
      const output = AnsiDoc.catWithSpace(
        createPrefixDoc(Ansi.red),
        AnsiDoc.text(Cause.pretty(cause)),
      );

      console.error(AnsiDoc.render(output, { style: "pretty" }));

      return;
    }

    for (const message of messages) {
      let messageDoc: AnsiDoc.AnsiDoc;

      if (ValidationError.isValidationError(message)) {
        return;
      }

      if (isQuitException(message)) {
        documents.push(
          AnsiDoc.cat(
            AnsiDoc.hardLine,
            AnsiDoc.catWithSpace(
              createPrefixDoc(prefixColor),
              AnsiDoc.text("Exiting..."),
            ),
          ),
        );
        break;
      }

      if (AnsiDoc.isDoc(message)) {
        messageDoc = message as AnsiDoc.AnsiDoc;
      } else {
        messageDoc = AnsiDoc.text(message as string);
      }

      documents.push(
        AnsiDoc.catWithSpace(createPrefixDoc(prefixColor), messageDoc),
      );
    }

    const output = AnsiDoc.render(AnsiDoc.vsep(documents), {
      style: "pretty",
    });

    console.log(output);
  });
}
