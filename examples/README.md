# pxd examples

Each example is a real Pixi scene rendered live inside the unified [documentation page](../docs/index.html#examples).

Every folder contains:

- `demo.ts` — Node-safe `run...Demo()` used by the test suite (`test/examples.test.ts`).
- `preview.ts` — browser entry exporting `mountDemo(target)`. Imported by both the docs page and any standalone HTML wrapper.

Run all checks:

```bash
npm test
# or just the examples after compilation
npm run examples:check
```

| Folder | Live demo |
|---|---|
| `browser-minimal` | [#example-browser-minimal](../docs/index.html#example-browser-minimal) |
| `custom-node-type` | [#example-custom-node-type](../docs/index.html#example-custom-node-type) |
| `custom-composable-node` | [#example-custom-composable-node](../docs/index.html#example-custom-composable-node) |
| `hot-reload-apply` | [#example-hot-reload-apply](../docs/index.html#example-hot-reload-apply) |
| `slots` | [#example-slots](../docs/index.html#example-slots) |
| `prefabs` | [#example-prefabs](../docs/index.html#example-prefabs) |
| `decisions-bindings` | [#example-decisions-bindings](../docs/index.html#example-decisions-bindings) |
