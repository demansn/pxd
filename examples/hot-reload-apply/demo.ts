import { Container } from "pixi.js";
import { apply, build, find, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export const initialDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "card",
                type: "container",
                x: 40,
                alpha: 0.8,
                children: [
                    { id: "body", type: "graphics", shape: "rect", width: 160, height: 80, fill: "#334155" },
                    { id: "badge", type: "container", y: 8 },
                ],
            },
        ],
    },
};

export const patchDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "card",
                type: "container",
                x: 120,
                children: [
                    { id: "body", type: "graphics", shape: "rect", width: 160, height: 80, fill: "#16a34a" },
                    { id: "ghost", type: "container", x: 999 },
                ],
            },
        ],
    },
};

export function runApplyPatchDemo(): {
    root: Container;
    sameCardIdentity: boolean;
    updatedCount: number;
    cardX: number;
    badgeStillAttached: boolean;
    missed: Array<{ path: string; nodeId: string }>;
} {
    const root = build(initialDoc, { resolve });
    const beforeCard = find(root, "card");
    const missed: Array<{ path: string; nodeId: string }> = [];

    const updatedCount = apply(patchDoc, root, {
        onMissing: (path, nodeId) => missed.push({ path, nodeId }),
    });

    const afterCard = find(root, "card");
    const badge = find(root, "card.badge");

    return {
        root,
        sameCardIdentity: beforeCard === afterCard,
        updatedCount,
        cardX: afterCard?.x ?? Number.NaN,
        badgeStillAttached: Boolean(badge),
        missed,
    };
}
