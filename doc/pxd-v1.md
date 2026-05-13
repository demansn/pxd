# PXD v1

Status: v1

PXD is a portable layout configuration format for Pixi.js-based applications. It specifies how trees of visual nodes are serialized and consumed, without encoding engine-specific runtime behavior.

The specification is layered into three levels, each building on the previous:

- **Core** — a single tree of nodes. The minimum useful document.
- **Library** — adds reusable named trees (prefabs).
- **Scene** — adds multiple named scenes with viewport-dependent modes.

Part I defines the Core level and is self-sufficient: a reader that only supports Core does not need to read Parts II or III.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY follow RFC 2119.

---

## Reader level vs document shape

The word "level" is used in two senses that MUST NOT be conflated:

- **Reader level** — the capability tier of a runtime implementation. Reader levels form a strict superset: a Library reader does everything a Core reader does; a Scene reader does everything a Library reader does.
- **Document shape** — the top-level structure of a concrete document. Shapes are mutually exclusive: a *core-shape* document has `root`; a *library-shape* document has `root` + `prefabs`; a *scene-shape* document has `scenes` (with optional `prefabs`). A valid library-shape document is **not** a valid scene-shape document.

The connection: a Scene reader accepts any of the three shapes; a Library reader accepts core-shape and library-shape; a Core reader accepts only core-shape. Producers pick shape by need; readers pick level by capability.

---

# Part I — Core Level

## 1. Overview

### Goals
- Simple: a minimum-subset Core reader (container / sprite / text, no masks, no custom types) fits in under 50 lines of TypeScript; a full Core reader covering every intrinsic type plus masks fits in roughly 100 lines. See the reference implementation at `../../../reference/pxd-reader/` for the latter.
- Portable: engine-agnostic across any Pixi.js application.
- Extensible: glTF-style extension mechanism with document-level and per-node payloads.
- Layered: each level is independently useful.
- Strictly documented: RFC 2119 language throughout.

### Non-goals
- Encoding engine-specific widget semantics.
- Defining runtime behaviors, controllers, or data bindings.
- Defining an asset pipeline or asset manifest format.
- Defining producer tooling (Figma mapping, editors, code generators).

---

## 2. Document envelope

Every PXD document has this envelope:

```json
{
  "format": "pxd",
  "version": 1,
  "level": "core",
  "extensionsUsed": [],
  "extensionsRequired": [],
  "extensions": {},
  "root": { }
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `format` | string | yes | MUST be `"pxd"` |
| `version` | integer | yes | MUST be `1` for this specification |
| `level` | string | no | One of `"core"`, `"library"`, `"scene"`. If present, enforced |
| `extensionsUsed` | string[] | no | Extension identifiers referenced anywhere in the document |
| `extensionsRequired` | string[] | no | Subset of `extensionsUsed` that a reader MUST support |
| `extensions` | object | no | Document-scoped extension payloads keyed by identifier |
| `root` | Node | core/library shape | Root of the node tree |

Additional top-level fields (`prefabs`, `scenes`) are introduced in Parts II and III.

### 2.1 Level field semantics

The `level` field is optional.

- **If present**, the reader MUST verify the document shape matches:
  - `"core"` requires `root` without `prefabs` or `scenes`.
  - `"library"` requires `root` and `prefabs` without `scenes`.
  - `"scene"` requires `scenes` without `root` (`prefabs` optional).

  On mismatch, the reader MUST reject the document with an error.

- **If absent**, the reader infers the level from shape:
  - `scenes` present → scene.
  - `prefabs` present without `scenes` → library.
  - Otherwise → core.

### 2.2 Version evolution

Non-breaking additions keep `version` at `1` and announce new capabilities through extensions. Breaking changes bump `version` to `2`. Minor suffixes such as `"1.1"` are not used.

---

## 3. Node model

### 3.1 Base node

Every node in a tree has the following shape:

```json
{
  "id": "n_0012",
  "label": "title",
  "type": "text",
  "x": 0,
  "y": 0,
  "scaleX": 1,
  "scaleY": 1,
  "rotation": 0,
  "alpha": 1,
  "visible": true,
  "zIndex": 0,
  "mask": "n_0042",
  "children": [],
  "extensions": {}
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `id` | string | yes | — | Technical identity, unique within the tree |
| `label` | string | no | — | Semantic name for runtime queries |
| `type` | string | yes | — | Intrinsic type, prefab name (Part II), or runtime-registered type |
| `x` | number | no | 0 | Local X position |
| `y` | number | no | 0 | Local Y position |
| `scaleX` | number | no | 1 | Local X scale |
| `scaleY` | number | no | 1 | Local Y scale |
| `rotation` | number | no | 0 | Local rotation in degrees; positive values rotate clockwise (Y-down, §6) |
| `alpha` | number | no | 1 | Opacity in [0, 1] |
| `visible` | boolean | no | true | Visibility |
| `zIndex` | number | no | 0 | Display order hint |
| `mask` | string | no | — | `id` of another node in the same tree used as mask source |
| `children` | Node[] | no | — | Child nodes, in z-order |
| `extensions` | object | no | — | Per-node extension payloads keyed by identifier |

Runtime/custom node parameters (§5) live directly on the node as top-level fields not reserved by the base model. The legacy `props` payload is rejected in this 0.x library version.

### 3.2 Identity: `id` and `label`

Identity is split into two concepts.

- `id` — technical identity for intra-tree references (masks, extension payloads) and optional runtime state continuity (see §19 in Part III).
- `label` — semantic name for runtime queries.

`id` rules:

1. Every node MUST have an `id`.
2. `id` MUST be unique within a single tree.
3. `id` is a technical key; it is NOT required to be human-readable.
4. Ids in different trees are independent.

`label` rules:

1. `label` is OPTIONAL.
2. `label` is NOT required to be unique within a tree; repeated labels in different branches are valid.
3. Intended for runtime queries — for example path-based lookup such as `Bet.value`, or multi-match semantics over duplicated labels.

### 3.3 Identifier character set

`id`, prefab names, and scene names SHOULD NOT contain whitespace, control characters, or forward slashes. Beyond that, the specification does not constrain the character set; readers MAY tighten this.

### 3.4 Anchor and pivot

The base node does NOT define `anchorX`/`anchorY` or `pivotX`/`pivotY`. Pixi.js exposes these on different classes (anchor on `Sprite`/`Text`, pivot on `Container`). They are declared per intrinsic type in §4.

### 3.5 Composability

Only composable node types may carry `children`. In Core, the only composable intrinsic type is `container`. Non-composable intrinsic types (`sprite`, `text`, `graphics`, `slot`, `spine`) MUST NOT have `children`.

Runtime/custom nodes (§5) MAY carry `children`; the created runtime object must be a container-like object that can receive children. The reader builds/applies those children after the custom node's `create`/`assign` and base fields.

Prefab references (Part II) are different: their structure comes from the prefab body, so the reference node itself MUST NOT carry `children`.

### 3.6 Decision values

Any scalar-typed field of a node — number, string, or boolean — MAY be replaced by a *decision map* that selects the actual value based on a runtime-supplied set of active tags. Decision values let one document describe context-dependent geometry, style, and content (language, platform, theme, anything) without duplicating trees.

```json
{
  "id": "title", "type": "text", "text": "Hello",
  "x": 100,
  "maxWidth": { "_": 320, "de": 400, "de+mobile": 360 }
}
```

**Active tag set.** The reader receives an unordered set of flat string tags from the host application, for example `["de", "mobile"]`. The specification does not define namespaces, axes, or where tags come from; that is the host's concern.

**Decision map shape.**

A decision map is a JSON object satisfying all of:

1. It has a `"_"` key holding the default value (used when no selector matches).
2. Every other key is a *selector*: one or more flat tag names joined by `+`. A selector with no tags is forbidden — use `"_"` for the default.
3. Every selector's tag list MUST be lexicographically sorted (`"de+mobile"`, NOT `"mobile+de"`). Producers MUST sort; readers MUST match against sorted active tags. This makes selector identity canonical.
4. All values (`"_"` and selectors) MUST be of the same JSON type (all numbers, or all strings, or all booleans).
5. Selector strings MUST NOT be empty and MUST NOT contain whitespace.

**Selection algorithm.** Given active tag set `A`:

1. A selector `s` *matches* iff every tag in `s` is in `A`.
2. *Specificity* of a selector is its tag count.
3. The reader picks the matching selector with the highest specificity.
4. **Tie-break**: when several selectors match with equal specificity, the one declared first (JSON insertion order) wins.
5. If no selector matches, the `"_"` value is used.

**Scope.** Decision values are allowed at any field position where the underlying type is a primitive — base fields (`x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `label`), intrinsic-specific scalar fields (`text`, `maxWidth`, `width`, `height`, `anchorX`, `anchorY`, `pivotX`, `pivotY`, `texture`, `tint`, `radius`, `strokeWidth`, `shape`, `style` when string, `fill` when string, `stroke` when string, `slot`, `skeleton`, `skin`, `animation`).

Decision values are NOT permitted on:
- `id`, `type` — identity must be static.
- `mask` — mask target must be statically known for forward-reference resolution.
- `children` — structural variation belongs in `modes` (Part III), not in decision values.
- `extensions` — extension payloads are objects, not scalar decision values.
- Inline style/fill/stroke objects — when the field carries an object form, decision values cannot wrap the object. Producers SHOULD use a style id (string) and let the style resolver vary the underlying object.

**Bindings (§7.2) interaction.** A decision map's leaf string values MAY themselves contain bindings; resolution order is: pick decision leaf → resolve bindings → hand to typed resolver. Bindings inside a selector key (the tag string itself) are NOT supported.

**Modes (Part III) interaction.** Modes (viewport) select an entire tree first; decision values overlay scalar fields within the selected tree. The two mechanisms address different axes and do not compete: use `modes` for structurally different layouts (different parent/child or different concrete types), use decision values for scalar overrides within one layout.

---

## 4. Intrinsic types

This section defines the intrinsic node types available in all levels.

### 4.1 `container`

A grouping node.

```json
{ "id": "root", "type": "container", "children": [] }
```

| Field | Type | Default | Description |
|---|---|---|---|
| `pivotX` | number | 0 | Local pivot X |
| `pivotY` | number | 0 | Local pivot Y |

### 4.2 `sprite`

A raster image node. There is no separate `image` type.

```json
{
  "id": "logo",
  "type": "sprite",
  "texture": "logo",
  "anchorX": 0.5,
  "anchorY": 0.5
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `texture` | string | yes | — | Opaque final texture identifier (§7) |
| `tint` | string/number | no | — | Optional tint |
| `width` | number | no | — | Optional explicit display width |
| `height` | number | no | — | Optional explicit display height |
| `anchorX` | number | no | 0 | Anchor X in [0, 1] |
| `anchorY` | number | no | 0 | Anchor Y in [0, 1] |

`texture` identifies the final Pixi `Texture` to render. For atlas subtextures, encode the subtexture key into the opaque `texture` id (for example `"atlas/logo_idle"`) and resolve it in the host's texture resolver. This lightweight reader does not define a separate `frame` field.

### 4.3 `text`

```json
{
  "id": "title",
  "type": "text",
  "text": "Hello",
  "style": "title",
  "maxWidth": 320
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `text` | string | yes | — | Text content |
| `style` | string/object | no | — | Style identifier (preferred) or inline style object |
| `maxWidth` | number | no | — | Maximum display width constraint |
| `anchorX` | number | no | 0 | Anchor X in [0, 1] |
| `anchorY` | number | no | 0 | Anchor Y in [0, 1] |

`maxWidth` maps to Pixi Text word wrapping (`wordWrap` + `wordWrapWidth`). This lightweight reader does not define text auto-fit/shrink behavior; implement shrink-to-fit by overriding the `text` node type if your runtime needs it.

Inline style objects are not constrained by this specification; Pixi.js text style fields evolve across versions. Producers SHOULD prefer string identifiers resolved by the runtime.

### 4.4 `graphics`

A geometric shape node. May also be used as a mask source.

```json
{
  "id": "panelBg",
  "type": "graphics",
  "shape": "rect",
  "width": 400,
  "height": 120,
  "fill": "#1f1f1f",
  "radius": 16
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `shape` | string | yes | One of `"rect"`, `"roundRect"`, `"circle"`, `"ellipse"`, `"polygon"` |
| `width` | number | conditional | Required for `rect`, `roundRect`, `ellipse` |
| `height` | number | conditional | Required for `rect`, `roundRect`, `ellipse` |
| `radius` | number | conditional | Required for `circle`; optional corner radius for `roundRect` |
| `points` | number[] | conditional | Required for `polygon`. Flat array `[x0, y0, x1, y1, ...]` |
| `fill` | string/object | no | Fill definition |
| `stroke` | string/object | no | Stroke definition |
| `strokeWidth` | number | no | Stroke width |

### 4.5 `slot`

A named mount point where a runtime may place external content (another tree, a widget, a container constructed outside the layout document).

```json
{
  "id": "boardSlot",
  "type": "slot",
  "slot": "Board",
  "width": 1000,
  "height": 600
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `slot` | string | yes | Semantic mount point name |
| `width` | number | no | Slot area width |
| `height` | number | no | Slot area height |

A slot is a passive placeholder — mounting semantics are runtime-defined. Slots replace naming conventions such as `_ph` suffixes.

### 4.6 `spine`

A Spine skeletal animation node.

```json
{
  "id": "zeus",
  "type": "spine",
  "skeleton": "zeus",
  "skin": "default",
  "animation": "idle"
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `skeleton` | string | yes | Opaque skeleton identifier (§7) |
| `skin` | string | no | Initial skin name |
| `animation` | string | no | Default animation name |

A Core reader is not required to ship Spine support; see §11 conformance.

---

## 5. Runtime-registered types

A `type` value that is not an intrinsic name and is not a prefab name (Part II) is resolved against the runtime's type registry. If the runtime recognizes the name, it constructs the corresponding object using custom top-level fields on the node as construction/update parameters.

```json
{
  "id": "spinButton",
  "type": "Button",
  "text": "SPIN",
  "enabled": true
}
```

Rules:

1. Runtime-registered type names MUST NOT collide with intrinsic type names.
2. Runtime-registered type names MUST NOT collide with prefab names (Part II).
3. Custom top-level fields are opaque to this specification — their shape is owned by the runtime.
4. A runtime-registered node MAY carry `children`; traversal is handled by the reader after `create`, `assign`, and base fields.
5. The legacy `props` payload is rejected in this 0.x library version; use top-level custom fields instead.
6. If a reader does not recognize a non-intrinsic `type`, it MUST reject the document (§10 rule 17), unless an extension governs the case explicitly.

---

## 6. Coordinate system, units, colors

1. The coordinate system is 2D with Y pointing downward, consistent with Pixi.js.
2. `rotation` is in degrees. Positive values rotate clockwise (a direct consequence of the Y-down convention). Readers MUST convert to their engine's native unit; Pixi.js uses radians internally, so a Pixi reader multiplies by `π/180` when applying the value.
3. Positions, sizes, radii, and stroke widths are in the producer's unit of measure (typically CSS-like pixels). The specification does not define DPI or scale; values are applied as-is.
4. Colors are hex strings: `"#rrggbb"` or `"#rrggbbaa"`. Readers MAY also accept Pixi-style numeric colors (for example `0xff0000`); producers SHOULD prefer strings for JSON readability.

---

## 7. Resolvers

String values in a document fall into two reader-resolved categories: opaque identifiers (§7.1) and bindings (§7.2). Both are handed off to runtime callbacks; the specification does not constrain what those callbacks do.

### 7.1 Asset references

Fields such as `texture`, `skeleton`, and `style` are opaque string identifiers. The specification does not define:

- how identifiers resolve to concrete files,
- an asset manifest format,
- atlas layout,
- caching or loading semantics.

Resolution is the consuming runtime's responsibility.

### 7.2 String bindings

Any string value in a document MAY contain *bindings* — substrings of the form `{path}` — that the reader MUST resolve before further processing.

```json
{ "id": "betLabel", "type": "text", "text": "Bet: {settings.bet} {locale.coins}" }
{ "id": "flag",     "type": "sprite", "texture": "{locale.flagTexture}" }
```

Rules:

1. A binding is a substring `{path}`, where `path` is a non-empty sequence of any characters except `{`, `}`, and `\`. The path is opaque to the specification; convention is dotted (`locale.title`, `settings.bet`).
2. Bindings apply to string values only. Numeric, boolean, and array fields are not interpreted.
3. A literal `{` MUST be escaped as `\{`; a literal `\` immediately before `{` MUST be escaped as `\\`. No other escape sequences are defined.
4. When a binding resolver is registered, readers MUST call it once per binding occurrence and substitute its return value into the field value as a string. When no resolver is registered, readers MAY either pass occurrences through unchanged (the tolerant default, §11) or reject the document; in either case, escape processing (rule 3) still applies.
5. A field MAY contain multiple bindings (`"{a}-{b}"`); each is resolved independently. Substituted values are NOT re-scanned for further bindings.
6. Bindings are resolved BEFORE typed resolvers (§7.1). For example, `texture: "{locale.flagTexture}"` first resolves to a string such as `"flag_en"`, which then becomes the input to the texture resolver.
7. Producers SHOULD scope path namespaces semantically (`locale.*` for translation tables, `settings.*` for user-controlled values, `state.*` for runtime state). The specification does not enforce any namespace.

Out of scope:

- Reactivity and change subscriptions. A reader MAY resolve bindings once at instantiation and treat the tree as a snapshot, or MAY rebuild affected nodes when sources change. Both are spec-compliant.
- Locale switching strategy, fallback chains, pluralization, and formatting.
- Numeric or structural interpolation (positions, sizes, conditional children). A future level MAY add a structured binding form.

Localization is one application of this mechanism: text content via `text: "{locale.title}"`, font selection via `style: "{locale.h1}"`, locale-dependent imagery via `texture: "{locale.logo}"`. Geometric differences across locales (RTL flipping, line breaking, per-locale repositioning) are NOT addressed here.

---

## 8. Masking

A node attaches a mask through the `mask` field, referencing the `id` of another node in the same tree.

```json
{
  "id": "panel",
  "type": "container",
  "mask": "panelMask",
  "children": [
    {
      "id": "panelMask",
      "type": "graphics",
      "shape": "rect",
      "width": 300,
      "height": 120,
      "fill": "#ffffff"
    },
    { "id": "bg", "type": "sprite", "texture": "panel_bg" }
  ]
}
```

Rules:

- The mask source is a regular node, typically `sprite` or `graphics`.
- The mask source MUST exist in the same tree as the target.
- A mask source MAY be referenced by multiple targets in the same tree.
- A target node MAY have at most one mask.
- If the same content must act as both mask and visible content, the producer MUST duplicate it; a mask source is treated as mask-only at the target.

---

## 9. Extensions

Extensibility follows the glTF 2.0 model.

### 9.1 Document-level

- `extensionsUsed` lists extension identifiers referenced anywhere in the document.
- `extensionsRequired` lists extensions a reader MUST support; it is a subset of `extensionsUsed`.
- `extensions` (document root) carries extension-owned data scoped to the whole document (for example, a physics world, a theme token set, an audio manifest reference).

### 9.2 Per-node

Each node MAY carry an `extensions` object keyed by extension identifier:

```json
{
  "id": "ball",
  "type": "sprite",
  "texture": "ball",
  "extensions": {
    "VENDOR_physics": { "shape": "circle", "radius": 16 }
  }
}
```

### 9.3 Rules (both layers)

- Extension identifiers SHOULD be namespaced (`VENDOR_feature` or `org.vendor.feature`).
- An extension listed in `extensionsRequired` MUST be supported by a reader; otherwise the reader MUST reject the document.
- An extension listed only in `extensionsUsed` SHOULD be ignored by readers that do not recognize it; the document MUST remain loadable.
- Extensions MUST NOT redefine intrinsic fields of intrinsic types. Additional data attached to intrinsic nodes MUST live inside `extensions`.
- Producer-private data ("extras") is not a separate mechanism. Producers MUST place any private payload under a namespaced key inside `extensions` (for example `extensions["VENDOR_producer-meta"]`); readers that do not recognize the key ignore it under the rules above.

---

## 10. Validation rules (Core)

A valid core-shape document satisfies all of the following:

1. `format === "pxd"`.
2. `version === 1`.
3. `root` is present and is a valid node.
4. Every node has a non-empty string `id` and a non-empty string `type`.
5. Within the tree, all `id` values are unique.
6. Every `mask` value is the `id` of a node in the same tree.
7. Intrinsic node types satisfy their type-specific required-field constraints (§4).
8. Non-composable intrinsic types (`sprite`, `text`, `graphics`, `slot`, `spine`) MUST NOT have `children`.
9. Runtime/custom nodes MAY have `children`; prefab references are checked separately in §15.
10. Nodes MUST NOT have legacy `props`; put custom fields directly on runtime/custom nodes (§5 rule 5).
11. Every decision-map value (§3.6) has a `"_"` key.
12. Every selector key in a decision-map has tags joined by `+`, lexicographically sorted, with no whitespace, no empty segments. The selector `""` is forbidden.
13. Every value inside one decision-map (default plus all selector branches) has the same JSON primitive type (number, string, or boolean).
14. Decision-map values do NOT appear on `id`, `type`, `mask`, `children`, `extensions`, or `points`. Custom scalar top-level fields MAY be decision maps.
15. `extensionsRequired` ⊆ `extensionsUsed`, when both are present.
16. Every identifier in `extensionsRequired` is recognized by the reader.
17. Every non-intrinsic `type` value is a runtime-registered type known to the reader. (In core-shape documents there are no prefabs.)
18. If `level` is present, the document shape matches it (§2.1).

---

## 11. Conformance (Core reader)

A Core reader MUST:

- Parse the document envelope and reject documents that fail §10 validation.
- Instantiate at minimum the intrinsic types `container`, `sprite`, and `text`.
- Apply every base node field (transform, visibility, alpha, `zIndex`, `mask`) to every instantiated node.
- Convert `rotation` from degrees (§6) to its engine's native angular unit before applying.
- Accept an "active tag set" from the host application (possibly empty) and resolve every decision-map value (§3.6) against it BEFORE other field processing.
- Expose a binding resolver hook for §7.2 and apply it to every document string value (including identifiers consumed by typed resolvers) AFTER decision resolution.
- Resolve runtime-registered types through its type registry.
- Reject loading when any identifier in `extensionsRequired` is not recognized.
- Reject documents using an intrinsic type it does not support (with an explicit error naming the type).
- Ignore unrecognized `extensions` entries without error.

A Core reader MAY:

- Support any subset of the optional intrinsic types `graphics`, `slot`, `spine`.
- Treat `zIndex` as a sorting hint according to its own rules.
- Expose semantic lookup by `label`.
- Reject library-shape or scene-shape documents (Core does not support them).
- Pass binding occurrences (`{path}`) through unchanged when no binding resolver is registered by the host application. This is a tolerant default; readers MAY alternatively reject such documents.

A Core reader MUST NOT:

- Require engine-specific class names in the document.
- Depend on extension content for correct loading of intrinsic-typed trees (extensions enrich, they do not gate).

---

# Part II — Library Level

The Library level extends Core with reusable named trees (prefabs). A Library reader accepts every document a Core reader accepts, plus library-shape documents.

## 12. `prefabs` map

A library-shape document adds a top-level `prefabs` map:

```json
{
  "format": "pxd",
  "version": 1,
  "prefabs": {
    "Button.primary": {
      "id": "root",
      "type": "container",
      "children": [
        { "id": "bg", "type": "sprite", "texture": "btn_bg" },
        { "id": "label", "type": "text", "text": "" }
      ]
    }
  },
  "root": {
    "id": "root",
    "type": "container",
    "children": [
      { "id": "playBtn", "type": "Button.primary", "x": 100, "y": 50 }
    ]
  }
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `prefabs` | object | no | Prefab definitions keyed by name |

Each prefab is a complete node tree — the same shape as a `root`. A prefab definition has no wrapper object.

### 12.1 Prefab name rules

- Names are case-sensitive non-empty strings.
- Dotted grouping is conventional (`Family.variant`, for example `Button.primary`, `Slider.portrait`).
- Prefab names MUST NOT collide with intrinsic type names or runtime-registered type names for a given reader.

---

## 13. Prefab reference resolution

When a reader encounters a node `type` that is not an intrinsic name, it resolves in this order:

1. `prefabs[type]` — if matched, instantiate the prefab tree.
2. Runtime-registered type — if matched, construct via the runtime using custom top-level fields.
3. Otherwise — reject the document (§15 rule 22).

### 13.1 Reference node rules

A node whose `type` resolves to a prefab is a *prefab reference*. The following apply:

- The reference MUST NOT carry `children`. Children come from the prefab body; a different structure requires a different prefab. This restriction does not apply to runtime/custom node types.
- The legacy `props` payload is rejected globally; prefab references are not parameterized in this version.
- The reference MAY carry base node fields: `id`, `label`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `mask`, `extensions`. These apply to the instantiated prefab root.

### 13.2 Identity of instantiated nodes

When a prefab is instantiated, the nodes inside the prefab body retain their prefab-local ids for the purposes of intra-prefab references (such as masks inside the prefab). Ids across instances of the same prefab are independent — a reader instantiates a fresh id scope per instance.

---

## 14. Transitive composition and cycles

A prefab body MAY contain nodes whose `type` resolves to another prefab. Composition is transitive.

Cycles are forbidden: the directed graph of prefab-to-prefab references MUST be acyclic.

---

## 15. Validation rules (Library additions)

A valid library-shape document satisfies all Core validation rules (§10) plus:

19. `prefabs[name]` is a valid node tree under the same rules as `root`.
20. Within each prefab tree, all `id` values are unique. (Trees are independent: the same `id` MAY appear in `root` and in every prefab tree; that is not a collision.)
21. The directed prefab-to-prefab reference graph is acyclic.
22. Every non-intrinsic `type` value resolves either to a prefab name in `prefabs` or to a runtime-registered type known to the reader.
23. No prefab reference carries `children`; `props` is rejected globally (§10 rule 10).
24. If `level` is present and equals `"library"`, the document has both `root` and `prefabs` and does not contain `scenes`.

---

## 16. Conformance (Library reader)

A Library reader MUST:

- Support everything a Core reader supports (§11).
- Accept core-shape documents as a Core reader would.
- Resolve prefab references transitively.
- Reject documents with cyclic prefab references.
- Apply reference-node base fields (§13.1) to the instantiated prefab root.

A Library reader MAY:

- Share instantiated prefab subtrees across references as a runtime optimization, provided the resulting instances are observationally equivalent to independent copies.

---

# Part III — Scene Level

The Scene level replaces the single `root` with a collection of named scenes, each with one or more mode trees for different viewports. A Scene reader accepts every document a Library reader accepts, plus scene-shape documents.

## 17. `scenes` map

A scene-shape document replaces `root` with `scenes`:

```json
{
  "format": "pxd",
  "version": 1,
  "prefabs": { },
  "scenes": {
    "SettingsScene": {
      "modes": { },
      "extensions": { }
    }
  }
}
```

Top-level rules:

| Field | Type | Required | Description |
|---|---|---:|---|
| `scenes` | object | yes (scene shape) | Scene definitions keyed by scene name |
| `root` | — | MUST NOT appear | — |
| `prefabs` | object | no | Prefab definitions, as in Library |

Per-scene fields:

| Field | Type | Required | Description |
|---|---|---:|---|
| `modes` | object | yes | Node trees keyed by mode name. MUST contain at least one key |
| `extensions` | object | no | Scene-scoped extension payloads keyed by identifier |

---

## 18. Modes

A mode is a complete node tree — the same shape as a Core `root`. Different modes describe alternative layouts of the same scene for different viewports (orientations, device classes).

```json
"modes": {
  "portrait":  { "id": "root", "type": "container", "children": [] },
  "landscape": { "id": "root", "type": "container", "children": [] }
}
```

Mode names are free-form non-empty strings. The recommended interoperable set is: `default`, `portrait`, `landscape`, `desktop`. A scene with only one layout SHOULD use a single mode named `default`.

Mode trees in the same scene are structurally independent: they may differ in parent hierarchy, child order, and concrete types of corresponding logical objects.

---

## 19. Cross-mode logical identity (MAY contract)

If the same logical object appears in multiple mode trees of one scene with the same `id`, a reader MAY treat those occurrences as the same logical object for state continuity — for example, preserving slider position when the viewport rotates.

- Producers that want this behavior MUST choose stable `id` values for the logical object across modes.
- The specification does not require producers to reuse ids; it only defines what a reader is permitted to do when they do.
- A matching `id` in different modes implies nothing about parent, position, or concrete `type` — those may vary freely.

---

## 20. Validation rules (Scene additions)

A valid scene-shape document satisfies all Core (§10) and Library (§15) node-level rules, plus:

25. `scenes` is present and has at least one key.
26. Each scene has a `modes` object with at least one key.
27. Each mode tree is a valid node tree under Core rules.
28. The document does NOT contain `root`.
29. If `level` is present and equals `"scene"`, the document has `scenes` and does not contain `root`.

---

## 21. Conformance (Scene reader)

A Scene reader MUST:

- Support everything a Library reader supports (§16), and therefore Core (§11).
- Accept core-shape and library-shape documents.
- Select one active mode per scene at load time. The selection policy is runtime-defined.
- Instantiate only the selected mode tree, not all modes.

A Scene reader MAY:

- Preserve node identity across mode switches using stable `id` (§19).
- Expose semantic lookup by `label` scoped per-scene.
- Re-instantiate the mode tree on viewport change or patch state in place — either is spec-compliant.

---

# Part IV — Shared

## 22. Full example

A scene-shape document exercising prefabs, multiple modes, cross-mode identity, an extension, and a runtime-registered type.

```json
{
  "format": "pxd",
  "version": 1,
  "level": "scene",
  "extensionsUsed": ["VENDOR_physics"],
  "prefabs": {
    "Slider.portrait": {
      "id": "root",
      "type": "container",
      "children": [
        { "id": "track", "type": "sprite", "texture": "slider_v" },
        { "id": "thumb", "type": "sprite", "texture": "slider_thumb" }
      ]
    },
    "Slider.landscape": {
      "id": "root",
      "type": "container",
      "children": [
        { "id": "track", "type": "sprite", "texture": "slider_h" },
        { "id": "thumb", "type": "sprite", "texture": "slider_thumb" }
      ]
    }
  },
  "scenes": {
    "Settings": {
      "modes": {
        "portrait": {
          "id": "root",
          "type": "container",
          "children": [
            { "id": "title",  "type": "text",            "text": "Settings", "style": "h1", "x": 360, "y": 60 },
            { "id": "volume", "type": "Slider.portrait", "x": 80,  "y": 900 }
          ]
        },
        "landscape": {
          "id": "root",
          "type": "container",
          "children": [
            {
              "id": "rightPanel",
              "type": "container",
              "children": [
                { "id": "title",  "type": "text",             "text": "Settings", "style": "h1", "x": 300, "y": 60 },
                { "id": "volume", "type": "Slider.landscape", "x": 900, "y": 100 },
                { "id": "spin",   "type": "Button",           "text": "SPIN" }
              ]
            }
          ]
        }
      }
    }
  }
}
```

Notes:

- `volume` has a stable `id` across `portrait` and `landscape` (§19). A reader MAY use this to preserve the slider value on rotation.
- `Slider.portrait` and `Slider.landscape` are distinct prefabs, not variants of one prefab. They have different textures and different intended axes.
- `Button` is a runtime-registered type. Its custom `text` field is interpreted by the host-provided node type.
- `VENDOR_physics` is declared in `extensionsUsed` but not in `extensionsRequired`, so a reader that does not recognize it MUST load the document and simply ignore any `VENDOR_physics` payloads that appear.

---

## 23. Precedent

The shape of this specification follows established practice.

- **SVG profiles** (Tiny / Basic / Full) — the W3C precedent for explicit layered conformance tiers in a single format. PXD's Core / Library / Scene levels are directly inspired by this pattern.
- **glTF 2.0** — `extensionsUsed`, `extensionsRequired`, and per-node `extensions` are taken directly from glTF. A single producer-private `extras` bag follows glTF convention.
- **Unity (post-2018 nested prefabs)** — variants-as-named-prefabs mirrors the pattern Unity adopted after moving away from per-instance stored overrides.
- **Godot `.tscn`** — the split between built-in intrinsic types and scripted opaque types informs the distinction between intrinsic types and runtime-registered types in Core.

---

## 24. Future directions

Deliberately excluded from v1 to keep the specification minimal. Listed here to mark expected growth points:

- **Parametrized prefabs.** v1 keeps prefab references simple and unparameterized. A future version may define a contract for passing parameters from the reference to the prefab body.
- **Mode diff operations.** v1 stores a full tree per mode. A future version may add an optional patch mechanism (add / remove / replace / move) for scenes with many modes and small diffs.
- **Promoted widget types.** Common widgets (button, check box, scroll container) are runtime-registered types in v1. A future version may promote some of them to intrinsic types.
- **Behavior and binding layer.** Runtime behaviors, controllers, data bindings, and flow logic are out of scope in v1 and expected to live outside this schema or inside a dedicated extension.
- **Shared subtrees between prefabs.** v1 requires duplication where prefabs share content. A future version may add a reference or include mechanism.

Experimental additions SHOULD use the extension mechanism (§9).

---

End of specification.
