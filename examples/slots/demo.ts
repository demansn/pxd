import { Container } from "pixi.js";
import { build, getSlot, mountSlot, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export const slotsDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "boardMount",
                type: "slot",
                slot: "Board",
                x: 100,
                y: 80,
                width: 640,
                height: 360,
            },
        ],
    },
};

export function runSlotsDemo(): { root: Container; slot: Container; mounted: Container } {
    const root = build(slotsDoc, { resolve });
    const mounted = new Container();
    mounted.label = "hostOwnedBoard";

    const slot = mountSlot(root, "Board", mounted);
    const sameSlot = getSlot(root, "Board");
    if (sameSlot !== slot) throw new Error("Slot lookup mismatch");

    return { root, slot, mounted };
}
