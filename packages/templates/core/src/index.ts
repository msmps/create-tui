import {
  BoxRenderable,
  type CliRenderer,
  createCliRenderer,
  TextRenderable,
} from "@opentui/core";

class App {
  private box: BoxRenderable;
  private text: TextRenderable;
  private renderer: CliRenderer;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    this.box = new BoxRenderable("container", {});

    this.text = new TextRenderable("text", {
      content: "Hello, world!",
    });

    this.box.add(this.text);
    this.renderer.root.add(this.box);

    this.renderer.start();
  }
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
new App(renderer);
