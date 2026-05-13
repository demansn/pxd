/**
 * `apply(doc, root, options)` — apply a PXD doc as a stylesheet to an existing tree.
 *
 * Matches by label-path (immediate child whose label === pxdChild.label ?? id).
 * Missing nodes silently skip the subtree (optional `onMissing` callback).
 * Type-mismatch is also silent — base fields still apply, type-specific fields
 * are skipped by the per-type `assign`.
 */

import type { Container } from "pixi.js";
import { makeStringReader } from "./bindings.js";
import { applyBaseFields } from "./build.js";
import type { AssignContext, NodeType, Resolvers } from "./context.js";
import { mergeRegistry } from "./context.js";
import { resolveNodeFields } from "./decisions.js";
import { defaultNodeTypes } from "./nodeTypes.js";
import { idOf } from "./tags.js";
import type { LibraryDocument, Node, ResolvedNode } from "./types.js";
import { validate } from "./validate.js";

export interface ApplyOptions {
    /** Partial resolvers — only needed when corresponding fields appear in the doc. */
    resolve?: Partial<Resolvers>;
    /** §3.6 active tag set used for this apply call. Defaults to empty. */
    activeTags?: Iterable<string>;
    /** Additional node types merged onto {@link defaultNodeTypes}. Only `assign` is invoked by apply. */
    nodeTypes?: ReadonlyMap<string, NodeType>;
    /** Called when a PXD node has no matching Pixi child. Subtree is still skipped. */
    onMissing?: (labelPath: string, nodeId: string) => void;
}

const EMPTY_ID_MAP: ReadonlyMap<string, Container> = new Map();

interface ApplyState {
    activeTags: ReadonlySet<string>;
    nodeTypes: ReadonlyMap<string, NodeType>;
    ctx: AssignContext;
    onMissing?: (labelPath: string, nodeId: string) => void;
    count: number;
}

/** Apply a PXD doc to an existing Pixi tree. Returns count of updated nodes. */
export function apply(doc: unknown, root: Container, options: ApplyOptions = {}): number {
    // Apply docs may reference mask sources that live in the existing Pixi tree,
    // not in the doc itself. Skip §10 rule 6 — masks are resolved against the
    // tree's idMap below.
    const validated = validate(doc, { skipMaskValidation: true });

    const activeTags = new Set(options.activeTags ?? []);
    const readString = makeStringReader(options.resolve?.binding);
    const nodeTypes = mergeRegistry(defaultNodeTypes, options.nodeTypes);

    const docRoot = (validated as LibraryDocument).root;
    const idMap: ReadonlyMap<string, Container> = docContainsMask(docRoot)
        ? collectIdMap(root)
        : EMPTY_ID_MAP;

    const state: ApplyState = {
        activeTags,
        nodeTypes,
        ctx: {
            resolve: options.resolve ?? {},
            readString,
            idMap,
        },
        onMissing: options.onMissing,
        count: 0,
    };

    const rootKey = (docRoot.label as string | undefined) ?? docRoot.id;
    applyNode(docRoot, root, rootKey, state);
    return state.count;
}

function applyNode(node: Node, target: Container, labelPath: string, state: ApplyState): void {
    const resolved = resolveNodeFields(node, state.activeTags);
    const type = state.nodeTypes.get(resolved.type);
    // Same order as build: type-specific first, base fields last.
    type?.assign?.(resolved, target, state.ctx);
    applyBaseFields(target, resolved);
    applyMask(resolved, target, state.ctx.idMap);
    state.count++;
    applyChildren(resolved, target, labelPath, state);
}

function applyMask(node: ResolvedNode, target: Container, idMap: ReadonlyMap<string, Container>): void {
    if (typeof node.mask !== "string") return;
    const mask = idMap.get(node.mask);
    if (mask) target.mask = mask;
}

function applyChildren(node: ResolvedNode, target: Container, labelPath: string, state: ApplyState): void {
    const children = node.children as Node[] | undefined;
    if (!Array.isArray(children)) return;
    for (const child of children) applyChild(child, target, labelPath, state);
}

function applyChild(child: Node, target: Container, labelPath: string, state: ApplyState): void {
    const key = (child.label as string | undefined) ?? child.id;
    const childTarget = target.getChildByLabel(key, false) as Container | null;
    const childPath = `${labelPath}.${key}`;
    if (childTarget) {
        applyNode(child, childTarget, childPath, state);
    } else {
        state.onMissing?.(childPath, child.id);
    }
}

/** True if any node in the doc subtree has a string `mask` field. Used by build + apply to skip idMap work. */
export function docContainsMask(node: Node): boolean {
    if (typeof (node as { mask?: unknown }).mask === "string") return true;
    const children = (node as { children?: unknown }).children;
    if (!Array.isArray(children)) return false;
    for (const c of children) if (docContainsMask(c as Node)) return true;
    return false;
}

function collectIdMap(root: Container): ReadonlyMap<string, Container> {
    const map = new Map<string, Container>();
    collectIdMapNode(root, map);
    return map;
}

function collectIdMapNode(node: Container, map: Map<string, Container>): void {
    const id = idOf(node);
    if (id !== undefined) map.set(id, node);
    for (const child of node.children) collectIdMapNode(child as Container, map);
}
