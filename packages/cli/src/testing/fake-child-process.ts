import { Effect, Layer, PlatformError, Redacted, Sink, Stream } from "effect";
import { ChildProcessSpawner } from "effect/process";

/** How a scripted command behaves: it runs and exits, or it cannot be found. */
export type ScriptedCommand =
  | {
      readonly _tag: "Exits";
      readonly exitCode: number;
      readonly output?: string;
    }
  | { readonly _tag: "NotFound" };

export interface SpawnedCommand {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

/**
 * A ChildProcessSpawner that runs nothing: each spawned command is answered by
 * `script`, and every spawn is recorded in the returned `spawned` array.
 */
export const fakeChildProcessSpawner = (
  script: (command: SpawnedCommand) => ScriptedCommand,
) => {
  const spawned: Array<SpawnedCommand> = [];

  const spawner = ChildProcessSpawner.make((command) => {
    if (command._tag !== "StandardCommand") {
      return Effect.die(
        "fakeChildProcessSpawner only supports standard commands",
      );
    }

    const call: SpawnedCommand = {
      command: command.command,
      args: command.args.map((word) =>
        Redacted.isRedacted(word) ? Redacted.value(word) : word,
      ),
    };
    spawned.push(call);

    const scripted = script(call);
    if (scripted._tag === "NotFound") {
      return Effect.fail(
        PlatformError.systemError({
          _tag: "NotFound",
          module: "ChildProcess",
          method: "spawn",
          pathOrDescriptor: call.command,
          description: `spawn ${call.command} ENOENT`,
        }),
      );
    }

    const output = Stream.make(new TextEncoder().encode(scripted.output ?? ""));
    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(1),
        exitCode: Effect.succeed(
          ChildProcessSpawner.ExitCode(scripted.exitCode),
        ),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        stdin: Sink.drain,
        stdout: output,
        stderr: Stream.empty,
        all: output,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        unref: Effect.succeed(Effect.void),
      }),
    );
  });

  return {
    layer: Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
    spawned,
  };
};
