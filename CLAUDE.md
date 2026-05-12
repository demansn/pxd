# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — `tsc` compile to `dist/`.
- `npm test` — compiles, then runs `dist/test/fixtures.test.js` (must pass first; it's a plain script, not a `node:test` runner), then runs the rest of the suites via `node --test`.
- Single test file: `npx tsc && node --test dist/test/apply.test.js` (substitute the suite). The `fixtures` suite is `node dist/test/fixtures.test.js` (no `--test` flag).

There is no linter and no separate watch task. Tests are written in `node:test` (`describe`/`it`) and rely on compiled `.js` from `dist/` — never run TS sources directly.

## Architecture

This is a Pixi.js-bound reader for PXD v1 documents (spec: `doc/pxd-v1.md`). It supports **Core + Library** profiles only; Scene-shape documents are rejected at validation. The reference implementation in `reference/pxd-reader/` is the spec-faithful canonical reader — this library vendors `types`, validation rules, and intrinsic builders from it rather than depending on it, so `src/` stays self-contained.

### The two entry points

- `build(doc, opts)` (`src/build.ts`) — creates a fresh Pixi `Container` tree from a document.
- `apply(doc, root, opts)` (`src/apply.ts`) — patches an **already-built** tree in place. This is the value-add over the reference reader: hot-reload / theme-swap / locale-swap without rebuild.

Both flow through one `NodeType { create, assign }` registry (`src/context.ts`, `src/nodeTypes.ts`). `build` calls `create` then `assign`; `apply` calls only `assign`. Then **base fields** (`x`, `y`, `alpha`, `scale`, …) run last in `applyBaseFields` — so explicit transform fields override type-specific side effects (e.g. `sprite.width = N` mutates `scale.x`, but a later `scaleX` field still wins). Preserve this dispatch order when extending.

### Load-bearing invariants

- **`Container.label = node.label ?? node.id`.** Path queries (`find`, `apply`'s child lookup) compare against `label`. If you change how labels are assigned during build, find/apply break.
- **`apply` matches by label-path with one-hop child lookup** — not deep search. Missing child → `onMissing` callback, subtree skipped. Structural mismatch never throws.
- **Type-mismatch in apply is silent.** Doc says `text`, live target is `Sprite`: type-specific fields skip, base fields still flow.
- **Mask validation is relaxed for apply.** §10 rule 6 (mask target must exist in the doc) is enforced by `validate.ts` for build but `apply` rebinds masks by `id` against the existing tree via a lazy idMap.
- **Slots use `Symbol.for("pxd.slot")`** (`src/tags.ts`) — `getSlot` finds them regardless of label, cross-module-safe via the global symbol registry. Don't tag with anything else.

### Module map

- `types.ts` — vendored PXD schema (Core + Library node shapes, `Document`, `Node`).
- `validate.ts` — §10 + §15 validation, table-driven per node-kind; rejects Scene shape.
- `decisions.ts` — §3.6 decision-value resolver: lexicographic selector validation, active-tag set, declaration-order tie-break.
- `bindings.ts` — §7.2 `{path}` substitution with `\{` / `\\` escapes; **no rescanning** of substituted output.
- `context.ts` — `NodeType`, `BuildContext`, `ApplyContext`, `Resolvers`, `mergeRegistry`. Resolvers (`texture`, `style`, `binding`) come from the host.
- `nodeTypes.ts` — `defaultNodeTypes` map + `drawShape` + `setAnchorFromNode`.
- `build.ts` — recursive build + Library prefab composition (transitive, with §13.2 per-instance scope isolation).
- `apply.ts` — label-path walking, decision/binding re-resolution, mask rebind by id.
- `find.ts` — `find`, `findAll`, `requirePath` (the latter throws).
- `slots.ts` — `getSlot`, `mountSlot`.

### What's intentionally out of scope

No Scene profile, no per-node §9.2 extension handlers (payloads silently ignored), no document-level extensions / asset loading, no reactivity (bindings resolve once per call — re-call `apply` on change), no tree → PXD serialization.

## Working with the spec

When changing validation or builder behavior, cite spec sections in commits/comments (`§3.6`, `§7.2`, `§13.2`, etc.) — fixtures in `doc/fixtures/` and `test/fixtures.test.ts` are organized by the rules they exercise (`valid/core-*`, `valid/library-*`, `invalid/*`, `valid/scene-*` for rejected). Add fixtures alongside changes; `fixtures.test.ts` discovers them automatically.
