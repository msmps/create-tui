import { TextAttributes } from "@opentui/core";
import { render } from "@opentui/solid";

render(() => (
  <box alignItems="center" justifyContent="center" flexGrow={1}>
    <box justifyContent="center" alignItems="flex-end">
      <ascii_font font="tiny" text="OpenTUI" />
      <text attributes={TextAttributes.DIM}>What will you build?</text>
    </box>
  </box>
));
