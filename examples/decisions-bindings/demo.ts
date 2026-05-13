import { Container } from "pixi.js";
import { build, getSlot, type NodeType, type PxdDocument, type Resolvers } from "../../src/index.js";

export class ColorPanel extends Container {
    fillSeenByCustomType = "";
}

export const colorPanelType: NodeType = {
    create: () => new ColorPanel(),
    assign: (node, target, ctx) => {
        if (!(target instanceof ColorPanel)) return;
        if (typeof node.fill === "string") target.fillSeenByCustomType = ctx.readString(node.fill);
    },
};

export const decisionsBindingsDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        x: { _: 16, mobile: 48 },
        children: [
            {
                id: "panel",
                type: "ColorPanel",
                fill: "{theme.primary}",
            },
            {
                id: "boardMount",
                type: "slot",
                slot: "Board.{layout}",
            },
        ],
    },
};

export function runDecisionsBindingsDemo(): {
    root: Container;
    slotFound: boolean;
    panelFillSeenByCustomType: string;
} {
    const resolve: Resolvers = {
        texture: () => { throw new Error("no textures in this demo"); },
        binding: (path) => {
            if (path === "theme.primary") return "#1d4ed8";
            if (path === "layout") return "mobile";
            return "";
        },
    };

    const root = build(decisionsBindingsDoc, {
        resolve,
        activeTags: ["mobile"],
        nodeTypes: new Map([["ColorPanel", colorPanelType]]),
    });

    const panel = root.getChildByLabel("panel", false);
    if (!(panel instanceof ColorPanel)) throw new Error("ColorPanel failed to build");

    return {
        root,
        slotFound: Boolean(getSlot(root, "Board.mobile")),
        panelFillSeenByCustomType: panel.fillSeenByCustomType,
    };
}
