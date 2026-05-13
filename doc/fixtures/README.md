# PXD v1 — Conformance Fixtures

Test inputs for any PXD v1 reader implementation. Each fixture isolates one rule so that a failure can be diagnosed unambiguously.

Normative specification: `../pxd-v1.md`.

## Layout

```
doc/fixtures/
├── valid/       # MUST load without error
└── invalid/     # MUST be rejected
```

## Valid fixtures

| File | Tests | Spec section |
|---|---|---|
| `valid/core-minimal.json` | Smallest loadable Core document | §2, §3, §4.1, §4.3 |
| `valid/core-full.json` | Every original Core intrinsic type (`container`, `sprite`, `text`, `graphics`, `slot`); `level: "core"` | §4 |
| `valid/core-nine-slice-sprite.json` | `nineSliceSprite` intrinsic with texture, borders, size, and anchor | §4.6 |
| `valid/core-expanded-pixi-intrinsics.json` | `tilingSprite`, `animatedSprite`, and `bitmapText` intrinsics | §4.7–§4.9 |
| `valid/core-mask-shared.json` | One mask referenced by multiple targets | §8 |
| `valid/core-extensions.json` | Extension declared in `extensionsUsed` but not `extensionsRequired`; document MUST load even if the reader does not recognize the extension | §9 |
| `valid/core-bindings.json` | String bindings (`{locale.title}`, multi-binding, escape `\{`) in `text`, `style`, `texture` fields | §7.2 |
| `valid/core-decisions.json` | Decision-map values (`{_:100, mobile:50}`, multi-tag `de+mobile`) on `x`, `maxWidth`, `texture`, `width`, `fill` | §3.6 |
| `valid/core-custom-top-level.json` | Runtime/custom node with top-level custom fields and a decision map | §5, §3.6 |
| `valid/core-custom-children.json` | Runtime/custom node carrying document-defined children | §5, §3.5 |
| `valid/core-custom-spine.json` | Spine-shaped node treated as a custom/runtime type, not a built-in intrinsic | §5 |
| `valid/library-simple.json` | `prefabs` map, prefab instantiated twice, `level: "library"` | §12, §13 |
| `valid/library-nested.json` | Prefab body references another prefab (transitive composition) | §13, §14 |
| `valid/scene-modes.json` | Two scene modes, cross-mode identity by stable `id`, `level: "scene"` | §17, §18, §19 |
| `valid/scene-runtime-type.json` | Scene-shape fixture with a runtime-registered type; rejected by this Core+Library library | §5 |

## Invalid fixtures

| File | Violation | Spec rule |
|---|---|---|
| `invalid/wrong-format.json` | `format` is not `"pxd"` | §10 rule 1 |
| `invalid/duplicate-ids.json` | Two sibling nodes share an `id` | §10 rule 5 |
| `invalid/mask-out-of-tree.json` | `mask` references an `id` that is not in the tree | §10 rule 6 |
| `invalid/non-composable-has-children.json` | `sprite` carries `children` | §10 rule 8 |
| `invalid/nine-slice-missing-texture.json` | `nineSliceSprite` missing required `texture` | §10 rule 7 |
| `invalid/nine-slice-bad-border.json` | `nineSliceSprite` border field has wrong scalar type | §10 rule 7 |
| `invalid/tiling-sprite-missing-texture.json` | `tilingSprite` missing required `texture` | §10 rule 7 |
| `invalid/animated-sprite-empty-textures.json` | `animatedSprite` has empty `textures` array | §10 rule 7 |
| `invalid/animated-sprite-bad-texture-entry.json` | `animatedSprite.textures` contains a non-string entry | §10 rule 7 |
| `invalid/bitmap-text-missing-text.json` | `bitmapText` missing required `text` | §10 rule 7 |
| `invalid/bitmap-text-bad-style.json` | `bitmapText.style` is not a style id string | §10 rule 7 |
| `invalid/sprite-frame-removed.json` | Sprite uses removed `frame`; encode final atlas subtexture in `texture` instead | §4.2 |
| `invalid/text-fit-removed.json` | Text uses removed `fit`; shrink policies belong in custom node types | §4.3 |
| `invalid/text-inline-style-object.json` | Text uses removed inline Pixi style object; use a style id resolver or custom node type | §4.3 |
| `invalid/graphics-inline-fill-object.json` | Graphics uses removed inline Pixi fill object; use string color or custom node type | §4.4 |
| `invalid/graphics-inline-stroke-object.json` | Graphics uses removed inline Pixi stroke object; use string color + `strokeWidth` or custom node type | §4.4 |
| `invalid/graphics-unknown-shape.json` | Graphics node uses an unsupported `shape` literal | §10 rule 7 |
| `invalid/graphics-noop-radius-on-rect.json` | Graphics rect declares no-op `radius`; use `roundRect` for rounded corners | §10 rule 7 |
| `invalid/intrinsic-has-props.json` | An intrinsic type carries legacy `props` | §10 rule 10 |
| `invalid/custom-props.json` | Legacy runtime/custom node `props` payload is rejected; use top-level fields | §5 migration |
| `invalid/decision-unsorted-selector.json` | Decision-map selector `mobile+de` is not lexicographically sorted | §10 rule 12 |
| `invalid/decision-mixed-types.json` | Decision-map mixes number and string values | §10 rule 13 |
| `invalid/decision-on-mask.json` | Decision map on the `mask` field (static-only) | §10 rule 14 |
| `invalid/required-not-in-used.json` | `extensionsRequired` contains an id absent from `extensionsUsed` | §10 rule 15 |
| `invalid/extension-required-unsupported.json` | `extensionsRequired` contains an id not supported by the reader | §10 rule 16 |
| `invalid/prefab-cycle.json` | Prefab `A` references `B` which references `A` | §15 rule 21 |
| `invalid/prefab-ref-with-props.json` | A prefab reference carries legacy `props` (rejected globally) | §10 rule 10 |
| `invalid/prefab-ref-with-children.json` | A prefab reference carries `children` | §15 rule 23 |
| `invalid/mixed-root-and-scenes.json` | Document has both `root` and `scenes` | §20 rule 28 |
| `invalid/empty-modes.json` | Scene has an empty `modes` object | §20 rule 26 |
| `invalid/level-mismatch.json` | `level: "core"` but document contains `prefabs` | §2.1, §10 rule 18 |

## Using the fixtures

A reader implementation SHOULD run every valid fixture through its load path and expect success, and run every invalid fixture through its load path and expect rejection with an error that cites the violated rule.

The reference implementation at `../../../../reference/pxd-reader/` demonstrates this pattern.

## Adding new fixtures

- Keep each fixture minimal; exercise exactly one rule.
- Prefer human-readable ids, textures, and labels.
- Update this README when adding or removing fixtures.
