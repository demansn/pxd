/**
 * Runtime tests for `apply()` — matching, missing nodes, type-mismatch, re-resolution.
 *
 * Uses container-only stubs for sprite/text to avoid canvas dependency.
 * Tests verify the dispatch contract directly: base fields apply, custom
 * `assign` fires, missing nodes trigger callbacks, mask is rewired.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Container } from "pixi.js";

import { apply } from "../src/apply.js";
import { build } from "../src/build.js";
import type { NodeType, Resolvers } from "../src/context.js";
import { find } from "../src/find.js";

const resolveStub: Resolvers = { texture: () => ({}) as never };

// Stub node types: Container instead of Sprite/Text so we can run in Node
// without a canvas. Apply will then see Container, not Sprite — type-specific
// fields are silently skipped, but base fields still flow through.
const stubNodeTypes = new Map<string, NodeType>([
    ["sprite", { create: () => new Container(), assign: () => {} }],
    ["text", { create: () => new Container(), assign: () => {} }],
]);

test("apply: patches x on existing label-path match", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "bg", type: "container", x: 100 }],
        },
    };
    const root = build(buildDoc, { resolve: resolveStub });

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "bg", type: "container", x: 250 }],
        },
    };
    const count = apply(patchDoc, root);
    assert.equal(count, 2, "patched root + bg");
    assert.equal(find(root, "bg")?.x, 250);
});

test("apply: missing PXD node calls onMissing and continues", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "container", children: [{ id: "a", type: "container" }] },
    };
    const root = build(buildDoc, { resolve: resolveStub });

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "a", type: "container", x: 10 },
                { id: "ghost", type: "container", x: 20 },
            ],
        },
    };
    const missed: Array<{ path: string; nodeId: string }> = [];
    const count = apply(patchDoc, root, {
        onMissing: (path, nodeId) => missed.push({ path, nodeId }),
    });
    assert.equal(count, 2, "patched root + a (ghost skipped)");
    assert.equal(missed.length, 1);
    assert.equal(missed[0].nodeId, "ghost");
    assert.equal(missed[0].path, "root.ghost");
    assert.equal(find(root, "a")?.x, 10);
});

test("apply: type-mismatch silent skip of type-specific fields, base fields still flow", () => {
    // build with container stub for sprite (target = Container, not Sprite)
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "logo", type: "sprite", texture: "old_texture", x: 10 }],
        },
    };
    const root = build(buildDoc, { resolve: resolveStub, nodeTypes: stubNodeTypes });
    const logo = find(root, "logo")!;
    assert.equal(logo.x, 10);

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "logo", type: "sprite", texture: "NEW_TEXTURE", x: 99 }],
        },
    };

    // Track if texture resolver is called — it should NOT be (target is plain Container).
    let textureResolverCalled = 0;
    const count = apply(patchDoc, root, {
        resolve: {
            texture: () => {
                textureResolverCalled++;
                return {} as never;
            },
        },
    });
    assert.equal(count, 2);
    assert.equal(logo.x, 99, "base field 'x' applied even though target is Container");
    assert.equal(
        textureResolverCalled,
        0,
        "type-specific 'texture' silently skipped — target isn't Sprite",
    );
});

test("apply: re-resolves decision values against new activeTags", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            x: { _: 100, mobile: 50 },
        },
    };
    const root = build(doc, { resolve: resolveStub, activeTags: [] });
    assert.equal(root.x, 100, "default branch picked initially");

    apply(doc, root, { activeTags: ["mobile"] });
    assert.equal(root.x, 50, "mobile branch picked after apply");
});

test("apply: re-resolves bindings via custom assign capture", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "lbl", type: "text", text: "{locale.title}" }],
        },
    };
    const root = build(doc, { resolve: resolveStub, nodeTypes: stubNodeTypes });

    // Custom node type whose `assign` captures the resolved text into a side-channel.
    // `create` is not invoked by apply but the field is mandatory.
    const captured: string[] = [];
    const captureText: NodeType = {
        create: () => new Container(),
        assign: (n, _t, ctx) => {
            captured.push(ctx.readString(n.text as string));
        },
    };
    apply(doc, root, {
        resolve: { binding: (p) => (p === "locale.title" ? "Привет" : `[${p}]`) },
        nodeTypes: new Map([["text", captureText]]),
    });
    assert.equal(captured[0], "Привет");
});

test("apply: base fields override NodeType.assign side effects (order contract)", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "Button" },
    };
    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "Button", alpha: 0.8 },
    };
    const buttonType: NodeType = {
        create: () => new Container(),
        assign: (_n, target) => {
            target.alpha = 0.5;
        },
    };
    const root = build(buildDoc, {
        resolve: resolveStub,
        nodeTypes: new Map([["Button", buttonType]]),
    });
    apply(patchDoc, root, { nodeTypes: new Map([["Button", buttonType]]) });
    assert.equal(root.alpha, 0.8, "applyBaseFields runs after assign — node.alpha wins");
});

test("apply: mask rebound by id lookup in existing tree", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "mask1", type: "container" },
                { id: "mask2", type: "container" },
                { id: "panel", type: "container", mask: "mask1" },
            ],
        },
    };
    const root = build(buildDoc, { resolve: resolveStub });
    const panel = find(root, "panel")!;
    const mask1 = find(root, "mask1")!;
    const mask2 = find(root, "mask2")!;
    assert.equal(panel.mask, mask1);

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "panel", type: "container", mask: "mask2" }],
        },
    };
    apply(patchDoc, root);
    assert.equal(panel.mask, mask2, "mask rebound to mask2 by id");
});

test("apply: scene-shape doc is rejected (out of scope)", () => {
    const sceneDoc = {
        format: "pxd" as const,
        version: 1 as const,
        scenes: { Main: { modes: { default: { id: "root", type: "container" } } } },
    };
    const root = new Container();
    root.label = "root";
    assert.throws(() => apply(sceneDoc, root), /scene-shape/);
});
