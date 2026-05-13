import { Container } from "pixi.js";
import { build, find, type LibraryDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export const prefabsDoc: LibraryDocument = {
    format: "pxd",
    version: 1,
    level: "library",
    prefabs: {
        Card: {
            id: "cardRoot",
            type: "container",
            children: [
                { id: "body", type: "graphics", shape: "roundRect", width: 180, height: 96, radius: 10, fill: "#1e293b" },
                { id: "badge", type: "graphics", x: 12, y: 12, shape: "circle", radius: 8, fill: "#f97316" },
            ],
        },
    },
    root: {
        id: "root",
        type: "container",
        children: [
            { id: "leftCard", type: "Card", x: 20, y: 20 },
            { id: "rightCard", type: "Card", x: 240, y: 20 },
        ],
    },
};

export function runPrefabsDemo(): {
    root: Container;
    leftCard: Container | null;
    rightCard: Container | null;
    leftBadge: Container | null;
    rightBadge: Container | null;
} {
    const root = build(prefabsDoc, { resolve });

    return {
        root,
        leftCard: find(root, "leftCard"),
        rightCard: find(root, "rightCard"),
        leftBadge: find(root, "leftCard.badge"),
        rightBadge: find(root, "rightCard.badge"),
    };
}
