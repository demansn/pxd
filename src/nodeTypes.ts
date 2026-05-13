/**
 * Default node types for intrinsic PXD types (§4).
 *
 * Each `NodeType` constructs a minimal empty Pixi object in `create`; type-specific
 * fields (texture/text/style/anchor/draw-calls/...) are written by `assign`. The
 * dispatcher in `build.ts`/`apply.ts` runs `assign` then `applyBaseFields` — so
 * base fields override any side effects of type-specific writes (e.g. `width`
 * mutating `scale` on Sprite).
 */

import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { AssignContext, NodeType } from "./context.js";
import type { ResolvedNode } from "./types.js";

/** Empty mount point whose document area is readable even before content is mounted. */
export class SlotContainer extends Container {
    private documentWidth: number | undefined;
    private documentHeight: number | undefined;

    override get width(): number {
        return this.documentWidth ?? super.width;
    }

    override set width(value: number) {
        this.documentWidth = value;
    }

    override get height(): number {
        return this.documentHeight ?? super.height;
    }

    override set height(value: number) {
        this.documentHeight = value;
    }
}

/** Apply `anchorX` / `anchorY` from a node to any object that has a Pixi `anchor`. */
export function setAnchorFromNode(target: Sprite | Text, node: ResolvedNode): void {
    if (node.anchorX === undefined && node.anchorY === undefined) return;
    target.anchor.set(
        (node.anchorX as number | undefined) ?? 0,
        (node.anchorY as number | undefined) ?? 0,
    );
}

const container: NodeType = {
    create: () => new Container(),
    assign: (node, target) => {
        if (typeof node.pivotX === "number") target.pivot.x = node.pivotX;
        if (typeof node.pivotY === "number") target.pivot.y = node.pivotY;
    },
};

const sprite: NodeType = {
    create: () => new Sprite(),
    // Order matters: texture must be set BEFORE width/height — those mutate scale
    // via the current texture dimensions.
    assign: (node, target, ctx) => {
        if (!(target instanceof Sprite)) return;
        if (typeof node.texture === "string" && ctx.resolve.texture) {
            target.texture = ctx.resolve.texture(ctx.readString(node.texture));
        }
        if (typeof node.width === "number") target.width = node.width;
        if (typeof node.height === "number") target.height = node.height;
        if (node.tint !== undefined) target.tint = node.tint as number | string;
        setAnchorFromNode(target, node);
    },
};

function resolveTextStyle(node: ResolvedNode, ctx: AssignContext): object | undefined {
    if (typeof node.style === "string") {
        return ctx.resolve.style?.(ctx.readString(node.style));
    }
    if (node.style !== undefined && typeof node.style === "object") {
        return node.style as object;
    }
    return undefined;
}

function applyTextMaxWidth(node: ResolvedNode, target: Text): void {
    if (typeof node.maxWidth !== "number") return;
    target.style.wordWrap = true;
    target.style.wordWrapWidth = node.maxWidth;
}

const text: NodeType = {
    create: () => new Text(),
    assign: (node, target, ctx) => {
        if (!(target instanceof Text)) return;
        if (typeof node.text === "string") {
            target.text = ctx.readString(node.text);
        }
        const style = resolveTextStyle(node, ctx);
        if (style) Object.assign(target.style, style);
        applyTextMaxWidth(node, target);
        setAnchorFromNode(target, node);
    },
};

/**
 * Issue Pixi shape draw calls into `g` based on a resolved graphics node.
 * Pure of side-effects outside `g`. Exported for tests / advanced custom types.
 */
export function drawShape(
    g: Graphics,
    node: ResolvedNode,
    readString: (s: string) => string,
): void {
    const shape = node.shape as string;
    switch (shape) {
        case "rect":
            g.rect(0, 0, node.width as number, node.height as number);
            break;
        case "roundRect":
            g.roundRect(
                0,
                0,
                node.width as number,
                node.height as number,
                (node.radius as number | undefined) ?? 0,
            );
            break;
        case "circle":
            g.circle(0, 0, node.radius as number);
            break;
        case "ellipse":
            g.ellipse(0, 0, (node.width as number) / 2, (node.height as number) / 2);
            break;
        case "polygon":
            g.poly(node.points as number[]);
            break;
    }
    if (node.fill !== undefined) {
        const fill =
            typeof node.fill === "string"
                ? readString(node.fill)
                : (node.fill as object);
        g.fill(fill);
    }
    if (node.stroke !== undefined) {
        const strokeWidth = (node.strokeWidth as number | undefined) ?? 1;
        const stroke =
            typeof node.stroke === "string"
                ? { color: readString(node.stroke), width: strokeWidth }
                : { ...(node.stroke as object), width: strokeWidth };
        g.stroke(stroke);
    }
}

const graphics: NodeType = {
    create: () => new Graphics(),
    assign: (node, target, ctx) => {
        if (!(target instanceof Graphics)) return;
        target.clear();
        drawShape(target, node, ctx.readString);
    },
};

/** Slot — passive named mount point. External content attached via `mountSlot`. */
const slot: NodeType = {
    create: () => new SlotContainer(),
    assign: (node, target) => {
        if (!(target instanceof SlotContainer)) return;
        if (typeof node.width === "number") target.width = node.width;
        if (typeof node.height === "number") target.height = node.height;
    },
};

export const defaultNodeTypes: ReadonlyMap<string, NodeType> = new Map<string, NodeType>([
    ["container", container],
    ["sprite", sprite],
    ["text", text],
    ["graphics", graphics],
    ["slot", slot],
]);
