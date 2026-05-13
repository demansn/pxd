# Examples and Checkable Demos Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add a small but complete `examples/` suite for TODO §9 and make those examples typechecked/smoke-tested by the normal build/test path.

**Architecture:** Keep examples as source-level TypeScript demos under `examples/`, with each non-browser demo exporting a `run...Demo()` function that can be imported by `node:test`. The browser demo stays browser-first (`index.html` + `main.ts`) but exposes its PXD document from a separate `document.ts` so CI can validate it without touching the DOM. Example verification is layered: TypeScript compilation catches API drift, `test/examples.test.ts` validates example documents and runs Node-safe smoke demos, and `npm test` includes that suite.

**Tech Stack:** TypeScript `NodeNext`, Pixi.js v8 `Container`/`Graphics`/`Application`, existing `build/apply/find/slots/validate` API, Node.js `node:test`, package-local `npm test` CI path.

---

## Codebase analysis summary

Current state relevant to TODO §9:

- There is no `examples/` directory today.
- Public API is already small and suitable for examples: `build`, `apply`, `find`, `getSlot`, `mountSlot`, `NodeType`, `validate` are exported from `src/index.ts`.
- Existing docs/guides already explain custom top-level fields, composable custom nodes, apply patch semantics, slots, and prefabs, but these snippets are not executable/checkable.
- `npm test` currently compiles only `src/**/*.ts` and `test/**/*.ts`, then runs fixture/runtime suites from `dist/`.
- Pixi `Text` can require browser/canvas shims in Node tests; CI-smoke examples should prefer `Container`/`Graphics` or validate documents without rendering browser-only files.
- `package.json.files` currently excludes `examples`, so published packages would not include demos unless this is changed.

Recommended additions beyond the exact TODO list:

1. Add an `examples/README.md` index with how to run/check examples.
2. Add a small `decisions-bindings` example, because decisions (§3.6) and bindings (§7.2) are core library features and likely to break if examples only cover structural APIs.
3. Add package/README links so users can actually discover the examples.

Do **not** add a full Vite project, assets pipeline, or browser automation in this iteration. A minimal browser example plus TypeScript/Node smoke checks is enough.

---

### Task 1: Add example build/check wiring with failing tests

**Files:**
- Modify: `tsconfig.json`
- Modify: `package.json`
- Create: `test/examples.test.ts`

**Step 1: Write the failing example test suite**

Create `test/examples.test.ts`:

```ts
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { validate } from "../src/index.js";
import { browserDoc } from "../examples/browser-minimal/document.js";
import { runApplyPatchDemo } from "../examples/hot-reload-apply/demo.js";
import { runCustomComposableDemo } from "../examples/custom-composable-node/demo.js";
import { runCustomNodeTypeDemo } from "../examples/custom-node-type/demo.js";
import { runDecisionsBindingsDemo } from "../examples/decisions-bindings/demo.js";
import { runPrefabsDemo } from "../examples/prefabs/demo.js";
import { runSlotsDemo } from "../examples/slots/demo.js";

const root = resolve(import.meta.dirname, "../..");

describe("examples", () => {
    it("ships a minimal browser example", () => {
        assert.equal(existsSync(resolve(root, "examples/browser-minimal/index.html")), true);
        assert.equal(existsSync(resolve(root, "examples/browser-minimal/main.ts")), true);
        assert.doesNotThrow(() => validate(browserDoc));
    });

    it("runs custom node type example without props", () => {
        const result = runCustomNodeTypeDemo();
        assert.equal(result.meter.label, "meter");
        assert.equal(result.meter.value, 75);
        assert.equal(result.meter.max, 100);
        assert.equal(result.root.children.includes(result.meter), true);
    });

    it("runs custom composable node example", () => {
        const result = runCustomComposableDemo();
        assert.equal(result.panel.title, "Settings");
        assert.equal(result.panel.children.includes(result.content), true);
        assert.equal(result.content.x, 16);
    });

    it("runs hot reload/apply patch example", () => {
        const result = runApplyPatchDemo();
        assert.equal(result.sameCardIdentity, true);
        assert.equal(result.updatedCount, 3);
        assert.equal(result.cardX, 120);
        assert.equal(result.badgeStillAttached, true);
        assert.deepEqual(result.missed, [{ path: "root.card.ghost", nodeId: "ghost" }]);
    });

    it("runs slots example", () => {
        const result = runSlotsDemo();
        assert.equal(result.slot.label, "boardMount");
        assert.equal(result.mounted.parent, result.slot);
        assert.equal(result.slot.children.includes(result.mounted), true);
    });

    it("runs prefabs example", () => {
        const result = runPrefabsDemo();
        assert.notEqual(result.leftCard, result.rightCard);
        assert.ok(result.leftBadge);
        assert.ok(result.rightBadge);
        assert.notEqual(result.leftBadge, result.rightBadge);
    });

    it("runs decisions and bindings example", () => {
        const result = runDecisionsBindingsDemo();
        assert.equal(result.root.x, 48);
        assert.equal(result.slotFound, true);
        assert.equal(result.panelFillSeenByCustomType, "#1d4ed8");
    });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx tsc
```

Expected: FAIL with module-not-found errors for `../examples/...` because example files do not exist yet.

**Step 3: Add `examples/**/*.ts` to root TypeScript compilation**

Modify `tsconfig.json` include:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": false,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "examples/**/*.ts"]
}
```

**Step 4: Add examples to test script and published files**

Modify `package.json` scripts/files:

```json
{
  "scripts": {
    "clean": "rm -rf dist",
    "build": "npm run clean && tsc",
    "examples:check": "tsc && node --test dist/test/examples.test.js",
    "test": "tsc && node dist/test/fixtures.test.js && node --test dist/test/build.test.js dist/test/apply.test.js dist/test/intrinsics.test.js dist/test/find.test.js dist/test/slots.test.js dist/test/schema.test.js dist/test/cli.test.js dist/test/examples.test.js",
    "prepack": "npm run build",
    "prepublishOnly": "npm test"
  },
  "files": [
    "dist/src",
    "examples",
    "doc/pxd-v1.md",
    "pxd.schema.json",
    "README.md",
    "LICENSE"
  ]
}
```

Keep the rest of `package.json` unchanged.

**Step 5: Commit**

```bash
git add tsconfig.json package.json test/examples.test.ts
git commit -m "test: add checkable examples harness"
```

---

### Task 2: Add examples index README

**Files:**
- Create: `examples/README.md`

**Step 1: Create the examples index**

Create `examples/README.md`:

```md
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
```

**Step 2: Run test to verify remaining failures**

Run:

```bash
npx tsc
```

Expected: still FAIL with module-not-found errors for example demo modules.

**Step 3: Commit**

```bash
git add examples/README.md
git commit -m "docs: add examples index"
```

---

### Task 3: Add minimal browser example

**Files:**
- Create: `examples/browser-minimal/README.md`
- Create: `examples/browser-minimal/index.html`
- Create: `examples/browser-minimal/document.ts`
- Create: `examples/browser-minimal/main.ts`

**Step 1: Add the browser PXD document**

Create `examples/browser-minimal/document.ts`:

```ts
import type { PxdDocument } from "../../src/index.js";

export const browserDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        x: 80,
        y: 80,
        children: [
            {
                id: "card",
                type: "graphics",
                shape: "roundRect",
                width: 360,
                height: 160,
                radius: 18,
                fill: "#1f2937",
                stroke: "#60a5fa",
                strokeWidth: 3,
            },
            {
                id: "title",
                type: "text",
                x: 24,
                y: 24,
                text: "Hello from PXD",
                style: "title",
            },
            {
                id: "caption",
                type: "text",
                x: 24,
                y: 76,
                text: "Edit the document and call apply() to patch this tree.",
                style: "caption",
                maxWidth: 300,
            },
        ],
    },
};
```

**Step 2: Add browser bootstrap**

Create `examples/browser-minimal/main.ts`:

```ts
import { Application, Assets, Texture } from "pixi.js";
import { build } from "../../src/index.js";
import { browserDoc } from "./document.js";

const app = new Application();
await app.init({ background: "#0f172a", resizeTo: window, antialias: true });

document.querySelector<HTMLDivElement>("#app")?.appendChild(app.canvas);

const root = build(browserDoc, {
    resolve: {
        texture: (id) => Assets.get(id) ?? Texture.WHITE,
        style: (id) => {
            if (id === "title") {
                return { fill: "#f8fafc", fontSize: 32, fontFamily: "Arial", fontWeight: "700" };
            }
            if (id === "caption") {
                return { fill: "#cbd5e1", fontSize: 16, fontFamily: "Arial", wordWrap: true };
            }
            return undefined;
        },
    },
});

app.stage.addChild(root);
```

**Step 3: Add HTML shell**

Create `examples/browser-minimal/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>pxd browser minimal example</title>
  <style>
    html, body, #app { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body { background: #0f172a; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

**Step 4: Add example README**

Create `examples/browser-minimal/README.md`:

```md
# Minimal browser example

A tiny Pixi browser bootstrap that builds a PXD tree and adds it to the stage.

This folder is intentionally bundler-light. In a real app, point Vite/esbuild/etc. at `index.html`.
The repo test suite validates `document.ts`; the DOM bootstrap is typechecked by TypeScript.
```

**Step 5: Run partial check**

Run:

```bash
npx tsc
```

Expected: still FAIL for the remaining missing example modules, but no errors from `examples/browser-minimal/*`.

**Step 6: Commit**

```bash
git add examples/browser-minimal
git commit -m "docs: add minimal browser example"
```

---

### Task 4: Add custom node type example without `props`

**Files:**
- Create: `examples/custom-node-type/README.md`
- Create: `examples/custom-node-type/demo.ts`

**Step 1: Create the example**

Create `examples/custom-node-type/demo.ts`:

```ts
import { Container, Graphics } from "pixi.js";
import { build, find, type NodeType, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export class Meter extends Container {
    readonly track = new Graphics();
    readonly fillBar = new Graphics();
    value = 0;
    max = 100;

    constructor() {
        super();
        this.addChild(this.track, this.fillBar);
    }

    setValue(value: number, max: number, width: number, height: number, fill: string): void {
        this.value = value;
        this.max = max;
        this.track.clear().roundRect(0, 0, width, height, height / 2).fill("#334155");
        this.fillBar.clear().roundRect(0, 0, width * (value / max), height, height / 2).fill(fill);
    }
}

export const meterType: NodeType = {
    create: () => new Meter(),
    assign: (node, target, ctx) => {
        if (!(target instanceof Meter)) return;
        const value = typeof node.value === "number" ? node.value : 0;
        const max = typeof node.max === "number" ? node.max : 100;
        const width = typeof node.barWidth === "number" ? node.barWidth : 200;
        const height = typeof node.barHeight === "number" ? node.barHeight : 20;
        const fill = typeof node.fill === "string" ? ctx.readString(node.fill) : "#22c55e";
        target.setValue(value, max, width, height, fill);
    },
};

export const customNodeTypeDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "meter",
                type: "Meter",
                x: 24,
                y: 24,
                value: { _: 40, desktop: 75 },
                max: 100,
                barWidth: 240,
                barHeight: 18,
                fill: "#22c55e",
            },
        ],
    },
};

export function runCustomNodeTypeDemo(): { root: Container; meter: Meter } {
    const root = build(customNodeTypeDoc, {
        resolve,
        activeTags: ["desktop"],
        nodeTypes: new Map([["Meter", meterType]]),
    });

    const meter = find(root, "meter");
    if (!(meter instanceof Meter)) throw new Error("Meter example failed to build");
    return { root, meter };
}
```

**Step 2: Add README**

Create `examples/custom-node-type/README.md`:

```md
# Custom node type without props

Demonstrates a runtime `Meter` node type. Custom fields (`value`, `max`, `barWidth`, `barHeight`, `fill`) live directly on the node — there is no `props` wrapper.

`assign` is shared by `build()` and `apply()`, so every document-driven field should be written there.
```

**Step 3: Run test to verify progress**

Run:

```bash
npx tsc
```

Expected: FAIL only for missing modules that have not been created yet.

**Step 4: Commit**

```bash
git add examples/custom-node-type
git commit -m "docs: add custom node type example"
```

---

### Task 5: Add custom composable node example

**Files:**
- Create: `examples/custom-composable-node/README.md`
- Create: `examples/custom-composable-node/demo.ts`

**Step 1: Create the example**

Create `examples/custom-composable-node/demo.ts`:

```ts
import { Container, Graphics } from "pixi.js";
import { build, find, type NodeType, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export class Panel extends Container {
    readonly background = new Graphics();
    title = "";

    constructor() {
        super();
        this.addChild(this.background);
    }

    setChrome(title: string, width: number, height: number, fill: string): void {
        this.title = title;
        this.background.clear().roundRect(0, 0, width, height, 12).fill(fill);
    }
}

export const panelType: NodeType = {
    create: () => new Panel(),
    assign: (node, target, ctx) => {
        if (!(target instanceof Panel)) return;
        const title = typeof node.title === "string" ? ctx.readString(node.title) : "";
        const width = typeof node.panelWidth === "number" ? node.panelWidth : 320;
        const height = typeof node.panelHeight === "number" ? node.panelHeight : 180;
        const fill = typeof node.fill === "string" ? ctx.readString(node.fill) : "#0f172a";
        target.setChrome(title, width, height, fill);
    },
};

export const customComposableDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "panel",
                type: "Panel",
                title: "Settings",
                panelWidth: 320,
                panelHeight: 180,
                fill: "#1e293b",
                children: [
                    {
                        id: "content",
                        type: "container",
                        x: 16,
                        y: 48,
                        children: [
                            {
                                id: "accent",
                                type: "graphics",
                                shape: "rect",
                                width: 120,
                                height: 8,
                                fill: "#38bdf8",
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export function runCustomComposableDemo(): { root: Container; panel: Panel; content: Container } {
    const root = build(customComposableDoc, {
        resolve,
        nodeTypes: new Map([["Panel", panelType]]),
    });

    const panel = find(root, "panel");
    const content = find(root, "panel.content");
    if (!(panel instanceof Panel)) throw new Error("Panel example failed to build");
    if (!(content instanceof Container)) throw new Error("Panel child failed to build");
    return { root, panel, content };
}
```

**Step 2: Add README**

Create `examples/custom-composable-node/README.md`:

```md
# Custom composable node

Demonstrates a custom `Panel` that owns internal chrome and also receives document-defined PXD children.

The library handles `children`; the custom `NodeType.assign` only applies custom fields such as `title`, `panelWidth`, and `fill`.
```

**Step 3: Run test to verify progress**

Run:

```bash
npx tsc
```

Expected: FAIL only for remaining missing modules.

**Step 4: Commit**

```bash
git add examples/custom-composable-node
git commit -m "docs: add custom composable node example"
```

---

### Task 6: Add hot reload/apply patch example

**Files:**
- Create: `examples/hot-reload-apply/README.md`
- Create: `examples/hot-reload-apply/demo.ts`

**Step 1: Create the example**

Create `examples/hot-reload-apply/demo.ts`:

```ts
import { Container } from "pixi.js";
import { apply, build, find, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export const initialDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "card",
                type: "container",
                x: 40,
                alpha: 0.8,
                children: [
                    { id: "body", type: "graphics", shape: "rect", width: 160, height: 80, fill: "#334155" },
                    { id: "badge", type: "container", y: 8 },
                ],
            },
        ],
    },
};

export const patchDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "card",
                type: "container",
                x: 120,
                children: [
                    { id: "body", type: "graphics", shape: "rect", width: 160, height: 80, fill: "#16a34a" },
                    { id: "ghost", type: "container", x: 999 },
                ],
            },
        ],
    },
};

export function runApplyPatchDemo(): {
    root: Container;
    sameCardIdentity: boolean;
    updatedCount: number;
    cardX: number;
    badgeStillAttached: boolean;
    missed: Array<{ path: string; nodeId: string }>;
} {
    const root = build(initialDoc, { resolve });
    const beforeCard = find(root, "card");
    const missed: Array<{ path: string; nodeId: string }> = [];

    const updatedCount = apply(patchDoc, root, {
        onMissing: (path, nodeId) => missed.push({ path, nodeId }),
    });

    const afterCard = find(root, "card");
    const badge = find(root, "card.badge");

    return {
        root,
        sameCardIdentity: beforeCard === afterCard,
        updatedCount,
        cardX: afterCard?.x ?? Number.NaN,
        badgeStillAttached: Boolean(badge),
        missed,
    };
}
```

**Step 2: Add README**

Create `examples/hot-reload-apply/README.md`:

```md
# Hot reload with apply

Demonstrates patch semantics:

- `apply()` mutates existing matched nodes in place.
- Present fields update live state.
- Omitted live children remain attached.
- Missing document children call `onMissing` and are skipped.
```

**Step 3: Run test to verify progress**

Run:

```bash
npx tsc
```

Expected: FAIL only for remaining missing modules.

**Step 4: Commit**

```bash
git add examples/hot-reload-apply
git commit -m "docs: add apply patch example"
```

---

### Task 7: Add slots example

**Files:**
- Create: `examples/slots/README.md`
- Create: `examples/slots/demo.ts`

**Step 1: Create the example**

Create `examples/slots/demo.ts`:

```ts
import { Container } from "pixi.js";
import { build, getSlot, mountSlot, type PxdDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export const slotsDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "boardMount",
                type: "slot",
                slot: "Board",
                x: 100,
                y: 80,
                width: 640,
                height: 360,
            },
        ],
    },
};

export function runSlotsDemo(): { root: Container; slot: Container; mounted: Container } {
    const root = build(slotsDoc, { resolve });
    const mounted = new Container();
    mounted.label = "hostOwnedBoard";

    const slot = mountSlot(root, "Board", mounted);
    const sameSlot = getSlot(root, "Board");
    if (sameSlot !== slot) throw new Error("Slot lookup mismatch");

    return { root, slot, mounted };
}
```

**Step 2: Add README**

Create `examples/slots/README.md`:

```md
# Slots

Demonstrates `slot` nodes as stable mount points for host-owned content.

Slot lookup uses `Symbol.for("pxd.slot")`, not labels, so `getSlot()` and `mountSlot()` keep working even when labels are used for path matching elsewhere.
```

**Step 3: Run test to verify progress**

Run:

```bash
npx tsc
```

Expected: FAIL only for remaining missing modules.

**Step 4: Commit**

```bash
git add examples/slots
git commit -m "docs: add slots example"
```

---

### Task 8: Add prefabs example

**Files:**
- Create: `examples/prefabs/README.md`
- Create: `examples/prefabs/demo.ts`

**Step 1: Create the example**

Create `examples/prefabs/demo.ts`:

```ts
import { Container } from "pixi.js";
import { build, find, type LibraryDocument, type Resolvers } from "../../src/index.js";

const resolve: Resolvers = { texture: () => { throw new Error("no textures in this demo"); } };

export const prefabsDoc: LibraryDocument = {
    format: "pxd",
    version: 1,
    level: "library",
    prefabs: {
        Card: {
            id: "cardRoot",
            type: "container",
            children: [
                { id: "body", type: "graphics", shape: "roundRect", width: 180, height: 96, radius: 10, fill: "#1e293b" },
                { id: "badge", type: "graphics", x: 12, y: 12, shape: "circle", radius: 8, fill: "#f97316" },
            ],
        },
    },
    root: {
        id: "root",
        type: "container",
        children: [
            { id: "leftCard", type: "Card", x: 20, y: 20 },
            { id: "rightCard", type: "Card", x: 240, y: 20 },
        ],
    },
};

export function runPrefabsDemo(): {
    root: Container;
    leftCard: Container | null;
    rightCard: Container | null;
    leftBadge: Container | null;
    rightBadge: Container | null;
} {
    const root = build(prefabsDoc, { resolve });

    return {
        root,
        leftCard: find(root, "leftCard"),
        rightCard: find(root, "rightCard"),
        leftBadge: find(root, "leftCard.badge"),
        rightBadge: find(root, "rightCard.badge"),
    };
}
```

**Step 2: Add README**

Create `examples/prefabs/README.md`:

```md
# Prefabs

Demonstrates a Library document with a reusable `Card` subtree.

Each prefab instance receives its own id scope, so `leftCard.badge` and `rightCard.badge` are distinct live objects even though the prefab body uses the same internal ids.
```

**Step 3: Run test to verify progress**

Run:

```bash
npx tsc
```

Expected: FAIL only for remaining missing modules.

**Step 4: Commit**

```bash
git add examples/prefabs
git commit -m "docs: add prefabs example"
```

---

### Task 9: Add decisions and bindings example (recommended extra)

**Files:**
- Create: `examples/decisions-bindings/README.md`
- Create: `examples/decisions-bindings/demo.ts`

**Step 1: Create the example**

Create `examples/decisions-bindings/demo.ts`:

```ts
import { Container } from "pixi.js";
import { build, getSlot, type NodeType, type PxdDocument, type Resolvers } from "../../src/index.js";

export class ColorPanel extends Container {
    fillSeenByCustomType = "";
}

export const colorPanelType: NodeType = {
    create: () => new ColorPanel(),
    assign: (node, target, ctx) => {
        if (!(target instanceof ColorPanel)) return;
        if (typeof node.fill === "string") target.fillSeenByCustomType = ctx.readString(node.fill);
    },
};

export const decisionsBindingsDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        x: { _: 16, mobile: 48 },
        children: [
            {
                id: "panel",
                type: "ColorPanel",
                fill: "{theme.primary}",
            },
            {
                id: "boardMount",
                type: "slot",
                slot: "Board.{layout}",
            },
        ],
    },
};

export function runDecisionsBindingsDemo(): {
    root: Container;
    slotFound: boolean;
    panelFillSeenByCustomType: string;
} {
    const resolve: Resolvers = {
        texture: () => { throw new Error("no textures in this demo"); },
        binding: (path) => {
            if (path === "theme.primary") return "#1d4ed8";
            if (path === "layout") return "mobile";
            return "";
        },
    };

    const root = build(decisionsBindingsDoc, {
        resolve,
        activeTags: ["mobile"],
        nodeTypes: new Map([["ColorPanel", colorPanelType]]),
    });

    const panel = root.getChildByLabel("panel", false);
    if (!(panel instanceof ColorPanel)) throw new Error("ColorPanel failed to build");

    return {
        root,
        slotFound: Boolean(getSlot(root, "Board.mobile")),
        panelFillSeenByCustomType: panel.fillSeenByCustomType,
    };
}
```

**Step 2: Add README**

Create `examples/decisions-bindings/README.md`:

```md
# Decisions and bindings

Demonstrates two load-time resolution features:

- Decision maps choose scalar values from `activeTags`.
- String bindings replace `{path}` through `resolve.binding`.

The example also shows that top-level custom scalar fields participate in decision/binding resolution before a custom `NodeType.assign` sees them.
```

**Step 3: Run test to verify TypeScript passes**

Run:

```bash
npx tsc
```

Expected: PASS.

**Step 4: Commit**

```bash
git add examples/decisions-bindings
git commit -m "docs: add decisions and bindings example"
```

---

### Task 10: Run and fix example smoke tests

**Files:**
- Modify as needed: `examples/**/demo.ts`
- Modify as needed: `test/examples.test.ts`

**Step 1: Run just examples check**

Run:

```bash
npm run examples:check
```

Expected initially: either PASS, or focused failures in `dist/test/examples.test.js`.

**Step 2: If TypeScript complains about JSON/type shape**

Prefer explicit type annotations over `as const` for documents:

```ts
import type { PxdDocument } from "../../src/index.js";

export const doc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: { id: "root", type: "container" },
};
```

Do not use readonly `as const` arrays for document children unless the schema types are changed to readonly arrays.

**Step 3: If a Node smoke test hits DOM/canvas errors**

Do not add DOM dependencies. Either:

- move browser-only rendering code to `browser-minimal/main.ts`, or
- keep CI-smoke examples on `Container`/`Graphics`, or
- validate the browser document with `validate()` instead of building browser-only Pixi `Text` in Node.

**Step 4: Re-run examples check**

Run:

```bash
npm run examples:check
```

Expected: PASS.

**Step 5: Commit fixes**

```bash
git add examples test/examples.test.ts
git commit -m "test: verify examples"
```

---

### Task 11: Link examples from README

**Files:**
- Modify: `README.md`

**Step 1: Add Examples section after Quickstart or CLI**

Add this section to `README.md`:

```md
## Examples

Checkable examples live in [`examples/`](./examples/):

- [`browser-minimal`](./examples/browser-minimal/) — minimal Pixi browser bootstrap.
- [`custom-node-type`](./examples/custom-node-type/) — custom `NodeType` with top-level custom fields, no `props`.
- [`custom-composable-node`](./examples/custom-composable-node/) — custom nodes with document-defined children.
- [`hot-reload-apply`](./examples/hot-reload-apply/) — patch an existing tree with `apply()`.
- [`slots`](./examples/slots/) — slot lookup and host-owned content mounting.
- [`prefabs`](./examples/prefabs/) — Library prefab declaration and instantiation.
- [`decisions-bindings`](./examples/decisions-bindings/) — active tags and `{path}` bindings.

Examples are compiled and smoke-tested by `npm test`.
```

**Step 2: Run README grep sanity check**

Run:

```bash
grep -n "## Examples" README.md
```

Expected: prints the new section line.

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: link checkable examples"
```

---

### Task 12: Final verification

**Files:**
- No planned edits unless verification reveals issues.

**Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS, including `dist/test/examples.test.js`.

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/examples/` emitted because examples are included in `tsconfig.json`.

**Step 3: Check pack contents include examples source**

Run:

```bash
npm pack --dry-run
```

Expected: output lists `examples/README.md` and each example folder. It should still include `dist/src`, `doc/pxd-v1.md`, `pxd.schema.json`, `README.md`, and `LICENSE`.

**Step 4: Update TODO checklist**

Modify `TODO.md` §9 only after verification passes:

```md
## 9. Examples и проверяемые демо

- [x] Минимальный browser example.
- [x] Custom node type example без `props`, с top-level custom fields.
- [x] Custom composable node example.
- [x] Hot reload/apply patch example.
- [x] Slots example.
- [x] Prefabs example.
- [x] Проверять examples в build/CI.
```

Optionally add a sub-bullet or note for the extra decisions/bindings example.

**Step 5: Commit final state**

```bash
git add TODO.md package.json tsconfig.json README.md examples test/examples.test.ts
git commit -m "docs: add checked examples suite"
```

If previous task commits already captured most files, this final commit may only contain `TODO.md` and any last fixes.

---

## Implementation notes and guardrails

- Keep imports in examples pointing at `../../src/index.js` so examples compile directly in the repo without depending on prebuilt package self-references.
- Do not introduce Vite, Playwright, jsdom, or extra dependencies for this TODO item.
- Avoid Pixi `Text` in Node-executed smoke demos; it is fine in the browser example because CI only validates its document and typechecks its bootstrap.
- Keep custom examples focused on current public model: top-level fields, no `props`, children owned by the library traversal pipeline.
- Do not add reconciliation/full-apply behavior in examples; `apply()` examples must reinforce patch-only semantics.
- If `npm pack --dry-run` output is too noisy after adding `dist/examples`, revisit `package.json.files`. Publishing source `examples/` is useful; publishing `dist/examples` is optional and not necessary for the package runtime API.
