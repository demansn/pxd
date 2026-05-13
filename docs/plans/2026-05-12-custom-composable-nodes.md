# Custom Composable Nodes Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Allow custom/runtime node types to own document-defined `children` and behave like composable Pixi `Container` nodes in `build()` and `apply()`.

**Architecture:** Keep intrinsic non-composable nodes strict (`sprite`, `text`, `graphics`, `slot`, `spine`) and keep prefab references unparameterized/no-children, but allow runtime/custom nodes to carry `children`. `build()` and `apply()` already recurse through `children`; this plan makes that contract explicit, updates types/validation/schema, and refactors nested traversal helpers into top-level functions to match the repository's readability/tree-shaking guidance.

**Tech Stack:** TypeScript `NodeNext`, Pixi.js `Container`, Node.js `node:test`, Ajv draft 2020-12, existing `build/apply/validate` pipeline and handwritten `pxd.schema.json`.

---

## Codebase analysis summary

Next unchecked TODO item is:

```md
## 2. Custom nodes как composable containers
```

Current relevant state:

- `src/types.ts`
  - `CustomNode` has top-level custom fields but still declares `children?: never`.
- `src/validate.ts`
  - Non-composable intrinsic children are rejected via `NON_COMPOSABLE` — keep this.
  - Prefab reference children are rejected via `rule 23` — keep this.
  - Runtime/custom children are rejected via `rule 9` — remove this.
- `src/build.ts`
  - Runtime behavior already adds `resolved.children` for any node after `create/assign/applyBaseFields/tagNode`.
  - But traversal function `buildNode()` is nested inside `buildSubtree()`, while current TODO architecture guidance says functions should not be declared inside other functions. Refactor while touching this code.
- `src/apply.ts`
  - Runtime behavior already walks `resolved.children` for any node after assign/base/mask.
  - But `walk()` and `visit()` are nested functions. Refactor touched traversal helpers to top-level functions.
- `pxd.schema.json`
  - `customNode.not` currently rejects `children` structurally.
  - To allow custom `children`, customNode must define `children` as an array of `node` and remove the `children` `not` branch.
  - JSON Schema cannot know which non-intrinsic type names are prefabs. Therefore `invalid/prefab-ref-with-children.json` must become schema-accepted / validate-rejected semantic-only.
- Fixtures:
  - `doc/fixtures/invalid/runtime-has-children.json` should no longer be invalid. Convert/move it into a valid custom-composable fixture or remove it and add a new valid fixture.
- Docs:
  - `doc/guides/02-custom-node-types.md` still says runtime types must not have children.
  - `doc/guides/05-prefabs.md` correctly says prefab references must not carry children; keep that distinction.

Implementation stance:

- Custom/runtime nodes may have `children` immediately.
- `children` remains structural and non-decidable.
- Custom node children are built/applied using the same label-path semantics as container children.
- Do not implement reconcile/add/remove in `apply()`. Missing custom children should still call `onMissing` and skip the subtree, just like container children.
- Do not allow prefab-reference `children`; validation still rejects this semantic case.

---

### Task 1: Add failing tests and fixture changes for custom composable nodes

**Files:**
- Modify: `test/build.test.ts`
- Modify: `test/apply.test.ts`
- Modify: `test/schema.test.ts`
- Create: `doc/fixtures/valid/core-custom-children.json`
- Delete: `doc/fixtures/invalid/runtime-has-children.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Add a valid fixture for custom children**

Create `doc/fixtures/valid/core-custom-children.json`:

```json
{
  "format": "pxd",
  "version": 1,
  "root": {
    "id": "root",
    "type": "container",
    "children": [
      {
        "id": "panel",
        "type": "Panel",
        "title": "Menu",
        "children": [
          { "id": "caption", "type": "text", "text": "PLAY" }
        ]
      }
    ]
  }
}
```

**Step 2: Remove obsolete invalid fixture**

Delete the old invalid fixture because runtime/custom nodes with children are no longer invalid:

```bash
rm doc/fixtures/invalid/runtime-has-children.json
```

**Step 3: Update fixture README**

In `doc/fixtures/README.md`:

1. Add valid row near other core fixtures:

```md
| `valid/core-custom-children.json` | Runtime/custom node carrying document-defined children | §5, §3.5 |
```

2. Remove this invalid row:

```md
| `invalid/runtime-has-children.json` | A runtime-registered type carries `children` | §10 rule 9 |
```

3. Keep prefab child restriction row:

```md
| `invalid/prefab-ref-with-children.json` | A prefab reference carries `children` | §15 rule 23 |
```

**Step 4: Add build test for custom `Panel` with children**

In `test/build.test.ts`, add after existing custom-node tests:

```ts
test("build: custom node can own document-defined children", () => {
    const doc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "panel",
                    type: "Panel",
                    title: "Menu",
                    children: [
                        { id: "caption", type: "container", x: 12 },
                    ],
                },
            ],
        },
    };
    let capturedTitle: unknown;
    const panelType: NodeType = {
        create: () => new Container(),
        assign: (node) => {
            capturedTitle = node.title;
        },
    };

    const root = build(doc, {
        resolve: resolveStub,
        nodeTypes: new Map([["Panel", panelType]]),
    });

    const panel = find(root, "panel");
    const caption = find(root, "panel.caption");
    assert.equal(capturedTitle, "Menu");
    assert.ok(panel);
    assert.ok(caption);
    assert.equal(panel?.children.length, 1);
    assert.equal(caption?.x, 12);
});
```

**Step 5: Add apply test for custom children traversal**

In `test/apply.test.ts`, add after the first basic patch test or near other traversal tests:

```ts
test("apply: walks children of custom nodes", () => {
    const panelType: NodeType = {
        create: () => new Container(),
        assign: () => {},
    };
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "panel",
                    type: "Panel",
                    children: [{ id: "caption", type: "container", x: 1 }],
                },
            ],
        },
    };
    const root = build(buildDoc, {
        resolve: resolveStub,
        nodeTypes: new Map([["Panel", panelType]]),
    });

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "panel",
                    type: "Panel",
                    children: [{ id: "caption", type: "container", x: 44 }],
                },
            ],
        },
    };

    const count = apply(patchDoc, root, {
        nodeTypes: new Map([["Panel", panelType]]),
    });

    assert.equal(count, 3, "patched root + panel + caption");
    assert.equal(find(root, "panel.caption")?.x, 44);
});
```

**Step 6: Add apply missing-child behavior under custom node**

In `test/apply.test.ts`, add:

```ts
test("apply: missing child under custom node calls onMissing and skips subtree", () => {
    const panelType: NodeType = {
        create: () => new Container(),
        assign: () => {},
    };
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "panel", type: "Panel" }],
        },
    };
    const root = build(buildDoc, {
        resolve: resolveStub,
        nodeTypes: new Map([["Panel", panelType]]),
    });

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                {
                    id: "panel",
                    type: "Panel",
                    children: [{ id: "ghost", type: "container", x: 99 }],
                },
            ],
        },
    };
    const missed: Array<{ path: string; nodeId: string }> = [];

    const count = apply(patchDoc, root, {
        nodeTypes: new Map([["Panel", panelType]]),
        onMissing: (path, nodeId) => missed.push({ path, nodeId }),
    });

    assert.equal(count, 2, "patched root + panel; ghost skipped");
    assert.deepEqual(missed, [{ path: "root.panel.ghost", nodeId: "ghost" }]);
});
```

**Step 7: Update schema test semantic-only list**

In `test/schema.test.ts`, add `"prefab-ref-with-children.json"` to `SEMANTIC_ONLY` because schema cannot distinguish custom runtime types from prefab references:

```ts
const SEMANTIC_ONLY = new Set([
    "duplicate-ids.json",
    "mask-out-of-tree.json",
    "prefab-cycle.json",
    "prefab-ref-with-children.json",
    "decision-unsorted-selector.json",
    "required-not-in-used.json",
    "extension-required-unsupported.json",
]);
```

**Step 8: Run focused tests to verify failure**

Run:

```bash
npx tsc && node dist/test/fixtures.test.js && node --test dist/test/build.test.js dist/test/apply.test.js dist/test/schema.test.js
```

Expected before implementation:

- Fixture test FAILS because `valid/core-custom-children.json` is rejected by `validate()` rule 9.
- Build/apply custom-child tests FAIL because `validate()` rejects custom children.
- Schema test for `core-custom-children.json` FAILS because `customNode` schema rejects `children`.

**Step 9: Do not commit red tests unless your workflow allows it**

Preferred: wait to commit after Task 3 when focused tests are green.

---

### Task 2: Update public types and semantic validation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/validate.ts`
- Test: `test/build.test.ts`, `test/apply.test.ts`, `doc/fixtures/valid/core-custom-children.json`

**Step 1: Allow children in `CustomNode` type**

In `src/types.ts`, replace:

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

with:

```ts
export interface CustomNode extends BaseNode {
    type: string;
    /**
     * Runtime/custom node fields live directly on the node. Their shape is
     * owned by the host-provided NodeType implementation.
     */
    [field: string]: unknown;
    /** Custom/runtime nodes are composable Containers; prefab refs stay restricted by validation. */
    children?: Node[];
}
```

**Step 2: Remove runtime/custom children rejection from validation**

In `src/validate.ts`, remove the `isRuntimeRef` constant if it becomes unused:

```ts
const isRuntimeRef = !INTRINSIC.has(node.type) && !prefabNames.has(node.type);
```

Remove the whole rule 9 block:

```ts
// §10 rule 9 — runtime-registered nodes MUST NOT have children (§3.5, §5 rule 4)
if (isRuntimeRef && node.children !== undefined) {
    throw new ValidationError(
        "rule 9",
        `runtime-registered type '${node.type}' on node '${node.id}' must not have 'children'`,
    );
}
```

Keep the prefab reference `children` rejection unchanged:

```ts
if (isPrefabRef) {
    if (node.children !== undefined) {
        throw new ValidationError(
            "rule 23",
            `prefab reference '${node.type}' on node '${node.id}' must not have 'children'`,
        );
    }
}
```

**Step 3: Update nearby comments**

Change the intrinsic composability comment to make the boundary clear:

```ts
// §10 rule 8 — non-composable intrinsic MUST NOT have children.
// Custom/runtime nodes are composable; prefab references are checked below.
```

**Step 4: Run validation/build/apply focused tests**

Run:

```bash
npx tsc && node dist/test/fixtures.test.js && node --test dist/test/build.test.js dist/test/apply.test.js
```

Expected after this task:

- Fixture tests PASS for `valid/core-custom-children.json`.
- Build/apply tests PASS.
- Schema tests may still fail until Task 3.

**Step 5: Do not commit yet if schema tests are still red**

Proceed to Task 3, then commit the coherent type/validation/schema change.

---

### Task 3: Update JSON Schema for custom children and fixture classification

**Files:**
- Modify: `pxd.schema.json`
- Modify: `test/schema.test.ts`
- Delete: `doc/fixtures/invalid/runtime-has-children.json`
- Create: `doc/fixtures/valid/core-custom-children.json`
- Modify: `doc/fixtures/README.md`

**Step 1: Allow `children` on custom nodes in schema**

In `pxd.schema.json`, replace current `customNode` block:

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

with:

```json
"customNode": {
  "allOf": [{ "$ref": "#/$defs/baseNode" }],
  "properties": {
    "type": { "type": "string", "minLength": 1 },
    "children": { "type": "array", "items": { "$ref": "#/$defs/node" } }
  },
  "required": ["type"],
  "not": {
    "anyOf": [
      {
        "properties": { "type": { "$ref": "#/$defs/intrinsicTypeName" } },
        "required": ["type"]
      },
      { "required": ["props"] }
    ]
  },
  "unevaluatedProperties": { "$ref": "#/$defs/customField" }
},
```

**Step 2: Keep prefab-ref children as semantic-only invalid**

In `test/schema.test.ts`, ensure this entry is present in `SEMANTIC_ONLY`:

```ts
"prefab-ref-with-children.json",
```

Reason: schema sees non-intrinsic nodes as custom nodes; only `validate.ts` knows a type name is a prefab name in a given document.

**Step 3: Run schema tests**

Run:

```bash
npx tsc && node --test dist/test/schema.test.js
```

Expected: PASS.

**Step 4: Run all tests**

Run:

```bash
npm test
```

Expected: PASS all suites.

**Step 5: Commit coherent runtime/schema change**

```bash
git add src/types.ts src/validate.ts pxd.schema.json test/build.test.ts test/apply.test.ts test/schema.test.ts doc/fixtures/valid/core-custom-children.json doc/fixtures/invalid/runtime-has-children.json doc/fixtures/README.md
git commit -m "feat: allow custom node children"
```

Note: `git add` with the deleted invalid fixture path stages the deletion.

---

### Task 4: Refactor build traversal helpers out of nested functions

**Files:**
- Modify: `src/build.ts`
- Test: `test/build.test.ts`

**Why this task exists:** `TODO.md` now states every function should be kept separate instead of being declared inside another function. Since custom composability touches traversal, refactor `build.ts` now to reduce cognitive load before further features.

**Step 1: Introduce build state interface**

In `src/build.ts`, below `BuildOptions`, add:

```ts
interface BuildSubtreeState {
    nodeTypes: ReadonlyMap<string, NodeType>;
    activeTags: ReadonlySet<string>;
    readString: (s: string) => string;
    buildCtx: BuildContext;
    assignCtx: AssignContext;
    idMap: Map<string, Container> | null;
    pendingMasks: Array<[Container, string]>;
}
```

**Step 2: Replace `buildSubtree()` implementation**

Replace current `buildSubtree()` body, including nested `buildNode()`, with:

```ts
function buildSubtree(
    root: Node,
    nodeTypes: ReadonlyMap<string, NodeType>,
    options: BuildOptions,
): Container {
    const state = createBuildSubtreeState(root, nodeTypes, options);
    const out = buildNode(root, state);
    bindPendingMasks(state);
    return out;
}
```

**Step 3: Add top-level build helper functions**

Add these top-level functions after `buildSubtree()`:

```ts
function createBuildSubtreeState(
    root: Node,
    nodeTypes: ReadonlyMap<string, NodeType>,
    options: BuildOptions,
): BuildSubtreeState {
    const activeTags = new Set(options.activeTags ?? []);
    const readString = makeStringReader(options.resolve.binding);
    const idMap = docContainsMask(root) ? new Map<string, Container>() : null;
    return {
        nodeTypes,
        activeTags,
        readString,
        buildCtx: { resolve: options.resolve, readString },
        assignCtx: { resolve: options.resolve, readString, idMap: EMPTY_ID_MAP },
        idMap,
        pendingMasks: [],
    };
}

function buildNode(node: Node, state: BuildSubtreeState): Container {
    const resolved = resolveNodeFields(node, state.activeTags);
    const type = state.nodeTypes.get(resolved.type);
    if (!type) {
        throw new Error(
            `no node type registered for '${resolved.type}' on node '${resolved.id}'`,
        );
    }
    const obj = type.create(resolved, state.buildCtx);
    // Order: type-specific (assign) → universal transform (applyBaseFields).
    // Base fields run last so `scaleX` overrides `width`-derived scale on Sprite, etc.
    type.assign?.(resolved, obj, state.assignCtx);
    applyBaseFields(obj, resolved);
    tagNode(obj, resolved, state.readString);
    rememberNodeForMasks(obj, resolved, state);
    addBuiltChildren(obj, resolved, state);
    return obj;
}

function rememberNodeForMasks(obj: Container, node: ResolvedNode, state: BuildSubtreeState): void {
    if (state.idMap) state.idMap.set(node.id as string, obj);
    if (typeof node.mask === "string") state.pendingMasks.push([obj, node.mask]);
}

function addBuiltChildren(parent: Container, node: ResolvedNode, state: BuildSubtreeState): void {
    const children = node.children as Node[] | undefined;
    if (!Array.isArray(children)) return;
    for (const child of children) parent.addChild(buildNode(child, state));
}

function bindPendingMasks(state: BuildSubtreeState): void {
    for (const [target, maskId] of state.pendingMasks) {
        const mask = state.idMap?.get(maskId);
        if (!mask) throw new Error(`mask '${maskId}' not found in tree`);
        target.mask = mask;
    }
}
```

**Step 4: Run build tests**

Run:

```bash
npx tsc && node --test dist/test/build.test.js
```

Expected: PASS.

**Step 5: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/build.ts
git commit -m "refactor: extract build traversal helpers"
```

---

### Task 5: Refactor apply traversal helpers out of nested functions

**Files:**
- Modify: `src/apply.ts`
- Test: `test/apply.test.ts`

**Step 1: Add apply state interface**

In `src/apply.ts`, below `const EMPTY_ID_MAP`, add:

```ts
interface ApplyState {
    activeTags: ReadonlySet<string>;
    nodeTypes: ReadonlyMap<string, NodeType>;
    ctx: AssignContext;
    onMissing?: (labelPath: string, nodeId: string) => void;
    count: number;
}
```

**Step 2: Replace local state and nested `walk()` in `apply()`**

Replace everything from:

```ts
    const ctx: AssignContext = {
        resolve: options.resolve ?? {},
        readString,
        idMap,
    };

    let count = 0;

    function walk(node: Node, target: Container, labelPath: string): void {
        ...
    }

    const rootKey = (docRoot.label as string | undefined) ?? docRoot.id;
    walk(docRoot, root, rootKey);
    return count;
```

with:

```ts
    const state: ApplyState = {
        activeTags,
        nodeTypes,
        ctx: {
            resolve: options.resolve ?? {},
            readString,
            idMap,
        },
        onMissing: options.onMissing,
        count: 0,
    };

    const rootKey = (docRoot.label as string | undefined) ?? docRoot.id;
    applyNode(docRoot, root, rootKey, state);
    return state.count;
```

**Step 3: Add top-level apply helper functions**

Add after `apply()`:

```ts
function applyNode(node: Node, target: Container, labelPath: string, state: ApplyState): void {
    const resolved = resolveNodeFields(node, state.activeTags);
    const type = state.nodeTypes.get(resolved.type);
    // Same order as build: type-specific first, base fields last.
    type?.assign?.(resolved, target, state.ctx);
    applyBaseFields(target, resolved);
    applyMask(resolved, target, state.ctx.idMap);
    state.count++;
    applyChildren(resolved, target, labelPath, state);
}

function applyMask(node: ResolvedNode, target: Container, idMap: ReadonlyMap<string, Container>): void {
    if (typeof node.mask !== "string") return;
    const mask = idMap.get(node.mask);
    if (mask) target.mask = mask;
}

function applyChildren(node: ResolvedNode, target: Container, labelPath: string, state: ApplyState): void {
    const children = node.children as Node[] | undefined;
    if (!Array.isArray(children)) return;
    for (const child of children) applyChild(child, target, labelPath, state);
}

function applyChild(child: Node, target: Container, labelPath: string, state: ApplyState): void {
    const key = (child.label as string | undefined) ?? child.id;
    const childTarget = target.getChildByLabel(key, false) as Container | null;
    const childPath = `${labelPath}.${key}`;
    if (childTarget) {
        applyNode(child, childTarget, childPath, state);
    } else {
        state.onMissing?.(childPath, child.id);
    }
}
```

**Step 4: Extract `collectIdMap()` nested visitor**

Replace current `collectIdMap()` implementation:

```ts
function collectIdMap(root: Container): ReadonlyMap<string, Container> {
    const map = new Map<string, Container>();
    function visit(c: Container): void {
        const id = idOf(c);
        if (id !== undefined) map.set(id, c);
        for (const child of c.children) visit(child as Container);
    }
    visit(root);
    return map;
}
```

with:

```ts
function collectIdMap(root: Container): ReadonlyMap<string, Container> {
    const map = new Map<string, Container>();
    collectIdMapNode(root, map);
    return map;
}

function collectIdMapNode(node: Container, map: Map<string, Container>): void {
    const id = idOf(node);
    if (id !== undefined) map.set(id, node);
    for (const child of node.children) collectIdMapNode(child as Container, map);
}
```

**Step 5: Run apply tests**

Run:

```bash
npx tsc && node --test dist/test/apply.test.js
```

Expected: PASS.

**Step 6: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/apply.ts
git commit -m "refactor: extract apply traversal helpers"
```

---

### Task 6: Update docs/spec for custom composability and reserved fields

**Files:**
- Modify: `README.md`
- Modify: `doc/guides/02-custom-node-types.md`
- Modify: `doc/guides/05-prefabs.md`
- Modify: `doc/pxd-v1.md`
- Modify: `TODO.md`

**Step 1: Update README support bullets**

In `README.md`, find the custom runtime type bullet:

```md
- **Runtime-registered types (§5):** add custom `NodeType { create, assign }` via `options.nodeTypes`.
```

Replace with:

```md
- **Runtime-registered/custom types (§5):** add custom `NodeType { create, assign }` via `options.nodeTypes`; custom nodes may carry document-defined `children` and are traversed like containers.
```

Add a short note near the extension/custom type section:

```md
Custom node fields live directly on the node. Reserved structural/base fields are `id`, `type`, `label`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `mask`, `children`, and `extensions`; do not reuse those names for custom semantics. `children` is structural: the library builds/applies it, not your `assign` function.
```

**Step 2: Rewrite custom guide children section**

In `doc/guides/02-custom-node-types.md`, replace:

```md
Custom node fields are plain top-level node fields. The library reserves base/structural fields (`id`, `type`, `label`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `mask`, `extensions`, and for now `children`). Do not reuse those names for custom semantics.
```

with:

```md
Custom node fields are plain top-level node fields. The library reserves base/structural fields (`id`, `type`, `label`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `mask`, `children`, `extensions`). Do not reuse those names for custom semantics. `children` is owned by the library traversal pipeline.
```

Replace the whole section:

```md
## Runtime types must not have children
...
```

with:

```md
## Custom nodes can have document-defined children

Custom/runtime nodes are composable Pixi `Container`s. `build()` creates the custom node, runs its `assign`, applies base fields, then builds and adds its `children`. `apply()` runs the custom `assign`, applies base fields, then walks child label-paths exactly like it does for `container` nodes.

```json
{
    "id": "panel",
    "type": "Panel",
    "title": "Menu",
    "children": [
        { "id": "caption", "type": "text", "text": "PLAY" }
    ]
}
```

Your `NodeType` should return a `Container` or subclass capable of receiving children. Prefab references remain different: they are references to prefab bodies and still cannot carry `children` on the reference node.
```

**Step 3: Clarify prefab guide distinction**

In `doc/guides/05-prefabs.md`, ensure the restriction says:

```md
A prefab reference node MUST NOT carry `children`. Custom/runtime nodes can be composable, but prefab references are not custom nodes; their structure comes from the prefab body.
```

Keep the invalid child example.

**Step 4: Update spec sections**

In `doc/pxd-v1.md`, make targeted updates:

- §3.5 Composability:
  - Replace “Runtime-registered nodes MUST NOT have children” with “Runtime/custom nodes MAY carry children; the created runtime object must be a container-like object that can receive children.”
  - Keep non-composable intrinsic restriction.
  - Keep prefab reference restriction.
- §5 Runtime-registered types rules:
  - Replace the rule that runtime nodes must not carry children with a rule that runtime nodes may carry children and traversal is handled by the reader after `create/assign/base fields`.
- §10 validation rules:
  - Replace rule 9 with custom/runtime composability wording, e.g. “Runtime/custom nodes MAY have children; prefab references are checked in §15.”
- §13.1 Prefab reference rules:
  - Keep “The reference MUST NOT carry children.”
  - Add “This restriction does not apply to runtime/custom node types.”
- §15 rule 23:
  - Keep “No prefab reference carries children”.

**Step 5: Mark TODO item 2 complete**

In `TODO.md`, under `## 2. Custom nodes как composable containers`, mark every checklist item complete:

```md
- [x] Разрешить `children` у custom/runtime node types.
- [x] В build: custom node строится обычным pipeline, затем его `children` добавляются в созданный `Container`.
- [x] В apply: custom node children обходятся так же, как `container.children`.
- [x] В validate: убрать правило “runtime-registered nodes MUST NOT have children”.
- [x] Сохранить правило для prefab references отдельно, если prefab-ref children всё ещё запрещены.
- [x] Добавить тест: custom `Panel` с `children` build/apply работает.
- [x] Документировать: base fields зарезервированы для всех узлов (`id/type/label/x/y/.../children/mask`). Custom типы не должны переиспользовать их под другой смысл.
```

**Step 6: Run docs grep**

Run:

```bash
rg -n "Runtime types must not have children|runtime-registered nodes MUST NOT have children|runtime-has-children|for now `children`|for now children" README.md doc TODO.md
```

Expected: no matches.

**Step 7: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

**Step 8: Commit**

```bash
git add README.md doc/guides/02-custom-node-types.md doc/guides/05-prefabs.md doc/pxd-v1.md TODO.md
git commit -m "docs: document custom node children"
```

---

### Task 7: Final verification and package smoke check

**Files:**
- No source files expected unless verification reveals an issue.

**Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS, all suites green.

**Step 2: Run package dry-run**

Run:

```bash
npm pack --dry-run
```

Expected: PASS. Verify package contents include:

```text
package/dist/src/build.js
package/dist/src/apply.js
package/dist/src/types.d.ts
package/dist/src/validate.js
package/pxd.schema.json
package/doc/pxd-v1.md
package/README.md
```

Verify package contents do **not** include:

```text
package/dist/test
package/src
package/test
package/node_modules
```

**Step 3: Run targeted CLI schema smoke checks**

Run:

```bash
node dist/src/cli.js validate doc/fixtures/valid/core-custom-children.json
```

Expected:

```text
OK doc/fixtures/valid/core-custom-children.json shape=core
```

Run:

```bash
node dist/src/cli.js validate doc/fixtures/invalid/prefab-ref-with-children.json
```

Expected: exit code `1`, stderr includes:

```text
Validation failed in doc/fixtures/invalid/prefab-ref-with-children.json:
  - [rule 23] prefab reference 'Card' on node 'c1' must not have 'children'
```

**Step 4: Check worktree**

Run:

```bash
git status --short
```

Expected: no uncommitted changes.

If verification requires fixes, make them and commit:

```bash
git add <changed-files>
git commit -m "fix: complete custom node children verification"
```

---

## Acceptance criteria

- `CustomNode` permits `children?: Node[]`.
- `validate()` no longer rejects `children` on runtime/custom nodes.
- Non-composable intrinsic nodes still reject `children`.
- Prefab references still reject `children` with rule 23.
- `build()` creates custom node, assigns it, applies base fields, tags it, then adds built children.
- `apply()` walks custom node children with the same label-path semantics as container children.
- Missing child under a custom node calls `onMissing` and skips subtree.
- `pxd.schema.json` accepts custom nodes with `children` and rejects obsolete `props`.
- `prefab-ref-with-children.json` is schema-accepted but validate-rejected as semantic-only.
- Docs clearly distinguish custom/runtime nodes (composable) from prefab references (no children on reference node).
- Reserved fields are documented, including `children` as structural.
- `npm test` passes.
- `npm pack --dry-run` passes.

## Notes / pitfalls

- Do not implement reconcile/add/remove. `apply()` must not create missing custom children.
- Do not allow `children` on prefab references; schema cannot enforce this, but `validate.ts` must.
- Do not allow `children` on non-composable intrinsic nodes.
- If `docContainsMask()` is used with custom children, it should already recurse through any `children` array; keep that behavior.
- If refactoring traversal helpers, preserve order: `create` → `assign` → `applyBaseFields` → tag → build/add children.
- Preserve `Container.label = node.label ?? node.id`; custom child path matching depends on it.
- Be mindful that `TODO.md` currently has uncommitted user edits adding architecture guidelines. Do not discard those edits; only mark item 2 complete when implementing Task 6.
