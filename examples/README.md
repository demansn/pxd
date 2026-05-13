# pxd examples

Small, checkable examples for the public `pxd` API.

## Run checks

From the repository root:

```bash
npm test
# or just the examples after compilation
npm run examples:check
```

## Examples

- [`browser-minimal`](./browser-minimal/) — minimal Pixi browser bootstrap with `build()`.
- [`custom-node-type`](./custom-node-type/) — custom `NodeType` with top-level custom fields; no `props`.
- [`custom-composable-node`](./custom-composable-node/) — custom `Container` that receives document-defined children.
- [`hot-reload-apply`](./hot-reload-apply/) — patch an existing tree in place with `apply()`.
- [`slots`](./slots/) — declare a `slot` and mount host-owned content.
- [`prefabs`](./prefabs/) — declare reusable prefab subtrees in a Library document.
- [`decisions-bindings`](./decisions-bindings/) — active tags and string bindings.

The Node-safe examples export `run...Demo()` functions and are smoke-tested by `test/examples.test.ts`.
The browser example exports its document separately so CI can validate it without launching a browser.
