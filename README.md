# pxd — minimal PXD library for Pixi.js

Reads PXD v1 documents (Core + Library), builds Pixi `Container` trees, walks them by label, applies updated documents as patches. Core + Library only. `apply` is patch-only. No built-in Spine/UI widgets — register as custom `nodeTypes`.

📘 **[Spec](./doc/pxd-v1.md)** · 🧪 **[Examples](./examples/)**

## Install

```bash
npm install pxd pixi.js
```

```ts
import { build, apply, requirePath, mountSlot } from "pxd";

const root = build(doc, { resolve: { texture: Assets.get } });  // build once
apply(updatedDoc, root, { activeTags: ["mobile"] });             // patch many times
const title = requirePath<Text>(root, "title");                  // look up by label-path
mountSlot(root, "Reels", reelsContainer);                        // mount host content
```

Minimal document:

```json
{
    "format": "pxd",
    "version": 1,
    "root": {
        "id": "root",
        "type": "container",
        "children": [
            { "id": "title", "type": "text", "text": "Hello", "x": 100, "y": 40 },
            { "id": "logo",  "type": "sprite", "texture": "logo_main" }
        ]
    }
}
```

## API

| Export | Kind | Purpose |
|---|---|---|
| `build(doc, options)` | function | Validate `doc`, construct a fresh Pixi `Container` tree. |
| `apply(doc, root, options?)` | function | Patch an existing tree in place. Returns the number of updated nodes. |
| `find(root, path)` | function | Dot-path lookup by `Container.label`, returns `null` on miss. |
| `findAll(root, path)` | function | All matches at the final segment. |
| `requirePath(root, path)` | function | Like `find` but throws on miss. |
| `getSlot(root, name)` | function | Locate a slot Container by its `slot` field. |
| `mountSlot(root, name, child)` | function | Find slot, `addChild(child)`; throws if slot is missing. |
| `validate(doc)` | function | Run semantic validation. `build` calls this internally. |
| `defaultNodeTypes` | Map | Default registry: `container`, `sprite`, `nineSliceSprite`, `tilingSprite`, `animatedSprite`, `text`, `bitmapText`, `graphics`, `slot`. |
| `mergeRegistry(a, b)` | function | Helper for composing `nodeTypes` maps. |
| Types: `NodeType`, `BuildContext`, `AssignContext`, `Resolvers`, `BuildOptions`, `ApplyOptions`, `PxdDocument`, … | types | TypeScript-only. |

```ts
interface BuildOptions {
    resolve: {
        texture(id: string): Texture | undefined;
        style?(id: string): Partial<TextStyleOptions> | undefined;
        binding?(path: string): string | number | boolean | undefined;
    };
    activeTags?: ReadonlyArray<string>;
    nodeTypes?: Map<string, NodeType>;  // defaults to defaultNodeTypes
}

interface ApplyOptions extends Partial<BuildOptions> {
    onMissing?(path: string, nodeId: string): void;
}
```

## Base fields

Every node has these reserved fields. Do not reuse names — the base-field pass runs last and will overwrite.

- **Identity:** `id`, `type`, `label` — `Container.label = label ?? id`, used by path lookup.
- **Transform:** `x`, `y`, `scaleX`, `scaleY`, `rotation`, `pivotX`, `pivotY`
- **Visual:** `alpha`, `visible`, `zIndex`
- **Structural:** `mask` (id ref to Pixi mask target), `children` (walked by the library), `extensions` (ignored)

Everything else is yours: the library runs it through decision resolution and binding substitution, then passes it to `NodeType.assign`.

## apply()

Three rules:

- **Present field** → overwrites the live value.
- **Omitted field** → left unchanged.
- **Missing child** → `onMissing(path, id)` fires, subtree skipped; extra live children stay.

Matching uses one-hop child lookup against `Container.label` at each step — not deep search. Type mismatch (doc says `text`, live node is `Sprite`) silently skips type-specific fields; base fields still flow. Masks rebind by `id` against the live tree.

See [`examples/hot-reload-apply`](./examples/hot-reload-apply/).

## Custom node types

The default registry covers intrinsics: `container`, `sprite`, `nineSliceSprite`, `tilingSprite`, `animatedSprite`, `text`, `bitmapText`, `graphics`, `slot`. Anything else needs a `NodeType` from the host.

```ts
interface NodeType {
    create(node: ResolvedNode, ctx: BuildContext): Container;
    assign?(node: ResolvedNode, target: Container, ctx: AssignContext): void;
}
```

`create` constructs the container subclass. `assign` writes type-specific fields — called by both `build` and `apply`, so you write it once. Dispatch order per node: `create` → `assign` → base fields. Base fields run last so explicit transforms always win.

**Example:**

```ts
class SpinButton extends Container {
    private caption = new Text({ text: "" });
    constructor() { super(); this.addChild(this.caption); this.eventMode = "static"; }
    setLabel(s: string) { this.caption.text = s; }
    setEnabled(on: boolean) { this.alpha = on ? 1 : 0.4; this.eventMode = on ? "static" : "none"; }
}

const SpinButtonType: NodeType = {
    create: () => new SpinButton(),
    assign: (node, target, ctx) => {
        if (!(target instanceof SpinButton)) return;
        if (typeof node.text === "string") target.setLabel(ctx.readString(node.text));
        if (typeof node.enabled === "boolean") target.setEnabled(node.enabled);
    },
};

build(doc, {
    resolve: { texture: Assets.get },
    nodeTypes: new Map([...defaultNodeTypes, ["SpinButton", SpinButtonType]]),
});
```

Custom fields sit directly on the node (no `props` wrapper) and participate in decision resolution:

```json
{
    "id": "spinBtn",
    "type": "SpinButton",
    "x": 600, "y": 540,
    "text": { "_": "SPIN", "mobile": "TAP" },
    "enabled": true
}
```

Custom nodes can have document-defined `children`. `build` creates the node, runs `assign`, applies base fields, then builds and adds children. `apply` walks them the same way as `container`.

See [`examples/custom-node-type`](./examples/custom-node-type/) and [`examples/custom-composable-node`](./examples/custom-composable-node/).

## Decisions and bindings

| Feature | What it does | Where it applies |
|---|---|---|
| **Decision values (§3.6)** | Pick a primitive based on the active tag set. | Any scalar field: `x`, `texture`, `text`, custom fields, etc. |
| **String bindings (§7.2)** | Replace `{path}` via `resolve.binding`. | Any string value after decisions resolve. |

```json
{
    "id": "title",
    "type": "text",
    "text": { "_": "Welcome, {user.name}!", "ru": "Добро пожаловать, {user.name}!" },
    "x": { "_": 100, "mobile": 50 },
    "maxWidth": { "_": 320, "de": 400, "de+mobile": 360 }
}
```

```ts
const root = build(doc, {
    activeTags: ["de", "mobile"],
    resolve: { texture: Assets.get, binding: (path) => path === "user.name" ? "Ada" : "" },
});

apply(doc, root, { activeTags: ["en"], resolve });
```

Rules:
- Decision maps need `_` as default; selectors are single tags or lexicographically sorted sets (`de+mobile`, not `mobile+de`).
- Most specific match wins; declaration order breaks ties.
- Not decidable: `id`, `type`, `mask`, `children`, `extensions`, `points`.
- Binding escapes: `\{` → `{`, `\\` → `\`. Substituted values are not rescanned. Missing `resolve.binding` passes placeholders through literally.

See [`examples/decisions-bindings`](./examples/decisions-bindings/).

## Prefabs

A prefab is a reusable subtree declared once and instantiated by `type`. Each instance gets its own id scope (§13.2).

```json
{
    "format": "pxd",
    "version": 1,
    "level": "library",
    "prefabs": {
        "Button.primary": {
            "id": "root",
            "type": "container",
            "children": [
                { "id": "bg", "type": "sprite", "texture": "btn_primary" },
                { "id": "caption", "type": "text", "text": "" }
            ]
        }
    },
    "root": {
        "id": "menu",
        "type": "container",
        "children": [
            { "id": "playBtn", "type": "Button.primary", "x": 100, "y": 50 },
            { "id": "settingsBtn", "type": "Button.primary", "x": 100, "y": 120 }
        ]
    }
}
```

Rules:
- Prefab graphs must be acyclic.
- Prefab references cannot carry `children`.
- Type key collision between `prefabs` and `nodeTypes` is rejected.
- Patch prefab instance descendants with `apply()` by label path, e.g. `playBtn.caption`.

See [`examples/prefabs`](./examples/prefabs/).

## Slots

A `slot` node is a named mount point: an empty `Container` tagged with `Symbol.for("pxd.slot")`. Mount host-owned content into it after build.

```json
{ "id": "reelsMount", "type": "slot", "slot": "Reels", "x": 100, "y": 200, "width": 800, "height": 480 }
```

```ts
const root = build(doc, { resolve });
mountSlot(root, "Reels", new ReelsContainer());

const mount = getSlot(root, "Reels");
if (mount) mount.addChild(overlay);
```

Slot lookup uses the symbol tag, not `Container.label`, so it survives label collisions and cross-module boundaries. The `slot` field is a normal string — bindings work: `"slot": "Board.{layout.type}"`. Mounted content survives `apply()`. Slots do not auto-size mounted content.

See [`examples/slots`](./examples/slots/).

## CLI

```bash
pxd validate path/to/document.json   # structural + semantic check
pxd inspect  path/to/document.json   # validate + print shape, counts, tree
```

## Examples

| Example | What it shows |
|---|---|
| [`browser-minimal`](./examples/browser-minimal/) | Build a PXD tree and add it to the Pixi stage. |
| [`custom-node-type`](./examples/custom-node-type/) | Runtime `Meter` with `value`, `max`, `fill` as top-level fields; `assign` shared by `build` and `apply`. |
| [`custom-composable-node`](./examples/custom-composable-node/) | Custom `Panel` with internal chrome + document-defined `children`. |
| [`hot-reload-apply`](./examples/hot-reload-apply/) | `apply()` patches in place; `badge` child survives; missing `ghost` calls `onMissing`. |
| [`slots`](./examples/slots/) | `mountSlot` + `getSlot` with symbol-based lookup. |
| [`prefabs`](./examples/prefabs/) | `leftCard.badge` and `rightCard.badge` are distinct despite one shared prefab body. |
| [`decisions-bindings`](./examples/decisions-bindings/) | `activeTags` picks `x: 48`; `{theme.primary}` resolves via `binding`; custom field goes through the same pipeline. |

## Development

```bash
npm test
npm run build
npm pack --dry-run
```
