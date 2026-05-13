import { Application } from "pixi.js";
import { build } from "../../src/index.js";
import { prefabsDoc } from "./demo.js";

export async function mountDemo(target: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({ background: "#0b1220", width: 520, height: 160, antialias: true });
    target.replaceChildren(app.canvas);

    const root = build(prefabsDoc, { resolve: { texture: () => { throw new Error("no textures here"); } } });
    app.stage.addChild(root);
}
