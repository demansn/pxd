import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const cli = resolve(root, "dist/src/cli.js");

function run(args: string[]) {
    return spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        encoding: "utf8",
    });
}

describe("cli package entry", () => {
    it("declares pxd bin entry", () => {
        const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
        assert.deepEqual(pkg.bin, { pxd: "./dist/src/cli.js" });
    });
});

describe("pxd validate", () => {
    it("accepts valid Core document", () => {
        const result = run(["validate", "doc/fixtures/valid/core-minimal.json"]);

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /OK doc\/fixtures\/valid\/core-minimal\.json/);
        assert.match(result.stdout, /shape=core/);
        assert.equal(result.stderr, "");
    });

    it("reports schema errors before semantic validation", () => {
        const result = run(["validate", "doc/fixtures/invalid/wrong-format.json"]);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Schema validation failed in doc\/fixtures\/invalid\/wrong-format\.json:/);
        assert.match(result.stderr, /\/format/);
        assert.match(result.stderr, /must be equal to constant/);
    });

    it("reports semantic validation errors with rule ids", () => {
        const result = run(["validate", "doc/fixtures/invalid/duplicate-ids.json"]);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Validation failed in doc\/fixtures\/invalid\/duplicate-ids\.json:/);
        assert.match(result.stderr, /\[rule 5\]/);
        assert.match(result.stderr, /duplicate id 'dup'/);
    });
});

describe("pxd inspect", () => {
    it("prints shape, node stats, and a short tree", () => {
        const result = run(["inspect", "doc/fixtures/valid/core-minimal.json"]);

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /file: doc\/fixtures\/valid\/core-minimal\.json/);
        assert.match(result.stdout, /shape: core/);
        assert.match(result.stdout, /nodes: 2/);
        assert.match(result.stdout, /types: container=1, text=1/);
        assert.match(result.stdout, /tree:\n- root \(container\)\n  - title \(text\)/);
    });

    it("prints prefab count for Library documents", () => {
        const result = run(["inspect", "doc/fixtures/valid/library-simple.json"]);

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /shape: library/);
        assert.match(result.stdout, /prefabs: 1/);
        assert.match(result.stdout, /prefab nodes:/);
    });
});

describe("pxd usage", () => {
    it("fails with usage for unknown command", () => {
        const result = run(["wat"]);

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Usage:/);
        assert.match(result.stderr, /pxd validate <file>/);
        assert.match(result.stderr, /pxd inspect <file>/);
    });
});
