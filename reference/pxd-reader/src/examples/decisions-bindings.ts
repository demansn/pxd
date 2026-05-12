/**
 * Example: §3.6 decision values + §7.2 string bindings.
 *
 * Both mechanisms let one document target many runtime contexts:
 *
 *   - Decision values: any scalar field MAY be `{ "_": default, "<tag>": ... }`.
 *     The reader picks the most specific selector that matches `activeTags`
 *     (ties broken by declaration order, all leaves must share a primitive type).
 *
 *   - String bindings: any string value MAY contain `{path}` placeholders.
 *     The reader expands them through the `binding` resolver BEFORE handing the
 *     string to a typed resolver (texture id, style id, raw text).
 *
 * Decision resolution runs FIRST, bindings SECOND.
 */
import type { Container } from "pixi.js";
import { build } from "pxd";
import type { CoreDocument } from "pxd";

const doc: CoreDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "title",
                type: "text",
                text: "{locale.title}",
                x: { _: 100, mobile: 50 },
                anchorX: 0.5,
            },
            {
                id: "betLabel",
                type: "text",
                text: "Bet: {settings.bet} {locale.coins}",
                maxWidth: { _: 320, de: 400, "de+mobile": 360 },
            },
        ],
    },
};

const locales: Record<string, string> = {
    "locale.title": "Gates of Olympus",
    "locale.coins": "monedas",
    "settings.bet": "10",
};

export function buildScene(): Container {
    return build(doc, {
        resolve: {
            texture: () => ({} as never),
            // Unknown paths surface in the bound string so the gap is obvious.
            binding: (path) => locales[path] ?? `[${path}]`,
        },
        activeTags: ["de", "mobile"],
    });
}
