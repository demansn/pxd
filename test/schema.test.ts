import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 as Ajv } from "ajv/dist/2020.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(here, "../../doc/fixtures");
const VALID_DIR = join(FIXTURES, "valid");
const INVALID_DIR = join(FIXTURES, "invalid");

// These fixtures are structurally valid per schema but fail validate.ts semantic rules
const SEMANTIC_ONLY = new Set([
    "duplicate-ids.json",
    "mask-out-of-tree.json",
    "prefab-cycle.json",
    "prefab-ref-with-children.json",
    "decision-unsorted-selector.json",
    "required-not-in-used.json",
    "extension-required-unsupported.json",
]);

const schema = JSON.parse(readFileSync(resolve(here, "../../pxd.schema.json"), "utf8"));
const ajv = new Ajv({ strict: false });
const schemaValidate = ajv.compile(schema);

function schemaAccepts(data: unknown): boolean {
    return schemaValidate(data);
}

function listJson(dir: string): string[] {
    return readdirSync(dir).filter(f => f.endsWith(".json")).sort();
}

function load(dir: string, name: string): unknown {
    return JSON.parse(readFileSync(join(dir, name), "utf8"));
}

const validFiles = listJson(VALID_DIR);

describe("schema — valid core/library fixtures", () => {
    for (const name of validFiles.filter(n => !n.startsWith("scene-")))
        it(name, () => assert.ok(schemaAccepts(load(VALID_DIR, name))));
});

describe("schema — scene fixtures rejected (out of scope)", () => {
    for (const name of validFiles.filter(n => n.startsWith("scene-")))
        it(name, () => assert.ok(!schemaAccepts(load(VALID_DIR, name))));
});

describe("schema — semantic-only invalid fixtures (schema accepts, validate.ts rejects)", () => {
    for (const name of SEMANTIC_ONLY)
        it(name, () => assert.ok(schemaAccepts(load(INVALID_DIR, name))));
});

describe("schema — structural invalid fixtures (schema rejects)", () => {
    for (const name of listJson(INVALID_DIR).filter(n => !SEMANTIC_ONLY.has(n)))
        it(name, () => assert.ok(!schemaAccepts(load(INVALID_DIR, name))));
});
