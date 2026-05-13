import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");
const readmePath = resolve(repoRoot, "README.md");

const REQUIRED_SECTIONS = [
    "## Install",
    "## API",
    "## Base fields",
    "## apply()",
    "## Custom node types",
    "## Decisions and bindings",
    "## Prefabs",
    "## Slots",
    "## CLI",
    "## Examples",
    "## Development",
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

describe("docs", () => {
    it("ships README.md", () => {
        assert.equal(existsSync(readmePath), true, "README.md missing");
    });

    it("contains every required section heading", () => {
        const md = readFileSync(readmePath, "utf8");
        for (const heading of REQUIRED_SECTIONS) {
            assert.ok(md.includes(heading), `README.md must contain "${heading}"`);
        }
    });

    it("links every example folder", () => {
        const md = readFileSync(readmePath, "utf8");
        for (const name of EXAMPLES) {
            assert.ok(
                md.includes(`examples/${name}`),
                `README.md must reference examples/${name}`,
            );
        }
    });
});
