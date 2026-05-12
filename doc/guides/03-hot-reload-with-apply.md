# Hot reload with `apply`

The killer feature of this library: `apply(doc, root, options)` updates an already-built Pixi tree from an updated JSON. No rebuild, no Container identity loss, no listener re-binding.

## Pattern: dev-time hot reload

```ts
import { build, apply } from "pxd";

const root = build(initialDoc, { resolve });
app.stage.addChild(root);

// During dev, watch the JSON file (Vite/esbuild HMR, fs.watch, dev-server SSE)
import.meta.hot?.accept("./hud.json", (mod) => {
    apply(mod.default, root, {
        resolve,
        onMissing: (path) => console.warn("PXD miss:", path),
    });
});
```

A designer edits `hud.json` → game updates transforms, textures, text content live.

## Pattern: locale / theme swap

```ts
// User switches language in settings UI.
function switchLocale(code: "en" | "ru" | "de") {
    apply(hudDoc, root, {
        resolve: { binding: (path) => i18n.translate(code, path) },
        activeTags: [code, isMobile ? "mobile" : "desktop"],
    });
}
```

Same doc, different tags → all `{path}` bindings and decision-map values re-resolve. Containers stay identical.

## What `apply` updates

- All base fields (`x/y/scale/rotation/alpha/visible/zIndex`).
- Type-specific fields via each `NodeType.assign` (texture, text, style, shape draws, ...).
- Masks — rebound by id against the existing tree (the source can live outside the apply doc, see below).

## What `apply` does NOT do

- **Doesn't add or remove children.** If the doc has a child the live tree doesn't have, `onMissing(path, id)` fires and the subtree is skipped. If the live tree has a child not in the doc, it's left untouched.
- **Doesn't change types.** A node was built as `Sprite`, the doc now says `text` — the type-specific fields are silently skipped (instanceof-mismatch). Base fields still apply.
- **Doesn't replace identity.** Same Container, mutated in place.

## Matching by label, not id

`apply` walks the doc and the live tree in lockstep. At each step it looks for an immediate child of the current target whose `label === node.label ?? node.id`. If you renamed an id between docs, the match silently fails.

## Masks across apply

Inside the apply doc, a node's `mask: "someId"` is resolved against ids already tagged on the live tree (`PXD_ID` symbol). The mask source can live *outside* the apply doc — useful when you apply a small subtree and the mask lives globally.

## Custom `assign` overrides for apply

You can register apply-only behaviour by passing different `nodeTypes`:

```ts
// Animate text changes only during reload, not during initial build.
apply(updatedDoc, root, {
    nodeTypes: new Map([
        ["text", {
            create: defaultNodeTypes.get("text")!.create,  // unused by apply
            assign: (node, target, ctx) => {
                if (target instanceof Text) {
                    gsap.to(target, { pixi: { text: ctx.readString(node.text) }, duration: 0.3 });
                }
            },
        }],
    ]),
});
```

Note: `apply` invokes only `assign`, so `create` can be anything (just keep the field — the type wants both).

## Counting updated nodes

`apply` returns the number of updated nodes. Useful for sanity checks:

```ts
const n = apply(doc, root, { onMissing: log });
console.log(`updated ${n} nodes`);
```
