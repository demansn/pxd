/**
 * Symbol tags attached to built Pixi Containers.
 *
 * `Symbol.for(...)` is intentional — these symbols are globally unique, so
 * a Container tagged in one module is recognized by `getSlot`/`apply` in another.
 */

import type { Container } from "pixi.js";

/** PXD node id of the source node. Used by `apply` to resolve mask references. */
export const PXD_ID = Symbol.for("pxd.id");

/** Slot name (from `slot.slot` field) on slot-built Containers. Used by `getSlot`/`mountSlot`. */
export const PXD_SLOT = Symbol.for("pxd.slot");

type TaggedContainer = Container & { [k: symbol]: unknown };

export function tagId(obj: Container, id: string): void {
    (obj as TaggedContainer)[PXD_ID] = id;
}

export function idOf(obj: Container): string | undefined {
    const v = (obj as TaggedContainer)[PXD_ID];
    return typeof v === "string" ? v : undefined;
}

export function tagSlot(obj: Container, slotName: string): void {
    (obj as TaggedContainer)[PXD_SLOT] = slotName;
}

export function slotOf(obj: Container): string | undefined {
    const v = (obj as TaggedContainer)[PXD_SLOT];
    return typeof v === "string" ? v : undefined;
}
