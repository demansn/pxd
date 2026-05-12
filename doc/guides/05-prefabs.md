# Prefabs

A prefab is a reusable subtree declared once and instantiated by `type`. Each instance gets its own id-scope (§13.2) — masks and ids inside one instance don't collide with another.

## Library document

A document with a top-level `prefabs` map is a **Library** profile:

```json
{
    "format": "pxd",
    "version": 1,
    "profile": "library",
    "prefabs": {
        "Button.primary": {
            "id": "root",
            "type": "container",
            "children": [
                { "id": "bg",      "type": "sprite", "texture": "btn_primary" },
                { "id": "caption", "type": "text",   "text": "" }
            ]
        }
    },
    "root": {
        "id": "menu",
        "type": "container",
        "children": [
            { "id": "playBtn",     "type": "Button.primary", "x": 100, "y": 50 },
            { "id": "settingsBtn", "type": "Button.primary", "x": 100, "y": 120 }
        ]
    }
}
```

`build` registers every prefab as a node type internally — so prefab references can compose transitively (a prefab body can use another prefab type).

## Per-instance identity

Both instances of `Button.primary` above expand to a subtree with `id: "bg"` and `id: "caption"`. That's allowed because each instance has its own id scope — `find(root, "playBtn.caption")` and `find(root, "settingsBtn.caption")` return distinct Containers.

## Restrictions on prefab references

Per §15 rule 19, a prefab reference node MUST NOT carry `props` or `children`:

```json
// VALID
{ "id": "playBtn", "type": "Button.primary", "x": 100 }

// INVALID — rejected by validator (rule 23)
{ "id": "playBtn", "type": "Button.primary", "children": [...] }
{ "id": "playBtn", "type": "Button.primary", "props": { "label": "Play" } }
```

If you want per-instance customization, pass it through the prefab body via decision values + bindings, or override on apply.

## Customizing prefab instances via apply

```json
{
    "format": "pxd",
    "version": 1,
    "profile": "library",
    "root": {
        "id": "menu",
        "type": "container",
        "children": [
            {
                "id": "playBtn",
                "type": "container",
                "children": [
                    { "id": "caption", "type": "text", "text": "PLAY" }
                ]
            },
            {
                "id": "settingsBtn",
                "type": "container",
                "children": [
                    { "id": "caption", "type": "text", "text": "SETTINGS" }
                ]
            }
        ]
    }
}
```

After building from the prefab doc above, you can `apply` a smaller patch doc that overrides just the captions per instance — match by label-path `playBtn.caption`, `settingsBtn.caption`.

## Acyclic prefab graph

Prefab A referencing prefab B referencing prefab A is rejected at validation time (rule 21). Cycle detection runs once at build.

## Collision with runtime types

If your `nodeTypes` map registers `"Card"` and the doc's prefabs also define `"Card"`, build throws — §12.1 forbids name collision. Pick distinct names.

## When to use prefabs vs custom node types

| Use a **prefab** when... | Use a **custom node type** when... |
|---|---|
| The subtree is just composition of intrinsic types | You need actual class behaviour (event handlers, methods, internal state) |
| Designers should be able to edit it as JSON | The widget owns logic the doc can't express |
| Every instance is structurally identical | Each instance is constructed differently |

Often: prefabs for layout cards, custom types for interactive widgets.
