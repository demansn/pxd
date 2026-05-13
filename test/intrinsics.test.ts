import assert from "node:assert/strict";
import { test } from "node:test";
import { Container } from "pixi.js";

import { build } from "../src/build.js";
import type { Resolvers } from "../src/context.js";
import { find } from "../src/find.js";
import { getSlot } from "../src/slots.js";

const resolveStub: Resolvers = { texture: () => ({}) as never };

test("intrinsic container: applies base fields and pivot fields", () => {
    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            x: 10,
            y: 20,
            scaleX: 2,
            scaleY: 3,
            alpha: 0.5,
            visible: false,
            zIndex: 7,
            pivotX: 11,
            pivotY: 12,
        },
    }, { resolve: resolveStub });

    assert.ok(root instanceof Container);
    assert.equal(root.x, 10);
    assert.equal(root.y, 20);
    assert.equal(root.scale.x, 2);
    assert.equal(root.scale.y, 3);
    assert.equal(root.alpha, 0.5);
    assert.equal(root.visible, false);
    assert.equal(root.zIndex, 7);
    assert.equal(root.pivot.x, 11);
    assert.equal(root.pivot.y, 12);
});

test("intrinsic slot: preserves declared width and height on empty slot", () => {
    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "boardSlot", type: "slot", slot: "Board", width: 600, height: 260 },
            ],
        },
    }, { resolve: resolveStub });

    const slot = getSlot(root, "Board");
    assert.ok(slot, "slot found by symbol tag");
    assert.equal(slot.width, 600);
    assert.equal(slot.height, 260);
    assert.equal(find(root, "boardSlot"), slot);
});
