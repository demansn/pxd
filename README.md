# `pxd` — minimal PXD library for Pixi.js

A tiny Pixi.js library that reads PXD v1 documents (Core + Library), builds Pixi `Container` trees, walks them by label, and applies updated documents as patches.

📖 **[Read the full documentation](./docs/index.html)** — guides, API reference, and live examples in one long page.

📘 **[Spec](./doc/pxd-v1.md)** · 🧪 **[Examples](./examples/)** · 🛠 **[CLI](./docs/index.html#cli)**

## Install

```bash
npm install pxd pixi.js
```

## At a glance

```ts
import { Application, Assets } from "pixi.js";
import { build, apply, requirePath, mountSlot } from "pxd";

const app = new Application();
await app.init({ resizeTo: window });

const root = build(doc, { resolve: { texture: Assets.get } });
app.stage.addChild(root);

apply(updatedDoc, root, { activeTags: ["mobile", "dark"] });
```

The full mental model — small API + `nodeTypes` as the only extension hook, patch-only `apply`, reserved base fields, "no extensions / no reconcile / no full apply" — lives in [`docs/index.html`](./docs/index.html#mental-model).

## Development

```bash
npm test
npm run build
npm pack --dry-run
```

Tests compile TypeScript first, then run fixture validation, runtime API suites, examples smoke tests, and docs structure checks.
