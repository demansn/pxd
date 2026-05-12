# Custom node types

The default registry (`defaultNodeTypes`) covers intrinsic types: `container`, `sprite`, `text`, `graphics`, `slot`. Anything else in a doc — `"type": "SpinButton"`, `"type": "ProgressBar"` — needs a `NodeType` registered by the host.

## The `NodeType` contract

```ts
interface NodeType {
    create(node: ResolvedNode, ctx: BuildContext): Container;
    assign?(node: ResolvedNode, target: Container, ctx: AssignContext): void;
}
```

- `create` returns a freshly constructed Container (a subclass — `MySpinButton`, `ProgressBar`, ...).
- `assign` writes type-specific fields. **Called by both `build` and `apply`** — write your update logic once, it runs in both flows.
- Dispatch order per node: `create` → `assign` → `applyBaseFields` (`x/y/scale/alpha/...`). Base fields always run last, so explicit transforms override any side effects of `assign`.

## Example: SpinButton

```ts
import { build, defaultNodeTypes, type NodeType } from "pxd";
import { Container, Text } from "pixi.js";

class SpinButton extends Container {
    private caption = new Text({ text: "" });
    constructor() {
        super();
        this.addChild(this.caption);
        this.eventMode = "static";
    }
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

const root = build(doc, {
    resolve: { texture: Assets.get },
    nodeTypes: new Map([
        ...defaultNodeTypes,
        ["SpinButton", SpinButtonType],
    ]),
});
```

Matching doc fragment:

```json
{
    "id": "spinBtn",
    "type": "SpinButton",
    "x": 600, "y": 540,
    "text": { "_": "SPIN", "mobile": "TAP" },
    "enabled": true
}
```

## Custom fields

Custom node fields are plain top-level node fields. The library reserves base/structural fields (`id`, `type`, `label`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `mask`, `extensions`, and for now `children`). Do not reuse those names for custom semantics.

Scalar custom fields may be decision maps. `NodeType.create` and `NodeType.assign` receive the resolved value, just like intrinsic node types.

### Migration note: no `props`

Older drafts used `{ "props": { "text": "SPIN" } }` for runtime/custom nodes. Custom parameters now live directly on the node: `{ "text": "SPIN" }`. The `props` field is rejected so custom scalar fields can participate in the same decision-resolution pipeline as built-in fields.

## Runtime types must not have children

Runtime-registered types are leaves for now — their children belong inside the implementation, not the doc. The validator rejects `children` on a non-intrinsic non-prefab type.

If you need a composite custom type with doc-defined children today, use a **prefab** instead — see [05-prefabs.md](./05-prefabs.md).

## Overriding an intrinsic type

Replace any default by registering the same key:

```ts
import { defaultNodeTypes, type NodeType } from "pxd";
import { Text } from "pixi.js";
import gsap from "gsap";

// Animate text changes instead of setting them instantly.
const animatedText: NodeType = {
    create: defaultNodeTypes.get("text")!.create,
    assign: (node, target, ctx) => {
        if (!(target instanceof Text)) return;
        if (typeof node.text === "string") {
            gsap.to(target, { pixi: { text: ctx.readString(node.text) }, duration: 0.3 });
        }
    },
};

apply(updatedDoc, root, {
    nodeTypes: new Map([["text", animatedText]]),
});
```

## When to do work in `create` vs `assign`

- **`create`**: anything constructor-only (subclasses, listeners). Keep it minimal — let `assign` do field application.
- **`assign`**: every doc-driven field. This is what gets re-run on `apply`. If you set a field only in `create`, hot-reload won't update it.

## Why `assign` is optional

Some types have no assignable type-specific fields:
- `slot` — passive mount point.
- Prefab wrappers — fully composed by `create`.

Just omit the field:

```ts
const slotType: NodeType = { create: () => new Container() };
```
