/**
 * Tests for getSlot / mountSlot — slot-name lookup independent from label.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Container } from "pixi.js";

import { build } from "../src/build.js";
import type { Resolvers } from "../src/context.js";
import { getSlot, mountSlot } from "../src/slots.js";

const resolveStub: Resolvers = { texture: () => ({}) as never };

test("getSlot: finds slot Container by `slot` field name", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "boardSlot",
                    label: "boardArea",
                    type: "slot",
                    slot: "Board",
                },
            ],
        },
    };
    const root = build(doc, { resolve: resolveStub });
    const slot = getSlot(root, "Board");
    assert.ok(slot, "slot found");
    // Slot identification is by symbol tag, NOT by label
    assert.equal(slot?.label, "boardArea");
});

test("getSlot: returns null when slot name doesn't exist", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "container" },
    };
    const root = build(doc, { resolve: resolveStub });
    assert.equal(getSlot(root, "Nope"), null);
});

test("mountSlot: addChild into slot Container", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "boardSlot", type: "slot", slot: "Board" },
            ],
        },
    };
    const root = build(doc, { resolve: resolveStub });
    const content = new Container();
    content.label = "external";
    const slot = mountSlot(root, "Board", content);
    assert.equal(content.parent, slot);
    assert.ok(slot.children.includes(content));
});

test("mountSlot: throws when slot not found", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "container" },
    };
    const root = build(doc, { resolve: resolveStub });
    assert.throws(
        () => mountSlot(root, "Missing", new Container()),
        /slot 'Missing' not found/,
    );
});

test("getSlot: works for nested slots", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "panel",
                    type: "container",
                    children: [
                        { id: "deep", type: "slot", slot: "DeepSlot" },
                    ],
                },
            ],
        },
    };
    const root = build(doc, { resolve: resolveStub });
    const slot = getSlot(root, "DeepSlot");
    assert.ok(slot);
});
