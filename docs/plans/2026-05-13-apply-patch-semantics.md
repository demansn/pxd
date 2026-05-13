# Apply Patch Semantics Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Make `apply()` semantics explicit and test-locked as patch-only updates: absent fields/children do not reset or delete live Pixi state, and structural mismatches are non-throwing skips.

**Architecture:** Keep `apply()` as an in-place stylesheet pass over an already-built tree, matching descendants by one-hop `Container.label` path only. Reuse the existing `NodeType.assign` pipeline, but split build-time base-field label fallback (`label ?? id`) from apply-time patch label handling so an absent `label` field does not reset an existing label. Document that reconcile/full mode is future work and must not be partially implemented now.

**Tech Stack:** TypeScript `NodeNext`, Pixi.js `Container`, Node.js `node:test`, existing `build/apply/find/validate` pipeline.

---

## Codebase analysis summary

Next unchecked TODO item is:

```md
## 3. Чёткая семантика `apply()`
```

Relevant current state:

- `src/apply.ts`
  - Already validates with `skipMaskValidation: true` so masks can resolve against the existing live tree.
  - Already matches child nodes by immediate child label using `node.label ?? node.id`.
  - Already calls `onMissing(labelPath, nodeId)` and skips the missing subtree.
  - Already keeps type mismatch silent through per-type `assign` implementations that `instanceof`-guard Pixi classes.
  - Already leaves absent `mask` unchanged because `applyMask()` no-ops when `node.mask` is not a string.
- `src/build.ts`
  - `applyBaseFields()` applies scalar base fields only when present, but always sets `obj.label = node.label ?? node.id`.
  - That unconditional label fallback is correct for build, but wrong for patch semantics: applying a root patch without `label` currently resets a previously explicit root label back to `id`.
- `test/apply.test.ts`
  - Already covers basic patching, missing child callbacks, custom-node children traversal, type-mismatch, decision/binding re-resolution, mask rebinding, and scene rejection.
  - Missing coverage for patch-only optional field preservation, live child preservation, absent mask preservation, and label removal/rename semantics.
- `README.md` and `doc/guides/03-hot-reload-with-apply.md`
  - Already mention hot reload, no child add/remove, type mismatch, and mask rebinding.
  - Need a clear “patch semantics” section that says absent optional fields do not reset, absent live children are not removed, absent masks do not clear, label rename caveat, and no `mode: "full"` today.
- `doc/pxd-v1.md`
  - This is the portable PXD format spec, not the library-specific `apply()` API spec. Do not add reconcile/full-apply promises here unless wording is clearly scoped as future/non-goal.

Implementation stance:

- `apply()` remains patch-only.
- Do not add `ApplyOptions.mode`.
- Do not add reconcile, child creation, child deletion, replacement, or type replacement.
- Build-time `Container.label = node.label ?? node.id` stays unchanged.
- Apply-time label behavior:
  - If the matched node has an explicit resolved `label`, set `target.label` to it.
  - If `label` is absent, leave `target.label` unchanged.
  - Descendant label renames are structural for label-path matching: a patch child with a new label is looked up by that new label, so an existing child under the old label is considered missing and skipped.
  - The root can be explicitly relabeled because root is passed directly to `apply()` and is not discovered by parent lookup.
- Mask behavior:
  - `mask` present and found in live idMap → rebind.
  - `mask` absent → keep existing `target.mask`.
  - `mask` present but not found in live idMap → keep existing `target.mask` and do not throw.

---

### Task 1: Add failing/applicable tests for patch-only semantics

**Files:**
- Modify: `test/apply.test.ts`

**Step 1: Add patch-only tests near the first basic `apply` test**

Append these tests after `apply: patches x on existing label-path match`:

```ts
test("apply: absent base fields leave existing values unchanged", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "container", x: 10, alpha: 0.4 },
    };
    const root = build(buildDoc, { resolve: resolveStub });

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "container", y: 20 },
    };

    const count = apply(patchDoc, root);

    assert.equal(count, 1);
    assert.equal(root.x, 10, "absent x is not reset");
    assert.equal(root.y, 20, "present y is patched");
    assert.equal(root.alpha, 0.4, "absent alpha is not reset");
});

test("apply: absent live child is not removed", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "kept", type: "container", x: 1 },
                { id: "extra", type: "container", x: 2 },
            ],
        },
    };
    const root = build(buildDoc, { resolve: resolveStub });

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "kept", type: "container", x: 10 }],
        },
    };

    const count = apply(patchDoc, root);

    assert.equal(count, 2, "patched root + kept only");
    assert.equal(root.children.length, 2, "extra live child remains attached");
    assert.equal(find(root, "kept")?.x, 10);
    assert.equal(find(root, "extra")?.x, 2);
});
```

**Step 2: Add mask preservation tests near the existing mask rebind test**

Append before `apply: mask rebound by id lookup in existing tree` or directly after it:

```ts
test("apply: absent mask field keeps existing mask", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "mask1", type: "container" },
                { id: "panel", type: "container", mask: "mask1" },
            ],
        },
    };
    const root = build(buildDoc, { resolve: resolveStub });
    const panel = find(root, "panel")!;
    const mask1 = find(root, "mask1")!;
    assert.equal(panel.mask, mask1);

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "panel", type: "container", x: 5 }],
        },
    };

    apply(patchDoc, root);

    assert.equal(panel.mask, mask1, "missing mask field does not clear live mask");
    assert.equal(panel.x, 5);
});

test("apply: unresolved mask id keeps existing mask", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [
                { id: "mask1", type: "container" },
                { id: "panel", type: "container", mask: "mask1" },
            ],
        },
    };
    const root = build(buildDoc, { resolve: resolveStub });
    const panel = find(root, "panel")!;
    const mask1 = find(root, "mask1")!;

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "panel", type: "container", mask: "ghostMask" }],
        },
    };

    apply(patchDoc, root);

    assert.equal(panel.mask, mask1, "unknown mask id is a no-op in apply");
});
```

**Step 3: Add label semantics tests near the missing-child tests**

Append after `apply: missing PXD node calls onMissing and continues`:

```ts
test("apply: absent root label does not reset existing label", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", label: "RootLabel", type: "container", x: 1 },
    };
    const root = build(buildDoc, { resolve: resolveStub });
    assert.equal(root.label, "RootLabel");

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", type: "container", x: 2 },
    };

    apply(patchDoc, root);

    assert.equal(root.x, 2);
    assert.equal(root.label, "RootLabel", "missing label field is patch-only, not label=id reset");
});

test("apply: explicit root label patches root label", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", label: "OldRoot", type: "container" },
    };
    const root = build(buildDoc, { resolve: resolveStub });

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: { id: "root", label: "NewRoot", type: "container" },
    };

    apply(patchDoc, root);

    assert.equal(root.label, "NewRoot");
});

test("apply: child label rename is treated as missing and skipped", () => {
    const buildDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "item", label: "oldLabel", type: "container", x: 1 }],
        },
    };
    const root = build(buildDoc, { resolve: resolveStub });
    const item = find(root, "oldLabel")!;
    const missed: Array<{ path: string; nodeId: string }> = [];

    const patchDoc = {
        format: "pxd" as const,
        version: 1 as const,
        root: {
            id: "root",
            type: "container",
            children: [{ id: "item", label: "newLabel", type: "container", x: 99 }],
        },
    };

    const count = apply(patchDoc, root, {
        onMissing: (path, nodeId) => missed.push({ path, nodeId }),
    });

    assert.equal(count, 1, "only root patched; renamed child was skipped");
    assert.deepEqual(missed, [{ path: "root.newLabel", nodeId: "item" }]);
    assert.equal(item.label, "oldLabel");
    assert.equal(item.x, 1, "subtree under missing label is not patched");
    assert.equal(find(root, "newLabel"), null);
});
```

**Step 4: Run apply tests and verify at least one failure**

Run:

```bash
npx tsc && node --test dist/test/apply.test.js
```

Expected:

- FAIL on `apply: absent root label does not reset existing label`.
- Failure should show actual label is `root` instead of `RootLabel`.
- Other new tests may already pass; keep them because they lock current patch-only behavior.

**Step 5: Commit failing tests**

```bash
git add test/apply.test.ts
git commit -m "test: lock apply patch-only semantics"
```

---

### Task 2: Split build base fields from apply patch base fields

**Files:**
- Modify: `src/build.ts`
- Modify: `src/apply.ts`

**Step 1: Add patch-only base-field helper in `src/build.ts`**

Replace the current `applyBaseFields()` body with shared helpers and a new exported `applyBasePatchFields()`:

```ts
/**
 * Apply base PXD fields (§3.1) to a freshly built Pixi Container.
 *
 * NOTE: `label` is `node.label ?? node.id` per §3.2 — load-bearing for find/apply.
 */
export function applyBaseFields(obj: Container, node: ResolvedNode): void {
    applyTransformFields(obj, node);
    applyBuildLabel(obj, node);
}

/**
 * Apply base fields during `apply()` patching.
 *
 * Patch semantics: absent optional fields do not reset live state. Therefore
 * `label` is only changed when explicitly present on the apply node; build-time
 * fallback to `id` belongs only to `applyBaseFields()`.
 */
export function applyBasePatchFields(obj: Container, node: ResolvedNode): void {
    applyTransformFields(obj, node);
    applyPatchLabel(obj, node);
}

function applyTransformFields(obj: Container, node: ResolvedNode): void {
    if (typeof node.x === "number") obj.x = node.x;
    if (typeof node.y === "number") obj.y = node.y;
    if (typeof node.scaleX === "number") obj.scale.x = node.scaleX;
    if (typeof node.scaleY === "number") obj.scale.y = node.scaleY;
    if (typeof node.rotation === "number") obj.rotation = node.rotation * DEG_TO_RAD;
    if (typeof node.alpha === "number") obj.alpha = node.alpha;
    if (typeof node.visible === "boolean") obj.visible = node.visible;
    if (typeof node.zIndex === "number") obj.zIndex = node.zIndex;
}

function applyBuildLabel(obj: Container, node: ResolvedNode): void {
    obj.label = (node.label as string | undefined) ?? (node.id as string);
}

function applyPatchLabel(obj: Container, node: ResolvedNode): void {
    if (typeof node.label === "string") obj.label = node.label;
}
```

Keep these functions top-level. Do not define functions inside other functions.

**Step 2: Update `src/apply.ts` to use patch base fields**

Change the import:

```ts
import { applyBasePatchFields } from "./build.js";
```

Change `applyNode()`:

```ts
function applyNode(node: Node, target: Container, labelPath: string, state: ApplyState): void {
    const resolved = resolveNodeFields(node, state.activeTags);
    const type = state.nodeTypes.get(resolved.type);
    // Same order as build: type-specific first, base fields last.
    type?.assign?.(resolved, target, state.ctx);
    applyBasePatchFields(target, resolved);
    applyMask(resolved, target, state.ctx.idMap);
    state.count++;
    applyChildren(resolved, target, labelPath, state);
}
```

**Step 3: Run apply tests**

Run:

```bash
npx tsc && node --test dist/test/apply.test.js
```

Expected: PASS.

**Step 4: Run build tests to ensure build label fallback did not regress**

Run:

```bash
npx tsc && node --test dist/test/build.test.js
```

Expected: PASS, especially `build: label = node.label ?? node.id (§3.2)`.

**Step 5: Commit implementation**

```bash
git add src/build.ts src/apply.ts
git commit -m "fix: preserve labels during apply patches"
```

---

### Task 3: Document `apply()` patch semantics

**Files:**
- Modify: `src/apply.ts`
- Modify: `README.md`
- Modify: `doc/guides/03-hot-reload-with-apply.md`

**Step 1: Update the `src/apply.ts` module comment**

Replace the top comment with:

```ts
/**
 * `apply(doc, root, options)` — patch a PXD doc onto an existing tree.
 *
 * Patch semantics:
 * - Present fields mutate the matched live node.
 * - Absent fields do not reset existing live values.
 * - Children are matched by label-path (immediate child whose label === pxdChild.label ?? id).
 * - Missing doc children do not delete live children.
 * - Missing live children call optional `onMissing` and skip that subtree.
 * - Type-mismatch is silent — base patch fields still apply, type-specific fields
 *   are skipped by the per-type `assign`.
 */
```

**Step 2: Update README design contract**

In `README.md`, under `## Design contract`, add this bullet after the label invariant:

```md
- **Apply is patch-only.** Present fields update matched live nodes; absent optional fields do not reset old values. A child missing from the apply doc is not removed from the live tree. An absent `mask` field does not clear an existing mask. There is no `mode: "full"` or reconcile mode yet.
```

Then replace the existing apply matching bullet with:

```md
- **Apply matches by label-path with immediate-child lookup.** For each PXD child node we look for an immediate child of the current Pixi parent with `label === (node.label ?? node.id)` (one hop, not deep search). Missing live nodes → `onMissing` callback, then subtree skipped. Structure mismatch never throws. Because matching itself uses label, renaming a descendant `label` in an apply doc is treated as a missing child rather than an in-place rename; use rebuild/future reconcile for structural renames.
```

Keep the existing type-mismatch and mask bullets, but adjust mask bullet to mention absent masks:

```md
- **Mask in apply** rebinds to the existing tree by `id` when `mask` is present (validation rule 6 is relaxed for apply because the mask source may live outside the apply doc). If `mask` is absent or cannot be found in the live id map, the current mask is left unchanged.
```

**Step 3: Update `doc/guides/03-hot-reload-with-apply.md`**

After `## What apply updates`, add:

```md
## Patch semantics

`apply()` is patch-only. It mutates fields that are present in the apply document and leaves absent fields untouched.

Examples:

- If a live node has `x: 100` and the apply node omits `x`, the live `x` stays `100`.
- If a live node has a mask and the apply node omits `mask`, the mask stays attached.
- If the apply document omits a live child, that child remains in the live tree.
- If the apply document contains a child that is not present in the live tree, `onMissing(path, id)` fires and that subtree is skipped.

There is no `mode: "full"` today. Full reset/reconcile semantics are future work, not a partial hidden mode.
```

In `## Matching by label, not id`, replace the paragraph with:

```md
`apply` walks the doc and the live tree in lockstep. At each step it looks for an immediate child of the current target whose `label === node.label ?? node.id`. If you renamed an id between docs, the match silently fails.

A descendant label rename is also structural: because the lookup key is the new `node.label ?? node.id`, an existing child under the old label is not found. `onMissing` fires and the live child keeps its old label/state. The root is the only node that can be explicitly relabeled by `apply`, because it is passed directly rather than found through a parent label lookup.
```

In `## Masks across apply`, append:

```md
Because `apply` is patch-only, omitting `mask` does not clear an existing mask. A present `mask` id that cannot be found in the live tree is also a no-op.
```

**Step 4: Check docs for accidental full/reconcile promise**

Run:

```bash
rg -n "mode:|full|reconcile|patch-only|patch semantics|label rename|mask" README.md doc/guides/03-hot-reload-with-apply.md TODO.md
```

Expected:

- README/guide say `mode: "full"` is not implemented.
- No docs imply that apply adds/removes/replaces children.

**Step 5: Commit docs**

```bash
git add src/apply.ts README.md doc/guides/03-hot-reload-with-apply.md
git commit -m "docs: clarify apply patch semantics"
```

---

### Task 4: Mark TODO item complete and run full verification

**Files:**
- Modify: `TODO.md`

**Step 1: Update `TODO.md` section 3 checkboxes**

Change:

```md
## 3. Чёткая семантика `apply()`

- [ ] Явно задокументировать: `apply()` — patch semantics.
- [ ] Отсутствующее поле не сбрасывает старое значение.
- [ ] Отсутствующий child не удаляет live child.
- [ ] Type mismatch silent: type-specific assign может skip, base fields всё равно применяются.
- [ ] Missing child → `onMissing`, subtree skipped.
- [ ] Проверить и зафиксировать тестами поведение удаления/отсутствия `mask`.
- [ ] Проверить и зафиксировать тестами поведение удаления/смены `label`.
- [ ] Не добавлять `mode: "full"` сейчас; оставить в roadmap.
```

to:

```md
## 3. Чёткая семантика `apply()`

- [x] Явно задокументировать: `apply()` — patch semantics.
- [x] Отсутствующее поле не сбрасывает старое значение.
- [x] Отсутствующий child не удаляет live child.
- [x] Type mismatch silent: type-specific assign может skip, base fields всё равно применяются.
- [x] Missing child → `onMissing`, subtree skipped.
- [x] Проверить и зафиксировать тестами поведение удаления/отсутствия `mask`.
- [x] Проверить и зафиксировать тестами поведение удаления/смены `label`.
- [x] Не добавлять `mode: "full"` сейчас; оставить в roadmap.
```

Optionally also mark the duplicated principle items near the top if they are now satisfied by docs/tests:

```md
- [x] `apply()` по умолчанию и пока фактически только **patch-only**: отсутствующие поля не сбрасываются.
- [x] `mode: "full"` / reconcile оставить как будущий дизайн, не реализовывать частично.
```

**Step 2: Run the targeted apply suite**

Run:

```bash
npx tsc && node --test dist/test/apply.test.js
```

Expected: PASS.

**Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS. Remember `npm test` first runs `dist/test/fixtures.test.js` as a plain script, then the rest with `node --test`.

**Step 4: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- test/apply.test.ts src/build.ts src/apply.ts README.md doc/guides/03-hot-reload-with-apply.md TODO.md
```

Expected:

- Tests cover absent fields, absent live child, absent/unknown masks, absent root label, explicit root relabel, descendant label rename skip.
- `apply()` imports/uses `applyBasePatchFields()`.
- Build-time `applyBaseFields()` still uses `node.label ?? node.id`.
- No `mode` option was added.

**Step 5: Commit TODO + final green state**

```bash
git add TODO.md
git commit -m "chore: mark apply semantics complete"
```

---

## Final verification checklist

- `npx tsc && node --test dist/test/apply.test.js` passes.
- `npm test` passes.
- `README.md` and `doc/guides/03-hot-reload-with-apply.md` clearly say `apply()` is patch-only.
- No `ApplyOptions.mode` field exists.
- No reconcile/add/remove/replace logic was added.
- Build label fallback remains `Container.label = node.label ?? node.id`.
- Apply absent label preserves live label; explicit root label can patch; descendant label rename is missing/skipped.
