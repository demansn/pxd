/**
 * `build(doc, options)` — validate and construct a fresh Pixi tree from a PXD doc.
 *
 * Mask forward-references are resolved in a second pass after the full tree is
 * built — masks may reference nodes declared later.
 */

import { Container } from "pixi.js";
import { docContainsMask } from "./apply.js";
import { makeStringReader } from "./bindings.js";
import type { AssignContext, BuildContext, NodeType, Resolvers } from "./context.js";
import { mergeRegistry } from "./context.js";
import { resolveNodeFields } from "./decisions.js";
import { defaultNodeTypes } from "./nodeTypes.js";
import { tagId, tagSlot } from "./tags.js";
import type { LibraryDocument, Node, ResolvedNode } from "./types.js";
import { documentShape, validate } from "./validate.js";

const DEG_TO_RAD = Math.PI / 180;
const EMPTY_ID_MAP: ReadonlyMap<string, Container> = new Map();

export interface BuildOptions {
    resolve: Resolvers;
    /** Additional node types merged onto {@link defaultNodeTypes}. Keys override defaults. */
    nodeTypes?: ReadonlyMap<string, NodeType>;
    /** §3.6 active tag set. Defaults to empty (always picks `_`). */
    activeTags?: Iterable<string>;
}

/** Validate (Core+Library) and build a fresh Pixi tree. */
export function build(doc: unknown, options: BuildOptions): Container {
    const validated = validate(doc);
    const shape = documentShape(validated);

    const nodeTypes = mergeRegistry(defaultNodeTypes, options.nodeTypes);

    // Library: register prefabs as node types into the shared map → transitive
    // prefab → prefab composition resolves correctly.
    if (shape === "library") {
        const prefabs = (validated as LibraryDocument).prefabs;
        for (const [name, body] of Object.entries(prefabs)) {
            if (nodeTypes.has(name)) {
                throw new Error(`prefab name '${name}' collides with registered type (§12.1)`);
            }
            nodeTypes.set(name, makePrefabType(body, nodeTypes, options));
        }
    }

    const root = (validated as LibraryDocument).root;
    return buildSubtree(root, nodeTypes, options);
}

/**
 * Builds one tree scope. Fresh idMap per call → each prefab instance has its
 * own identity scope (§13.2).
 */
function buildSubtree(
    root: Node,
    nodeTypes: ReadonlyMap<string, NodeType>,
    options: BuildOptions,
): Container {
    const activeTags = new Set(options.activeTags ?? []);
    const readString = makeStringReader(options.resolve.binding);
    const hasMasks = docContainsMask(root);
    const idMap = hasMasks ? new Map<string, Container>() : null;
    const pendingMasks: Array<[Container, string]> = [];

    const buildCtx: BuildContext = { resolve: options.resolve, readString };
    const assignCtx: AssignContext = { resolve: options.resolve, readString, idMap: EMPTY_ID_MAP };

    function buildNode(node: Node): Container {
        const resolved = resolveNodeFields(node, activeTags);
        const type = nodeTypes.get(resolved.type);
        if (!type) {
            throw new Error(
                `no node type registered for '${resolved.type}' on node '${resolved.id}'`,
            );
        }
        const obj = type.create(resolved, buildCtx);
        // Order: type-specific (assign) → universal transform (applyBaseFields).
        // Base fields run last so `scaleX` overrides `width`-derived scale on Sprite, etc.
        type.assign?.(resolved, obj, assignCtx);
        applyBaseFields(obj, resolved);
        tagNode(obj, resolved, readString);
        if (idMap) idMap.set(resolved.id as string, obj);
        if (typeof resolved.mask === "string") {
            pendingMasks.push([obj, resolved.mask]);
        }
        const children = resolved.children as ResolvedNode[] | undefined;
        if (Array.isArray(children)) {
            for (const child of children) obj.addChild(buildNode(child as Node));
        }
        return obj;
    }

    const out = buildNode(root);

    for (const [target, maskId] of pendingMasks) {
        const mask = idMap?.get(maskId);
        if (!mask) throw new Error(`mask '${maskId}' not found in tree`);
        target.mask = mask;
    }
    return out;
}

/**
 * Apply base PXD fields (§3.1) to a Pixi Container.
 *
 * NOTE: `label` is `node.label ?? node.id` per §3.2 — load-bearing for find/apply.
 */
export function applyBaseFields(obj: Container, node: ResolvedNode): void {
    if (typeof node.x === "number") obj.x = node.x;
    if (typeof node.y === "number") obj.y = node.y;
    if (typeof node.scaleX === "number") obj.scale.x = node.scaleX;
    if (typeof node.scaleY === "number") obj.scale.y = node.scaleY;
    if (typeof node.rotation === "number") obj.rotation = node.rotation * DEG_TO_RAD;
    if (typeof node.alpha === "number") obj.alpha = node.alpha;
    if (typeof node.visible === "boolean") obj.visible = node.visible;
    if (typeof node.zIndex === "number") obj.zIndex = node.zIndex;
    obj.label = (node.label as string | undefined) ?? (node.id as string);
}

function tagNode(obj: Container, node: ResolvedNode, readString: (s: string) => string): void {
    tagId(obj, node.id as string);
    if (node.type === "slot" && typeof node.slot === "string") {
        tagSlot(obj, readString(node.slot));
    }
}

function makePrefabType(
    body: Node,
    nodeTypes: ReadonlyMap<string, NodeType>,
    options: BuildOptions,
): NodeType {
    // create() delegates back through the full pipeline; no extra `assign` step needed.
    return {
        create: () => buildSubtree(body, nodeTypes, options),
    };
}
