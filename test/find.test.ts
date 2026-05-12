/**
 * Tests for find / findAll / requirePath — label-path traversal API.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Container } from "pixi.js";

import { find, findAll, requirePath } from "../src/find.js";

function make(label: string, ...children: Container[]): Container {
    const c = new Container();
    c.label = label;
    for (const child of children) c.addChild(child);
    return c;
}

test("find: returns null for unknown segment", () => {
    const root = make("root", make("hud"));
    assert.equal(find(root, "missing"), null);
    assert.equal(find(root, "hud.missing"), null);
});

test("find: returns nested container by dot-path", () => {
    const value = make("value");
    const root = make("root", make("hud", make("bet", value)));
    const hit = find(root, "hud.bet.value");
    assert.equal(hit, value);
});

test("findAll: returns every match at the final segment", () => {
    const a1 = make("a"), a2 = make("a"), a3 = make("a");
    const root = make("root", make("g1", a1, a2), make("g2", a3));
    const all = findAll(root, "g1.a");
    assert.equal(all.length, 2);
    assert.ok(all.includes(a1));
    assert.ok(all.includes(a2));
    assert.ok(!all.includes(a3));
});

test("requirePath: throws on miss with path in message", () => {
    const root = make("root");
    assert.throws(() => requirePath(root, "hud.bet"), /'hud\.bet'/);
});

test("requirePath: returns same Container on hit", () => {
    const value = make("value");
    const root = make("root", make("hud", value));
    assert.equal(requirePath(root, "hud.value"), value);
});
