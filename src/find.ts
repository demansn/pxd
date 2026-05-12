/**
 * Tree query API by `Container.label` — matches §3.2 label semantics.
 *
 * Path segments are joined with `.`. Each segment matches an IMMEDIATE
 * child's label (no deep search inside a segment).
 *
 *   find(root, "hud.bet.value")  → root.children[label==hud].children[label==bet].children[label==value]
 *
 * Labels with `.` inside cannot be used in paths — producers should avoid them
 * (spec §3.3 already discourages slashes and whitespace in identifiers).
 */

import type { Container } from "pixi.js";

/** Dot-path lookup. Returns null if any segment fails to match. */
export function find(root: Container, path: string): Container | null {
    let cur: Container | null = root;
    for (const seg of path.split(".")) {
        if (!cur) return null;
        cur = cur.getChildByLabel(seg, false) as Container | null;
    }
    return cur;
}

/** Returns all containers reachable at the final segment of `path`. */
export function findAll(root: Container, path: string): Container[] {
    const segs = path.split(".");
    let frontier: Container[] = [root];
    for (const seg of segs) {
        const next: Container[] = [];
        for (const parent of frontier) {
            for (const child of parent.children) {
                if (child.label === seg) next.push(child as Container);
            }
        }
        frontier = next;
        if (frontier.length === 0) return [];
    }
    return frontier;
}

/** Like `find`, but throws a descriptive error if the path doesn't resolve. */
export function requirePath<T extends Container = Container>(root: Container, path: string): T {
    const r = find(root, path);
    if (!r) {
        throw new Error(`PXD path '${path}' not found under '${root.label ?? "(unnamed root)"}'`);
    }
    return r as T;
}
