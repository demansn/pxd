/**
 * Example: Library profile — reusable named trees (prefabs).
 *
 * A library document adds a top-level `prefabs` map. A node whose `type`
 * matches a prefab name instantiates that prefab in a fresh identity scope
 * (§13.2): ids inside one instance never collide with ids in another, and
 * masks declared inside the prefab resolve locally.
 *
 * Transitive composition works out of the box — a prefab MAY reference another
 * prefab by name.
 */
import type { Container } from "pixi.js";
import { build } from "pxd";
import type { LibraryDocument } from "pxd";

const doc: LibraryDocument = {
    format: "pxd",
    version: 1,
    profile: "library",
    prefabs: {
        "Button.primary": {
            id: "root",
            type: "container",
            children: [
                { id: "bg", type: "sprite", texture: "btn_bg" },
                { id: "caption", type: "text", text: "" },
            ],
        },
        // Transitive prefab → prefab reference: `IconButton` includes a
        // `Button.primary` instance.
        "IconButton": {
            id: "root",
            type: "container",
            children: [
                { id: "frame", type: "Button.primary" },
                { id: "glyph", type: "sprite", texture: "icon" },
            ],
        },
    },
    root: {
        id: "root",
        type: "container",
        children: [
            { id: "playBtn", type: "Button.primary", x: 100, y: 50 },
            { id: "quitBtn", type: "Button.primary", x: 100, y: 120 },
            { id: "settingsBtn", type: "IconButton", x: 100, y: 200 },
        ],
    },
};

export function buildScene(): Container {
    return build(doc, {
        resolve: { texture: () => ({} as never) },
    });
}
