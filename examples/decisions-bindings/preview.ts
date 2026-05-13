import { Application, Graphics, Text } from "pixi.js";
import { build } from "../../src/index.js";
import { ColorPanel, colorPanelType, decisionsBindingsDoc } from "./demo.js";

export async function mountDemo(target: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({ background: "#0b1220", width: 360, height: 160, antialias: true });
    target.replaceChildren(app.canvas);

    const resolve = {
        texture: () => { throw new Error("no textures here"); },
        binding: (path: string) => path === "theme.primary" ? "#1d4ed8" : path === "layout" ? "mobile" : "",
    };

    const root = build(decisionsBindingsDoc, {
        resolve,
        activeTags: ["mobile"],
        nodeTypes: new Map([["ColorPanel", colorPanelType]]),
    });

    const panel = root.getChildByLabel("panel", false);
    if (panel instanceof ColorPanel) {
        panel.addChild(new Graphics().roundRect(0, 0, 220, 80, 10).fill(panel.fillSeenByCustomType));
        panel.addChild(new Text({ text: `fill = ${panel.fillSeenByCustomType}`, style: { fill: "#f8fafc", fontSize: 14 }, x: 12, y: 92 }));
    }

    app.stage.addChild(root);
}
