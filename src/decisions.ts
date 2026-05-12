/**
 * §3.6 Decision-value resolution.
 *
 * Given an "active tag set" (host-supplied), every decision-map field collapses
 * to its picked leaf BEFORE any further field processing. Pure functions —
 * no Pixi dependency, easy to unit-test.
 */

import type { Node, ResolvedNode } from "./types.js";

/** Keys of a node that MUST NOT be replaced by a decision value (§3.6 / §10 rule 14). */
export const NON_DECIDABLE_KEYS: ReadonlySet<string> = new Set([
    "id",
    "type",
    "mask",
    "children",
    "extensions",
    "points",
]);

/**
 * §3.6 decision-value resolver. Picks the most-specific selector that matches
 * the active tag set, breaking ties by declaration order. Throws on an
 * unsorted selector (§3.6 producers MUST canonicalize).
 */
export function resolveDecisionValue(value: unknown, activeTags: ReadonlySet<string>): unknown {
    if (!isDecisionMap(value)) return value;
    const map = value as Record<string, unknown>;
    let pickedKey = "_";
    let pickedSpec = -1;
    for (const key of Object.keys(map)) {
        if (key === "_") continue;
        const tags = key.split("+");
        // §3.6 canonical-order check
        for (let i = 1; i < tags.length; i++) {
            if (tags[i - 1] >= tags[i]) {
                throw new Error(
                    `decision-map selector '${key}' is not lexicographically sorted (§3.6)`,
                );
            }
        }
        let allActive = true;
        for (const t of tags) {
            if (!activeTags.has(t)) {
                allActive = false;
                break;
            }
        }
        if (!allActive) continue;
        // Strict `>` preserves declaration order on ties (first match wins).
        if (tags.length > pickedSpec) {
            pickedSpec = tags.length;
            pickedKey = key;
        }
    }
    return map[pickedKey];
}

/** True if `v` is a decision-map shape (object with `_` default key). */
export function isDecisionMap(v: unknown): boolean {
    return typeof v === "object" && v !== null && !Array.isArray(v) && "_" in v;
}

/**
 * Returns a copy of `node` with all decidable scalar fields resolved against
 * `activeTags`. Structural fields (id, type, mask, children, extensions,
 * points) are passed through unchanged.
 */
export function resolveNodeFields(node: Node, activeTags: ReadonlySet<string>): ResolvedNode {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
        out[key] = NON_DECIDABLE_KEYS.has(key)
            ? value
            : resolveDecisionValue(value, activeTags);
    }
    return out as ResolvedNode;
}
