# Intrinsic Built-ins Stabilization Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Make the current intrinsic Pixi node types (`container`, `sprite`, `text`, `graphics`, `slot`) precise, tested, and documented, while moving `spine` out of intrinsic support and into custom `nodeTypes`.

**Architecture:** Add a dedicated intrinsic runtime test suite that uses real Pixi classes where practical and small fakes where Pixi renderer/canvas internals would make tests brittle. Keep Pixi behavior in hand-written `src/nodeTypes.ts` helpers, validation in `src/validate.ts`, and schema/docs in sync; do not introduce the descriptor layer from TODO §5 in this plan. Treat future Pixi v8 types (`nineSliceSprite`, `tilingSprite`, `animatedSprite`, `bitmapText`) as the next follow-up after current built-ins are stable.

**Tech Stack:** TypeScript `NodeNext`, Pixi.js v8 (`Container`, `Sprite`, `Text`, `Graphics`, `Texture`), Node.js `node:test`, Ajv draft 2020-12, existing `build/apply/validate` pipeline.

---

## Codebase analysis summary

Next unchecked TODO section is:

```md
## 4. Intrinsic types: стабильная Pixi-база
```

PixiJS documentation cross-check (`https://pixijs.download/release/docs/index.html`, release docs pages for `Container`, `Sprite`, `Text`, `Graphics`, `Texture`, and future `NineSliceSprite`/`TilingSprite`/`AnimatedSprite`/`BitmapText`) confirms:

- `Container.width` / `height` are bounds-derived accessors; setting them changes `scale.x` / `scale.y`. Empty containers have `0` bounds, so a passive slot needs an explicit wrapper contract if its declared area must be readable before content is mounted.
- `Sprite.width` / `height` also mutate scale; keeping PXD base fields after type-specific assignment is required so explicit `scaleX/scaleY` still win.
- `Sprite.anchor` is an `ObservablePoint` with normalized `0..1` origin semantics; `pivot` is inherited and pixel-based.
- `Sprite.tint` is exposed as a numeric tint value even if assigned from a string `ColorSource`; tests should assert `0xff00ff`, not the original string.
- Pixi `Texture` already carries `frame`/`orig` metadata. In this lightweight reader, PXD `texture` should identify the final Pixi `Texture` (including atlas subtextures); a separate `sprite.frame` field would add a second asset-addressing path and an extra resolver without clear runtime value.
- `Text` is canvas-based and `Text.width` / `height` are display-size accessors that mutate scale. Auto-fitting text by measuring and changing scale is a layout policy, not a minimal Pixi intrinsic field, so this plan removes `fit` instead of implementing shrink behavior.
- `Graphics` v8 uses shape calls followed by `fill()` / `stroke()`, matching current `drawShape()` ordering. Pixi `FillInput`, `StrokeInput`, and `TextStyle` object shapes are broad Pixi-owned APIs; accepting arbitrary inline objects in PXD makes intrinsic nodes non-strict and poorly described. Shape-specific fields such as `radius` or `points` should only be meaningful for their shapes; literal-shape validation should reject no-op extras where practical.
- `NineSliceSprite`, `TilingSprite`, `AnimatedSprite`, and `BitmapText` each have distinct constructor/field semantics, so they should remain a follow-up plan rather than being mixed into current intrinsic stabilization.

Current relevant repository state:

- `src/nodeTypes.ts`
  - `container` sets `pivotX/pivotY`; no dedicated tests.
  - `sprite` sets `texture`, `width`, `height`, `tint`, anchor; `frame` exists in schema/types/docs but is ignored at runtime.
  - `text` sets text/style/maxWidth/anchor; `fit` exists in schema/types/docs/fixture but is currently a no-op. `style` accepts arbitrary inline objects.
  - `graphics` draws all cases in `drawShape()`, but there are no direct tests for emitted draw calls. `fill`/`stroke` accept arbitrary inline objects.
  - `slot` creates a plain empty `Container`; Pixi `Container.width/height` on an empty container stays `0`, so documented slot sizing is currently not actually readable.
  - `defaultNodeTypes` does not register `spine`, yet `types.ts`, `validate.ts`, `pxd.schema.json`, and `doc/pxd-v1.md` still model `spine` as an intrinsic type.
- `src/context.ts`
- `src/validate.ts`
  - Intrinsic names include `spine`.
  - Non-composable intrinsic names include `spine`.
  - Required fields are checked for `sprite/text/slot/spine`.
  - Graphics shape requirements check missing `width/height/radius/points`, but unknown literal shape strings are silently accepted by `validate()` even though schema rejects them.
- `pxd.schema.json`
  - Intrinsic enum includes `spine`.
  - `text.fit` is accepted even though runtime ignores it.
  - `text.style`, `graphics.fill`, and `graphics.stroke` accept arbitrary inline objects.
  - `sprite.frame` is accepted by types/schema/docs but is not implemented.
  - `slot.width/height` are structurally accepted.
- Tests
  - Existing `test/build.test.ts` intentionally stubs `sprite` and `text` in many tests to avoid canvas dependency.
  - There is no dedicated test file for default intrinsic behavior.
  - Pixi `Sprite` and `Graphics` can be instantiated in Node. Pixi `Text` needs a tiny `document.createElement('canvas').getContext()` shim for construction.
- Docs
  - `doc/pxd-v1.md` lists `spine` as §4.6 intrinsic and says Core readers may optionally support it.
  - `doc/guides/02-custom-node-types.md` says default registry covers `container`, `sprite`, `text`, `graphics`, `slot`, which matches runtime.
  - `doc/guides/06-slots.md` says slot `width/height` can be read, but runtime currently returns `0` for empty slots.

Implementation decisions for this plan:

1. **Keep current intrinsic set to five defaults:** `container`, `sprite`, `text`, `graphics`, `slot`.
2. **Move `spine` to custom `nodeTypes`:** remove it from intrinsic TypeScript/schema/validation/docs so the library no longer validates Spine-specific fields it does not implement.
3. **Remove `sprite.frame` from the built-in model:** keep `texture` as the single opaque final-texture identifier. Hosts that need atlas subtextures should encode that in the texture id (for example `"atlas/logo_idle"`) and resolve it in `resolve.texture`, or override `sprite` with custom `nodeTypes`.
4. **Remove `text.fit` from the built-in model:** keep `maxWidth` as the only built-in text width hint, mapped to Pixi word wrapping. Text shrink/fit policies belong in host code or custom `nodeTypes` because they depend on fonts, measurement, scaling policy, and layout expectations.
5. **Remove arbitrary inline Pixi object payloads from built-ins:** make `text.style` string-only and make `graphics.fill` / `graphics.stroke` string-only. Complex Pixi `TextStyle`, `FillInput`, and `StrokeInput` objects belong in host resolvers/custom node types, not the strict intrinsic schema.
6. **Implement slot `width/height`:** use a small `SlotContainer extends Container` whose `width`/`height` accessors preserve the document area even when empty.
7. **Make graphics validation stricter for literal shape strings:** unknown shape strings become `ValidationError [rule 7]`; shape-specific no-op extras such as `radius` on `rect` should be rejected for literal shapes where practical; decision-map shape leaves remain covered by schema and existing decision-map validation.
8. **Do not add `nineSliceSprite`, `tilingSprite`, `animatedSprite`, or `bitmapText` in this plan.** Add a TODO note that they remain future follow-up after current built-ins are stable.

---

## Task 1: Add intrinsic test suite and stabilize `container` + `slot`

**Files:**
- Create: `test/intrinsics.test.ts`
- Modify: `package.json`
- Modify: `src/nodeTypes.ts`

**Step 1: Write the failing tests**

Create `test/intrinsics.test.ts` with initial tests for `container` and `slot`:

```ts
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
```

Modify `package.json` test script to include the new compiled suite:

```json
"test": "tsc && node dist/test/fixtures.test.js && node --test dist/test/build.test.js dist/test/apply.test.js dist/test/intrinsics.test.js dist/test/find.test.js dist/test/slots.test.js dist/test/schema.test.js dist/test/cli.test.js"
```

**Step 2: Run tests to verify failure**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js
```

Expected: FAIL on `intrinsic slot: preserves declared width and height on empty slot`; actual `slot.width`/`slot.height` are `0` because the current slot is a plain empty Pixi `Container`.

**Step 3: Implement `SlotContainer` and slot assign**

In `src/nodeTypes.ts`, add a small exported class near the top-level helpers:

```ts
/** Empty mount point whose document area is readable even before content is mounted. */
export class SlotContainer extends Container {
    private documentWidth: number | undefined;
    private documentHeight: number | undefined;

    override get width(): number {
        return this.documentWidth ?? super.width;
    }

    override set width(value: number) {
        this.documentWidth = value;
    }

    override get height(): number {
        return this.documentHeight ?? super.height;
    }

    override set height(value: number) {
        this.documentHeight = value;
    }
}
```

Replace the current `slot` node type with:

```ts
/** Slot — passive named mount point. External content attached via `mountSlot`. */
const slot: NodeType = {
    create: () => new SlotContainer(),
    assign: (node, target) => {
        if (!(target instanceof SlotContainer)) return;
        if (typeof node.width === "number") target.width = node.width;
        if (typeof node.height === "number") target.height = node.height;
    },
};
```

Keep `SlotContainer` top-level; do not define classes/functions inside another function.

**Step 4: Run the intrinsic suite**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js
```

Expected: PASS.

**Step 5: Run slots suite to check existing slot APIs**

Run:

```bash
npx tsc && node --test dist/test/slots.test.js
```

Expected: PASS.

**Step 6: Commit**

```bash
git add test/intrinsics.test.ts package.json src/nodeTypes.ts
git commit -m "test: cover container and slot intrinsics"
```

---

## Task 2: Stabilize `sprite` semantics and remove unused `frame`

**Files:**
- Modify: `test/intrinsics.test.ts`
- Modify: `src/types.ts`
- Modify: `src/nodeTypes.ts` only if tests expose needed helper cleanup
- Modify: `pxd.schema.json`
- Modify: `doc/pxd-v1.md`
- Modify: `doc/fixtures/valid/core-full.json` only if it starts using `frame`
- Modify: `README.md` / guides if they mention `frame`

**Step 1: Add failing sprite tests**

Append to `test/intrinsics.test.ts`:

```ts
import { Sprite, Texture } from "pixi.js";
```

If the import line already imports from `pixi.js`, merge it into one line:

```ts
import { Container, Sprite, Texture } from "pixi.js";
```

Add tests:

```ts
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
```

**Step 2: Add schema rejection test/fixture for obsolete `sprite.frame`**

Create `doc/fixtures/invalid/sprite-frame-removed.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "logo",
    "type": "sprite",
    "texture": "atlas",
    "frame": "logo_idle"
  }
}
```

Update `doc/fixtures/README.md` invalid table with:

```md
| `invalid/sprite-frame-removed.json` | Sprite uses removed `frame`; encode final atlas subtexture in `texture` instead | §4.2 |
```

Do **not** add this fixture to `SEMANTIC_ONLY` in `test/schema.test.ts`; schema should reject `frame` as an unknown intrinsic field once removed from `pxd.schema.json`.

**Step 3: Run tests to verify failure**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: FAIL because `SpriteNode` / JSON Schema / docs still allow `frame`, so `invalid/sprite-frame-removed.json` is accepted by schema/fixtures.

**Step 4: Remove `frame` from TypeScript types and schema**

In `src/types.ts`, remove this field from `SpriteNode`:

```ts
frame?: Decidable<string>;
```

In `pxd.schema.json`, remove this property from `$defs.spriteNode.properties`:

```json
"frame": { "$ref": "#/$defs/decidableString" },
```

No `Resolvers.frame` should be added. Keep `Resolvers` small: `texture` remains the only built-in sprite asset hook.

**Step 5: Update docs for final texture id semantics**

In `doc/pxd-v1.md` §4.2:

- Remove the `frame` row from the sprite table.
- Add prose under the table:

```md
`texture` identifies the final Pixi `Texture` to render. For atlas subtextures, encode the subtexture key into the opaque `texture` id (for example `"atlas/logo_idle"`) and resolve it in the host's texture resolver. This lightweight reader does not define a separate `frame` field.
```

Also update §7.1 if it lists `frame` among asset references; remove `frame` from that list.

In `README.md` / guides, ensure no built-in docs mention `sprite.frame` or `resolve.frame`.

**Step 6: Run targeted tests**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: PASS.

**Step 7: Commit**

```bash
git add test/intrinsics.test.ts src/types.ts pxd.schema.json doc/pxd-v1.md doc/fixtures/invalid/sprite-frame-removed.json doc/fixtures/README.md README.md doc/guides
git commit -m "refactor: remove unused sprite frame field"
```

---

## Task 3: Stabilize `text` semantics and remove unused `fit`

**Files:**
- Modify: `test/intrinsics.test.ts`
- Modify: `src/types.ts`
- Modify: `src/nodeTypes.ts`
- Modify: `pxd.schema.json`
- Modify: `doc/pxd-v1.md`
- Modify: `doc/fixtures/valid/core-full.json`
- Create: `doc/fixtures/invalid/text-fit-removed.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Add Text canvas shim helper to tests**

In `test/intrinsics.test.ts`, update Pixi import to include `Text`:

```ts
import { Container, Sprite, Text, Texture } from "pixi.js";
```

Add this top-level helper near `resolveStub` so Pixi `Text` can measure in Node:

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
    const globals = globalThis as typeof globalThis & {
        CanvasRenderingContext2D?: unknown;
        document?: unknown;
    };
    globals.CanvasRenderingContext2D ??= FakeCanvasRenderingContext2D;
    globals.document ??= {
        createElement: () => ({
            getContext: () => new FakeCanvasRenderingContext2D(),
        }),
    };
}
```

**Step 2: Add text behavior test for supported fields only**

Append:

```ts
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
```

This test may fail initially because current `maxWidth` sets `wordWrapWidth` but not `wordWrap`.

**Step 3: Add schema rejection fixture for obsolete `text.fit`**

Create `doc/fixtures/invalid/text-fit-removed.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "title",
    "type": "text",
    "text": "Hello",
    "maxWidth": 320,
    "fit": "shrink"
  }
}
```

Update `doc/fixtures/README.md` invalid table with:

```md
| `invalid/text-fit-removed.json` | Text uses removed `fit`; shrink policies belong in custom node types | §4.3 |
```

Do **not** add this fixture to `SEMANTIC_ONLY` in `test/schema.test.ts`; schema should reject `fit` as an unknown intrinsic field once removed from `pxd.schema.json`.

**Step 4: Run tests to verify failure**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: FAIL because `TextNode` / JSON Schema / docs still allow `fit`, and because `maxWidth` does not set `wordWrap` yet.

**Step 5: Implement supported maxWidth semantics**

In `src/nodeTypes.ts`, add a top-level helper near `resolveTextStyle`:

```ts
function applyTextMaxWidth(node: ResolvedNode, target: Text): void {
    if (typeof node.maxWidth !== "number") return;
    target.style.wordWrap = true;
    target.style.wordWrapWidth = node.maxWidth;
}
```

Replace the existing maxWidth line in text `assign`:

```ts
if (typeof node.maxWidth === "number") target.style.wordWrapWidth = node.maxWidth;
```

with:

```ts
applyTextMaxWidth(node, target);
```

Do not add shrink/scale logic. If a host wants shrink-to-fit, it can override `text` in `nodeTypes`.

**Step 6: Remove `fit` from TypeScript types and schema**

In `src/types.ts`, remove this field from `TextNode`:

```ts
fit?: Decidable<string>;
```

In `pxd.schema.json`, remove this property from `$defs.textNode.properties`:

```json
"fit": { "$ref": "#/$defs/decidableString" },
```

In `doc/fixtures/valid/core-full.json`, remove:

```json
"fit": "shrink"
```

**Step 7: Update docs for text maxWidth semantics**

In `doc/pxd-v1.md` §4.3:

- Remove the `fit` row from the text table.
- Add prose under the table:

```md
`maxWidth` maps to Pixi Text word wrapping (`wordWrap` + `wordWrapWidth`). This lightweight reader does not define text auto-fit/shrink behavior; implement shrink-to-fit by overriding the `text` node type if your runtime needs it.
```

In README/guides, ensure no built-in docs mention `fit`.

**Step 8: Run targeted tests**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: PASS.

**Step 9: Commit**

```bash
git add test/intrinsics.test.ts src/nodeTypes.ts src/types.ts pxd.schema.json doc/pxd-v1.md doc/fixtures/valid/core-full.json doc/fixtures/invalid/text-fit-removed.json doc/fixtures/README.md README.md doc/guides
git commit -m "refactor: remove unused text fit field"
```

---

## Task 4: Remove open inline object payloads from built-ins

**Files:**
- Modify: `src/types.ts`
- Modify: `src/nodeTypes.ts`
- Modify: `pxd.schema.json`
- Modify: `doc/pxd-v1.md`
- Modify: `doc/guides/04-decisions-and-bindings.md`
- Modify: `test/intrinsics.test.ts`
- Create: `doc/fixtures/invalid/text-inline-style-object.json`
- Create: `doc/fixtures/invalid/graphics-inline-fill-object.json`
- Create: `doc/fixtures/invalid/graphics-inline-stroke-object.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Add schema rejection fixtures for inline objects**

Create `doc/fixtures/invalid/text-inline-style-object.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "title",
    "type": "text",
    "text": "Hello",
    "style": { "fontSize": 32, "fill": "#ffffff" }
  }
}
```

Create `doc/fixtures/invalid/graphics-inline-fill-object.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "panel",
    "type": "graphics",
    "shape": "rect",
    "width": 100,
    "height": 50,
    "fill": { "color": "#ffffff", "alpha": 0.5 }
  }
}
```

Create `doc/fixtures/invalid/graphics-inline-stroke-object.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "panel",
    "type": "graphics",
    "shape": "rect",
    "width": 100,
    "height": 50,
    "stroke": { "color": "#ffffff", "width": 2 }
  }
}
```

Update `doc/fixtures/README.md` invalid table with:

```md
| `invalid/text-inline-style-object.json` | Text uses removed inline Pixi style object; use a style id resolver or custom node type | §4.3 |
| `invalid/graphics-inline-fill-object.json` | Graphics uses removed inline Pixi fill object; use string color or custom node type | §4.4 |
| `invalid/graphics-inline-stroke-object.json` | Graphics uses removed inline Pixi stroke object; use string color + `strokeWidth` or custom node type | §4.4 |
```

Do **not** add these fixtures to `SEMANTIC_ONLY` in `test/schema.test.ts`; schema should reject them structurally after object forms are removed.

**Step 2: Run tests to verify failure**

Run:

```bash
npx tsc && node --test dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: FAIL because the schema currently accepts inline object forms through `decidableStringOrObject`.

**Step 3: Remove object forms from TypeScript types**

In `src/types.ts`, change `TextNode.style` from:

```ts
/** String form is Decidable; inline object form is NOT (§3.6 scope). */
style?: Decidable<string> | Record<string, unknown>;
```

to:

```ts
style?: Decidable<string>;
```

Change `GraphicsNode.fill` / `stroke` from:

```ts
/** String form is Decidable; inline object form is NOT (§3.6 scope). */
fill?: Decidable<string> | Record<string, unknown>;
/** String form is Decidable; inline object form is NOT (§3.6 scope). */
stroke?: Decidable<string> | Record<string, unknown>;
```

to:

```ts
fill?: Decidable<string>;
stroke?: Decidable<string>;
```

**Step 4: Simplify runtime assignment code**

In `src/nodeTypes.ts`, simplify `resolveTextStyle()` to string-only:

```ts
function resolveTextStyle(node: ResolvedNode, ctx: AssignContext): object | undefined {
    if (typeof node.style !== "string") return undefined;
    return ctx.resolve.style?.(ctx.readString(node.style));
}
```

In `drawShape()`, simplify fill/stroke handling to string-only:

```ts
if (typeof node.fill === "string") {
    g.fill(readString(node.fill));
}
if (typeof node.stroke === "string") {
    const strokeWidth = (node.strokeWidth as number | undefined) ?? 1;
    g.stroke({ color: readString(node.stroke), width: strokeWidth });
}
```

This preserves current string color behavior and removes arbitrary Pixi object passthrough.

**Step 5: Update JSON Schema**

In `pxd.schema.json`:

1. Delete `$defs.decidableStringOrObject` if no longer used.
2. Change `textNode.properties.style` to:

```json
"style": { "$ref": "#/$defs/decidableString" }
```

3. Change `graphicsNode.properties.fill` and `stroke` to:

```json
"fill": { "$ref": "#/$defs/decidableString" },
"stroke": { "$ref": "#/$defs/decidableString" },
```

**Step 6: Update docs**

In `doc/pxd-v1.md`:

- Change `text.style` type from `string/object` to `string`.
- Remove prose saying inline style objects are allowed/not constrained.
- Change `graphics.fill` and `graphics.stroke` types from `string/object` to `string`.
- Add a short note near text/graphics field tables:

```md
This lightweight reader keeps intrinsic fields strict. Complex Pixi `TextStyle`, `FillInput`, and `StrokeInput` objects are host/runtime concerns; use string ids/resolvers or custom `nodeTypes` when you need them.
```

In `doc/guides/04-decisions-and-bindings.md`, remove references to inline style/fill/stroke objects and keep the guidance that string ids/colors may be decision maps.

**Step 7: Run targeted tests**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: PASS.

**Step 8: Commit**

```bash
git add src/types.ts src/nodeTypes.ts pxd.schema.json doc/pxd-v1.md doc/guides/04-decisions-and-bindings.md test/intrinsics.test.ts doc/fixtures/invalid/text-inline-style-object.json doc/fixtures/invalid/graphics-inline-fill-object.json doc/fixtures/invalid/graphics-inline-stroke-object.json doc/fixtures/README.md
git commit -m "refactor: remove inline Pixi object payloads"
```

---

## Task 5: Lock graphics draw cases and validation errors

**Files:**
- Modify: `test/intrinsics.test.ts`
- Modify: `src/validate.ts`
- Create: `doc/fixtures/invalid/graphics-unknown-shape.json`
- Modify: `doc/fixtures/README.md`
- Modify: `test/schema.test.ts` if the new fixture is semantic-only or structural-only

**Step 1: Add drawShape tests for every shape case**

Update `test/intrinsics.test.ts` imports:

```ts
import { Container, Sprite, Text, Texture, type Graphics } from "pixi.js";
import { drawShape } from "../src/nodeTypes.js";
```

Add a fake graphics recorder and tests:

```ts
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
    const cases: Array<{ node: Record<string, unknown>; expected: unknown[] }> = [
        { node: { shape: "rect", width: 10, height: 20 }, expected: ["rect", 0, 0, 10, 20] },
        { node: { shape: "roundRect", width: 10, height: 20, radius: 3 }, expected: ["roundRect", 0, 0, 10, 20, 3] },
        { node: { shape: "circle", radius: 7 }, expected: ["circle", 0, 0, 7] },
        { node: { shape: "ellipse", width: 10, height: 20 }, expected: ["ellipse", 0, 0, 5, 10] },
        { node: { shape: "polygon", points: [0, 0, 10, 0, 10, 10] }, expected: ["poly", [0, 0, 10, 0, 10, 10]] },
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
```

These draw tests may already pass; they lock currently intended behavior.

**Step 2: Add failing validation tests for unknown and no-op literal graphics fields**

Append to `test/intrinsics.test.ts` imports:

```ts
import { validate, ValidationError } from "../src/validate.js";
```

Add:

```ts
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
```

**Step 3: Run tests to verify failure**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js
```

Expected: FAIL on both validation tests: current `validateGraphicsShape()` returns when shape is not in `shapeRequirements`, and it does not reject no-op extras such as `radius` on `rect`.

**Step 4: Implement unknown shape and no-op extra validation**

In `src/validate.ts`, replace this part of `validateGraphicsShape()`:

```ts
const reqs = shapeRequirements[shape];
if (!reqs) return;
```

with:

```ts
const reqs = shapeRequirements[shape];
if (!reqs) {
    throw new ValidationError(
        "rule 7",
        `graphics node '${node.id}' has unknown graphics shape '${shape}'`,
    );
}
```

Then add a small top-level helper table/function for literal-shape extras, for example:

```ts
const allowedGraphicsFieldsByShape: Record<string, ReadonlySet<string>> = {
    rect: new Set(["type", "id", "label", "x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible", "zIndex", "mask", "extensions", "shape", "width", "height", "fill", "stroke", "strokeWidth"]),
    roundRect: new Set(["type", "id", "label", "x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible", "zIndex", "mask", "extensions", "shape", "width", "height", "radius", "fill", "stroke", "strokeWidth"]),
    circle: new Set(["type", "id", "label", "x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible", "zIndex", "mask", "extensions", "shape", "radius", "fill", "stroke", "strokeWidth"]),
    ellipse: new Set(["type", "id", "label", "x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible", "zIndex", "mask", "extensions", "shape", "width", "height", "fill", "stroke", "strokeWidth"]),
    polygon: new Set(["type", "id", "label", "x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible", "zIndex", "mask", "extensions", "shape", "points", "fill", "stroke", "strokeWidth"]),
};
```

Use it only when `shape` is a literal string. Do not try to statically validate per-branch extras when `shape` itself is a decision map.

**Step 5: Add invalid fixture**

Create `doc/fixtures/invalid/graphics-unknown-shape.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "bad",
    "type": "graphics",
    "shape": "triangle"
  }
}
```

Create `doc/fixtures/invalid/graphics-noop-radius-on-rect.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "bad",
    "type": "graphics",
    "shape": "rect",
    "width": 100,
    "height": 50,
    "radius": 8
  }
}
```

Update `doc/fixtures/README.md` invalid table with:

```md
| `invalid/graphics-unknown-shape.json` | Graphics node uses an unsupported `shape` literal | §10 rule 7 |
| `invalid/graphics-noop-radius-on-rect.json` | Graphics rect declares no-op `radius`; use `roundRect` for rounded corners | §10 rule 7 |
```

Do **not** add this fixture to `SEMANTIC_ONLY` in `test/schema.test.ts`; the schema should reject it structurally because `decidableGraphicsShape` only allows known shape strings.

**Step 6: Run targeted tests**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: PASS.

**Step 7: Commit**

```bash
git add test/intrinsics.test.ts src/validate.ts doc/fixtures/invalid/graphics-unknown-shape.json doc/fixtures/invalid/graphics-noop-radius-on-rect.json doc/fixtures/README.md
git commit -m "test: lock graphics intrinsic semantics"
```

---

## Task 6: Move `spine` out of intrinsic support

**Files:**
- Modify: `src/types.ts`
- Modify: `src/validate.ts`
- Modify: `pxd.schema.json`
- Modify: `doc/pxd-v1.md`
- Modify: `doc/guides/02-custom-node-types.md`
- Modify: `doc/guides/04-decisions-and-bindings.md`
- Modify: `test/intrinsics.test.ts`
- Modify: `test/schema.test.ts` only if fixture classification changes
- Create: `doc/fixtures/valid/core-custom-spine.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Add failing custom-spine test**

Append to `test/intrinsics.test.ts`:

```ts
import type { NodeType } from "../src/context.js";
```

Merge with existing context imports if needed.

Add:

```ts
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
```

**Step 2: Run test to verify failure**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js
```

Expected: FAIL with `ValidationError [rule 7] spine node 'hero' must have string 'skeleton'`, because `validate.ts` currently treats `spine` as intrinsic.

**Step 3: Update TypeScript schema types**

In `src/types.ts`:

1. Delete the `SpineNode` interface.
2. Remove `| SpineNode` from `IntrinsicNode`.
3. Leave `CustomNode` open so hosts can still register a custom type named `spine` with top-level fields such as `skeleton`, `skin`, and `animation`.

**Step 4: Update validator intrinsic lists**

In `src/validate.ts`:

```ts
const INTRINSIC = new Set(["container", "sprite", "text", "graphics", "slot"]);
const NON_COMPOSABLE = new Set(["sprite", "text", "graphics", "slot"]);
```

Remove the `spine` entry from `intrinsicSpecs`:

```ts
const intrinsicSpecs: Record<string, FieldSpec[]> = {
    sprite: [{ name: "texture", check: isNonEmptyStr, label: "string" }],
    text: [{ name: "text", check: isString, label: "string" }],
    slot: [{ name: "slot", check: isNonEmptyStr, label: "string" }],
};
```

**Step 5: Update JSON Schema**

In `pxd.schema.json`:

1. Remove `"spine"` from `$defs.intrinsicTypeName.enum`.
2. Delete `$defs.spineNode`.
3. Remove `{ "$ref": "#/$defs/spineNode" }` from the `$defs.node.oneOf` list.

After this, a document with `type: "spine"` should match `customNode`, not an intrinsic branch.

**Step 6: Add valid custom-spine fixture**

Create `doc/fixtures/valid/core-custom-spine.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "hero",
    "type": "spine",
    "skeleton": "heroSkeleton",
    "skin": "default",
    "animation": "idle"
  }
}
```

Update `doc/fixtures/README.md` valid table:

```md
| `valid/core-custom-spine.json` | Spine-shaped node treated as a custom/runtime type, not a built-in intrinsic | §5 |
```

**Step 7: Update docs**

In `doc/pxd-v1.md`:

- Remove §4.6 `spine` from the intrinsic list, or replace it with a short note:

```md
### 4.6 Spine and other engine-specific objects

This lightweight Pixi reader does not define Spine as an intrinsic node type. Use a runtime/custom node type (§5), for example `type: "spine"`, and validate fields such as `skeleton`, `skin`, and `animation` in the host-provided `NodeType`.
```

- Update §3.5 non-composable list to remove `spine`.
- Update §3.6 decision-value scope to remove `skeleton`, `skin`, `animation` from intrinsic-specific examples, or mention they are custom scalar fields when using a custom Spine node.
- Update §10 rule 8 to remove `spine`.
- Update §11 optional intrinsic list to remove `spine`.

In `doc/guides/02-custom-node-types.md`, add a small note near the default registry paragraph:

```md
Spine/game objects are intentionally not built-ins in this package. Register them as custom `nodeTypes` so your engine owns the Spine runtime dependency and field semantics.
```

In `doc/guides/04-decisions-and-bindings.md`, remove `skeleton` from the intrinsic examples or rephrase it as custom field example.

**Step 8: Run targeted tests**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: PASS.

**Step 9: Commit**

```bash
git add src/types.ts src/validate.ts pxd.schema.json doc/pxd-v1.md doc/guides/02-custom-node-types.md doc/guides/04-decisions-and-bindings.md test/intrinsics.test.ts doc/fixtures/valid/core-custom-spine.json doc/fixtures/README.md
git commit -m "refactor: treat spine as custom node type"
```

---

## Task 7: Documentation pass for stabilized built-ins

**Files:**
- Modify: `README.md`
- Modify: `doc/guides/01-getting-started.md`
- Modify: `doc/guides/06-slots.md`
- Modify: `doc/pxd-v1.md`

**Step 1: Update README supported built-ins**

In `README.md`, ensure `What it supports` and extension docs say the intrinsic set is:

```md
- **Intrinsic Pixi nodes (§4):** `container`, `sprite`, `text`, `graphics`, and `slot`.
```

Add a short note near custom node docs:

```md
Spine, buttons, reels, layout controllers, and other engine/game-specific objects are custom `nodeTypes`, not built-ins.
```

**Step 2: Update getting started guide**

In `doc/guides/01-getting-started.md`, ensure the built-in field summary mentions:

```md
- `sprite`: final `texture` id, `tint`, `width`, `height`, `anchorX/Y`; atlas subtextures are resolved by the host through `texture` ids, not a separate `frame` field.
- `text`: `text`, `style`, `maxWidth` as Pixi word wrapping, `anchorX/Y`; shrink/fit policies are custom node type concerns.
- `slot`: readable mount area `width`/`height` plus the semantic `slot` name.
```

**Step 3: Update slot guide sizing claim**

In `doc/guides/06-slots.md`, replace the current sizing paragraph with wording that matches `SlotContainer`:

```md
The built-in slot uses a lightweight `SlotContainer`, so `width`/`height` return the declared PXD mount area even before content is mounted. This is intentionally different from default Pixi `Container.width`/`height`, which are bounds-derived and mutate scale when set. PXD does not auto-size the mounted content; the host decides how to use the declared area.
```

Keep the example that reads `mount.width`.

**Step 4: Check docs for stale spine/default intrinsic claims**

Run:

```bash
rg -n "spine|skeleton|skin|animation|nineSlice|tilingSprite|animatedSprite|bitmapText|fit|frame|style.*object|fill.*object|stroke.*object|slot.*width|slot.*height" README.md doc src test pxd.schema.json
```

Expected:

- `spine` appears only as custom-node guidance/future examples, not as intrinsic/default support.
- Docs do not mention built-in `text.fit`; shrink/fit policies are documented as custom-node concerns.
- Docs state that `sprite.texture` is the final opaque texture id and no `sprite.frame` / `resolve.frame` API exists.
- Slot sizing docs mention readable area, not auto-sizing mounted content.
- Docs do not advertise inline Pixi `TextStyle` / `FillInput` / `StrokeInput` object payloads for built-ins.

**Step 5: Commit docs**

```bash
git add README.md doc/guides/01-getting-started.md doc/guides/06-slots.md doc/pxd-v1.md
git commit -m "docs: describe stabilized intrinsic semantics"
```

---

## Task 8: Mark TODO progress and run full verification

**Files:**
- Modify: `TODO.md`

**Step 1: Update TODO section 4 checkboxes**

Change this part:

```md
- [ ] Сначала довести текущие built-ins до точной и протестированной семантики:
  - [ ] `container`: base/pivot fields.
  - [ ] `sprite`: `texture`, `tint`, `width`, `height`, `anchor`; remove unused `frame`.
  - [ ] `text`: `style`, `maxWidth`; remove unused `fit`.
  - [ ] `graphics`: все shape cases, ошибки неполных shape fields.
  - [ ] `slot`: реализовать/описать `width` и `height`.
- [ ] Решить судьбу `spine`: скорее убрать из default intrinsic support и оставить через custom `nodeTypes`.
```

to:

```md
- [x] Сначала довести текущие built-ins до точной и протестированной семантики:
  - [x] `container`: base/pivot fields.
  - [x] `sprite`: `texture`, `tint`, `width`, `height`, `anchor`; remove unused `frame`.
  - [x] `text`: `style`, `maxWidth`; remove unused `fit`.
  - [x] `graphics`: все shape cases, ошибки неполных shape fields.
  - [x] `slot`: реализовать/описать `width` и `height`.
- [x] Решить судьбу `spine`: скорее убрать из default intrinsic support и оставить через custom `nodeTypes`.
```

Leave these unchecked because they are explicitly follow-up after stabilization and not implemented in this plan:

```md
- [ ] Затем расширить PXD v1 intrinsic набор практичными Pixi v8 типами:
  - [ ] `nineSliceSprite`.
  - [ ] `tilingSprite`.
  - [ ] `animatedSprite`.
  - [ ] `bitmapText`.
```

Optionally mark this item checked if docs now clearly say engine-specific types are custom-only:

```md
- [x] Не добавлять engine/game-specific типы в базу: buttons, reels, layout controllers, Spine/game objects — через custom `nodeTypes`.
```

**Step 2: Run targeted suites**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/build.test.js dist/test/apply.test.js dist/test/schema.test.js
node dist/test/fixtures.test.js
```

Expected: PASS.

**Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

**Step 4: Inspect diff**

Run:

```bash
git diff --stat
git diff -- src/nodeTypes.ts src/context.ts src/types.ts src/validate.ts pxd.schema.json test/intrinsics.test.ts package.json README.md doc/pxd-v1.md doc/guides/01-getting-started.md doc/guides/02-custom-node-types.md doc/guides/04-decisions-and-bindings.md doc/guides/06-slots.md TODO.md
```

Expected checklist:

- Dedicated intrinsic suite covers container, sprite, text, graphics, slot, and custom-spine behavior.
- `slot` uses `SlotContainer`; empty slot width/height return the declared mount area rather than default Pixi bounds-derived size.
- `sprite.frame` is removed; host asset handling stays in `resolve.texture` with final texture ids.
- `text.fit` is removed; built-in `maxWidth` maps to Pixi word wrapping.
- Inline Pixi object payloads are removed from built-ins: `text.style`, `graphics.fill`, and `graphics.stroke` are string-only.
- Graphics unknown literal shapes and literal-shape no-op extras throw `ValidationError [rule 7]`.
- `spine` is no longer in intrinsic lists/schema/types; it is custom-node territory.
- No new Pixi v8 intrinsic types were added in this plan.

**Step 5: Commit TODO/final verification state**

```bash
git add TODO.md
git commit -m "chore: mark intrinsic stabilization complete"
```

---

## Final verification checklist

- `npx tsc && node --test dist/test/intrinsics.test.js dist/test/build.test.js dist/test/apply.test.js dist/test/schema.test.js` passes.
- `node dist/test/fixtures.test.js` passes.
- `npm test` passes.
- `defaultNodeTypes` contains exactly `container`, `sprite`, `text`, `graphics`, `slot`.
- `spine` is handled as a custom `nodeTypes` example, not a built-in intrinsic.
- Slot `width`/`height` are readable before mounting content.
- Built-in `text.style`, `graphics.fill`, and `graphics.stroke` are string-only; complex Pixi objects require resolvers/custom node types.
- `sprite.frame` / `resolve.frame` do not exist; final texture id semantics are documented.
- `text.fit` is removed; supported `maxWidth` word wrapping is tested.
- New Pixi v8 types remain unchecked/future in `TODO.md`.
