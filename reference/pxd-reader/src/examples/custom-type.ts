/**
 * Example: registering a custom node type.
 *
 * `pxd` ships default node types for `container`, `sprite`, `text`, `graphics`,
 * and `slot`. Anything else in a document is treated as a runtime-registered
 * type (§3.5) — the host MUST supply a `NodeType` for it.
 *
 * A NodeType has two phases:
 *   - `create` constructs a Pixi Container/subclass.
 *   - `assign` applies doc-driven fields and is called by both build/apply.
 *
 * Base fields (`x`, `y`, `scale`, …) are applied by the framework AFTER
 * `assign`, so explicit transforms in the document win.
 */
import { Container, Graphics } from "pixi.js";
import { build, defaultNodeTypes, type NodeType } from "pxd";
import type { CoreDocument } from "pxd";

/**
 * A toy `Button` widget. In a real app this would be a Container subclass
 * with its own internal layout, hit area, sound, etc. — text rendering is
 * skipped here so the example carries no font dependency.
 */
class Button extends Container {
    constructor() {
        super();
        const bg = new Graphics().roundRect(0, 0, 160, 48, 8).fill("#fbbf24");
        this.addChild(bg);
    }

    setCaption(_value: string): void {
        // Real widget would update an internal Text child here.
    }
}

/**
 * Runtime type for `Button`. `node.props` is the §5 prop bag.
 */
const ButtonType: NodeType = {
    create: () => new Button(),
    assign: (node, target) => {
        if (!(target instanceof Button)) return;
        const props = (node.props ?? {}) as { label?: string };
        if (typeof props.label === "string") target.setCaption(props.label);
    },
};

const doc: CoreDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "play",
                type: "Button",
                x: 100, y: 100,
                props: { label: "Play" },
            },
            {
                id: "quit",
                type: "Button",
                x: 100, y: 160,
                props: { label: "Quit" },
            },
        ],
    },
};

export function buildScene(): Container {
    return build(doc, {
        resolve: { texture: () => ({} as never) },
        nodeTypes: new Map([
            ...defaultNodeTypes,
            ["Button", ButtonType],
        ]),
    });
}
