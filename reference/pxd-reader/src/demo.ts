/**
 * Browser demo for the `pxd` library.
 *
 * Walks through the headline features end-to-end:
 *
 *  1. `build(doc, opts)`            — turn a Core document into a Pixi tree.
 *  2. `find` / `requirePath`        — look up nodes by dotted label path.
 *  3. `mountSlot`                   — drop external content into a `slot` node.
 *  4. `apply(doc, root, opts)`      — patch the live tree with a new document
 *                                     (positions, text, textures update in place).
 *
 * The demo intentionally uses inline documents and stubbed texture resolvers so
 * it runs in a static `index.html` with no bundler or asset pipeline.
 */
import { Application, Sprite, Text, Texture } from "pixi.js";
import { apply, build, mountSlot, requirePath } from "pxd";
import type { CoreDocument } from "pxd";

// -----------------------------------------------------------------------------
// 1) Initial document — built once.
// -----------------------------------------------------------------------------

const initialDoc: CoreDocument = {
    format: "pxd",
    version: 1,
    profile: "core",
    root: {
        id: "root",
        type: "container",
        children: [
            { id: "bg", type: "graphics", shape: "rect", width: 800, height: 600, fill: "#1f2937" },
            {
                id: "card",
                type: "graphics",
                shape: "roundRect",
                x: 80, y: 120, width: 640, height: 360,
                fill: "#374151", radius: 24,
            },
            {
                id: "title",
                type: "text",
                text: "PXD v1",
                style: "h1",
                x: 400, y: 200, anchorX: 0.5,
            },
            {
                id: "subtitle",
                type: "text",
                text: "Demo of the `pxd` library",
                style: "body",
                x: 400, y: 250, anchorX: 0.5,
            },
            // A `slot` is a passive named mount point — the caller fills it.
            { id: "logoSlot", type: "slot", slot: "logo", x: 400, y: 360 },
        ],
    },
};

// -----------------------------------------------------------------------------
// 2) Patch document — same shape, different field values.
//    Applied to the live tree after a delay to demonstrate hot-reload semantics.
// -----------------------------------------------------------------------------

const patchedDoc: CoreDocument = {
    format: "pxd",
    version: 1,
    profile: "core",
    root: {
        id: "root",
        type: "container",
        children: [
            { id: "bg", type: "graphics", shape: "rect", width: 800, height: 600, fill: "#1f2937" },
            {
                id: "card",
                type: "graphics",
                shape: "roundRect",
                x: 80, y: 120, width: 640, height: 360,
                fill: "#1e293b", radius: 24,
            },
            {
                id: "title",
                type: "text",
                text: "Patched live",
                style: "h1",
                x: 400, y: 200, anchorX: 0.5,
            },
            {
                id: "subtitle",
                text: "`apply()` updated text + colours in place",
                type: "text",
                style: "body",
                x: 400, y: 250, anchorX: 0.5,
            },
            { id: "logoSlot", type: "slot", slot: "logo", x: 400, y: 360 },
        ],
    },
};

// -----------------------------------------------------------------------------
// 3) Boot.
// -----------------------------------------------------------------------------

async function run(): Promise<void> {
    const app = new Application();
    await app.init({ width: 800, height: 600, background: "#111827", antialias: true });
    document.getElementById("canvas-host")!.appendChild(app.canvas);

    const styleTable: Record<string, object> = {
        h1: { fill: "#ffffff", fontSize: 36, fontWeight: "700" },
        body: { fill: "#9ca3af", fontSize: 18 },
    };

    const resolve = {
        texture: () => Texture.WHITE,
        style: (id: string) => styleTable[id],
    };

    // Build a fresh Pixi tree from the document.
    const root = build(initialDoc, { resolve });
    app.stage.addChild(root);

    // `find` by dotted label path — labels come from `node.label ?? node.id`.
    const title = requirePath<Text>(root, "title");
    console.log("found title node:", title.label, title.text);

    // Mount external content into the `logo` slot. Slots are looked up by their
    // declared `slot` name, not by `id`.
    const logo = new Sprite(Texture.WHITE);
    logo.anchor.set(0.5);
    logo.width = 64;
    logo.height = 64;
    logo.tint = 0xfbbf24;
    mountSlot(root, "logo", logo);

    // After 2 seconds — hot-patch the tree with a new document. Same node ids
    // mean `apply` updates fields in place (no rebuild, slot content survives).
    setTimeout(() => {
        apply(patchedDoc, root, {
            resolve,
            onMissing: (path) => console.warn("pxd miss:", path),
        });
    }, 2000);
}

run().catch((err) => {
    console.error(err);
    const host = document.getElementById("canvas-host");
    if (host) host.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
});
