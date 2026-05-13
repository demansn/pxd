# Pixi Expanded Intrinsics Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add strict built-in support for `tilingSprite`, `animatedSprite`, and `bitmapText` PXD intrinsic node types.

**Architecture:** Keep the existing registry architecture: each intrinsic is a hand-written `NodeType { create, assign }` in `src/nodeTypes.ts`, with build/apply dispatch order unchanged (`assign` first, base fields last). Extend the vendored TypeScript node model, semantic validator, JSON Schema, fixtures, and docs in lockstep; do not introduce the TODO §5 descriptor layer in this plan.

**Tech Stack:** TypeScript, PixiJS v8.7 (`TilingSprite`, `AnimatedSprite`, `BitmapText`), Node `node:test`, Ajv JSON Schema draft 2020-12.

---

## Pre-analysis notes

Pixi API cross-check was done against the installed `pixi.js@8.7.0` types/docs in `node_modules/pixi.js/lib/...`, which mirror the release docs at `https://pixijs.download/release/docs/index.html`:

- `TilingSprite` constructor supports `{ texture, width, height, tilePosition, tileScale, tileRotation, anchor, applyAnchorToTexture }`; `tileRotation` is Pixi radians. PXD should expose `tileRotation` in **degrees** for consistency with base `rotation` (§6), then convert to radians in `nodeTypes.ts`.
- `AnimatedSprite` requires a non-empty frame collection (`Texture[]` or frame objects), has mutable `textures`, `animationSpeed`, `loop`, `autoUpdate`, `updateAnchor`, and playback methods `play()` / `stop()`. PXD should keep v1 simple: required `textures: string[]`, no per-frame timing objects, and optional `playing` boolean for build/apply patch semantics.
- `BitmapText` uses the same high-level `TextOptions` shape as `Text`: `{ text, style }`, has a mutable `style`, and supports word-wrap via `style.wordWrap` + `style.wordWrapWidth`. Reuse `text` semantics: `text`, `style` string id, `maxWidth`, `anchorX`, `anchorY`.

Current worktree note: `nineSliceSprite` is already in progress in this repository. Before starting this plan, either finish/commit that work or run this plan in a worktree where `nineSliceSprite` is already green. Do not overwrite unrelated uncommitted changes.

## Chosen PXD field semantics

### `tilingSprite`

```ts
{
  type: "tilingSprite",
  texture: string,              // required; resolver id, binding-supported
  width?: number,
  height?: number,
  tilePositionX?: number,
  tilePositionY?: number,
  tileScaleX?: number,
  tileScaleY?: number,
  tileRotation?: number,        // degrees in PXD; converted to Pixi radians
  applyAnchorToTexture?: boolean,
  anchorX?: number,
  anchorY?: number
}
```

### `animatedSprite`

```ts
{
  type: "animatedSprite",
  textures: string[],           // required non-empty resolver ids; each string binding-supported
  tint?: string | number,
  width?: number,
  height?: number,
  anchorX?: number,
  anchorY?: number,
  animationSpeed?: number,
  loop?: boolean,
  autoUpdate?: boolean,
  updateAnchor?: boolean,
  playing?: boolean             // true => play(), false => stop(); absent => patch-only no-op
}
```

### `bitmapText`

```ts
{
  type: "bitmapText",
  text: string,                 // required; binding-supported
  style?: string,               // style resolver id
  maxWidth?: number,            // maps to wordWrap + wordWrapWidth
  anchorX?: number,
  anchorY?: number
}
```

All three are strict, non-composable intrinsic leaf nodes (`children` forbidden by §10 rule 8).

---

### Task 0: Baseline safety check

**Files:**
- Read/verify only: `TODO.md`
- Read/verify only: `src/nodeTypes.ts`
- Read/verify only: `src/validate.ts`
- Read/verify only: `pxd.schema.json`
- Read/verify only: `doc/pxd-v1.md`

**Step 1: Check worktree state**

Run:

```bash
git status --short
```

Expected: either clean, or only known `nineSliceSprite` work that the owner agrees to include before this plan. If unrelated files are modified, stop and ask before editing.

**Step 2: Verify existing tests pass before adding new failures**

Run:

```bash
npm test
```

Expected: all tests pass. If this fails, fix/commit the baseline first; do not debug new intrinsics on top of a red baseline.

**Step 3: Commit baseline if needed**

If `nineSliceSprite` work is still uncommitted but green, commit it before this plan:

```bash
git add src/types.ts src/nodeTypes.ts src/validate.ts pxd.schema.json test/intrinsics.test.ts test/apply.test.ts doc/fixtures README.md TODO.md doc/pxd-v1.md README.md
git commit -m "feat: add nineSliceSprite intrinsic"
```

Expected: either a commit is created, or there was nothing to commit. Adjust the `git add` list to actual changed files; do not stage unrelated user changes.

---

### Task 1: Add failing build/runtime tests for the three new intrinsics

**Files:**
- Modify: `test/intrinsics.test.ts`

**Step 1: Extend Pixi imports**

Replace the import from `pixi.js` in `test/intrinsics.test.ts` with:

```ts
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
```

**Step 2: Add `tilingSprite` build test after the `nineSliceSprite` tests**

```ts
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
```

**Step 3: Add `animatedSprite` build test after the `tilingSprite` test**

```ts
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
```

**Step 4: Add `bitmapText` build test after the regular `text` test**

```ts
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
```

**Step 5: Run tests to verify they fail**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js
```

Expected: FAIL. At least one new test fails because `tilingSprite`, `animatedSprite`, and `bitmapText` are not registered in `defaultNodeTypes` yet (likely `no node type registered for ...`).

**Step 6: Commit failing tests**

```bash
git add test/intrinsics.test.ts
git commit -m "test: cover expanded Pixi intrinsics"
```

---

### Task 2: Add failing apply tests for patch semantics

**Files:**
- Modify: `test/apply.test.ts`

**Step 1: Extend Pixi imports**

Replace the Pixi import in `test/apply.test.ts` with:

```ts
import { AnimatedSprite, BitmapText, Container, NineSliceSprite, Texture, TilingSprite } from "pixi.js";
```

**Step 2: Add a BitmapText canvas shim near the top of `test/apply.test.ts`**

```ts
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
```

**Step 3: Add `tilingSprite` apply test after the existing `nineSliceSprite` apply test**

```ts
test("apply: patches tilingSprite type-specific fields", () => {
    const oldTexture = Texture.EMPTY;
    const newTexture = Texture.WHITE;
    const textureCalls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "bg",
            type: "tilingSprite",
            texture: "oldBg",
            width: 100,
            height: 80,
            tilePositionX: 1,
            tilePositionY: 2,
        },
    }, { resolve: { texture: () => oldTexture } });

    assert.ok(root instanceof TilingSprite);

    const count = apply({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "bg",
            type: "tilingSprite",
            texture: "newBg",
            width: 300,
            height: 200,
            tilePositionX: 11,
            tilePositionY: 22,
            tileScaleX: 2,
            tileScaleY: 3,
            tileRotation: 180,
            applyAnchorToTexture: true,
            anchorX: 0.5,
            anchorY: 1,
            x: 40,
        },
    }, root, {
        resolve: {
            texture: (id) => {
                textureCalls.push(id);
                return newTexture;
            },
        },
    });

    assert.equal(count, 1);
    assert.deepEqual(textureCalls, ["newBg"]);
    assert.equal(root.texture, newTexture);
    assert.equal(root.width, 300);
    assert.equal(root.height, 200);
    assert.equal(root.tilePosition.x, 11);
    assert.equal(root.tilePosition.y, 22);
    assert.equal(root.tileScale.x, 2);
    assert.equal(root.tileScale.y, 3);
    assert.ok(Math.abs(root.tileRotation - Math.PI) < 1e-9);
    assert.equal(root.applyAnchorToTexture, true);
    assert.equal(root.anchor.x, 0.5);
    assert.equal(root.anchor.y, 1);
    assert.equal(root.x, 40, "base fields still apply after type-specific assign");
});
```

**Step 4: Add `animatedSprite` apply test**

```ts
test("apply: patches animatedSprite textures and playback fields", () => {
    const oldTexture = Texture.EMPTY;
    const newFrames = [Texture.WHITE, Texture.EMPTY];
    const textureCalls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "hero",
            type: "animatedSprite",
            textures: ["oldHero"],
            autoUpdate: false,
            playing: true,
        },
    }, { resolve: { texture: () => oldTexture } });

    assert.ok(root instanceof AnimatedSprite);
    assert.equal(root.playing, true);

    const count = apply({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "hero",
            type: "animatedSprite",
            textures: ["newHero0", "newHero1"],
            animationSpeed: 0.5,
            loop: false,
            autoUpdate: false,
            updateAnchor: true,
            playing: false,
            tint: "#ff00ff",
            anchorX: 0.25,
            anchorY: 0.75,
            x: 9,
        },
    }, root, {
        resolve: {
            texture: (id) => {
                textureCalls.push(id);
                return newFrames[textureCalls.length - 1] ?? Texture.EMPTY;
            },
        },
    });

    assert.equal(count, 1);
    assert.deepEqual(textureCalls, ["newHero0", "newHero1"]);
    assert.equal(root.totalFrames, 2);
    assert.equal(root.animationSpeed, 0.5);
    assert.equal(root.loop, false);
    assert.equal(root.autoUpdate, false);
    assert.equal(root.updateAnchor, true);
    assert.equal(root.playing, false);
    assert.equal(root.tint, 0xff00ff);
    assert.equal(root.anchor.x, 0.25);
    assert.equal(root.anchor.y, 0.75);
    assert.equal(root.x, 9);
});
```

**Step 5: Add `bitmapText` apply test**

```ts
test("apply: patches bitmapText text, style, maxWidth, and anchor", () => {
    installTextCanvasShim();

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "score",
            type: "bitmapText",
            text: "Old",
            style: "oldStyle",
        },
    }, {
        resolve: {
            texture: () => Texture.EMPTY,
            style: () => ({ fontFamily: "Arial", fontSize: 16, fill: "#ffffff" }),
        },
    });

    assert.ok(root instanceof BitmapText);

    const count = apply({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "score",
            type: "bitmapText",
            text: "Score: {score}",
            style: "newStyle",
            maxWidth: 180,
            anchorX: 1,
            anchorY: 0.5,
            y: 12,
        },
    }, root, {
        resolve: {
            binding: (path) => path === "score" ? "900" : `[${path}]`,
            style: (id) => id === "newStyle"
                ? { fontFamily: "Arial", fontSize: 24, fill: "#00ffff" }
                : undefined,
        },
    });

    assert.equal(count, 1);
    assert.equal(root.text, "Score: 900");
    assert.equal(root.style.fontSize, 24);
    assert.equal(root.style.fill, "#00ffff");
    assert.equal(root.style.wordWrap, true);
    assert.equal(root.style.wordWrapWidth, 180);
    assert.equal(root.anchor.x, 1);
    assert.equal(root.anchor.y, 0.5);
    assert.equal(root.y, 12);
});
```

**Step 6: Run tests to verify they fail**

Run:

```bash
npx tsc && node --test dist/test/apply.test.js
```

Expected: FAIL before implementation because build/apply cannot create or assign the new intrinsic types.

**Step 7: Commit failing apply tests**

```bash
git add test/apply.test.ts
git commit -m "test: cover apply for expanded Pixi intrinsics"
```

---

### Task 3: Extend TypeScript node model

**Files:**
- Modify: `src/types.ts`

**Step 1: Add node interfaces after `NineSliceSpriteNode`**

```ts
export interface TilingSpriteNode extends BaseNode {
    type: "tilingSprite";
    texture: Decidable<string>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    tilePositionX?: Decidable<number>;
    tilePositionY?: Decidable<number>;
    tileScaleX?: Decidable<number>;
    tileScaleY?: Decidable<number>;
    /** Tiling texture rotation in degrees; converted to Pixi radians by the reader. */
    tileRotation?: Decidable<number>;
    applyAnchorToTexture?: Decidable<boolean>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}

export interface AnimatedSpriteNode extends BaseNode {
    type: "animatedSprite";
    /** Static frame texture ids. Bindings resolve per string; decision maps are not supported inside arrays. */
    textures: string[];
    tint?: Decidable<string> | Decidable<number>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    animationSpeed?: Decidable<number>;
    loop?: Decidable<boolean>;
    autoUpdate?: Decidable<boolean>;
    updateAnchor?: Decidable<boolean>;
    /** Patch-friendly playback control: true => play(), false => stop(), absent => leave as-is. */
    playing?: Decidable<boolean>;
    children?: never;
}

export interface BitmapTextNode extends BaseNode {
    type: "bitmapText";
    text: Decidable<string>;
    style?: Decidable<string>;
    maxWidth?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}
```

**Step 2: Add the interfaces to `IntrinsicNode` union**

```ts
export type IntrinsicNode =
    | ContainerNode
    | SpriteNode
    | NineSliceSpriteNode
    | TilingSpriteNode
    | AnimatedSpriteNode
    | TextNode
    | BitmapTextNode
    | GraphicsNode
    | SlotNode;
```

**Step 3: Build to verify type errors remain implementation-related**

Run:

```bash
npx tsc
```

Expected: likely FAIL until runtime implementation imports/classes are added, or PASS if tests still only use unknown docs. Continue either way.

**Step 4: Commit types**

```bash
git add src/types.ts
git commit -m "feat: add expanded intrinsic node types"
```

---

### Task 4: Implement default Pixi `NodeType`s

**Files:**
- Modify: `src/nodeTypes.ts`

**Step 1: Replace Pixi imports**

Use this import block:

```ts
import {
    AnimatedSprite,
    BitmapText,
    Container,
    Graphics,
    NineSliceSprite,
    Sprite,
    Text,
    Texture,
    TilingSprite,
} from "pixi.js";
```

**Step 2: Add a local degrees-to-radians constant after imports**

```ts
const DEG_TO_RAD = Math.PI / 180;
```

Do not import this from `build.ts`; `build.ts` already imports `nodeTypes.ts`, so that would create a cycle.

**Step 3: Update anchor helper signature**

Replace `setAnchorFromNode` with:

```ts
type Anchorable = Sprite | Text | NineSliceSprite | TilingSprite | BitmapText;

/** Apply `anchorX` / `anchorY` from a node to any object that has a Pixi `anchor`. */
export function setAnchorFromNode(target: Anchorable, node: ResolvedNode): void {
    if (node.anchorX === undefined && node.anchorY === undefined) return;
    target.anchor.set(
        (node.anchorX as number | undefined) ?? 0,
        (node.anchorY as number | undefined) ?? 0,
    );
}
```

`AnimatedSprite` extends `Sprite`, so it is already covered by `Sprite`.

**Step 4: Generalize text helpers**

Replace `applyTextMaxWidth` signature with:

```ts
function applyTextMaxWidth(node: ResolvedNode, target: Text | BitmapText): void {
    if (typeof node.maxWidth !== "number") return;
    target.style.wordWrap = true;
    target.style.wordWrapWidth = node.maxWidth;
}
```

**Step 5: Add `tilingSprite` helper and node type after `nineSliceSprite`**

```ts
function assignTilingSpriteTileFields(node: ResolvedNode, target: TilingSprite): void {
    if (typeof node.tilePositionX === "number") target.tilePosition.x = node.tilePositionX;
    if (typeof node.tilePositionY === "number") target.tilePosition.y = node.tilePositionY;
    if (typeof node.tileScaleX === "number") target.tileScale.x = node.tileScaleX;
    if (typeof node.tileScaleY === "number") target.tileScale.y = node.tileScaleY;
    if (typeof node.tileRotation === "number") target.tileRotation = node.tileRotation * DEG_TO_RAD;
    if (typeof node.applyAnchorToTexture === "boolean") {
        target.applyAnchorToTexture = node.applyAnchorToTexture;
    }
}

const tilingSprite: NodeType = {
    create: () => new TilingSprite({ texture: Texture.EMPTY }),
    assign: (node, target, ctx) => {
        if (!(target instanceof TilingSprite)) return;
        if (typeof node.texture === "string" && ctx.resolve.texture) {
            target.texture = ctx.resolve.texture(ctx.readString(node.texture));
        }
        if (typeof node.width === "number") target.width = node.width;
        if (typeof node.height === "number") target.height = node.height;
        assignTilingSpriteTileFields(node, target);
        setAnchorFromNode(target, node);
    },
};
```

**Step 6: Add `animatedSprite` helper and node type after `tilingSprite`**

```ts
function resolveAnimationTextures(node: ResolvedNode, ctx: AssignContext): Texture[] | undefined {
    const ids = node.textures;
    if (!Array.isArray(ids) || !ctx.resolve.texture) return undefined;
    return ids.map((id) => ctx.resolve.texture!(ctx.readString(id as string)));
}

function assignAnimatedSpritePlaybackFields(node: ResolvedNode, target: AnimatedSprite): void {
    if (typeof node.animationSpeed === "number") target.animationSpeed = node.animationSpeed;
    if (typeof node.loop === "boolean") target.loop = node.loop;
    if (typeof node.autoUpdate === "boolean") target.autoUpdate = node.autoUpdate;
    if (typeof node.updateAnchor === "boolean") target.updateAnchor = node.updateAnchor;
    if (typeof node.playing === "boolean") {
        if (node.playing) target.play();
        else target.stop();
    }
}

const animatedSprite: NodeType = {
    create: () => new AnimatedSprite([Texture.EMPTY]),
    // Order matters: textures before width/height; playback fields last.
    assign: (node, target, ctx) => {
        if (!(target instanceof AnimatedSprite)) return;
        const textures = resolveAnimationTextures(node, ctx);
        if (textures) target.textures = textures;
        if (typeof node.width === "number") target.width = node.width;
        if (typeof node.height === "number") target.height = node.height;
        if (node.tint !== undefined) target.tint = node.tint as number | string;
        setAnchorFromNode(target, node);
        assignAnimatedSpritePlaybackFields(node, target);
    },
};
```

If TypeScript dislikes the non-null assertion in `resolveAnimationTextures`, replace it with a local const:

```ts
const resolveTexture = ctx.resolve.texture;
if (!Array.isArray(ids) || !resolveTexture) return undefined;
return ids.map((id) => resolveTexture(ctx.readString(id as string)));
```

**Step 7: Add `bitmapText` node type after regular `text`**

```ts
const bitmapText: NodeType = {
    create: () => new BitmapText(),
    assign: (node, target, ctx) => {
        if (!(target instanceof BitmapText)) return;
        if (typeof node.text === "string") {
            target.text = ctx.readString(node.text);
        }
        const style = resolveTextStyle(node, ctx);
        if (style) Object.assign(target.style, style);
        applyTextMaxWidth(node, target);
        setAnchorFromNode(target, node);
    },
};
```

**Step 8: Register new node types in `defaultNodeTypes`**

```ts
export const defaultNodeTypes: ReadonlyMap<string, NodeType> = new Map<string, NodeType>([
    ["container", container],
    ["sprite", sprite],
    ["nineSliceSprite", nineSliceSprite],
    ["tilingSprite", tilingSprite],
    ["animatedSprite", animatedSprite],
    ["text", text],
    ["bitmapText", bitmapText],
    ["graphics", graphics],
    ["slot", slot],
]);
```

**Step 9: Run targeted tests**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/apply.test.js
```

Expected: new runtime tests may still fail validation until `validate.ts` is updated. If validation already treats them as custom and build reaches runtime, implementation tests should now pass except strict validation assertions added later.

**Step 10: Commit runtime implementation**

```bash
git add src/nodeTypes.ts
git commit -m "feat: implement expanded Pixi intrinsic node types"
```

---

### Task 5: Add semantic validation for strict intrinsic fields

**Files:**
- Modify: `src/validate.ts`
- Test: `test/intrinsics.test.ts`

**Step 1: Add validation tests to `test/intrinsics.test.ts`**

Add near the existing validation tests:

```ts
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
```

**Step 2: Run tests to verify validation tests fail**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js
```

Expected: FAIL because validator still treats the new names as custom or does not check required fields.

**Step 3: Add intrinsic names to validation sets**

Update the sets near the top of `src/validate.ts`:

```ts
const INTRINSIC = new Set([
    "container",
    "sprite",
    "nineSliceSprite",
    "tilingSprite",
    "animatedSprite",
    "text",
    "bitmapText",
    "graphics",
    "slot",
]);
const NON_COMPOSABLE = new Set([
    "sprite",
    "nineSliceSprite",
    "tilingSprite",
    "animatedSprite",
    "text",
    "bitmapText",
    "graphics",
    "slot",
]);
```

**Step 4: Add field check helpers**

After the existing `isArray` helper, add:

```ts
const isBoolean: FieldCheck = (x) => typeof x === "boolean";
const isStringOrNumber: FieldCheck = (x) => typeof x === "string" || typeof x === "number";
const isNonEmptyStringArray: FieldCheck = (x) => Array.isArray(x)
    && x.length > 0
    && x.every(isNonEmptyStr);
```

**Step 5: Add allowed field sets**

Add entries to `intrinsicAllowedFields`:

```ts
tilingSprite: new Set([
    ...COMMON_NODE_FIELDS,
    "texture",
    "width",
    "height",
    "tilePositionX",
    "tilePositionY",
    "tileScaleX",
    "tileScaleY",
    "tileRotation",
    "applyAnchorToTexture",
    "anchorX",
    "anchorY",
]),
animatedSprite: new Set([
    ...COMMON_NODE_FIELDS,
    "textures",
    "tint",
    "width",
    "height",
    "anchorX",
    "anchorY",
    "animationSpeed",
    "loop",
    "autoUpdate",
    "updateAnchor",
    "playing",
]),
bitmapText: new Set([...COMMON_NODE_FIELDS, "text", "style", "maxWidth", "anchorX", "anchorY"]),
```

**Step 6: Add required field specs**

Update `intrinsicSpecs`:

```ts
const intrinsicSpecs: Record<string, FieldSpec[]> = {
    sprite: [{ name: "texture", check: isNonEmptyStr, label: "string" }],
    nineSliceSprite: [{ name: "texture", check: isNonEmptyStr, label: "string" }],
    tilingSprite: [{ name: "texture", check: isNonEmptyStr, label: "string" }],
    animatedSprite: [{ name: "textures", check: isNonEmptyStringArray, label: "non-empty string array" }],
    text: [{ name: "text", check: isString, label: "string" }],
    bitmapText: [{ name: "text", check: isString, label: "string" }],
    slot: [{ name: "slot", check: isNonEmptyStr, label: "string" }],
};
```

**Step 7: Add optional field specs**

Add entries to `optionalIntrinsicSpecs`:

```ts
tilingSprite: [
    { name: "width", check: isNumber, label: "number" },
    { name: "height", check: isNumber, label: "number" },
    { name: "tilePositionX", check: isNumber, label: "number" },
    { name: "tilePositionY", check: isNumber, label: "number" },
    { name: "tileScaleX", check: isNumber, label: "number" },
    { name: "tileScaleY", check: isNumber, label: "number" },
    { name: "tileRotation", check: isNumber, label: "number" },
    { name: "applyAnchorToTexture", check: isBoolean, label: "boolean" },
    { name: "anchorX", check: isNumber, label: "number" },
    { name: "anchorY", check: isNumber, label: "number" },
],
animatedSprite: [
    { name: "tint", check: isStringOrNumber, label: "string or number" },
    { name: "width", check: isNumber, label: "number" },
    { name: "height", check: isNumber, label: "number" },
    { name: "anchorX", check: isNumber, label: "number" },
    { name: "anchorY", check: isNumber, label: "number" },
    { name: "animationSpeed", check: isNumber, label: "number" },
    { name: "loop", check: isBoolean, label: "boolean" },
    { name: "autoUpdate", check: isBoolean, label: "boolean" },
    { name: "updateAnchor", check: isBoolean, label: "boolean" },
    { name: "playing", check: isBoolean, label: "boolean" },
],
bitmapText: [
    { name: "style", check: isString, label: "string" },
    { name: "maxWidth", check: isNumber, label: "number" },
    { name: "anchorX", check: isNumber, label: "number" },
    { name: "anchorY", check: isNumber, label: "number" },
],
```

Keep the existing `nineSliceSprite`, `text`, and `graphics` entries.

**Step 8: Run targeted validation/runtime tests**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/apply.test.js
```

Expected: PASS for targeted tests.

**Step 9: Commit validation**

```bash
git add src/validate.ts test/intrinsics.test.ts
git commit -m "feat: validate expanded Pixi intrinsics"
```

---

### Task 6: Update JSON Schema for editor/CLI structural validation

**Files:**
- Modify: `pxd.schema.json`
- Test: `test/schema.test.ts` (auto-discovers fixtures later)

**Step 1: Add new intrinsic names**

Update `$defs.intrinsicTypeName.enum`:

```json
["container", "sprite", "nineSliceSprite", "tilingSprite", "animatedSprite", "text", "bitmapText", "graphics", "slot"]
```

**Step 2: Add a reusable non-empty string-array definition after `decidableTint`**

```json
"textureIdArray": {
  "type": "array",
  "minItems": 1,
  "items": { "type": "string", "minLength": 1 }
},
```

**Step 3: Add `tilingSpriteNode` after `nineSliceSpriteNode`**

```json
"tilingSpriteNode": {
  "allOf": [{ "$ref": "#/$defs/baseNode" }],
  "properties": {
    "type":                 { "const": "tilingSprite" },
    "texture":              { "$ref": "#/$defs/decidableString" },
    "width":                { "$ref": "#/$defs/decidableNumber" },
    "height":               { "$ref": "#/$defs/decidableNumber" },
    "tilePositionX":        { "$ref": "#/$defs/decidableNumber" },
    "tilePositionY":        { "$ref": "#/$defs/decidableNumber" },
    "tileScaleX":           { "$ref": "#/$defs/decidableNumber" },
    "tileScaleY":           { "$ref": "#/$defs/decidableNumber" },
    "tileRotation":         { "$ref": "#/$defs/decidableNumber" },
    "applyAnchorToTexture": { "$ref": "#/$defs/decidableBoolean" },
    "anchorX":              { "$ref": "#/$defs/decidableNumber" },
    "anchorY":              { "$ref": "#/$defs/decidableNumber" }
  },
  "required": ["type", "texture"],
  "unevaluatedProperties": false
},
```

**Step 4: Add `animatedSpriteNode` after `tilingSpriteNode`**

```json
"animatedSpriteNode": {
  "allOf": [{ "$ref": "#/$defs/baseNode" }],
  "properties": {
    "type":           { "const": "animatedSprite" },
    "textures":       { "$ref": "#/$defs/textureIdArray" },
    "tint":           { "$ref": "#/$defs/decidableTint" },
    "width":          { "$ref": "#/$defs/decidableNumber" },
    "height":         { "$ref": "#/$defs/decidableNumber" },
    "anchorX":        { "$ref": "#/$defs/decidableNumber" },
    "anchorY":        { "$ref": "#/$defs/decidableNumber" },
    "animationSpeed": { "$ref": "#/$defs/decidableNumber" },
    "loop":           { "$ref": "#/$defs/decidableBoolean" },
    "autoUpdate":     { "$ref": "#/$defs/decidableBoolean" },
    "updateAnchor":   { "$ref": "#/$defs/decidableBoolean" },
    "playing":        { "$ref": "#/$defs/decidableBoolean" }
  },
  "required": ["type", "textures"],
  "unevaluatedProperties": false
},
```

**Step 5: Add `bitmapTextNode` after `textNode`**

```json
"bitmapTextNode": {
  "allOf": [{ "$ref": "#/$defs/baseNode" }],
  "properties": {
    "type":     { "const": "bitmapText" },
    "text":     { "$ref": "#/$defs/decidableString" },
    "style":    { "$ref": "#/$defs/decidableString" },
    "maxWidth": { "$ref": "#/$defs/decidableNumber" },
    "anchorX":  { "$ref": "#/$defs/decidableNumber" },
    "anchorY":  { "$ref": "#/$defs/decidableNumber" }
  },
  "required": ["type", "text"],
  "unevaluatedProperties": false
},
```

**Step 6: Add refs to `$defs.node.oneOf`**

```json
{ "$ref": "#/$defs/tilingSpriteNode" },
{ "$ref": "#/$defs/animatedSpriteNode" },
{ "$ref": "#/$defs/bitmapTextNode" },
```

Place them next to related nodes:

```json
"oneOf": [
  { "$ref": "#/$defs/containerNode" },
  { "$ref": "#/$defs/spriteNode" },
  { "$ref": "#/$defs/nineSliceSpriteNode" },
  { "$ref": "#/$defs/tilingSpriteNode" },
  { "$ref": "#/$defs/animatedSpriteNode" },
  { "$ref": "#/$defs/textNode" },
  { "$ref": "#/$defs/bitmapTextNode" },
  { "$ref": "#/$defs/graphicsNode" },
  { "$ref": "#/$defs/slotNode" },
  { "$ref": "#/$defs/customNode" }
]
```

**Step 7: Validate JSON and run schema tests**

Run:

```bash
node -e 'JSON.parse(require("node:fs").readFileSync("pxd.schema.json", "utf8")); console.log("schema json ok")'
npx tsc && node --test dist/test/schema.test.js
```

Expected: JSON parse passes. Schema tests still PASS until fixtures are added.

**Step 8: Commit schema**

```bash
git add pxd.schema.json
git commit -m "feat: add expanded Pixi intrinsics to schema"
```

---

### Task 7: Add conformance fixtures

**Files:**
- Create: `doc/fixtures/valid/core-expanded-pixi-intrinsics.json`
- Create: `doc/fixtures/invalid/tiling-sprite-missing-texture.json`
- Create: `doc/fixtures/invalid/animated-sprite-empty-textures.json`
- Create: `doc/fixtures/invalid/animated-sprite-bad-texture-entry.json`
- Create: `doc/fixtures/invalid/bitmap-text-missing-text.json`
- Create: `doc/fixtures/invalid/bitmap-text-bad-style.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Create valid fixture**

Write `doc/fixtures/valid/core-expanded-pixi-intrinsics.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "level": "core",
  "root": {
    "id": "root",
    "type": "container",
    "children": [
      {
        "id": "bg",
        "type": "tilingSprite",
        "texture": "patterns/checker",
        "width": 800,
        "height": 600,
        "tilePositionX": 0,
        "tilePositionY": 16,
        "tileScaleX": 2,
        "tileScaleY": 2,
        "tileRotation": 0,
        "applyAnchorToTexture": true
      },
      {
        "id": "hero",
        "type": "animatedSprite",
        "textures": ["hero/walk_0", "hero/walk_1"],
        "animationSpeed": 0.25,
        "loop": true,
        "autoUpdate": false,
        "updateAnchor": false,
        "playing": false,
        "anchorX": 0.5,
        "anchorY": 1
      },
      {
        "id": "score",
        "type": "bitmapText",
        "text": "Score: {score}",
        "style": "score",
        "maxWidth": 240,
        "anchorX": 1,
        "anchorY": 0
      }
    ]
  }
}
```

**Step 2: Create invalid fixtures**

`doc/fixtures/invalid/tiling-sprite-missing-texture.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": { "id": "bg", "type": "tilingSprite", "width": 800, "height": 600 }
}
```

`doc/fixtures/invalid/animated-sprite-empty-textures.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": { "id": "hero", "type": "animatedSprite", "textures": [] }
}
```

`doc/fixtures/invalid/animated-sprite-bad-texture-entry.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": { "id": "hero", "type": "animatedSprite", "textures": ["hero/0", 7] }
}
```

`doc/fixtures/invalid/bitmap-text-missing-text.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": { "id": "score", "type": "bitmapText", "style": "score" }
}
```

`doc/fixtures/invalid/bitmap-text-bad-style.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": { "id": "score", "type": "bitmapText", "text": "Score", "style": { "fontSize": 32 } }
}
```

**Step 3: Update fixture README tables**

Add to valid fixtures table in `doc/fixtures/README.md`:

```md
| `valid/core-expanded-pixi-intrinsics.json` | `tilingSprite`, `animatedSprite`, and `bitmapText` intrinsics | §4.7–§4.9 |
```

Add to invalid fixtures table:

```md
| `invalid/tiling-sprite-missing-texture.json` | `tilingSprite` missing required `texture` | §10 rule 7 |
| `invalid/animated-sprite-empty-textures.json` | `animatedSprite` has empty `textures` array | §10 rule 7 |
| `invalid/animated-sprite-bad-texture-entry.json` | `animatedSprite.textures` contains a non-string entry | §10 rule 7 |
| `invalid/bitmap-text-missing-text.json` | `bitmapText` missing required `text` | §10 rule 7 |
| `invalid/bitmap-text-bad-style.json` | `bitmapText.style` is not a style id string | §10 rule 7 |
```

**Step 4: Run fixture and schema suites**

Run:

```bash
npx tsc && node dist/test/fixtures.test.js && node --test dist/test/schema.test.js
```

Expected: PASS. If schema rejects the valid fixture, fix `pxd.schema.json`. If semantic fixture errors mismatch, fix `validate.ts` error labels or fixture intent.

**Step 5: Commit fixtures**

```bash
git add doc/fixtures/valid/core-expanded-pixi-intrinsics.json \
  doc/fixtures/invalid/tiling-sprite-missing-texture.json \
  doc/fixtures/invalid/animated-sprite-empty-textures.json \
  doc/fixtures/invalid/animated-sprite-bad-texture-entry.json \
  doc/fixtures/invalid/bitmap-text-missing-text.json \
  doc/fixtures/invalid/bitmap-text-bad-style.json \
  doc/fixtures/README.md
git commit -m "test: add expanded intrinsic fixtures"
```

---

### Task 8: Update spec and README documentation

**Files:**
- Modify: `doc/pxd-v1.md`
- Modify: `README.md`

**Step 1: Update intrinsic list and decision scope in spec**

In `doc/pxd-v1.md` §3.5, update non-composable intrinsic list to include:

```md
`sprite`, `nineSliceSprite`, `tilingSprite`, `animatedSprite`, `text`, `bitmapText`, `graphics`, `slot`
```

In §3.6 decision value scope, include new scalar fields:

```md
`tilePositionX`, `tilePositionY`, `tileScaleX`, `tileScaleY`, `tileRotation`, `applyAnchorToTexture`, `textures` excluded because arrays are structural, `animationSpeed`, `loop`, `autoUpdate`, `updateAnchor`, `playing`
```

Recommended wording:

```md
Decision values are allowed on scalar fields only. For `animatedSprite`, the `textures` array itself is static, but each texture id string may still contain §7.2 bindings that are resolved before calling the texture resolver.
```

**Step 2: Add spec sections after `slot`**

If `nineSliceSprite` docs are not already present, keep/restore the completed nine-slice section from its own plan first. Then add:

````md
### 4.7 `tilingSprite`

A repeated texture node backed by Pixi `TilingSprite`.

```json
{
  "id": "bg",
  "type": "tilingSprite",
  "texture": "patterns/checker",
  "width": 800,
  "height": 600,
  "tilePositionX": 0,
  "tilePositionY": 16,
  "tileScaleX": 2,
  "tileScaleY": 2
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `texture` | string | yes | — | Opaque texture identifier (§7) |
| `width` | number | no | texture width | Tiling area width |
| `height` | number | no | texture height | Tiling area height |
| `tilePositionX` | number | no | 0 | X offset of the repeated texture |
| `tilePositionY` | number | no | 0 | Y offset of the repeated texture |
| `tileScaleX` | number | no | 1 | X scale of each tile |
| `tileScaleY` | number | no | 1 | Y scale of each tile |
| `tileRotation` | number | no | 0 | Tile rotation in degrees; converted to Pixi radians |
| `applyAnchorToTexture` | boolean | no | false | Whether tile coordinates originate from the anchor |
| `anchorX` | number | no | 0 | Anchor X in [0, 1] |
| `anchorY` | number | no | 0 | Anchor Y in [0, 1] |

### 4.8 `animatedSprite`

A frame animation backed by Pixi `AnimatedSprite`.

```json
{
  "id": "hero",
  "type": "animatedSprite",
  "textures": ["hero/walk_0", "hero/walk_1"],
  "animationSpeed": 0.25,
  "loop": true,
  "playing": true
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `textures` | string[] | yes | — | Non-empty frame texture ids resolved through the texture resolver |
| `tint` | string/number | no | — | Optional tint |
| `width` | number | no | — | Optional explicit display width |
| `height` | number | no | — | Optional explicit display height |
| `anchorX` | number | no | 0 | Anchor X in [0, 1] |
| `anchorY` | number | no | 0 | Anchor Y in [0, 1] |
| `animationSpeed` | number | no | Pixi default | Pixi animation speed multiplier |
| `loop` | boolean | no | Pixi default | Whether playback loops |
| `autoUpdate` | boolean | no | Pixi default | Whether `Ticker.shared` updates animation time |
| `updateAnchor` | boolean | no | Pixi default | Whether frame default anchors update the sprite anchor |
| `playing` | boolean | no | false on build; unchanged on apply | `true` calls `play()`, `false` calls `stop()` |

This lightweight reader intentionally does not expose Pixi frame timing objects or callbacks. Use a custom `nodeTypes` entry for advanced animation runtime behavior.

### 4.9 `bitmapText`

A high-performance text node backed by Pixi `BitmapText`.

```json
{
  "id": "score",
  "type": "bitmapText",
  "text": "Score: {score}",
  "style": "score"
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `text` | string | yes | — | Text content |
| `style` | string | no | — | Style/font identifier resolved by the host |
| `maxWidth` | number | no | — | Maximum display width via Pixi word wrap |
| `anchorX` | number | no | 0 | Anchor X in [0, 1] |
| `anchorY` | number | no | 0 | Anchor Y in [0, 1] |

Bitmap font loading/installation is the host application's responsibility. The PXD node only selects text content and a style id.
````

Then renumber the existing Spine/custom section to the next section number.

**Step 3: Update README default registry mentions**

Replace lists of built-ins in `README.md` with:

```md
`container`, `sprite`, `nineSliceSprite`, `tilingSprite`, `animatedSprite`, `text`, `bitmapText`, `graphics`, `slot`
```

Add a short paragraph under “What it supports” or “Extension points”:

```md
Additional Pixi v8 leaf intrinsics include `nineSliceSprite`, `tilingSprite`, `animatedSprite`, and `bitmapText`. They stay deliberately small: assets/styles are still resolved by host callbacks, and advanced animation/font behavior belongs in custom `nodeTypes`.
```

**Step 4: Grep for stale docs**

Run:

```bash
rg -n "default registry|built-ins|intrinsic|sprite`, `text|Spine and other" README.md doc/pxd-v1.md
```

Expected: no current user-facing list omits the new intrinsic names.

**Step 5: Commit docs**

```bash
git add doc/pxd-v1.md README.md
git commit -m "docs: specify expanded Pixi intrinsics"
```

---

### Task 9: Update TODO checklist and run full verification

**Files:**
- Modify: `TODO.md`

**Step 1: Mark TODO items complete**

In `TODO.md`, update §4:

```md
- [x] `tilingSprite`.
- [x] `animatedSprite`.
- [x] `bitmapText`.
```

If `nineSliceSprite` is also complete in this branch, ensure it is checked too:

```md
- [x] `nineSliceSprite`.
```

Then mark the parent item complete only if all four are now checked:

```md
- [x] Затем расширить PXD v1 intrinsic набор практичными Pixi v8 типами:
```

**Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass, including fixtures, build/apply/intrinsics/schema/CLI.

**Step 3: Run package build**

Run:

```bash
npm run build
```

Expected: TypeScript compile succeeds and `dist/` is regenerated.

**Step 4: Check worktree diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended files changed.

**Step 5: Commit TODO/final verification state**

```bash
git add TODO.md
git commit -m "chore: mark expanded Pixi intrinsics complete"
```

If `npm run build` changed tracked `dist/` files (normally `dist/` is not committed unless this repo does so), either leave them untracked/ignored or follow repository convention.

---

### Task 10: Final review checklist

**Files:**
- Review all modified files.

**Step 1: Check implementation invariants**

Verify:

- `build.ts` / `apply.ts` dispatch order was not changed.
- New intrinsic leaf types are in `NON_COMPOSABLE`.
- `textures` on `animatedSprite` is static/non-decidable; string bindings are resolved per texture id in `assign`.
- `tileRotation` is documented as degrees and converted to radians exactly once.
- Type mismatch in `apply()` remains silent because every assign starts with `instanceof` guard.
- Missing resolver behavior matches existing sprite behavior: if `ctx.resolve.texture` is absent during apply, texture fields are skipped rather than throwing.

**Step 2: Run final tests**

Run:

```bash
npm test
```

Expected: PASS.

**Step 3: Commit any review fixes**

If fixes were necessary:

```bash
git add src test doc README.md TODO.md pxd.schema.json
git commit -m "fix: address expanded intrinsic review issues"
```

Expected: no remaining unintended changes.
