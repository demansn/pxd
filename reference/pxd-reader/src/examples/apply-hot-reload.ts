/**
 * Example: `apply()` — patch a live Pixi tree with a new document.
 *
 * `apply` matches nodes by **label path with immediate-child lookup**: for each
 * PXD node it looks for a single child of the current Pixi parent whose `label`
 * matches. Missing nodes trigger `onMissing` and skip the subtree (no throw).
 * Type-mismatched targets accept base-field updates (`x`, `y`, `alpha`, …) but
 * silently skip type-specific fields (`text` on a `Sprite`, etc.).
 *
 * Typical use cases:
 *   - Designer edits a JSON; reload patches the live scene without rebuild.
 *   - Theme / locale swap: re-`apply` the same doc with different `activeTags`.
 *   - A/B test: apply a variant doc, then revert by applying the baseline.
 */
import type { Container } from "pixi.js";
import { apply, build } from "pxd";
import type { CoreDocument } from "pxd";

const baseline: CoreDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "title",
                type: "text",
                text: "Hello",
                x: 100, y: 80,
            },
        ],
    },
};

const themed: CoreDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "title",
                type: "text",
                text: { _: "Hello", dark: "Hello (night)" },
                x: { _: 100, mobile: 40 },
                y: 80,
            },
        ],
    },
};

export function buildScene(): Container {
    const root = build(baseline, {
        resolve: { texture: () => ({} as never) },
    });

    // Re-apply the themed doc with different active tags — same tree, new fields.
    apply(themed, root, {
        resolve: { texture: () => ({} as never) },
        activeTags: ["dark", "mobile"],
        onMissing: (path) => console.warn("pxd apply miss:", path),
    });

    return root;
}
