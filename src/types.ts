/**
 * Vendored subset of the PXD v1 TypeScript schema.
 *
 * Normative: `doc/pxd-v1.md` (Core + Library levels only).
 * Canonical: `tools/figma/src/schema/pxd-v1.schema.ts`.
 *
 * Scene types are NOT vendored — this library supports Core + Library only.
 */

export type PxdDocument = CoreDocument | LibraryDocument;

export interface DocumentEnvelope {
    format: "pxd";
    version: 1;
    level?: "core" | "library";
    extensionsUsed?: string[];
    extensionsRequired?: string[];
    extensions?: Record<string, unknown>;
}

export interface CoreDocument extends DocumentEnvelope {
    level?: "core";
    root: Node;
    prefabs?: never;
    scenes?: never;
}

export interface LibraryDocument extends DocumentEnvelope {
    level?: "library";
    root: Node;
    prefabs: Record<string, Node>;
    scenes?: never;
}

/**
 * §3.6 Decision map: a scalar field value selected at load time from an
 * "active tag set" supplied by the host. `"_"` is the default; every other
 * key is a `+`-joined, lexicographically-sorted tag selector.
 */
export interface DecisionMap<T extends number | string | boolean> {
    _: T;
    [selector: string]: T;
}

/** Field value that MAY be replaced by a decision map (§3.6). */
export type Decidable<T extends number | string | boolean> = T | DecisionMap<T>;

export interface BaseNode {
    /** Identity is static — never a decision value (§3.6). */
    id: string;
    /** Identity is static — never a decision value (§3.6). */
    type: string;
    label?: Decidable<string>;
    x?: Decidable<number>;
    y?: Decidable<number>;
    scaleX?: Decidable<number>;
    scaleY?: Decidable<number>;
    /** Local rotation in degrees; positive values rotate clockwise (§6). */
    rotation?: Decidable<number>;
    alpha?: Decidable<number>;
    visible?: Decidable<boolean>;
    zIndex?: Decidable<number>;
    /** Static — must resolve before mask forward-reference (§3.6). */
    mask?: string;
    extensions?: Record<string, unknown>;
}

export interface ContainerNode extends BaseNode {
    type: "container";
    pivotX?: Decidable<number>;
    pivotY?: Decidable<number>;
    children?: Node[];
}

export interface SpriteNode extends BaseNode {
    type: "sprite";
    texture: Decidable<string>;
    tint?: Decidable<string> | Decidable<number>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}

export interface NineSliceSpriteNode extends BaseNode {
    type: "nineSliceSprite";
    texture: Decidable<string>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    leftWidth?: Decidable<number>;
    topHeight?: Decidable<number>;
    rightWidth?: Decidable<number>;
    bottomHeight?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}

export interface TilingSpriteNode extends BaseNode {
    type: "tilingSprite";
    texture: Decidable<string>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    tilePositionX?: Decidable<number>;
    tilePositionY?: Decidable<number>;
    tileScaleX?: Decidable<number>;
    tileScaleY?: Decidable<number>;
    /** Tiling texture rotation in degrees; converted to Pixi radians by the reader. */
    tileRotation?: Decidable<number>;
    applyAnchorToTexture?: Decidable<boolean>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}

export interface AnimatedSpriteNode extends BaseNode {
    type: "animatedSprite";
    /** Static frame texture ids. Bindings resolve per string; decision maps are not supported inside arrays. */
    textures: string[];
    tint?: Decidable<string> | Decidable<number>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    animationSpeed?: Decidable<number>;
    loop?: Decidable<boolean>;
    autoUpdate?: Decidable<boolean>;
    updateAnchor?: Decidable<boolean>;
    /** Patch-friendly playback control: true => play(), false => stop(), absent => leave as-is. */
    playing?: Decidable<boolean>;
    children?: never;
}

export interface TextNode extends BaseNode {
    type: "text";
    text: Decidable<string>;
    style?: Decidable<string>;
    maxWidth?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}

export type GraphicsShape = "rect" | "roundRect" | "circle" | "ellipse" | "polygon";

export interface BitmapTextNode extends BaseNode {
    type: "bitmapText";
    text: Decidable<string>;
    style?: Decidable<string>;
    maxWidth?: Decidable<number>;
    anchorX?: Decidable<number>;
    anchorY?: Decidable<number>;
    children?: never;
}

export interface GraphicsNode extends BaseNode {
    type: "graphics";
    shape: Decidable<GraphicsShape>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    radius?: Decidable<number>;
    points?: number[];
    fill?: Decidable<string>;
    stroke?: Decidable<string>;
    strokeWidth?: Decidable<number>;
    children?: never;
}

export interface SlotNode extends BaseNode {
    type: "slot";
    slot: Decidable<string>;
    width?: Decidable<number>;
    height?: Decidable<number>;
    children?: never;
}

export interface CustomNode extends BaseNode {
    type: string;
    /**
     * Runtime/custom node fields live directly on the node. Their shape is
     * owned by the host-provided NodeType implementation.
     */
    [field: string]: unknown;
    /** Custom/runtime nodes are composable Containers; prefab refs stay restricted by validation. */
    children?: Node[];
}

export type IntrinsicNode =
    | ContainerNode
    | SpriteNode
    | NineSliceSpriteNode
    | TilingSpriteNode
    | AnimatedSpriteNode
    | TextNode
    | BitmapTextNode
    | GraphicsNode
    | SlotNode;

export type Node = IntrinsicNode | CustomNode;

/**
 * Post-§3.6 view of a node — every Decidable<T> field is collapsed to its
 * picked leaf T. NodeTypes' `create`/`assign` receive nodes of this shape, never raw Decidable.
 */
type Unwrap<T> = T extends DecisionMap<infer U>
    ? U
    : T extends Decidable<infer U>
    ? U
    : T;
export type Resolved<N> = { [K in keyof N]: Unwrap<N[K]> };

/** A node with all decision values pre-resolved. NodeTypes' `create`/`assign` see this. */
export type ResolvedNode = Resolved<Node> & Record<string, unknown>;
