import { Container, Graphics } from "pixi.js";
import { build, find, type NodeType, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export class Meter extends Container {
    readonly track = new Graphics();
    readonly fillBar = new Graphics();
    value = 0;
    max = 100;

    constructor() {
        super();
        this.addChild(this.track, this.fillBar);
    }

    setValue(value: number, max: number, width: number, height: number, fill: string): void {
        this.value = value;
        this.max = max;
        this.track.clear().roundRect(0, 0, width, height, height / 2).fill("#334155");
        this.fillBar.clear().roundRect(0, 0, width * (value / max), height, height / 2).fill(fill);
    }
}

export const meterType: NodeType = {
    create: () => new Meter(),
    assign: (node, target, ctx) => {
        if (!(target instanceof Meter)) return;
        const value = typeof node.value === "number" ? node.value : 0;
        const max = typeof node.max === "number" ? node.max : 100;
        const width = typeof node.barWidth === "number" ? node.barWidth : 200;
        const height = typeof node.barHeight === "number" ? node.barHeight : 20;
        const fill = typeof node.fill === "string" ? ctx.readString(node.fill) : "#22c55e";
        target.setValue(value, max, width, height, fill);
    },
};

export const customNodeTypeDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "meter",
                type: "Meter",
                x: 24,
                y: 24,
                value: { _: 40, desktop: 75 },
                max: 100,
                barWidth: 240,
                barHeight: 18,
                fill: "#22c55e",
            },
        ],
    },
};

export function runCustomNodeTypeDemo(): { root: Container; meter: Meter } {
    const root = build(customNodeTypeDoc, {
        resolve,
        activeTags: ["desktop"],
        nodeTypes: new Map([["Meter", meterType]]),
    });

    const meter = find(root, "meter");
    if (!(meter instanceof Meter)) throw new Error("Meter example failed to build");
    return { root, meter };
}
