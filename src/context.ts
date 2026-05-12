/**
 * Runtime context types passed to node types.
 *
 * Lives in its own file to avoid circular imports between `build.ts` / `apply.ts`
 * (context producers) and `nodeTypes.ts` (consumer).
 */

import type { Container, Texture } from "pixi.js";
import type { ResolvedNode } from "./types.js";

/** Host-supplied resolvers (§7.1 asset references, §7.2 string bindings). */
export interface Resolvers {
    /** Resolve an opaque texture identifier (§7.1) to a Pixi Texture. */
    texture: (id: string) => Texture;
    /** Resolve a text style identifier. Return `undefined` for unknown ids. */
    style?: (id: string) => object | undefined;
    /**
     * Resolve a binding path (§7.2). Receives the raw `path` between `{` and `}`
     * (escapes already stripped). If absent, `{...}` substrings are passed through.
     */
    binding?: (path: string) => string;
}

/** Context passed to {@link NodeType.create}. */
export interface BuildContext {
    resolve: Resolvers;
    /** Apply §7.2 bindings to a string. */
    readString: (value: string) => string;
}

/** Context passed to {@link NodeType.assign}. */
export interface AssignContext {
    resolve: Partial<Resolvers>;
    readString: (value: string) => string;
    /** PXD_ID → Container in the existing tree. Empty during build's initial pass. */
    idMap: ReadonlyMap<string, Container>;
}

/**
 * Strategy: per-type create + assign.
 *
 * `create` constructs a minimal empty Container.
 * `assign` writes all type-specific mutable fields to the object (texture, text,
 * anchor, draw-calls, ...).
 *
 * Dispatch order per node:
 *   create → assign (type-specific) → applyBaseFields (universal transform overrides).
 *
 * Base fields run LAST so they always override type-specific side effects.
 * Critical for Pixi: setting `sprite.width` mutates `scale.x`; `applyBaseFields`
 * sets `scale.x` after to restore the node's explicit `scaleX` if present.
 *
 * `assign` is optional — passive types (slot, prefab) have no fields to apply.
 */
export interface NodeType {
    create(node: ResolvedNode, ctx: BuildContext): Container;
    assign?(node: ResolvedNode, target: Container, ctx: AssignContext): void;
}

/** Merge a defaults map with optional user overrides. */
export function mergeRegistry<V>(
    defaults: ReadonlyMap<string, V>,
    overrides?: ReadonlyMap<string, V>,
): Map<string, V> {
    const out = new Map(defaults);
    if (overrides) for (const [k, v] of overrides) out.set(k, v);
    return out;
}
