import assert from "node:assert/strict";
import { test } from "node:test";
import {
    AnimatedSprite,
    BitmapText,
    Container,
    NineSliceSprite,
    Sprite,
    Text,
    Texture,
    TilingSprite,
    type Graphics,
} from "pixi.js";

import { build } from "../src/build.js";
import type { NodeType, Resolvers } from "../src/context.js";
import type { ResolvedNode } from "../src/types.js";
import { drawShape } from "../src/nodeTypes.js";
import { validate, ValidationError } from "../src/validate.js";
import { find } from "../src/find.js";
import { getSlot } from "../src/slots.js";

const resolveStub: Resolvers = { texture: () => ({}) as never };

class FakeCanvasRenderingContext2D {
    font = "";
    letterSpacing = "0px";

    measureText(value: string): TextMetrics {
        return {
            width: value.length * 10,
            actualBoundingBoxAscent: 10,
            actualBoundingBoxDescent: 2,
            fontBoundingBoxAscent: 10,
            fontBoundingBoxDescent: 2,
        } as TextMetrics;
    }
}

function installTextCanvasShim(): void {
    const globals = globalThis as unknown as Record<string, unknown>;
    globals.CanvasRenderingContext2D ??= FakeCanvasRenderingContext2D;
    globals.document ??= {
        createElement: () => ({
            getContext: () => new FakeCanvasRenderingContext2D(),
        }),
    };
}

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

test("intrinsic sprite: applies texture, tint, size, and anchor", () => {
    const texture = Texture.WHITE;
    const calls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "logo",
            type: "sprite",
            texture: "atlas/logo_idle",
            tint: "#ff00ff",
            width: 123,
            height: 45,
            anchorX: 0.25,
            anchorY: 0.75,
        },
    }, {
        resolve: {
            texture: (id) => {
                calls.push(id);
                return texture;
            },
        },
    });

    assert.ok(root instanceof Sprite);
    assert.deepEqual(calls, ["atlas/logo_idle"]);
    assert.equal(root.texture, texture);
    assert.equal(root.tint, 0xff00ff);
    assert.equal(root.width, 123);
    assert.equal(root.height, 45);
    assert.equal(root.anchor.x, 0.25);
    assert.equal(root.anchor.y, 0.75);
});

test("intrinsic sprite: explicit scale base fields override width and height side effects", () => {
    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "logo",
            type: "sprite",
            texture: "logo",
            width: 100,
            height: 50,
            scaleX: 2,
            scaleY: 3,
        },
    }, { resolve: { texture: () => Texture.EMPTY } });

    assert.ok(root instanceof Sprite);
    assert.equal(root.scale.x, 2);
    assert.equal(root.scale.y, 3);
});

test("intrinsic nineSliceSprite: applies texture, borders, size, and anchor", () => {
    const texture = Texture.WHITE;
    const calls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "panel",
            type: "nineSliceSprite",
            texture: "ui/panel",
            width: 320,
            height: 120,
            leftWidth: 12,
            topHeight: 14,
            rightWidth: 16,
            bottomHeight: 18,
            anchorX: 0.5,
            anchorY: 1,
        },
    }, {
        resolve: {
            texture: (id) => {
                calls.push(id);
                return texture;
            },
        },
    });

    assert.ok(root instanceof NineSliceSprite);
    assert.deepEqual(calls, ["ui/panel"]);
    assert.equal(root.texture, texture);
    assert.equal(root.width, 320);
    assert.equal(root.height, 120);
    assert.equal(root.leftWidth, 12);
    assert.equal(root.topHeight, 14);
    assert.equal(root.rightWidth, 16);
    assert.equal(root.bottomHeight, 18);
    assert.equal(root.anchor.x, 0.5);
    assert.equal(root.anchor.y, 1);
});

test("intrinsic nineSliceSprite: resolves decisions and bindings before texture resolver", () => {
    const calls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "panel",
            type: "nineSliceSprite",
            texture: { _: "panel_{theme}", dark: "panel_dark_{theme}" },
            width: { _: 200, mobile: 160 },
        },
    }, {
        activeTags: ["dark", "mobile"],
        resolve: {
            texture: (id) => {
                calls.push(id);
                return Texture.WHITE;
            },
            binding: (path) => path === "theme" ? "blue" : `[${path}]`,
        },
    });

    assert.ok(root instanceof NineSliceSprite);
    assert.deepEqual(calls, ["panel_dark_blue"]);
    assert.equal(root.width, 160);
});

test("intrinsic tilingSprite: applies texture, area, tile transform, and anchor", () => {
    const texture = Texture.WHITE;
    const calls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "bg",
            type: "tilingSprite",
            texture: "patterns/checker_{theme}",
            width: 800,
            height: 600,
            tilePositionX: 12,
            tilePositionY: 24,
            tileScaleX: 2,
            tileScaleY: 3,
            tileRotation: 90,
            applyAnchorToTexture: true,
            anchorX: 0.5,
            anchorY: 0.25,
        },
    }, {
        resolve: {
            texture: (id) => {
                calls.push(id);
                return texture;
            },
            binding: (path) => path === "theme" ? "dark" : `[${path}]`,
        },
    });

    assert.ok(root instanceof TilingSprite);
    assert.deepEqual(calls, ["patterns/checker_dark"]);
    assert.equal(root.texture, texture);
    assert.equal(root.width, 800);
    assert.equal(root.height, 600);
    assert.equal(root.tilePosition.x, 12);
    assert.equal(root.tilePosition.y, 24);
    assert.equal(root.tileScale.x, 2);
    assert.equal(root.tileScale.y, 3);
    assert.ok(Math.abs(root.tileRotation - Math.PI / 2) < 1e-9);
    assert.equal(root.applyAnchorToTexture, true);
    assert.equal(root.anchor.x, 0.5);
    assert.equal(root.anchor.y, 0.25);
});

test("intrinsic animatedSprite: applies textures, playback fields, size, tint, and anchor", () => {
    const frames = [Texture.WHITE, Texture.EMPTY];
    const calls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "hero",
            type: "animatedSprite",
            textures: ["hero/{state}/0", "hero/{state}/1"],
            animationSpeed: 0.25,
            loop: false,
            autoUpdate: false,
            updateAnchor: true,
            playing: true,
            tint: "#00ff00",
            width: 64,
            height: 32,
            anchorX: 0.5,
            anchorY: 1,
        },
    }, {
        resolve: {
            texture: (id) => {
                calls.push(id);
                return frames[calls.length - 1] ?? Texture.EMPTY;
            },
            binding: (path) => path === "state" ? "walk" : `[${path}]`,
        },
    });

    assert.ok(root instanceof AnimatedSprite);
    assert.deepEqual(calls, ["hero/walk/0", "hero/walk/1"]);
    assert.equal(root.totalFrames, 2);
    assert.equal(root.animationSpeed, 0.25);
    assert.equal(root.loop, false);
    assert.equal(root.autoUpdate, false);
    assert.equal(root.updateAnchor, true);
    assert.equal(root.playing, true);
    assert.equal(root.tint, 0x00ff00);
    assert.equal(root.width, 64);
    assert.equal(root.height, 32);
    assert.equal(root.anchor.x, 0.5);
    assert.equal(root.anchor.y, 1);
    root.stop();
});

test("intrinsic text: applies text, resolved style, maxWidth wrapping, and anchor", () => {
    installTextCanvasShim();
    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "title",
            type: "text",
            text: "Hello {player}",
            style: "titleStyle",
            maxWidth: 180,
            anchorX: 0.5,
            anchorY: 1,
        },
    }, {
        resolve: {
            texture: () => Texture.EMPTY,
            binding: (path) => path === "player" ? "Ada" : `[${path}]`,
            style: (id) => id === "titleStyle" ? { fontSize: 32, fill: "#ffffff" } : undefined,
        },
    });

    assert.ok(root instanceof Text);
    assert.equal(root.text, "Hello Ada");
    assert.equal(root.style.fontSize, 32);
    assert.equal(root.style.fill, "#ffffff");
    assert.equal(root.style.wordWrap, true);
    assert.equal(root.style.wordWrapWidth, 180);
    assert.equal(root.anchor.x, 0.5);
    assert.equal(root.anchor.y, 1);
});

test("intrinsic bitmapText: applies text, resolved style, maxWidth wrapping, and anchor", () => {
    installTextCanvasShim();

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "score",
            type: "bitmapText",
            text: "Score: {score}",
            style: "scoreStyle",
            maxWidth: 240,
            anchorX: 1,
            anchorY: 0.5,
        },
    }, {
        resolve: {
            texture: () => Texture.EMPTY,
            binding: (path) => path === "score" ? "1200" : `[${path}]`,
            style: (id) => id === "scoreStyle"
                ? { fontFamily: "Arial", fontSize: 32, fill: "#ffff00" }
                : undefined,
        },
    });

    assert.ok(root instanceof BitmapText);
    assert.equal(root.text, "Score: 1200");
    assert.equal(root.style.fontFamily, "Arial");
    assert.equal(root.style.fontSize, 32);
    assert.equal(root.style.fill, "#ffff00");
    assert.equal(root.style.wordWrap, true);
    assert.equal(root.style.wordWrapWidth, 240);
    assert.equal(root.anchor.x, 1);
    assert.equal(root.anchor.y, 0.5);
});

function makeGraphicsRecorder(): { graphics: Graphics; calls: unknown[][] } {
    const calls: unknown[][] = [];
    const graphics = {
        rect: (...args: unknown[]) => { calls.push(["rect", ...args]); return graphics; },
        roundRect: (...args: unknown[]) => { calls.push(["roundRect", ...args]); return graphics; },
        circle: (...args: unknown[]) => { calls.push(["circle", ...args]); return graphics; },
        ellipse: (...args: unknown[]) => { calls.push(["ellipse", ...args]); return graphics; },
        poly: (...args: unknown[]) => { calls.push(["poly", ...args]); return graphics; },
        fill: (...args: unknown[]) => { calls.push(["fill", ...args]); return graphics; },
        stroke: (...args: unknown[]) => { calls.push(["stroke", ...args]); return graphics; },
    } as unknown as Graphics;
    return { graphics, calls };
}

test("intrinsic graphics: drawShape emits rect, roundRect, circle, ellipse, and polygon calls", () => {
    const cases: Array<{ node: ResolvedNode; expected: unknown[] }> = [
        { node: { id: "g", type: "graphics", shape: "rect", width: 10, height: 20 }, expected: ["rect", 0, 0, 10, 20] },
        { node: { id: "g", type: "graphics", shape: "roundRect", width: 10, height: 20, radius: 3 }, expected: ["roundRect", 0, 0, 10, 20, 3] },
        { node: { id: "g", type: "graphics", shape: "circle", radius: 7 }, expected: ["circle", 0, 0, 7] },
        { node: { id: "g", type: "graphics", shape: "ellipse", width: 10, height: 20 }, expected: ["ellipse", 0, 0, 5, 10] },
        { node: { id: "g", type: "graphics", shape: "polygon", points: [0, 0, 10, 0, 10, 10] }, expected: ["poly", [0, 0, 10, 0, 10, 10]] },
    ];

    for (const c of cases) {
        const { graphics, calls } = makeGraphicsRecorder();
        drawShape(graphics, c.node, (value) => value);
        assert.deepEqual(calls[0], c.expected);
    }
});

test("intrinsic graphics: drawShape resolves string fill and stroke", () => {
    const { graphics, calls } = makeGraphicsRecorder();

    drawShape(graphics, {
        id: "g",
        type: "graphics",
        shape: "rect",
        width: 10,
        height: 20,
        fill: "{color.fill}",
        stroke: "{color.stroke}",
        strokeWidth: 4,
    }, (value) => value.replace("{color.fill}", "#112233").replace("{color.stroke}", "#445566"));

    assert.deepEqual(calls, [
        ["rect", 0, 0, 10, 20],
        ["fill", "#112233"],
        ["stroke", { color: "#445566", width: 4 }],
    ]);
});

test("validate: graphics rejects unknown literal shape", () => {
    assert.throws(
        () => validate({
            format: "pxd",
            version: 1,
            root: { id: "bad", type: "graphics", shape: "triangle" },
        }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 7"
            && /unknown graphics shape 'triangle'/.test(error.message),
    );
});

test("validate: graphics rejects shape-specific no-op fields for literal shapes", () => {
    assert.throws(
        () => validate({
            format: "pxd",
            version: 1,
            root: { id: "bad", type: "graphics", shape: "rect", width: 10, height: 20, radius: 4 },
        }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 7"
            && /field 'radius'.*not used by graphics shape 'rect'/.test(error.message),
    );
});

test("validate: expanded intrinsics reject missing required fields", () => {
    assert.throws(
        () => validate({ format: "pxd", version: 1, root: { id: "bad", type: "tilingSprite" } }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 7"
            && /tilingSprite node 'bad' must have string 'texture'/.test(error.message),
    );
    assert.throws(
        () => validate({ format: "pxd", version: 1, root: { id: "bad", type: "animatedSprite" } }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 7"
            && /animatedSprite node 'bad' must have non-empty string array 'textures'/.test(error.message),
    );
    assert.throws(
        () => validate({ format: "pxd", version: 1, root: { id: "bad", type: "bitmapText" } }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 7"
            && /bitmapText node 'bad' must have string 'text'/.test(error.message),
    );
});

test("validate: expanded intrinsics reject unknown fields and children", () => {
    assert.throws(
        () => validate({
            format: "pxd",
            version: 1,
            root: { id: "bad", type: "tilingSprite", texture: "bg", children: [] },
        }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 8"
            && /intrinsic type 'tilingSprite'.*must not have 'children'/.test(error.message),
    );
    assert.throws(
        () => validate({
            format: "pxd",
            version: 1,
            root: { id: "bad", type: "bitmapText", text: "Hi", fit: "shrink" },
        }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 7"
            && /intrinsic bitmapText node 'bad' has unknown field 'fit'/.test(error.message),
    );
});

test("spine is a custom node type, not an intrinsic with required skeleton fields", () => {
    let capturedAnimation: unknown;
    const spineType: NodeType = {
        create: () => new Container(),
        assign: (node) => {
            capturedAnimation = node.animation;
        },
    };

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "hero", type: "spine", animation: "idle" },
    }, {
        resolve: resolveStub,
        nodeTypes: new Map([["spine", spineType]]),
    });

    assert.equal(root.label, "hero");
    assert.equal(capturedAnimation, "idle");
});
