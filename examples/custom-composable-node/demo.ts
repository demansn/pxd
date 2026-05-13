import { Container, Graphics } from "pixi.js";
import { build, find, type NodeType, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export class Panel extends Container {
    readonly background = new Graphics();
    title = "";

    constructor() {
        super();
        this.addChild(this.background);
    }

    setChrome(title: string, width: number, height: number, fill: string): void {
        this.title = title;
        this.background.clear().roundRect(0, 0, width, height, 12).fill(fill);
    }
}

export const panelType: NodeType = {
    create: () => new Panel(),
    assign: (node, target, ctx) => {
        if (!(target instanceof Panel)) return;
        const title = typeof node.title === "string" ? ctx.readString(node.title) : "";
        const width = typeof node.panelWidth === "number" ? node.panelWidth : 320;
        const height = typeof node.panelHeight === "number" ? node.panelHeight : 180;
        const fill = typeof node.fill === "string" ? ctx.readString(node.fill) : "#0f172a";
        target.setChrome(title, width, height, fill);
    },
};

export const customComposableDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "panel",
                type: "Panel",
                title: "Settings",
                panelWidth: 320,
                panelHeight: 180,
                fill: "#1e293b",
                children: [
                    {
                        id: "content",
                        type: "container",
                        x: 16,
                        y: 48,
                        children: [
                            {
                                id: "accent",
                                type: "graphics",
                                shape: "rect",
                                width: 120,
                                height: 8,
                                fill: "#38bdf8",
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export function runCustomComposableDemo(): { root: Container; panel: Panel; content: Container } {
    const root = build(customComposableDoc, {
        resolve,
        nodeTypes: new Map([["Panel", panelType]]),
    });

    const panel = find(root, "panel");
    const content = find(root, "panel.content");
    if (!(panel instanceof Panel)) throw new Error("Panel example failed to build");
    if (!(content instanceof Container)) throw new Error("Panel child failed to build");
    return { root, panel, content };
}
