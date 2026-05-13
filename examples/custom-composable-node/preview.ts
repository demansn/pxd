import { Application } from "pixi.js";
import { build } from "../../src/index.js";
import { customComposableDoc, panelType } from "./demo.js";

export async function mountDemo(target: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({ background: "#0b1220", width: 360, height: 220, antialias: true });
    target.replaceChildren(app.canvas);

    const root = build(customComposableDoc, {
        resolve: { texture: () => { throw new Error("no textures here"); } },
        nodeTypes: new Map([["Panel", panelType]]),
    });
    app.stage.addChild(root);
}
