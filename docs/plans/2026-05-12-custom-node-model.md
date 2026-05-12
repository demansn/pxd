# Custom Node Model Simplification Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Remove `props` as a public/special custom-node payload and make custom node parameters plain top-level node fields that participate in normal decision resolution.

**Architecture:** Keep intrinsic nodes strict and custom/runtime nodes open. Validation and JSON Schema should reject `props` on every node as an obsolete/reserved field, while allowing arbitrary non-reserved top-level fields on custom nodes. The existing `resolveNodeFields()` pipeline already resolves arbitrary top-level decision maps; removing `props` from the structural skip list and adding tests locks that behavior in.

**Tech Stack:** TypeScript `NodeNext`, Node.js `node:test`, Ajv draft 2020-12, existing `validate/build/apply` pipeline, handwritten `pxd.schema.json`, Markdown docs.

---

## Codebase analysis summary

Current state relevant to TODO item 1:

- `src/types.ts`
  - `CustomNode` currently exposes `props?: Record<string, unknown>` and no index signature for top-level custom fields.
- `src/decisions.ts`
  - `NON_DECIDABLE_KEYS` currently includes `"props"`, so a legacy `props` object is never decision-resolved.
  - Arbitrary top-level fields already get resolved because `resolveNodeFields()` iterates all node entries and resolves anything not in `NON_DECIDABLE_KEYS`.
- `src/validate.ts`
  - Intrinsic nodes reject `props` (`rule 10`).
  - Prefab references have a special `props` rejection (`rule 23`).
  - Runtime/custom nodes currently allow `props`.
  - Runtime/custom nodes still reject `children`; keep that for this item because TODO item 2 handles custom composability separately.
- `pxd.schema.json`
  - `customNode` currently only allows base fields plus `props` and has `unevaluatedProperties: false`.
  - To support top-level custom fields, `customNode` must allow unevaluated custom fields but explicitly reject reserved obsolete `props` and, for now, `children`.
- Tests/docs with legacy `props`
  - `test/build.test.ts` has a custom `Button` fixture using `props`.
  - `test/schema.test.ts` marks `prefab-ref-with-props.json` as schema-accepted semantic-only; this will change once schema rejects `props`.
  - README and guides document `node.props`.
  - `doc/pxd-v1.md` describes runtime nodes as using `props`.

Implementation stance for ambiguity in TODO wording:

- Treat `props` as removed hard (`0.x` breaking change): documents containing a node-level `props` field should fail both schema and semantic validation.
- Do **not** add custom `children` support in this item; keep current runtime/custom `children` rejection until TODO item 2.
- Custom fields are open at the top level and owned by the host/runtime. The library only validates generic decision-map shape for scalar decision maps.

---

### Task 1: Add failing tests and fixtures for the new custom-node model

**Files:**
- Modify: `test/build.test.ts`
- Modify: `test/schema.test.ts`
- Create: `doc/fixtures/valid/core-custom-top-level.json`
- Create: `doc/fixtures/invalid/custom-props.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Add a valid fixture with top-level custom fields**

Create `doc/fixtures/valid/core-custom-top-level.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "root",
    "type": "container",
    "children": [
      {
        "id": "spinBtn",
        "type": "SpinButton",
        "text": { "_": "SPIN", "mobile": "TAP" },
        "enabled": true,
        "variant": "primary"
      }
    ]
  }
}
```

**Step 2: Add an invalid fixture for legacy `props` on a custom node**

Create `doc/fixtures/invalid/custom-props.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "root",
    "type": "container",
    "children": [
      {
        "id": "spinBtn",
        "type": "SpinButton",
        "props": { "text": "SPIN" }
      }
    ]
  }
}
```

**Step 3: Update fixture README**

In `doc/fixtures/README.md`, add rows:

```md
| `valid/core-custom-top-level.json` | Runtime/custom node with top-level custom fields and a decision map | §5, §3.6 |
| `invalid/custom-props.json` | Legacy runtime/custom node `props` payload is rejected; use top-level fields | §5 migration |
```

Also update any existing text that says runtime types use `props`.

**Step 4: Update the custom build test to use top-level fields**

In `test/build.test.ts`, replace the existing `build: custom node type for runtime-registered type` test with:

```ts
test("build: custom node type receives top-level fields", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "btn", type: "Button", text: "OK", enabled: true }],
        },
    };
    let captured: { text?: unknown; enabled?: unknown } | undefined;
    const buttonType: NodeType = {
        create: () => new Container(),
        assign: (node) => {
            captured = { text: node.text, enabled: node.enabled };
        },
    };

    const root = build(doc, {
        resolve: resolveStub,
        nodeTypes: new Map([["Button", buttonType]]),
    });

    assert.deepEqual(captured, { text: "OK", enabled: true });
    assert.equal(root.children[0].label, "btn");
});
```

**Step 5: Add a decision-resolution regression test for custom scalar fields**

Add this test near the custom node test in `test/build.test.ts`:

```ts
test("build: custom top-level decision field is resolved before assign", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "btn",
                    type: "Button",
                    text: { _: "SPIN", mobile: "TAP" },
                    enabled: { _: false, mobile: true },
                },
            ],
        },
    };
    let captured: { text?: unknown; enabled?: unknown } | undefined;
    const buttonType: NodeType = {
        create: () => new Container(),
        assign: (node) => {
            captured = { text: node.text, enabled: node.enabled };
        },
    };

    build(doc, {
        resolve: resolveStub,
        activeTags: ["mobile"],
        nodeTypes: new Map([["Button", buttonType]]),
    });

    assert.deepEqual(captured, { text: "TAP", enabled: true });
});
```

**Step 6: Add a semantic validation test for legacy `props`**

If there is no dedicated validate suite, add this to `test/build.test.ts` imports:

```ts
import { validate, ValidationError } from "../src/validate.js";
```

Then add:

```ts
test("validate: custom node props are rejected; use top-level fields", () => {
    assert.throws(
        () => validate({
            format: "pxd",
            version: 1,
            root: {
                id: "root",
                type: "container",
                children: [{ id: "btn", type: "Button", props: { text: "OK" } }],
            },
        }),
        (error) => error instanceof ValidationError
            && error.rule === "rule 10"
            && /must not have 'props'/.test(error.message),
    );
});
```

**Step 7: Run focused tests to verify failure**

Run:

```bash
npx tsc && node --test dist/test/build.test.js dist/test/schema.test.js
```

Expected before implementation:

- `validate: custom node props are rejected` FAILS because `validate.ts` currently allows custom `props`.
- `schema — valid core/library fixtures / core-custom-top-level.json` FAILS because `pxd.schema.json` currently rejects unknown top-level custom fields.
- `schema — structural invalid fixtures / custom-props.json` FAILS because schema currently accepts custom `props`.

**Step 8: Commit only if your workflow allows red commits**

Preferred: do not commit yet; commit after Task 3 when tests are green.

---

### Task 2: Update TypeScript model and decision structural keys

**Files:**
- Modify: `src/types.ts`
- Modify: `src/decisions.ts`

**Step 1: Remove `props` from `CustomNode` and allow top-level custom fields**

In `src/types.ts`, replace:

```ts
export interface CustomNode extends BaseNode {
    type: string;
    props?: Record<string, unknown>;
    children?: never;
}
```

with:

```ts
export interface CustomNode extends BaseNode {
    type: string;
    /**
     * Runtime/custom node fields live directly on the node. Their shape is
     * owned by the host-provided NodeType implementation.
     */
    [field: string]: unknown;
    children?: never;
}
```

**Step 2: Remove `props` from non-decidable keys**

In `src/decisions.ts`, replace:

```ts
export const NON_DECIDABLE_KEYS: ReadonlySet<string> = new Set([
    "id",
    "type",
    "mask",
    "children",
    "extensions",
    "props",
    "points",
]);
```

with:

```ts
export const NON_DECIDABLE_KEYS: ReadonlySet<string> = new Set([
    "id",
    "type",
    "mask",
    "children",
    "extensions",
    "points",
]);
```

Also update the comment below from:

```ts
 * `activeTags`. Structural fields (id, type, mask, children, extensions, props,
 * points) are passed through unchanged.
```

to:

```ts
 * `activeTags`. Structural fields (id, type, mask, children, extensions,
 * points) are passed through unchanged.
```

**Step 3: Run typecheck-focused test**

Run:

```bash
npx tsc
```

Expected: may still FAIL because tests/docs still reference `node.props`. If the only TS references were changed in Task 1, this should PASS.

**Step 4: Do not commit yet**

The test suite remains red until validation and schema are updated.

---

### Task 3: Update semantic validation to reject `props` globally and remove special cases

**Files:**
- Modify: `src/validate.ts`
- Test: `test/build.test.ts`
- Test fixtures: `doc/fixtures/invalid/custom-props.json`

**Step 1: Replace intrinsic-only `props` rejection with a global node-level rejection**

In `src/validate.ts`, replace:

```ts
    // §10 rule 10 — intrinsic nodes MUST NOT have props (§5 rule 5)
    if (INTRINSIC.has(node.type) && node.props !== undefined) {
        throw new ValidationError(
            "rule 10",
            `intrinsic type '${node.type}' on node '${node.id}' must not have 'props'`,
        );
    }
```

with:

```ts
    // §5 migration — `props` was removed from the public node model in 0.x.
    // Custom/runtime parameters now live as top-level fields and participate in §3.6.
    if (node.props !== undefined) {
        throw new ValidationError(
            "rule 10",
            `node '${node.id}' must not have 'props'; put custom fields directly on the node`,
        );
    }
```

**Step 2: Remove prefab-reference `props` special case**

In the `if (isPrefabRef)` block, remove this block entirely:

```ts
        if (node.props !== undefined) {
            throw new ValidationError(
                "rule 23",
                `prefab reference '${node.type}' on node '${node.id}' must not have 'props'`,
            );
        }
```

Keep the `children` rejection in that block unchanged.

**Step 3: Update comments around prefab refs**

Change:

```ts
    // §15 rule 19 — prefab references MUST NOT have props or children
```

to:

```ts
    // §15 rule 19 — prefab references MUST NOT have children.
    // `props` is rejected globally above; prefab parameters are not part of this item.
```

**Step 4: Run validation-focused tests**

Run:

```bash
npx tsc && node dist/test/fixtures.test.js && node --test dist/test/build.test.js
```

Expected after this task:

- `validate: custom node props are rejected; use top-level fields` PASS.
- `invalid/custom-props.json` rejected with `[rule 10]`.
- Existing `invalid/intrinsic-has-props.json` still rejected, but message is now generic.
- Existing `invalid/prefab-ref-with-props.json` still rejected, but with `[rule 10]` instead of `[rule 23]`.
- Schema tests may still fail until Task 4.

**Step 5: Commit if build/fixtures/build tests are green**

```bash
git add src/types.ts src/decisions.ts src/validate.ts test/build.test.ts doc/fixtures/valid/core-custom-top-level.json doc/fixtures/invalid/custom-props.json doc/fixtures/README.md
git commit -m "feat: simplify custom node fields"
```

---

### Task 4: Update JSON Schema for open custom top-level fields without `props`

**Files:**
- Modify: `pxd.schema.json`
- Modify: `test/schema.test.ts`

**Step 1: Add a reusable custom field schema**

In `pxd.schema.json`, add this definition near the other decidable defs:

```json
"customField": {
  "$comment": "Custom runtime fields are owned by the host. Scalar decision maps are structurally accepted here; validate.ts enforces decision-map consistency.",
  "anyOf": [
    { "type": "null" },
    { "type": "string" },
    { "type": "number" },
    { "type": "boolean" },
    { "$ref": "#/$defs/decisionString" },
    { "$ref": "#/$defs/decisionNumber" },
    { "$ref": "#/$defs/decisionBoolean" },
    { "type": "array" },
    { "type": "object" }
  ]
},
```

Note: `object` intentionally makes schema permissive for host-owned custom object fields. Semantic decision-map errors are still caught by `validate.ts`.

**Step 2: Replace the custom node schema**

Replace current `customNode`:

```json
"customNode": {
  "allOf": [{ "$ref": "#/$defs/baseNode" }],
  "properties": {
    "type":  { "type": "string", "minLength": 1 },
    "props": { "type": "object" }
  },
  "required": ["type"],
  "not": {
    "properties": { "type": { "$ref": "#/$defs/intrinsicTypeName" } },
    "required": ["type"]
  },
  "unevaluatedProperties": false
},
```

with:

```json
"customNode": {
  "allOf": [{ "$ref": "#/$defs/baseNode" }],
  "properties": {
    "type": { "type": "string", "minLength": 1 }
  },
  "required": ["type"],
  "not": {
    "anyOf": [
      {
        "properties": { "type": { "$ref": "#/$defs/intrinsicTypeName" } },
        "required": ["type"]
      },
      { "required": ["props"] },
      { "required": ["children"] }
    ]
  },
  "unevaluatedProperties": { "$ref": "#/$defs/customField" }
},
```

Why keep `children` rejected here: TODO item 2 will make custom nodes composable later; this item only removes `props`.

**Step 3: Update schema semantic-only list**

In `test/schema.test.ts`, remove this entry from `SEMANTIC_ONLY`:

```ts
"prefab-ref-with-props.json",
```

Reason: after schema update, prefab refs are represented through the same custom-node branch and `props` is structurally rejected by schema.

Do **not** add `custom-props.json` to `SEMANTIC_ONLY`; it should be schema-rejected.

**Step 4: Run schema tests**

Run:

```bash
npx tsc && node --test dist/test/schema.test.js
```

Expected: PASS.

**Step 5: Run all tests**

Run:

```bash
npm test
```

Expected: PASS all suites.

**Step 6: Commit**

```bash
git add pxd.schema.json test/schema.test.ts
git commit -m "feat: allow top-level custom fields in schema"
```

---

### Task 5: Update docs and migration note away from `props`

**Files:**
- Modify: `README.md`
- Modify: `doc/guides/02-custom-node-types.md`
- Modify: `doc/guides/04-decisions-and-bindings.md`
- Modify: `doc/guides/05-prefabs.md`
- Modify: `doc/pxd-v1.md`

**Step 1: Update README custom type examples**

Replace examples like:

```ts
create: (n) => new MySpinButton(n.props),
assign: (n, t) => t.setLabel(n.props?.label),
```

with:

```ts
create: () => new MySpinButton(),
assign: (n, t) => {
    if (typeof n.text === "string") t.setLabel(n.text);
},
```

Replace later `node.props?.label` examples with direct top-level fields:

```ts
if (typeof node.text === "string") target.setLabel(ctx.readString(node.text));
```

Add a short migration note near the custom type section:

```md
### Migration note: no `props`

Older drafts used `{ "props": { "text": "SPIN" } }` for runtime/custom nodes. In this package version, custom parameters live directly on the node: `{ "text": "SPIN" }`. The `props` field is rejected so custom scalar fields can participate in the same decision-resolution pipeline as built-in fields.
```

**Step 2: Rewrite `doc/guides/02-custom-node-types.md`**

Update the `assign` example from:

```ts
const props = node.props as { label?: string; enabled?: boolean } | undefined;
if (typeof props?.label === "string") target.setLabel(props.label);
if (typeof props?.enabled === "boolean") target.setEnabled(props.enabled);
```

to:

```ts
if (typeof node.text === "string") target.setLabel(ctx.readString(node.text));
if (typeof node.enabled === "boolean") target.setEnabled(node.enabled);
```

Update the JSON fragment from:

```json
{
    "id": "spinBtn",
    "type": "SpinButton",
    "x": 600, "y": 540,
    "props": { "label": "SPIN", "enabled": true }
}
```

to:

```json
{
    "id": "spinBtn",
    "type": "SpinButton",
    "x": 600, "y": 540,
    "text": { "_": "SPIN", "mobile": "TAP" },
    "enabled": true
}
```

Remove or rewrite the section that says runtime types receive inputs through `props`.

Add:

```md
## Custom fields

Custom node fields are plain top-level node fields. The library reserves base/structural fields (`id`, `type`, `label`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `mask`, `extensions`, and for now `children`). Do not reuse those names for custom semantics.

Scalar custom fields may be decision maps. `NodeType.create` and `NodeType.assign` receive the resolved value, just like intrinsic node types.
```

**Step 3: Update decisions guide**

In `doc/guides/04-decisions-and-bindings.md`, replace:

```md
Structural fields are **not** decidable (`id`, `type`, `mask`, `children`, `extensions`, `props`, `points`).
```

with:

```md
Structural fields are **not** decidable (`id`, `type`, `mask`, `children`, `extensions`, `points`). Custom scalar fields are decidable because they live directly on the node.
```

**Step 4: Update prefab guide**

In `doc/guides/05-prefabs.md`, replace the restriction text:

```md
Per §15 rule 19, a prefab reference node MUST NOT carry `props` or `children`:
```

with:

```md
A prefab reference node MUST NOT carry `children`. The old `props` payload is no longer part of the node model; custom parameters live directly on custom/runtime nodes, and prefab references remain simple references plus base fields.
```

Remove the invalid `props` example, or replace it with:

```json
// INVALID — rejected by validator/schema: prefab refs are not parameterized
{ "id": "playBtn", "type": "Button.primary", "children": [...] }
```

**Step 5: Update `doc/pxd-v1.md` targeted sections**

This spec file currently contains many normative `props` mentions. Make a targeted library-spec update for current behavior:

- In the node field table around runtime/custom node fields, remove `props` as a runtime payload.
- In §3.5 / §5, replace “runtime nodes carry `props`” with “runtime/custom node parameters are top-level fields not reserved by the base model”.
- In §3.6 non-decidable field list, remove `props`.
- In §10 rules, replace intrinsic-only `props` wording with a rule/migration note that `props` is rejected in this implementation/version.
- In §15 prefab refs, remove “props reserved for runtime types” language; keep “prefab refs are not parameterized” and “children forbidden”.
- In examples near scene/runtime type, replace:

```json
{ "id": "spin", "type": "Button", "props": { "label": "SPIN" } }
```

with:

```json
{ "id": "spin", "type": "Button", "text": "SPIN" }
```

**Step 6: Run docs/reference grep**

Run:

```bash
rg -n "props|node\.props|n\.props" README.md doc src test pxd.schema.json
```

Expected after docs update:

- No runtime docs/examples instruct users to use `props`.
- Remaining `props` mentions are only migration/rejection notes and invalid fixture descriptions.

**Step 7: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

**Step 8: Commit**

```bash
git add README.md doc/guides/02-custom-node-types.md doc/guides/04-decisions-and-bindings.md doc/guides/05-prefabs.md doc/pxd-v1.md
git commit -m "docs: migrate custom nodes away from props"
```

---

### Task 6: Update TODO checklist and run final verification

**Files:**
- Modify: `TODO.md`

**Step 1: Mark TODO item 1 complete**

In `TODO.md`, under `## 1. Упрощение custom node model`, change each checkbox from `[ ]` to `[x]`:

```md
- [x] Удалить `props` из public модели жёстко — библиотека ещё ранняя (`0.x`).
- [x] Обновить `types.ts`: убрать `props` из `CustomNode`.
- [x] Обновить `validate.ts`: больше не требовать/разрешать special-case `props` для custom/prefab/runtime nodes.
- [x] Обновить `pxd.schema.json`: custom nodes принимают дополнительные top-level поля, но без `props` как особого контейнера.
- [x] Обновить `doc/pxd-v1.md`, README и guides: custom параметры лежат прямо на node.
- [x] Добавить migration note: было `{ props: { text } }`, стало `{ text }`.
- [x] Убрать `props` из `NON_DECIDABLE_KEYS` — custom top-level поля должны автоматически проходить decision resolution.
- [x] Добавить тест: custom scalar field с decision map приходит в `NodeType.assign()` уже resolved.
```

**Step 2: Run full verification**

Run:

```bash
npm test
```

Expected: PASS, all test suites green.

Run:

```bash
npm pack --dry-run
```

Expected: PASS. Verify tarball contents still include runtime build, schema, README, spec docs, CLI, and exclude `dist/test`, `src`, `test`, and `node_modules`.

Run:

```bash
rg -n "props|node\.props|n\.props" README.md doc src test pxd.schema.json
```

Expected: only intentional migration/rejection/invalid-fixture mentions remain.

**Step 3: Commit TODO update**

```bash
git add TODO.md
git commit -m "docs: mark custom node model todo complete"
```

---

## Acceptance criteria

- `CustomNode` no longer has `props` in `src/types.ts`.
- `NON_DECIDABLE_KEYS` no longer contains `"props"`.
- `validate()` rejects any node with a `props` field with a clear migration-oriented error.
- `pxd.schema.json` rejects `props` on custom nodes and prefab refs.
- `pxd.schema.json` accepts custom/runtime nodes with arbitrary top-level custom fields.
- Custom scalar top-level decision maps are resolved before `NodeType.assign()`.
- Existing custom-node examples use direct fields like `text`, `enabled`, `variant`, not `props`.
- README, guides, and spec contain a migration note from `{ props: { text } }` to `{ text }`.
- `npm test` passes.
- `npm pack --dry-run` passes.

## Notes / pitfalls

- Do not implement TODO item 2 in this plan. Custom/runtime `children` should remain rejected for now.
- Be careful with JSON Schema `unevaluatedProperties`: custom nodes must be open for host-owned fields, while intrinsic nodes remain strict.
- If schema starts accepting `runtime-has-children.json`, tighten `customNode.not` to keep `children` rejected until item 2.
- `resolveNodeFields()` already resolves arbitrary custom top-level fields. The important code change is removing `props` from the skip list and adding tests to prevent regression.
- `validate()` does not know host `nodeTypes`; it intentionally treats any non-intrinsic, non-prefab `type` as a runtime/custom node for structural validation.
