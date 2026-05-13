import { Application } from "pixi.js";
import { apply, build, type Resolvers } from "../../src/index.js";
import { initialDoc, patchDoc } from "./demo.js";

export async function mountDemo(target: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({ background: "#0b1220", width: 360, height: 140, antialias: true });
    target.replaceChildren(app.canvas);

    const resolve: Resolvers = { texture: () => { throw new Error("no textures here"); } };
    const root = build(initialDoc, { resolve });
    app.stage.addChild(root);

    let phase = 0;
    setInterval(() => {
        phase = (phase + 1) % 2;
        apply(phase === 0 ? initialDoc : patchDoc, root, {
            resolve,
            onMissing: () => { /* ghost subtree is expected to miss */ },
        });
    }, 1500);
}
