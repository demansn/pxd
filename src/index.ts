/**
 * `libs/pxd` — minimal PXD v1 (Core+Library) library for Pixi.js.
 *
 * Public API:
 *   - `build(doc, options)`              — validate + construct fresh Pixi tree
 *   - `apply(doc, root, options?)`       — apply doc as stylesheet to existing tree
 *   - `find(root, "a.b.c")`              — dot-path label lookup
 *   - `findAll(root, "a.b.c")`           — all matches at final segment
 *   - `requirePath(root, "a.b.c")`       — find or throw
 *   - `getSlot(root, slotName)`          — find slot Container by `slot` field
 *   - `mountSlot(root, slotName, child)` — find slot and addChild
 *
 * Power-user / extension surface:
 *   - `defaultNodeTypes`                  — default type registry (one Map for build+apply)
 *   - `NodeType`                          — strategy interface: { create, patch }
 *   - `validate` / `ValidationError`      — explicit validation
 *   - `resolveDecisionValue` / `resolveBindings` — §3.6 / §7.2 primitives
 *
 * Spec: `doc/pxd-v1.md`.
 */

export { build, applyBaseFields } from "./build.js";
export type { BuildOptions } from "./build.js";

export { apply } from "./apply.js";
export type { ApplyOptions } from "./apply.js";

export { find, findAll, requirePath } from "./find.js";

export { getSlot, mountSlot } from "./slots.js";

export { defaultNodeTypes, drawShape, setAnchorFromNode } from "./nodeTypes.js";

export { mergeRegistry } from "./context.js";
export type { BuildContext, AssignContext, NodeType, Resolvers } from "./context.js";

export { validate, ValidationError, documentShape, SUPPORTED_EXTENSIONS } from "./validate.js";
export type { Shape } from "./validate.js";

export { resolveDecisionValue, resolveNodeFields, NON_DECIDABLE_KEYS } from "./decisions.js";
export { resolveBindings, makeStringReader } from "./bindings.js";

export { PXD_ID, PXD_SLOT } from "./tags.js";

export type * from "./types.js";
