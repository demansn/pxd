import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validate } from "../src/index.js";
import { browserDoc } from "../examples/browser-minimal/document.js";
import { runApplyPatchDemo } from "../examples/hot-reload-apply/demo.js";
import { runCustomComposableDemo } from "../examples/custom-composable-node/demo.js";
import { runCustomNodeTypeDemo } from "../examples/custom-node-type/demo.js";
import { runDecisionsBindingsDemo } from "../examples/decisions-bindings/demo.js";
import { runPrefabsDemo } from "../examples/prefabs/demo.js";
import { runSlotsDemo } from "../examples/slots/demo.js";

describe("examples", () => {
    it("ships a minimal browser example", () => {
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
