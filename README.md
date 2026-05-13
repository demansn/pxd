# `pxd` — minimal PXD library for Pixi.js

A tiny Pixi.js library that reads PXD v1 documents (Core + Library levels), builds Pixi `Container` trees, walks them, and applies documents to existing trees as stylesheets. The whole library is small TypeScript with `pixi.js` as a peer dependency and Ajv for CLI schema validation.

Spec: [`doc/pxd-v1.md`](./doc/pxd-v1.md).

**Guides**: [Getting started](./doc/guides/01-getting-started.md) · [Custom node types](./doc/guides/02-custom-node-types.md) · [Hot reload with apply](./doc/guides/03-hot-reload-with-apply.md) · [Decisions & bindings](./doc/guides/04-decisions-and-bindings.md) · [Prefabs](./doc/guides/05-prefabs.md) · [Slots](./doc/guides/06-slots.md)

## Why this exists

PXD separates **scene configuration** (positions, textures, styles, prefabs) from **scene logic** (state, reactions, animations). This library is the bridge for Pixi.js:

- `build(doc, opts)` — turn a document into a fresh Pixi tree.
- `apply(doc, root, opts)` — apply a document to an **already-built** Pixi tree (positions, textures, text content, etc. update in place). This is the killer feature: a designer changes a JSON file, your game updates the live tree without rebuilding.
- `find(root, "hud.bet.value")` — dot-path lookup by `Container.label`.
- `mountSlot(root, slotName, content)` — drop external content into named slot nodes.

## Quickstart

```bash
npm install
npm test
```

## CLI

The package exposes a `pxd` binary:

```bash
pxd validate path/to/document.json
pxd inspect path/to/document.json
```

`pxd validate` parses JSON, checks `pxd.schema.json` for structural errors, then runs the semantic validator (`validate()`) for PXD rules such as duplicate ids, mask resolution, prefab cycles, and extension requirements.

`pxd inspect` validates the document first, then prints shape, node/type counts, prefab counts, and a short tree. It does not build Pixi objects or resolve textures/styles.

## Public API

```ts
import {
    build, apply,
    find, findAll, requirePath,
    getSlot, mountSlot,
    type BuildOptions, type ApplyOptions, type NodeType,
} from "./src/index.js";

// 1) Build a fresh tree
const root = build(doc, {
    resolve: {
        texture: (id) => Assets.get(id),
        style: (id) => styleTable[id],
        binding: (path) => i18n.t(path),
    },
    activeTags: ["en", "mobile"],
    nodeTypes: new Map([["SpinButton", {
        create: () => new MySpinButton(),
        assign: (n, t, ctx) => {
            if (typeof n.text === "string") t.setLabel(ctx.readString(n.text));
        },
    }]]),
});

// 2) Find children
const betValue = requirePath<Text>(root, "hud.bet.value");

// 3) Mount external content into a slot
mountSlot(root, "Reels", new ReelsContainer());

// 4) Apply a doc as stylesheet (hot reload, theme swap, locale swap)
apply(updatedDoc, root, {
    activeTags: ["en", "mobile", "dark"],
    onMissing: (path) => console.warn("PXD miss:", path),
});
```

## Design contract

- **`Container.label = node.label ?? node.id`** — load-bearing for find/apply. PXD spec §3.2 makes label the semantic name; if the producer didn't supply one, `id` is used. Path queries always compare against `label`.
- **Apply is patch-only.** Present fields update matched live nodes; absent optional fields do not reset old values. A child missing from the apply doc is not removed from the live tree. An absent `mask` field does not clear an existing mask. There is no `mode: "full"` or reconcile mode yet.
- **Apply matches by label-path with immediate-child lookup.** For each PXD child node we look for an immediate child of the current Pixi parent with `label === (node.label ?? node.id)` (one hop, not deep search). Missing live nodes → `onMissing` callback, then subtree skipped. Structure mismatch never throws. Because matching itself uses label, renaming a descendant `label` in an apply doc is treated as a missing child rather than an in-place rename; use rebuild/future reconcile for structural renames.
- **Type-mismatch is silent.** If PXD says `text` but the live target is `Sprite`, type-specific fields (`text`, `style`) are skipped. Base fields (`x`, `y`, `alpha`, …) still flow through.
- **Mask in apply** rebinds to the existing tree by `id` when `mask` is present (validation rule 6 is relaxed for apply because the mask source may live outside the apply doc). If `mask` is absent or cannot be found in the live id map, the current mask is left unchanged.
- **Slots** are Pixi `Container`s tagged with `Symbol.for("pxd.slot")` — `getSlot` finds them regardless of label. Independent from label collisions and cross-module-safe.

## Extension points

A single registry of `NodeType { create, assign }` strategies — used by both `build` and `apply`. The default registry is `defaultNodeTypes`; override by passing `nodeTypes` to either call.

Custom node fields live directly on the node. Reserved structural/base fields are `id`, `type`, `label`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `mask`, `children`, and `extensions`; do not reuse those names for custom semantics. `children` is structural: the library builds/applies it, not your `assign` function.

**Dispatch order per node:** `create` → `assign` (type-specific fields) → base fields (`x`, `y`, `scale`, …). Base fields run last so explicit transform fields override type-specific side effects (e.g. `sprite.width = N` mutates `scale.x`; a separate `scaleX` on the node still wins).

```ts
import { defaultNodeTypes, type NodeType } from "./src/index.js";

// Add a custom type — `create` constructs an empty object, `assign` writes
// type-specific fields. `build` calls create + assign; `apply` calls only assign.
const SpinButton: NodeType = {
    create: () => new MySpinButton(),
    assign: (node, target, ctx) => {
        if (!(target instanceof MySpinButton)) return;
        if (typeof node.text === "string") target.setLabel(ctx.readString(node.text));
        if (typeof node.enabled === "boolean") target.setEnabled(node.enabled);
    },
};

const nodeTypes = new Map<string, NodeType>([
    ...defaultNodeTypes,
    ["SpinButton", SpinButton],

    // Override how 'text' is assigned (e.g. animate instead of set)
    ["text", {
        create: defaultNodeTypes.get("text")!.create,
        assign: (node, target, ctx) => {
            if (target instanceof Text) gsap.to(target, { text: ctx.readString(node.text), duration: 0.3 });
        },
    }],
]);

build(doc, { resolve, nodeTypes });
apply(doc, root, { resolve, nodeTypes });
```

### Migration note: no `props`

Older drafts used `{ "props": { "text": "SPIN" } }` for runtime/custom nodes. Custom parameters now live directly on the node: `{ "text": "SPIN" }`. The `props` field is rejected so custom scalar fields can participate in the same decision-resolution pipeline as built-in fields.

## File layout

```
pxd/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        — public re-exports
    ├── types.ts        — vendored PXD schema (Core + Library)
    ├── validate.ts     — §10 + §15 validation (scene-shape rejected, table-driven specs)
    ├── decisions.ts    — §3.6 decision-value resolver
    ├── bindings.ts     — §7.2 {path} substitution
    ├── context.ts      — NodeType / BuildContext / ApplyContext / Resolvers / mergeRegistry
    ├── tags.ts         — Symbol.for("pxd.id"), Symbol.for("pxd.slot")
    ├── nodeTypes.ts    — defaultNodeTypes + drawShape + setAnchorFromNode
    ├── build.ts        — build() + buildSubtree + applyBaseFields
    ├── apply.ts        — apply() with label-path walking (lazy mask idMap)
    ├── find.ts         — find / findAll / requirePath
    └── slots.ts        — getSlot / mountSlot
```

## What it supports

- **Levels:** Core, Library (with transitive prefab composition and §13.2 scope isolation per instance).
- **Decision values (§3.6):** active-tag set, lexicographic selector validation, declaration-order tie-break.
- **String bindings (§7.2):** `{path}` substitution, `\{` and `\\` escapes, no rescanning.
- **Masks (§8):** forward references resolved in two passes; apply rebinds by id against existing tree.
- **Slots (§4.5):** symbol-tagged containers; `mountSlot` / `getSlot` find them by `slot` field.
- **Runtime-registered/custom types (§5):** add custom `NodeType { create, assign }` via `options.nodeTypes`; custom nodes may carry document-defined `children` and are traversed like containers.

## What it doesn't do

- **No Scene level.** Scene-shape documents are rejected with a clear error.
- **No per-node extension handlers (§9.2).** `extensions` payloads are silently ignored.
- **No document-level extensions.** Asset/resource manifest loading is the host's concern.
- **No reactivity.** Bindings resolve once per `build` / `apply`; call `apply` again on change.
- **No tree → PXD serialization.** One-way only.

## Relationship to `pxd-reader/`

`reference/pxd-reader/` is the canonical reference reader for the PXD spec (Core + Library + Scene, extension handler API, etc.). It's larger and more spec-faithful.

This package is the practical Pixi-bound library: smaller surface, fewer abstractions, adds `apply` / `find` / `mountSlot` which the reference reader doesn't have. Vendors `types`, `validate`, decision/binding resolvers, and the intrinsic node-type implementations from the reference rather than depending on it — so the package stays self-contained.

## JSON Schema

`pxd.schema.json` (JSON Schema draft 2020-12) ships with the package and is available via the `pxd/schema` export. It covers Core and Library levels; Scene documents fail both branches. The schema enforces structural constraints — required fields, type shapes, decision-map patterns, no unknown properties on intrinsic nodes. Semantic-only rules (ID uniqueness, mask resolution, prefab cycles, lexicographic tag ordering, extension subset checks) are deliberately left to `validate()`. Use the schema for editor integration and CI pre-checks; always call `validate()` before passing a document to `build()` or `apply()`.

## Tests

```bash
npm test
```

- `test/fixtures.test.ts` — every `valid/core-*` and `valid/library-*` fixture validates; every `invalid/*` rejects with the right rule; `valid/scene-*` rejected as out-of-scope.
- `test/build.test.ts` — decisions, bindings, prefab scope, custom node types, rotation, mask wiring.
- `test/apply.test.ts` — match, missing, type-mismatch, re-resolve decisions/bindings, mask rebind, scene reject.
- `test/find.test.ts` — dot-path, findAll, requirePath throws.
- `test/slots.test.ts` — getSlot by symbol, mountSlot adds child, throw on missing slot.
- `test/cli.test.ts` — `pxd validate`, validation/schema error formatting, `pxd inspect`, and bin metadata.
