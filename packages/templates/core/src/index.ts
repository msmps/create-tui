import {
  ASCIIFontRenderable,
  BoxRenderable,
  type CliRenderer,
  createCliRenderer,
  TextAttributes,
  TextRenderable,
} from "@opentui/core";

class App {
  private outerBox: BoxRenderable;
  private innerBox: BoxRenderable;
  private asciiFont: ASCIIFontRenderable;
  private text: TextRenderable;
  private renderer: CliRenderer;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    this.outerBox = new BoxRenderable("outer-container", {
      alignItems: "center",
      justifyContent: "center",
      flexGrow: 1,
    });

    this.innerBox = new BoxRenderable("inner-container", {
      justifyContent: "center",
      alignItems: "flex-end",
    });

    this.asciiFont = new ASCIIFontRenderable("ascii-font", {
      font: "tiny",
      text: "OpenTUI",
    });

    this.text = new TextRenderable("text", {
      content: "What will you build?",
      attributes: TextAttributes.DIM,
    });

    this.innerBox.add(this.asciiFont);
    this.innerBox.add(this.text);
    this.outerBox.add(this.innerBox);
    this.renderer.root.add(this.outerBox);

    this.renderer.start();
  }
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
new App(renderer);
