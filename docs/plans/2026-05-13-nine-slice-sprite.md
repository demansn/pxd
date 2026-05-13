# Nine Slice Sprite Intrinsic Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add `nineSliceSprite` as the next practical Pixi v8 intrinsic node type in PXD v1.

**Architecture:** Keep Pixi behavior in the existing hand-written `defaultNodeTypes` registry, while updating TypeScript types, semantic validation, JSON Schema, fixtures, and docs in lockstep. `nineSliceSprite` is a strict, non-composable intrinsic backed by Pixi v8 `NineSliceSprite`; it uses the existing texture resolver, binding resolver, decision resolution, anchor helper, and build/apply dispatch order.

**Tech Stack:** TypeScript `NodeNext`, Pixi.js v8 `NineSliceSprite` / `Texture`, Node.js `node:test`, Ajv draft 2020-12, existing `build/apply/validate` pipeline.

---

## Codebase analysis summary

Next concrete unchecked TODO item is in `TODO.md` §4:

```md
- [ ] Затем расширить PXD v1 intrinsic набор практичными Pixi v8 типами:
  - [ ] `nineSliceSprite`.
```

Current relevant state:

- `src/nodeTypes.ts` registers strict built-ins: `container`, `sprite`, `text`, `graphics`, `slot`.
- `src/types.ts`, `src/validate.ts`, `pxd.schema.json`, and docs all agree on those five intrinsic names.
- `build()` and `apply()` already share the same `NodeType { create, assign }` registry and run type-specific `assign` before base fields. Preserve this order.
- Non-composable intrinsic children are enforced in `src/validate.ts` through `NON_COMPOSABLE` and in schema through absence of `children` plus `unevaluatedProperties: false`.
- Decision resolution and binding resolution already happen before typed resolvers: `texture: "{id}"` should work automatically if `assign` calls `ctx.readString(node.texture)` before `ctx.resolve.texture(...)`.
- Pixi v8 `NineSliceSprite` API from `node_modules/pixi.js/lib/scene/sprite-nine-slice/NineSliceSprite.d.ts` exposes: `texture`, `width`, `height`, `leftWidth`, `topHeight`, `rightWidth`, `bottomHeight`, and `anchor`.

Implementation decisions:

1. Add intrinsic type name exactly as TODO says: `nineSliceSprite`.
2. Back it with Pixi `NineSliceSprite` from `pixi.js`.
3. Fields:
   - required: `texture: Decidable<string>`;
   - optional scalar/decidable numbers: `width`, `height`, `leftWidth`, `topHeight`, `rightWidth`, `bottomHeight`, `anchorX`, `anchorY`.
4. Do **not** add `tint` unless there is a proven Pixi API need. Unlike `Sprite`, `NineSliceSprite` is a `ViewContainer`, not a `Sprite` subclass.
5. `nineSliceSprite` is non-composable: no `children`.
6. Keep patch semantics: absent optional fields during `apply()` leave old Pixi values unchanged.
7. Keep schema manual for this plan. The descriptor/generator TODO §5 remains future work.
8. Do not implement `tilingSprite`, `animatedSprite`, or `bitmapText` in this plan.

---

### Task 1: Add failing runtime tests for `nineSliceSprite` build/apply

**Files:**
- Modify: `test/intrinsics.test.ts`
- Modify: `test/apply.test.ts`

**Step 1: Write the failing build test**

In `test/intrinsics.test.ts`, update the Pixi import:

```ts
import { Container, NineSliceSprite, Sprite, Text, Texture, type Graphics } from "pixi.js";
```

Add this test after the sprite tests:

```ts
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
```

**Step 2: Write the failing apply test**

In `test/apply.test.ts`, update the Pixi import:

```ts
import { Container, NineSliceSprite, Texture } from "pixi.js";
```

Add this test near the other apply patch tests:

```ts
test("apply: patches nineSliceSprite type-specific fields", () => {
    const oldTexture = Texture.EMPTY;
    const newTexture = Texture.WHITE;
    const textureCalls: string[] = [];

    const root = build({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "panel",
            type: "nineSliceSprite",
            texture: "oldPanel",
            width: 100,
            height: 50,
            leftWidth: 5,
            anchorX: 0,
            anchorY: 0,
        },
    }, {
        resolve: { texture: () => oldTexture },
    });

    assert.ok(root instanceof NineSliceSprite);

    const count = apply({
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "panel",
            type: "nineSliceSprite",
            texture: "newPanel",
            width: 220,
            height: 90,
            leftWidth: 11,
            topHeight: 12,
            anchorX: 0.5,
            anchorY: 1,
            x: 30,
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
    assert.deepEqual(textureCalls, ["newPanel"]);
    assert.equal(root.texture, newTexture);
    assert.equal(root.width, 220);
    assert.equal(root.height, 90);
    assert.equal(root.leftWidth, 11);
    assert.equal(root.topHeight, 12);
    assert.equal(root.anchor.x, 0.5);
    assert.equal(root.anchor.y, 1);
    assert.equal(root.x, 30, "base fields still apply after type-specific assign");
});
```

**Step 3: Run tests to verify failure**

Run:

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/apply.test.js
```

Expected: FAIL with validation/schema/runtime errors because `nineSliceSprite` is not yet an intrinsic/default node type.

**Step 4: Commit failing tests**

```bash
git add test/intrinsics.test.ts test/apply.test.ts
git commit -m "test: cover nineSliceSprite intrinsic"
```

---

### Task 2: Add `NineSliceSpriteNode` to TypeScript schema types

**Files:**
- Modify: `src/types.ts`

**Step 1: Write the type changes**

In `src/types.ts`, add this interface after `SpriteNode`:

```ts
export interface NineSliceSpriteNode extends BaseNode {
    type: "nineSliceSprite";
    texture: Decidable<string>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    leftWidth?: Decidable<number>;
    topHeight?: Decidable<number>;
    rightWidth?: Decidable<number>;
    bottomHeight?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}
```

Update `IntrinsicNode`:

```ts
export type IntrinsicNode =
    | ContainerNode
    | SpriteNode
    | NineSliceSpriteNode
    | TextNode
    | GraphicsNode
    | SlotNode;
```

**Step 2: Run TypeScript**

```bash
npx tsc --noEmit
```

Expected: still FAIL because implementation/validation/schema are not updated yet, or PASS if only types compile. Continue regardless; full tests still fail from Task 1.

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add nineSliceSprite node type"
```

---

### Task 3: Implement default `nineSliceSprite` NodeType

**Files:**
- Modify: `src/nodeTypes.ts`

**Step 1: Update imports**

Replace the Pixi import with:

```ts
import { Container, Graphics, NineSliceSprite, Sprite, Text, Texture } from "pixi.js";
```

**Step 2: Extend the anchor helper target type**

Replace:

```ts
export function setAnchorFromNode(target: Sprite | Text, node: ResolvedNode): void {
```

with:

```ts
export function setAnchorFromNode(target: Sprite | Text | NineSliceSprite, node: ResolvedNode): void {
```

**Step 3: Add assignment helper**

Add this helper near the `sprite` node type:

```ts
function assignNineSliceBorderFields(node: ResolvedNode, target: NineSliceSprite): void {
    if (typeof node.leftWidth === "number") target.leftWidth = node.leftWidth;
    if (typeof node.topHeight === "number") target.topHeight = node.topHeight;
    if (typeof node.rightWidth === "number") target.rightWidth = node.rightWidth;
    if (typeof node.bottomHeight === "number") target.bottomHeight = node.bottomHeight;
}
```

**Step 4: Add the node type**

Add after `sprite`:

```ts
const nineSliceSprite: NodeType = {
    create: () => new NineSliceSprite(Texture.EMPTY),
    // Order matters: texture/borders first, then explicit display size.
    assign: (node, target, ctx) => {
        if (!(target instanceof NineSliceSprite)) return;
        if (typeof node.texture === "string" && ctx.resolve.texture) {
            target.texture = ctx.resolve.texture(ctx.readString(node.texture));
        }
        assignNineSliceBorderFields(node, target);
        if (typeof node.width === "number") target.width = node.width;
        if (typeof node.height === "number") target.height = node.height;
        setAnchorFromNode(target, node);
    },
};
```

Update `defaultNodeTypes`:

```ts
export const defaultNodeTypes: ReadonlyMap<string, NodeType> = new Map<string, NodeType>([
    ["container", container],
    ["sprite", sprite],
    ["nineSliceSprite", nineSliceSprite],
    ["text", text],
    ["graphics", graphics],
    ["slot", slot],
]);
```

**Step 5: Run targeted runtime tests**

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/apply.test.js
```

Expected: still FAIL in validation because `validate.ts` does not know the intrinsic yet.

**Step 6: Commit**

```bash
git add src/nodeTypes.ts
git commit -m "feat: implement nineSliceSprite node type"
```

---

### Task 4: Update semantic validation

**Files:**
- Modify: `src/validate.ts`

**Step 1: Add intrinsic/non-composable name**

Update:

```ts
const INTRINSIC = new Set(["container", "sprite", "text", "graphics", "slot"]);
const NON_COMPOSABLE = new Set(["sprite", "text", "graphics", "slot"]);
```

To:

```ts
const INTRINSIC = new Set(["container", "sprite", "nineSliceSprite", "text", "graphics", "slot"]);
const NON_COMPOSABLE = new Set(["sprite", "nineSliceSprite", "text", "graphics", "slot"]);
```

**Step 2: Add allowed fields**

In `intrinsicAllowedFields`, add:

```ts
nineSliceSprite: new Set([
    ...COMMON_NODE_FIELDS,
    "texture",
    "width",
    "height",
    "leftWidth",
    "topHeight",
    "rightWidth",
    "bottomHeight",
    "anchorX",
    "anchorY",
]),
```

**Step 3: Add required field spec**

In `intrinsicSpecs`, add:

```ts
nineSliceSprite: [{ name: "texture", check: isNonEmptyStr, label: "string" }],
```

**Step 4: Add optional field type checks for the new intrinsic**

In `optionalIntrinsicSpecs`, add:

```ts
nineSliceSprite: [
    { name: "width", check: isNumber, label: "number" },
    { name: "height", check: isNumber, label: "number" },
    { name: "leftWidth", check: isNumber, label: "number" },
    { name: "topHeight", check: isNumber, label: "number" },
    { name: "rightWidth", check: isNumber, label: "number" },
    { name: "bottomHeight", check: isNumber, label: "number" },
    { name: "anchorX", check: isNumber, label: "number" },
    { name: "anchorY", check: isNumber, label: "number" },
],
```

**Step 5: Run targeted runtime tests**

```bash
npx tsc && node --test dist/test/intrinsics.test.js dist/test/apply.test.js
```

Expected: PASS for runtime tests. Schema/fixture tests may still fail until Task 5/6.

**Step 6: Commit**

```bash
git add src/validate.ts
git commit -m "feat: validate nineSliceSprite intrinsic"
```

---

### Task 5: Update JSON Schema

**Files:**
- Modify: `pxd.schema.json`
- Modify: `test/schema.test.ts` only if needed for semantic-only classification (expected: no change)

**Step 1: Add intrinsic type name**

Update `$defs.intrinsicTypeName.enum`:

```json
"enum": ["container", "sprite", "nineSliceSprite", "text", "graphics", "slot"]
```

**Step 2: Add `nineSliceSpriteNode` definition**

Add this `$defs` entry after `spriteNode`:

```json
"nineSliceSpriteNode": {
  "allOf": [{ "$ref": "#/$defs/baseNode" }],
  "properties": {
    "type":         { "const": "nineSliceSprite" },
    "texture":      { "$ref": "#/$defs/decidableString" },
    "width":        { "$ref": "#/$defs/decidableNumber" },
    "height":       { "$ref": "#/$defs/decidableNumber" },
    "leftWidth":    { "$ref": "#/$defs/decidableNumber" },
    "topHeight":    { "$ref": "#/$defs/decidableNumber" },
    "rightWidth":   { "$ref": "#/$defs/decidableNumber" },
    "bottomHeight": { "$ref": "#/$defs/decidableNumber" },
    "anchorX":      { "$ref": "#/$defs/decidableNumber" },
    "anchorY":      { "$ref": "#/$defs/decidableNumber" }
  },
  "required": ["type", "texture"],
  "unevaluatedProperties": false
},
```

**Step 3: Add it to node union**

In `$defs.node.oneOf`, add:

```json
{ "$ref": "#/$defs/nineSliceSpriteNode" },
```

between sprite and text.

**Step 4: Run schema tests**

```bash
npx tsc && node --test dist/test/schema.test.js
```

Expected: PASS or no new coverage yet. Fixture coverage arrives in Task 6.

**Step 5: Commit**

```bash
git add pxd.schema.json test/schema.test.ts
git commit -m "feat: add nineSliceSprite to schema"
```

---

### Task 6: Add conformance fixtures

**Files:**
- Create: `doc/fixtures/valid/core-nine-slice-sprite.json`
- Create: `doc/fixtures/invalid/nine-slice-missing-texture.json`
- Create: `doc/fixtures/invalid/nine-slice-bad-border.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Add valid fixture**

Create `doc/fixtures/valid/core-nine-slice-sprite.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "level": "core",
  "root": {
    "id": "panel",
    "type": "nineSliceSprite",
    "texture": "ui/panel",
    "width": 320,
    "height": 120,
    "leftWidth": 12,
    "topHeight": 14,
    "rightWidth": 16,
    "bottomHeight": 18,
    "anchorX": 0.5,
    "anchorY": 0.5
  }
}
```

**Step 2: Add invalid fixture for missing required texture**

Create `doc/fixtures/invalid/nine-slice-missing-texture.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "panel",
    "type": "nineSliceSprite",
    "width": 320,
    "height": 120
  }
}
```

**Step 3: Add invalid fixture for wrong border type**

Create `doc/fixtures/invalid/nine-slice-bad-border.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "panel",
    "type": "nineSliceSprite",
    "texture": "ui/panel",
    "leftWidth": "12"
  }
}
```

**Step 4: Update fixture README**

In `doc/fixtures/README.md`, add valid row:

```md
| `valid/core-nine-slice-sprite.json` | `nineSliceSprite` intrinsic with texture, borders, size, and anchor | §4.6 |
```

Add invalid rows:

```md
| `invalid/nine-slice-missing-texture.json` | `nineSliceSprite` missing required `texture` | §10 rule 7 |
| `invalid/nine-slice-bad-border.json` | `nineSliceSprite` border field has wrong scalar type | §10 rule 7 |
```

**Step 5: Run fixture and schema tests**

```bash
npx tsc && node dist/test/fixtures.test.js && node --test dist/test/schema.test.js
```

Expected: PASS. If `schema.test.ts` classifies either new invalid fixture as semantic-only, that is wrong; both should be structural/schema rejections and should not be added to `SEMANTIC_ONLY`.

**Step 6: Commit**

```bash
git add doc/fixtures/valid/core-nine-slice-sprite.json doc/fixtures/invalid/nine-slice-missing-texture.json doc/fixtures/invalid/nine-slice-bad-border.json doc/fixtures/README.md
git commit -m "test: add nineSliceSprite fixtures"
```

---

### Task 7: Update PXD spec docs

**Files:**
- Modify: `doc/pxd-v1.md`

**Step 1: Update composability list**

Replace both non-composable lists that currently say:

```md
`sprite`, `text`, `graphics`, `slot`
```

with:

```md
`sprite`, `nineSliceSprite`, `text`, `graphics`, `slot`
```

Locations to update:

- §3.5 Composability
- §10 rule 8

**Step 2: Update decision scope list**

In §3.6 decision values scope, add the new scalar fields to the intrinsic-specific list:

```md
`leftWidth`, `topHeight`, `rightWidth`, `bottomHeight`
```

Keep existing scalar fields such as `texture`, `width`, `height`, `anchorX`, `anchorY`.

**Step 3: Add §4.6 `nineSliceSprite`**

Insert this section after §4.5 `slot`, then renumber the existing Spine section from `4.6` to `4.7`:

````md
### 4.6 `nineSliceSprite`

A scalable textured panel using Pixi v8 nine-slice scaling. Corners remain unscaled while edges and the center stretch to the requested display size.

```json
{
  "id": "panel",
  "type": "nineSliceSprite",
  "texture": "ui/panel",
  "width": 320,
  "height": 120,
  "leftWidth": 12,
  "topHeight": 12,
  "rightWidth": 12,
  "bottomHeight": 12
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `texture` | string | yes | — | Opaque final texture identifier (§7) |
| `width` | number | no | Pixi default | Display width |
| `height` | number | no | Pixi default | Display height |
| `leftWidth` | number | no | Pixi default | Unscaled left border width |
| `topHeight` | number | no | Pixi default | Unscaled top border height |
| `rightWidth` | number | no | Pixi default | Unscaled right border width |
| `bottomHeight` | number | no | Pixi default | Unscaled bottom border height |
| `anchorX` | number | no | 0 | Anchor X in [0, 1] |
| `anchorY` | number | no | 0 | Anchor Y in [0, 1] |

`texture` follows the same opaque final-texture semantics as `sprite.texture`. For atlas subtextures, encode the subtexture key into the texture id and resolve it in the host's texture resolver.
````

**Step 4: Update conformance optional intrinsic list**

In §11, replace:

```md
- Support any subset of the optional intrinsic types `graphics` and `slot`.
```

with:

```md
- Support any subset of the optional intrinsic types `graphics`, `slot`, and `nineSliceSprite`.
```

**Step 5: Run markdown grep sanity checks**

```bash
rg -n "4\.6|4\.7|nineSliceSprite|Non-composable intrinsic" doc/pxd-v1.md
```

Expected: `nineSliceSprite` appears in §3.5, §3.6, §4.6, §10 rule 8, and §11; Spine appears under §4.7.

**Step 6: Commit**

```bash
git add doc/pxd-v1.md
git commit -m "docs: specify nineSliceSprite intrinsic"
```

---

### Task 8: Update README and guides

**Files:**
- Modify: `README.md`
- Modify: `doc/guides/01-getting-started.md` only if it lists built-ins
- Modify: `doc/guides/02-custom-node-types.md`

**Step 1: Update default registry lists**

In `README.md`, replace built-in list:

```md
`container`, `sprite`, `text`, `graphics`, `slot`
```

with:

```md
`container`, `sprite`, `nineSliceSprite`, `text`, `graphics`, `slot`
```

Do this in:

- Extension points section
- Tests section (`test/intrinsics.test.ts` description)
- Any “What it supports” intrinsic list if present

In `doc/guides/02-custom-node-types.md`, update the first paragraph similarly:

```md
The default registry (`defaultNodeTypes`) covers intrinsic types: `container`, `sprite`, `nineSliceSprite`, `text`, `graphics`, `slot`.
```

**Step 2: Add short README note**

In README “What it supports” or near Extension points, add one concise sentence:

```md
`nineSliceSprite` is available for scalable Pixi UI panels and uses the same `texture` resolver as `sprite`.
```

**Step 3: Search for stale intrinsic lists**

Run:

```bash
rg -n "container.*sprite.*text.*graphics.*slot|sprite`, `text`, `graphics`, `slot|graphics` and `slot`" README.md doc src test TODO.md
```

Expected: only intentional historical/TODO mentions remain. Update any user-facing current docs that still omit `nineSliceSprite`.

**Step 4: Commit**

```bash
git add README.md doc/guides/01-getting-started.md doc/guides/02-custom-node-types.md
git commit -m "docs: mention nineSliceSprite built-in"
```

---

### Task 9: Run full verification and update TODO

**Files:**
- Modify: `TODO.md`

**Step 1: Run full test suite**

```bash
npm test
```

Expected: PASS. The script should compile, run `dist/test/fixtures.test.js`, then run all `node --test` suites.

**Step 2: Run package dry-run**

```bash
npm pack --dry-run
```

Expected: PASS and package contains only intended files (`dist/src`, `doc/pxd-v1.md`, `pxd.schema.json`, `README.md`, `LICENSE`).

**Step 3: Update TODO**

In `TODO.md`, mark only this item complete:

```md
- [x] `nineSliceSprite`.
```

Do not mark the parent “Затем расширить...” item complete until `tilingSprite`, `animatedSprite`, and `bitmapText` are also done.

**Step 4: Commit**

```bash
git add TODO.md
git commit -m "chore: mark nineSliceSprite todo complete"
```

---

### Task 10: Final review checkpoint

**Files:**
- No planned edits unless review finds issues.

**Step 1: Inspect final diff**

```bash
git status --short
git log --oneline -10
git diff HEAD~9..HEAD -- src/types.ts src/nodeTypes.ts src/validate.ts pxd.schema.json doc/pxd-v1.md README.md doc/guides test doc/fixtures TODO.md
```

Expected: clean working tree, focused commits, no unrelated changes.

**Step 2: Re-run final verification**

```bash
npm test
npm pack --dry-run
```

Expected: both PASS.

**Step 3: If anything fails**

Do not proceed with success claims. Fix the smallest failing issue, re-run the targeted command, then re-run full verification.

**Step 4: Final commit only if fixes were needed**

```bash
git add <changed-files>
git commit -m "fix: address nineSliceSprite review issues"
```
