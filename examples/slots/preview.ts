import { Application, Container, Graphics } from "pixi.js";
import { build, mountSlot } from "../../src/index.js";
import { slotsDoc } from "./demo.js";

export async function mountDemo(target: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({ background: "#0b1220", width: 520, height: 320, antialias: true });
    target.replaceChildren(app.canvas);

    const root = build(slotsDoc, { resolve: { texture: () => { throw new Error("no textures here"); } } });

    const board = new Container();
    board.addChild(new Graphics().roundRect(0, 0, 320, 180, 12).fill("#1d4ed8").stroke({ color: "#60a5fa", width: 2 }));
    mountSlot(root, "Board", board);

    app.stage.addChild(root);
}
