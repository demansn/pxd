import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");
const indexPath = resolve(repoRoot, "docs/index.html");

const REQUIRED_SECTION_IDS = [
    "overview",
    "mental-model",
    "quickstart",
    "api",
    "reserved-base-fields",
    "apply-patch-semantics",
    "custom-node-types",
    "decisions-and-bindings",
    "prefabs",
    "slots",
    "cli",
    "not-included",
    "examples",
];

const EXAMPLES = [
    "browser-minimal",
    "custom-node-type",
    "custom-composable-node",
    "hot-reload-apply",
    "slots",
    "prefabs",
    "decisions-bindings",
];

describe("docs site", () => {
    it("ships docs/index.html", () => {
        assert.equal(existsSync(indexPath), true, "docs/index.html missing");
    });

    it("declares every required section id", () => {
        const html = readFileSync(indexPath, "utf8");
        for (const id of REQUIRED_SECTION_IDS) {
            assert.ok(
                html.includes(`id="${id}"`),
                `docs/index.html must contain <section id="${id}">`,
            );
        }
    });

    it("embeds a canvas mount point for every example", () => {
        const html = readFileSync(indexPath, "utf8");
        for (const name of EXAMPLES) {
            assert.ok(
                html.includes(`data-demo="${name}"`),
                `docs/index.html must contain a canvas with data-demo="${name}"`,
            );
        }
    });

    it("exposes mountDemo from every example preview", async () => {
        for (const name of EXAMPLES) {
            const mod = await import(`../examples/${name}/preview.js`);
            assert.equal(
                typeof mod.mountDemo,
                "function",
                `examples/${name}/preview.ts must export mountDemo(target)`,
            );
        }
    });
});
