import {
  ASCIIFontRenderable,
  BoxRenderable,
  createCliRenderer,
  TextAttributes,
  TextRenderable,
} from "@opentui/core";

const renderer = await createCliRenderer({ exitOnCtrlC: true });

const container = new BoxRenderable(renderer, {
  alignItems: "center",
  justifyContent: "center",
  flexGrow: 1,
});
const content = new BoxRenderable(renderer, {
  justifyContent: "center",
  alignItems: "flex-end",
});

content.add(
  new ASCIIFontRenderable(renderer, { font: "tiny", text: "OpenTUI" }),
);
content.add(
  new TextRenderable(renderer, {
    content: "What will you build?",
    attributes: TextAttributes.DIM,
  }),
);
container.add(content);
renderer.root.add(container);
