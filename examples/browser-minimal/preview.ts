import { Application, Assets, Texture } from "pixi.js";
import { build } from "../../src/index.js";
import { browserDoc } from "./document.js";

export async function mountDemo(target: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({ background: "#0f172a", width: 520, height: 280, antialias: true });
    target.replaceChildren(app.canvas);

    const root = build(browserDoc, {
        resolve: {
            texture: (id) => Assets.get(id) ?? Texture.WHITE,
            style: (id) => {
                if (id === "title") return { fill: "#f8fafc", fontSize: 28, fontFamily: "Inter, Arial", fontWeight: "700" };
                if (id === "caption") return { fill: "#cbd5e1", fontSize: 14, fontFamily: "Inter, Arial", wordWrap: true };
                return undefined;
            },
        },
    });
    app.stage.addChild(root);
}
