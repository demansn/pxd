import { Application } from "pixi.js";
import { build } from "../../src/index.js";
import { customNodeTypeDoc, meterType } from "./demo.js";

export async function mountDemo(target: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({ background: "#0b1220", width: 360, height: 120, antialias: true });
    target.replaceChildren(app.canvas);

    const root = build(customNodeTypeDoc, {
        resolve: { texture: () => { throw new Error("no textures here"); } },
        activeTags: ["desktop"],
        nodeTypes: new Map([["Meter", meterType]]),
    });
    app.stage.addChild(root);
}
