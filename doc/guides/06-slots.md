# Slots

A `slot` node (§4.5) is a passive named mount point in the tree — an empty `Container` tagged with a slot name. Your game attaches external content (a Reels container, a HUD widget tree built outside PXD, a third-party component) into it after build.

## Why slots and not labels?

`find(root, "reels")` finds by `Container.label`. Slots are tagged with a symbol (`Symbol.for("pxd.slot")`) instead:

- Slot lookup is label-independent — if a designer renames the surrounding container labels, slot mounting still works.
- Slot names are an explicit contract between doc and host; labels are general-purpose.
- `getSlot` walks the tree by symbol, so it works across module boundaries.

## Declaring a slot

```json
{
    "id": "hud",
    "type": "container",
    "children": [
        { "id": "reelsMount", "type": "slot", "slot": "Reels", "x": 100, "y": 200, "width": 800, "height": 480 }
    ]
}
```

The `slot` field is the semantic name. `id` / `label` are still applied for find/apply.

## Mounting external content

```ts
import { build, mountSlot, getSlot } from "pxd";

const root = build(doc, { resolve });

const reels = new ReelsContainer({ rows: 5, cols: 5 });
mountSlot(root, "Reels", reels);  // throws if "Reels" slot not present

// Or look up the slot Container and decide yourself.
const mount = getSlot(root, "Reels");
if (mount) {
    mount.addChild(reels);
    mount.addChild(reelsOverlay);
}
```

## Slot bindings

The `slot` field is a regular string-valued field — bindings work:

```json
{ "id": "boardMount", "type": "slot", "slot": "Board.{layout.type}" }
```

```ts
build(doc, {
    resolve: { binding: (p) => p === "layout.type" ? "cascade" : "" },
    // ...
});
// → slot name resolves to "Board.cascade"
mountSlot(root, "Board.cascade", boardContainer);
```

## Sizing a slot

PXD doesn't auto-size the mounted content. The slot Container has `width`/`height` from the doc only if you set them — otherwise it's an empty Container with size 0. Common patterns:

- Read `width`/`height` off the slot to size your mounted child:
  ```ts
  const mount = getSlot(root, "Reels")!;
  reels.scale.set(mount.width / reels.naturalWidth);
  ```
- Or use a `graphics` rect as a placeholder visible only in dev:
  ```json
  {
      "id": "reelsPlaceholder",
      "type": "graphics",
      "shape": "rect",
      "width": 800, "height": 480,
      "fill": "#ff00ff",
      "alpha": { "_": 0, "dev": 0.2 }
  }
  ```

## Slots survive apply

After hot-reloading via `apply`, mounted external content remains untouched (apply walks doc children, slot mount points typically have no doc children to match against — your mounted child stays). This is by design: the host owns slot contents.

## Multiple slots with the same name

`getSlot` returns the **first** match in DFS order. If a doc declares two slots with the same `slot` field, only the first is reachable via `getSlot`. Don't do this; the validator doesn't forbid it but it's a producer mistake.
