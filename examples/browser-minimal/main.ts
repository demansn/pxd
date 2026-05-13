import { Application, Assets, Texture } from "pixi.js";
import { build } from "../../src/index.js";
import { browserDoc } from "./document.js";

const app = new Application();
await app.init({ background: "#0f172a", resizeTo: window, antialias: true });

document.querySelector<HTMLDivElement>("#app")?.appendChild(app.canvas);

const root = build(browserDoc, {
    resolve: {
        texture: (id) => Assets.get(id) ?? Texture.WHITE,
        style: (id) => {
            if (id === "title") {
                return { fill: "#f8fafc", fontSize: 32, fontFamily: "Arial", fontWeight: "700" };
            }
            if (id === "caption") {
                return { fill: "#cbd5e1", fontSize: 16, fontFamily: "Arial", wordWrap: true };
            }
            return undefined;
        },
    },
});

app.stage.addChild(root);
