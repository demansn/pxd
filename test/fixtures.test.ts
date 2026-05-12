/**
 * Runs the validator and builder against conformance fixtures at
 * `doc/fixtures/`.
 *
 * Contract:
 *   - `valid/core-*.json` and `valid/library-*.json` MUST validate without error.
 *   - `valid/scene-*.json` MUST be rejected by this library (Core+Library only).
 *   - `invalid/*.json` MUST throw `ValidationError`.
 *
 * Exits with code 1 on any failure.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ValidationError, validate } from "../src/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = resolve(here, "../../doc/fixtures");

interface Failure {
    file: string;
    expected: string;
    message: string;
}

function listJson(dir: string): string[] {
    return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => join(dir, f))
        .sort();
}

function loadJson(path: string): unknown {
    return JSON.parse(readFileSync(path, "utf8"));
}

function rel(path: string): string {
    return path.slice(FIXTURES_ROOT.length + 1);
}

const failures: Failure[] = [];
let passed = 0;

// Valid Core/Library fixtures: MUST validate.
for (const file of listJson(join(FIXTURES_ROOT, "valid"))) {
    const name = rel(file).replace(/^valid\//, "");
    const isScene = name.startsWith("scene-");
    try {
        validate(loadJson(file));
        if (isScene) {
            failures.push({
                file: rel(file),
                expected: "scene-rejected",
                message: "scene-shape doc validated, but library is Core+Library only",
            });
            console.log(`  FAIL ${rel(file)} — scene-shape accepted (should reject)`);
        } else {
            passed++;
            console.log(`  ok  ${rel(file)}`);
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (isScene && e instanceof ValidationError && message.includes("scene-shape")) {
            passed++;
            console.log(`  ok  ${rel(file)} — rejected as out of scope`);
        } else {
            failures.push({ file: rel(file), expected: "valid", message });
            console.log(`  FAIL ${rel(file)} — ${message}`);
        }
    }
}

// Invalid fixtures: MUST throw ValidationError.
for (const file of listJson(join(FIXTURES_ROOT, "invalid"))) {
    try {
        validate(loadJson(file));
        failures.push({
            file: rel(file),
            expected: "invalid",
            message: "expected validation failure but document validated successfully",
        });
        console.log(`  FAIL ${rel(file)} — accepted but should have been rejected`);
    } catch (e) {
        if (e instanceof ValidationError) {
            passed++;
            console.log(`  ok  ${rel(file)} — rejected with ${e.message}`);
        } else {
            const message = e instanceof Error ? e.message : String(e);
            failures.push({
                file: rel(file),
                expected: "invalid",
                message: `expected ValidationError, got ${message}`,
            });
            console.log(`  FAIL ${rel(file)} — ${message}`);
        }
    }
}

console.log("");
console.log(`${passed} passed, ${failures.length} failed`);

if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) {
        console.log(`  ${f.file} (expected ${f.expected}): ${f.message}`);
    }
    process.exit(1);
}
