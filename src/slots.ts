/**
 * Slot mount API.
 *
 * `slot` nodes (§4.5) are passive Container mount points. Slot Containers
 * carry a `Symbol.for("pxd.slot")` tag with the slot's semantic name —
 * `getSlot` walks the tree looking for that tag, decoupled from `label`.
 */

import type { Container } from "pixi.js";
import { slotOf } from "./tags.js";

/** Find the Container that was built from a `slot` node with `slot === slotName`. */
export function getSlot(root: Container, slotName: string): Container | null {
    if (slotOf(root) === slotName) return root;
    for (const child of root.children) {
        const hit = getSlot(child as Container, slotName);
        if (hit) return hit;
    }
    return null;
}

/**
 * Find the named slot Container and `addChild(content)` into it.
 * Throws if no such slot is found in the tree.
 */
export function mountSlot(root: Container, slotName: string, content: Container): Container {
    const slot = getSlot(root, slotName);
    if (!slot) throw new Error(`PXD slot '${slotName}' not found`);
    slot.addChild(content);
    return slot;
}
