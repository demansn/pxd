# Getting started

A PXD document is JSON that describes a Pixi container tree: positions, textures, text, styles, prefabs. This library reads that JSON and builds a real Pixi tree, then lets you walk it by name and update it from a new document without rebuilding.

## Minimal document

```json
{
    "format": "pxd",
    "version": 1,
    "root": {
        "id": "root",
        "type": "container",
        "children": [
            { "id": "title", "type": "text", "text": "Hello", "x": 100, "y": 40 },
            { "id": "logo",  "type": "sprite", "texture": "logo_main", "x": 0, "y": 0 }
        ]
    }
}
```

## Build a tree

```ts
import { build, requirePath } from "pxd";
import { Assets, Text } from "pixi.js";
import doc from "./hud.json";

const root = build(doc, {
    resolve: {
        texture: (id) => Assets.get(id),   // your texture lookup
    },
});

app.stage.addChild(root);

// `requirePath` throws if the label-path doesn't resolve.
const title = requirePath<Text>(root, "title");
title.text = "Hello, player";
```

`Container.label` on every built node equals `node.label ?? node.id` — that is what `find` and `requirePath` match against.

## What you get back

- A `Container` tree mirroring the doc.
- Every node's `label` set to the doc's `id` (or explicit `label`).
- `x/y/scale/rotation/alpha/visible/zIndex` applied per node.
- Type-specific fields: `texture` for sprites, `text+style+maxWidth` for text, `shape+fill+stroke` for graphics, mount points for slots.

## Next steps

- [Custom node types](./02-custom-node-types.md) — register your own widgets (SpinButton, ProgressBar).
- [Hot reload with apply](./03-hot-reload-with-apply.md) — update a live tree from a new JSON doc.
- [Decisions and bindings](./04-decisions-and-bindings.md) — mobile/desktop layouts, locale swaps.
- [Prefabs](./05-prefabs.md) — reusable subtrees.
- [Slots](./06-slots.md) — mount external content (Reels, custom containers).
