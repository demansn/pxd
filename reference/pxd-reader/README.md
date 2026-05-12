# PXD reader — demo & usage examples

A browser demo and a small gallery of usage snippets for the local `pxd` library.

This folder is **not** a separate reader implementation. It exists to show how to wire `pxd` into a real Pixi.js application.

Spec: [`../../doc/pxd-v1.md`](../../doc/pxd-v1.md).

## Quickstart

```bash
# From repository root: build the library first.
npm install
npm run build

# Build and serve the demo.
cd reference/pxd-reader
npm install
npm run build
npm run demo:serve   # http://localhost:8080/reference/pxd-reader/
```

`npm install` resolves `pxd` from `file:../..`, so the local package is used directly.

## What the demo shows

The browser entry (`src/demo.ts`) walks through the four headline features:

1. **`build(doc, opts)`** — turn a Core document into a fresh Pixi tree.
2. **`requirePath(root, "hud.bet.value")`** — look up a child by dotted label path.
3. **`mountSlot(root, "logo", child)`** — drop external content into a named `slot` node.
4. **`apply(doc, root, opts)`** — patch the live tree with a new document. The demo applies a "patched" version after two seconds; text, colours and positions update in place without rebuilding.

## Example snippets

Each file under `src/examples/` is a standalone, commented module focused on one feature. They are not executed by the browser demo; they exist as copy-pasteable reference code.

| File | Demonstrates |
|---|---|
| `examples/custom-type.ts` | Registering a runtime-registered node type via `nodeTypes`. |
| `examples/prefabs.ts` | Library level — reusable named trees, including transitive prefab → prefab references. |
| `examples/decisions-bindings.ts` | §3.6 decision values (`activeTags`) and §7.2 string bindings (`{path}`). |
| `examples/slots-and-find.ts` | `slot` nodes, `mountSlot`, `requirePath` / `findAll` label-path lookup. |
| `examples/apply-hot-reload.ts` | `apply` as a stylesheet — theme/locale swap on a built tree. |

## Public API cheat sheet

```ts
import {
    build, apply,
    find, findAll, requirePath,
    getSlot, mountSlot,
    defaultNodeTypes,
    type NodeType,
} from "pxd";
```

- `build(doc, opts)` — validate + construct a Pixi tree.
- `apply(doc, root, opts)` — patch an existing tree. Missing nodes → `onMissing`, type mismatches silently skip type-specific fields.
- `find` / `findAll` / `requirePath` — dotted-label lookup over `Container.label`.
- `getSlot` / `mountSlot` — slot mounting by `slot` tag, label-independent.
- `defaultNodeTypes` — default per-type registry; extend/override it with custom `NodeType { create, assign }` entries.

See [`../../README.md`](../../README.md) for the full API surface and design contract.
