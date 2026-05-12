# Decisions and bindings

Two ways to make a doc respond to host state without rewriting it:

| | What it is | Where it goes |
|---|---|---|
| **Decision values (§3.6)** | Pick a primitive based on the active tag set | Any scalar field — `x`, `width`, `texture`, `tint`, ... |
| **String bindings (§7.2)** | Substitute `{path}` placeholders | Inside any string value |

Resolution happens on every `build` and every `apply` call.

## Decision values

A decision value is an object with `_` (default) plus optional selector keys. The picked value is the **most specific** selector whose tags are all active; ties break by declaration order.

```json
{
    "id": "title",
    "type": "text",
    "text": "Welcome",
    "x":        { "_": 100,  "mobile": 50 },
    "maxWidth": { "_": 320,  "de": 400, "de+mobile": 360 }
}
```

```ts
build(doc, { resolve, activeTags: ["de", "mobile"] });
// title.x = 50          → "mobile" matches
// title.style.wordWrapWidth = 360  → "de+mobile" beats both "de" and "_"
```

### Selector rules

- Single tag (`"mobile"`) or multi-tag joined with `+` (`"de+mobile"`).
- Tags in a multi-tag selector MUST be sorted lexicographically (`"de+mobile"`, never `"mobile+de"`). Validator rejects unsorted.
- Empty selector or whitespace not allowed.
- `_` is the default — required on every decision map.

### Fields that can be decision values

Most scalar fields: `x`, `y`, `scaleX`, `scaleY`, `rotation`, `alpha`, `visible`, `zIndex`, `width`, `height`, `radius`, `anchorX`, `anchorY`, `tint`, `texture`, `text`, `style`, `fill`, `stroke`, `maxWidth`, `pivotX`, `pivotY`, `slot`, `skeleton`, `shape`.

Structural fields are **not** decidable (`id`, `type`, `mask`, `children`, `extensions`, `points`). Custom scalar fields are decidable because they live directly on the node. The validator rejects decision maps in structural slots.

### Re-decide on apply

```ts
const root = build(doc, { resolve, activeTags: ["desktop", "en"] });

// User toggles dark mode + switches to mobile.
apply(doc, root, { activeTags: ["mobile", "dark", "en"] });
```

All decision fields re-resolve against the new tag set. Same Containers, new values.

## String bindings

Any string value can contain `{path}` placeholders resolved through `resolve.binding`:

```json
{ "id": "balance", "type": "text", "text": "Balance: {wallet.balance}" }
```

```ts
build(doc, {
    resolve: {
        texture: Assets.get,
        binding: (path) => {
            const parts = path.split(".");
            return String(state[parts[0]][parts[1]]);  // your lookup
        },
    },
});
// balance.text → "Balance: 100"
```

Escapes:
- `\{` → literal `{`
- `\\` → literal `\`

Substituted values are **not** re-scanned for further bindings (no recursion).

If `binding` is omitted, `{path}` substrings are passed through literally (graceful default, per §11).

## Combining decisions and bindings

```json
{
    "id": "promo",
    "type": "text",
    "text": { "_": "Welcome, {user.name}!", "ru": "Добро пожаловать, {user.name}!" }
}
```

Decisions resolve first, then bindings expand the picked string.

## Use case: slot game responsive HUD

```json
{
    "id": "hud",
    "type": "container",
    "x": { "_": 0, "mobile": 0 },
    "y": { "_": 0, "mobile": 0 },
    "scaleX": { "_": 1, "mobile": 0.7 },
    "scaleY": { "_": 1, "mobile": 0.7 },
    "children": [
        {
            "id": "balance",
            "type": "text",
            "text": "{currency.symbol}{wallet.balance}",
            "x":  { "_": 20, "mobile": 10 },
            "style": { "_": "hud-balance-large", "mobile": "hud-balance-small" }
        }
    ]
}
```

```ts
const root = build(doc, {
    resolve: {
        texture: Assets.get,
        style: (id) => textStyles[id],
        binding: (path) => walletAndCurrencyLookup(path),
    },
    activeTags: isPortrait ? ["mobile"] : ["desktop"],
});

// On orientation change:
window.addEventListener("orientationchange", () => {
    apply(doc, root, {
        activeTags: isPortrait ? ["mobile"] : ["desktop"],
        resolve: { /* keep the same */ },
    });
});
```
