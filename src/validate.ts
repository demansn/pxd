/**
 * PXD v1 validator (Core + Library levels only). Scene-shape rejected at entry.
 * Reports the first violation with a rule reference (`doc/pxd-v1.md`).
 */

import { isDecisionMap, NON_DECIDABLE_KEYS } from "./decisions.js";
import type { PxdDocument } from "./types.js";

export class ValidationError extends Error {
    constructor(
        public readonly rule: string,
        message: string,
    ) {
        super(`[${rule}] ${message}`);
        this.name = "ValidationError";
    }
}

/** Intrinsic type names (§4). */
const INTRINSIC = new Set(["container", "sprite", "nineSliceSprite", "text", "graphics", "slot"]);
/** Intrinsic types that MUST NOT have children (§10 rule 8). */
const NON_COMPOSABLE = new Set(["sprite", "nineSliceSprite", "text", "graphics", "slot"]);

/**
 * Extension identifiers this reader implementation supports.
 * Used for §10 rule 16 enforcement (`extensionsRequired` ids must be recognized).
 */
export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set<string>();

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.length > 0;
}

export type Shape = "core" | "library";

function detectShape(doc: Record<string, unknown>): Shape | "scene" {
    if ("scenes" in doc) return "scene";
    if ("prefabs" in doc) return "library";
    return "core";
}

export interface ValidateOptions {
    supportedExtensions?: ReadonlySet<string>;
    /**
     * If true, do NOT enforce §10 rule 6 (mask refs must resolve within tree).
     * Used by `apply()` where mask sources may live in the existing Pixi tree
     * rather than the apply document.
     */
    skipMaskValidation?: boolean;
}

export function validate(input: unknown, options: ValidateOptions = {}): PxdDocument {
    const supportedExtensions = options.supportedExtensions ?? SUPPORTED_EXTENSIONS;
    const skipMaskValidation = options.skipMaskValidation === true;
    if (!isObject(input)) throw new ValidationError("rule 1", "document must be an object");
    const doc = input;

    // §10 rule 1 — format
    if (doc.format !== "pxd") {
        throw new ValidationError("rule 1", "format must be 'pxd'");
    }
    // §10 rule 2 — version
    if (doc.version !== 1) {
        throw new ValidationError("rule 2", "version must be 1");
    }

    // §10 rules 15–16 — extensions
    const used = new Set(Array.isArray(doc.extensionsUsed) ? (doc.extensionsUsed as string[]) : []);
    const required = Array.isArray(doc.extensionsRequired) ? (doc.extensionsRequired as string[]) : [];
    for (const ext of required) {
        if (!used.has(ext)) {
            throw new ValidationError(
                "rule 15",
                `extensionsRequired contains '${ext}' not in extensionsUsed`,
            );
        }
        if (!supportedExtensions.has(ext)) {
            throw new ValidationError(
                "rule 16",
                `required extension '${ext}' is not supported by this reader`,
            );
        }
    }

    // §20 rule 28 — root and scenes are mutually exclusive
    if ("root" in doc && "scenes" in doc) {
        throw new ValidationError("rule 28", "document has both 'root' and 'scenes'");
    }

    const shape = detectShape(doc);

    // Scene-shape rejection — this library is Core+Library only.
    if (shape === "scene") {
        throw new ValidationError(
            "scope",
            "scene-shape documents are not supported by this library (Core+Library only)",
        );
    }

    // §2.1 / §10 rule 18 — level matches shape
    if (typeof doc.level === "string" && doc.level !== shape) {
        throw new ValidationError(
            "rule 18",
            `level '${doc.level}' does not match document shape '${shape}'`,
        );
    }

    // Prefabs
    const prefabs = isObject(doc.prefabs) ? doc.prefabs : undefined;
    const prefabNames = prefabs ? new Set(Object.keys(prefabs)) : new Set<string>();

    if (prefabs) {
        for (const [name, tree] of Object.entries(prefabs)) {
            validateTree(tree, prefabNames, `prefab '${name}'`, skipMaskValidation);
        }
        // §15 rule 21 — acyclic
        detectCycle(prefabs);
    }

    // Root
    if (!isObject(doc.root)) {
        throw new ValidationError("rule 3", "core/library documents MUST have an object 'root'");
    }
    validateTree(doc.root, prefabNames, "root", skipMaskValidation);

    return doc as unknown as PxdDocument;
}

/** Validate a tree rooted at `root`. Checks ids, masks, composability, prefab refs. */
function validateTree(
    root: unknown,
    prefabNames: ReadonlySet<string>,
    context: string,
    skipMaskValidation: boolean,
): void {
    const ids = new Set<string>();
    const masks: Array<{ nodeId: string; maskId: string }> = [];
    walk(root, ids, masks, prefabNames, context);
    if (skipMaskValidation) return;
    // §10 rule 6 — mask refs resolve within the same tree
    for (const { nodeId, maskId } of masks) {
        if (!ids.has(maskId)) {
            throw new ValidationError(
                "rule 6",
                `mask '${maskId}' on node '${nodeId}' in ${context} not found in same tree`,
            );
        }
    }
}

function walk(
    node: unknown,
    ids: Set<string>,
    masks: Array<{ nodeId: string; maskId: string }>,
    prefabNames: ReadonlySet<string>,
    context: string,
): void {
    if (!isObject(node)) {
        throw new ValidationError("rule 4", `node in ${context} must be an object`);
    }
    // §10 rule 4 — id + type non-empty strings
    if (!isNonEmptyString(node.id)) {
        throw new ValidationError("rule 4", `node in ${context} must have non-empty string 'id'`);
    }
    if (!isNonEmptyString(node.type)) {
        throw new ValidationError("rule 4", `node '${node.id}' in ${context} must have non-empty string 'type'`);
    }
    // §10 rule 5 — unique ids within tree
    if (ids.has(node.id)) {
        throw new ValidationError("rule 5", `duplicate id '${node.id}' in ${context}`);
    }
    ids.add(node.id);

    // §10 rule 8 — non-composable intrinsic MUST NOT have children.
    // Custom/runtime nodes are composable; prefab references are checked below.
    if (NON_COMPOSABLE.has(node.type) && node.children !== undefined) {
        throw new ValidationError(
            "rule 8",
            `intrinsic type '${node.type}' on node '${node.id}' must not have 'children'`,
        );
    }

    // §10 rules 11–14 — decision-map values
    validateDecisionMaps(node, context);

    // §5 migration — `props` was removed from the public node model in 0.x.
    // Custom/runtime parameters now live as top-level fields and participate in §3.6.
    if (node.props !== undefined) {
        throw new ValidationError(
            "rule 10",
            `node '${node.id}' must not have 'props'; put custom fields directly on the node`,
        );
    }

    // §7 intrinsic field constraints
    validateIntrinsicFields(node);

    const isPrefabRef = !INTRINSIC.has(node.type) && prefabNames.has(node.type);

    // §15 rule 19 — prefab references MUST NOT have children.
    // `props` is rejected globally above; prefab parameters are not part of this item.
    if (isPrefabRef) {
        if (node.children !== undefined) {
            throw new ValidationError(
                "rule 23",
                `prefab reference '${node.type}' on node '${node.id}' must not have 'children'`,
            );
        }
    }


    // mask — collect for post-walk check
    if (typeof node.mask === "string") {
        masks.push({ nodeId: node.id, maskId: node.mask });
    }

    // Recurse
    if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child, ids, masks, prefabNames, context);
    }
}

/** §3.6 / §10 rules 11–14 — decision-map shape. */
function validateDecisionMaps(node: Record<string, unknown>, context: string): void {
    for (const [key, value] of Object.entries(node)) {
        if (NON_DECIDABLE_KEYS.has(key)) {
            // Rule 14 — decision values forbidden on these keys.
            if (isDecisionMap(value)) {
                throw new ValidationError(
                    "rule 14",
                    `field '${key}' on node '${node.id}' in ${context} may not be a decision map`,
                );
            }
            continue;
        }
        if (!isDecisionMap(value)) continue;
        const map = value as Record<string, unknown>;

        // Rule 13 — same primitive type across `_` and all selectors
        const defaultType = typeofPrimitive(map._);
        if (defaultType === null) {
            throw new ValidationError(
                "rule 13",
                `decision-map '_' on field '${key}' of node '${node.id}' must be a primitive (number, string, or boolean)`,
            );
        }

        for (const selector of Object.keys(map)) {
            if (selector === "_") continue;
            validateSelector(selector, key, node.id as string);
            if (typeofPrimitive(map[selector]) !== defaultType) {
                throw new ValidationError(
                    "rule 13",
                    `decision-map on field '${key}' of node '${node.id}' has mixed value types`,
                );
            }
        }
    }
}

/** §3.6 / §10 rule 12 — single selector syntax + canonical sort. */
function validateSelector(selector: string, key: string, nodeId: string): void {
    if (selector.length === 0) {
        throw new ValidationError(
            "rule 12",
            `empty selector on field '${key}' of node '${nodeId}'`,
        );
    }
    if (/\s/.test(selector)) {
        throw new ValidationError(
            "rule 12",
            `selector '${selector}' on field '${key}' of node '${nodeId}' contains whitespace`,
        );
    }
    const tags = selector.split("+");
    if (tags.some((t) => t.length === 0)) {
        throw new ValidationError(
            "rule 12",
            `selector '${selector}' on field '${key}' of node '${nodeId}' has empty tag segments`,
        );
    }
    for (let i = 1; i < tags.length; i++) {
        if (tags[i - 1] >= tags[i]) {
            throw new ValidationError(
                "rule 12",
                `selector '${selector}' on field '${key}' of node '${nodeId}' is not lexicographically sorted`,
            );
        }
    }
}

function typeofPrimitive(v: unknown): "number" | "string" | "boolean" | null {
    if (typeof v === "number") return "number";
    if (typeof v === "string") return "string";
    if (typeof v === "boolean") return "boolean";
    return null;
}

// =============================================================================
// Intrinsic field specs — table-driven (§7)
// =============================================================================

const COMMON_NODE_FIELDS = [
    "id",
    "type",
    "label",
    "x",
    "y",
    "scaleX",
    "scaleY",
    "rotation",
    "alpha",
    "visible",
    "zIndex",
    "mask",
    "extensions",
];

const intrinsicAllowedFields: Record<string, ReadonlySet<string>> = {
    container: new Set([...COMMON_NODE_FIELDS, "pivotX", "pivotY", "children"]),
    sprite: new Set([...COMMON_NODE_FIELDS, "texture", "tint", "width", "height", "anchorX", "anchorY"]),
    nineSliceSprite: new Set([
        ...COMMON_NODE_FIELDS,
        "texture",
        "width",
        "height",
        "leftWidth",
        "topHeight",
        "rightWidth",
        "bottomHeight",
        "anchorX",
        "anchorY",
    ]),
    text: new Set([...COMMON_NODE_FIELDS, "text", "style", "maxWidth", "anchorX", "anchorY"]),
    graphics: new Set([...COMMON_NODE_FIELDS, "shape", "width", "height", "radius", "points", "fill", "stroke", "strokeWidth"]),
    slot: new Set([...COMMON_NODE_FIELDS, "slot", "width", "height"]),
};

type FieldCheck = (v: unknown) => boolean;

const isString: FieldCheck = (x) => typeof x === "string";
const isNonEmptyStr: FieldCheck = (x) => typeof x === "string" && x.length > 0;
const isNumber: FieldCheck = (x) => typeof x === "number";
const isArray: FieldCheck = Array.isArray;

/**
 * A field value passes if it satisfies `leaf`, or it's a decision-map whose
 * every value satisfies `leaf` (§3.6 — decision maps may carry typed leaves).
 */
function isDecidableWith(v: unknown, leaf: FieldCheck): boolean {
    if (leaf(v)) return true;
    if (!isDecisionMap(v)) return false;
    return Object.values(v as Record<string, unknown>).every(leaf);
}

interface FieldSpec {
    name: string;
    check: FieldCheck;
    // Human-readable expectation for the error message (e.g. "string", "number").
    label: string;
}

const intrinsicSpecs: Record<string, FieldSpec[]> = {
    sprite: [{ name: "texture", check: isNonEmptyStr, label: "string" }],
    nineSliceSprite: [{ name: "texture", check: isNonEmptyStr, label: "string" }],
    text: [{ name: "text", check: isString, label: "string" }],
    slot: [{ name: "slot", check: isNonEmptyStr, label: "string" }],
};

const optionalIntrinsicSpecs: Record<string, FieldSpec[]> = {
    nineSliceSprite: [
        { name: "width", check: isNumber, label: "number" },
        { name: "height", check: isNumber, label: "number" },
        { name: "leftWidth", check: isNumber, label: "number" },
        { name: "topHeight", check: isNumber, label: "number" },
        { name: "rightWidth", check: isNumber, label: "number" },
        { name: "bottomHeight", check: isNumber, label: "number" },
        { name: "anchorX", check: isNumber, label: "number" },
        { name: "anchorY", check: isNumber, label: "number" },
    ],
    text: [{ name: "style", check: isString, label: "string" }],
    graphics: [
        { name: "fill", check: isString, label: "string" },
        { name: "stroke", check: isString, label: "string" },
    ],
};

const shapeRequirements: Record<string, FieldSpec[]> = {
    rect: [
        { name: "width", check: isNumber, label: "number" },
        { name: "height", check: isNumber, label: "number" },
    ],
    roundRect: [
        { name: "width", check: isNumber, label: "number" },
        { name: "height", check: isNumber, label: "number" },
    ],
    ellipse: [
        { name: "width", check: isNumber, label: "number" },
        { name: "height", check: isNumber, label: "number" },
    ],
    circle: [{ name: "radius", check: isNumber, label: "number" }],
    polygon: [{ name: "points", check: isArray, label: "array", /* not decidable */ }],
};

const COMMON_GRAPHICS_FIELDS = [
    ...COMMON_NODE_FIELDS,
    "shape",
    "fill",
    "stroke",
    "strokeWidth",
];

const allowedGraphicsFieldsByShape: Record<string, ReadonlySet<string>> = {
    rect: new Set([...COMMON_GRAPHICS_FIELDS, "width", "height"]),
    roundRect: new Set([...COMMON_GRAPHICS_FIELDS, "width", "height", "radius"]),
    circle: new Set([...COMMON_GRAPHICS_FIELDS, "radius"]),
    ellipse: new Set([...COMMON_GRAPHICS_FIELDS, "width", "height"]),
    polygon: new Set([...COMMON_GRAPHICS_FIELDS, "points"]),
};

function validateIntrinsicFields(node: Record<string, unknown>): void {
    const type = node.type as string;
    validateIntrinsicKnownFields(node, type);
    validateOptionalIntrinsicFields(node, type);
    const specs = intrinsicSpecs[type];
    if (specs) {
        for (const spec of specs) {
            if (!isDecidableWith(node[spec.name], spec.check)) {
                throw new ValidationError(
                    "rule 7",
                    `${type} node '${node.id}' must have ${spec.label} '${spec.name}'`,
                );
            }
        }
        return;
    }
    if (type === "graphics") validateGraphicsShape(node);
}

function validateOptionalIntrinsicFields(node: Record<string, unknown>, type: string): void {
    const specs = optionalIntrinsicSpecs[type];
    if (!specs) return;
    for (const spec of specs) {
        if (node[spec.name] === undefined) continue;
        if (!isDecidableWith(node[spec.name], spec.check)) {
            throw new ValidationError(
                "rule 7",
                `${type} node '${node.id}' must have ${spec.label} '${spec.name}'`,
            );
        }
    }
}

function validateIntrinsicKnownFields(node: Record<string, unknown>, type: string): void {
    const allowed = intrinsicAllowedFields[type];
    if (!allowed) return;
    for (const field of Object.keys(node)) {
        if (!allowed.has(field)) {
            throw new ValidationError(
                "rule 7",
                `intrinsic ${type} node '${node.id}' has unknown field '${field}'`,
            );
        }
    }
}

function validateGraphicsShape(node: Record<string, unknown>): void {
    const shape = node.shape;
    if (typeof shape !== "string" && !isDecidableWith(shape, isString)) {
        throw new ValidationError("rule 7", `graphics node '${node.id}' must have 'shape'`);
    }
    if (typeof shape !== "string") return; // decision-map shape: defer to runtime
    const reqs = shapeRequirements[shape];
    if (!reqs) {
        throw new ValidationError(
            "rule 7",
            `graphics node '${node.id}' has unknown graphics shape '${shape}'`,
        );
    }
    validateGraphicsShapeFields(node, shape);
    for (const spec of reqs) {
        // `points` is an array (non-decidable); others must be decidable numbers.
        const ok = spec.check === isArray
            ? isArray(node[spec.name])
            : isDecidableWith(node[spec.name], spec.check);
        if (!ok) {
            throw new ValidationError(
                "rule 7",
                `graphics ${shape} node '${node.id}' requires '${spec.name}' (${spec.label})`,
            );
        }
    }
}

function validateGraphicsShapeFields(node: Record<string, unknown>, shape: string): void {
    const allowed = allowedGraphicsFieldsByShape[shape];
    if (!allowed) return;
    for (const field of Object.keys(node)) {
        if (allowed.has(field)) continue;
        throw new ValidationError(
            "rule 7",
            `field '${field}' is not used by graphics shape '${shape}' on node '${node.id}'`,
        );
    }
}

// =============================================================================
// Prefab cycle detection (§15 rule 21)
// =============================================================================

function detectCycle(prefabs: Record<string, unknown>): void {
    const names = Object.keys(prefabs);
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const n of names) color.set(n, WHITE);

    function visit(name: string, path: string[]): void {
        color.set(name, GRAY);
        for (const dep of collectTypeRefs(prefabs[name])) {
            if (!prefabs[dep]) continue;
            const c = color.get(dep);
            if (c === GRAY) {
                throw new ValidationError(
                    "rule 21",
                    `prefab cycle: ${[...path, name, dep].join(" -> ")}`,
                );
            }
            if (c === WHITE) visit(dep, [...path, name]);
        }
        color.set(name, BLACK);
    }

    for (const name of names) {
        if (color.get(name) === WHITE) visit(name, []);
    }
}

function collectTypeRefs(node: unknown): string[] {
    if (!isObject(node)) return [];
    const out: string[] = [];
    if (typeof node.type === "string" && !INTRINSIC.has(node.type)) {
        out.push(node.type);
    }
    if (Array.isArray(node.children)) {
        for (const c of node.children) out.push(...collectTypeRefs(c));
    }
    return out;
}

/** Extract shape from a validated doc. Always returns "core" or "library" — scene is rejected during validation. */
export function documentShape(doc: PxdDocument): Shape {
    const d = doc as unknown as Record<string, unknown>;
    return "prefabs" in d ? "library" : "core";
}
