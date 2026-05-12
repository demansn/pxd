/**
 * Runtime tests for `build()` — registry, decisions, bindings, prefab scope.
 *
 * Uses `node:test`. Avoids Sprite/Text (which require canvas) by overriding
 * those types with Container stubs. Container and Graphics are
 * instantiable in Node without a renderer.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Container } from "pixi.js";

import { build } from "../src/build.js";
import type { NodeType, Resolvers } from "../src/context.js";
import { find, requirePath } from "../src/find.js";

const stub: NodeType = { create: () => new Container(), assign: () => {} };

const resolveStub: Resolvers = { texture: () => ({}) as never };

const stubNodeTypes = new Map<string, NodeType>([
    ["sprite", stub],
    ["text", stub],
]);

test("build: container with x picks decision branch by activeTags", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            x: { _: 100, mobile: 50 },
        },
    };
    const root = build(doc, { resolve: resolveStub, activeTags: ["mobile"] });
    assert.equal(root.x, 50);
});

test("build: label = node.label ?? node.id (§3.2)", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root_id",
            label: "rootLabel",
            type: "container",
            children: [
                { id: "child_id", type: "container" },
            ],
        },
    };
    const root = build(doc, { resolve: resolveStub });
    assert.equal(root.label, "rootLabel", "label preferred over id");
    assert.equal(root.children[0].label, "child_id", "fallback to id when no label");
});

test("build: find(root, dot.path) resolves by label", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "hud",
                    type: "container",
                    children: [
                        {
                            id: "bet",
                            type: "container",
                            children: [{ id: "value", type: "container" }],
                        },
                    ],
                },
            ],
        },
    };
    const root = build(doc, { resolve: resolveStub });
    const value = find(root, "hud.bet.value");
    assert.ok(value, "value found");
    assert.equal(value?.label, "value");
    assert.equal(find(root, "hud.missing"), null, "non-existent path → null");
    assert.throws(() => requirePath(root, "hud.missing"), /not found/);
});

test("build: custom node type for runtime-registered type", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "btn", type: "Button", props: { label: "OK" } }],
        },
    };
    let buttonCalled = 0;
    const buttonType: NodeType = {
        create: () => {
            buttonCalled++;
            return new Container();
        },
        assign: () => {},
    };
    const root = build(doc, {
        resolve: resolveStub,
        nodeTypes: new Map([["Button", buttonType]]),
    });
    assert.equal(buttonCalled, 1);
    assert.equal(root.children[0].label, "btn");
});

test("build: rotation in degrees → radians (§6)", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "container", rotation: 90 },
    };
    const root = build(doc, { resolve: resolveStub });
    assert.ok(Math.abs(root.rotation - Math.PI / 2) < 1e-9);
});

test("build: prefab instances have independent id scope (§13.2)", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        prefabs: {
            "Card": {
                id: "root",
                type: "container",
                children: [
                    { id: "frame", type: "container" },
                    { id: "label", type: "container" },
                ],
            },
        },
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "card1", type: "Card" },
                { id: "card2", type: "Card" },
            ],
        },
    };
    const root = build(doc, { resolve: resolveStub });
    assert.equal(root.children.length, 2);
    // Each card instance has its own 'frame' child — find returns the FIRST
    // one at the deepest segment under root.
    const card1Frame = find(root, "card1.frame");
    const card2Frame = find(root, "card2.frame");
    assert.ok(card1Frame, "card1.frame exists");
    assert.ok(card2Frame, "card2.frame exists");
    assert.notEqual(card1Frame, card2Frame, "independent instances");
});

test("build: prefab name collision with registered type throws (§12.1)", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        prefabs: { "container": { id: "root", type: "container" } },
        root: { id: "root", type: "container" },
    };
    assert.throws(
        () => build(doc, { resolve: resolveStub }),
        /collides with registered type/,
    );
});

test("build: §7.2 bindings applied to text content via stub type capture", () => {
    const captured: string[] = [];
    const captureText: NodeType = {
        create: (node, ctx) => {
            captured.push(ctx.readString(node.text as string));
            return new Container();
        },
        assign: () => {},
    };
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "lbl", type: "text", text: "{locale.greeting}, {settings.user}" }],
        },
    };
    const lookups: Record<string, string> = {
        "locale.greeting": "Hello",
        "settings.user": "Player",
    };
    build(doc, {
        resolve: { texture: () => ({}) as never, binding: (p) => lookups[p] ?? `[${p}]` },
        nodeTypes: new Map([["text", captureText]]),
    });
    assert.equal(captured[0], "Hello, Player");
});

test("build: base fields override NodeType.assign side effects (order contract)", () => {
    // Contract: dispatcher runs assign FIRST, applyBaseFields LAST.
    // Critical for Pixi: e.g. `sprite.width = N` mutates `scale.x`; an explicit
    // `scaleX` on the node must override that. We verify with `alpha` as a proxy
    // (works in Node without canvas).
    const doc = {
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
    const root = build(doc, {
        resolve: resolveStub,
        nodeTypes: new Map([["Button", buttonType]]),
    });
    assert.equal(root.alpha, 0.8, "applyBaseFields runs after assign — node.alpha wins");
});

test("build: mask is wired up (forward reference resolves)", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            mask: "maskSrc",
            children: [{ id: "maskSrc", type: "container" }],
        },
    };
    const root = build(doc, { resolve: resolveStub, nodeTypes: stubNodeTypes });
    assert.ok(root.mask, "mask attached");
    assert.equal((root.mask as Container).label, "maskSrc");
});
