#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { Ajv2020 as Ajv } from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";

import { ValidationError, documentShape, validate } from "./validate.js";
import type { PxdDocument } from "./types.js";

const schemaUrl = new URL("../../pxd.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8"));
const ajv = new Ajv({ strict: false, allErrors: true });
const validateSchema = ajv.compile(schema);

type LoadedDocument =
    | { ok: true; data: unknown }
    | LoadedFailure;

type LoadedFailure = { ok: false; kind: "io" | "json"; message: string };

type ValidatedDocument =
    | { ok: true; doc: PxdDocument }
    | { ok: false; kind: "schema" | "validation"; message: string };

function usage(): string {
    return [
        "Usage:",
        "  pxd validate <file>",
        "  pxd inspect <file>",
    ].join("\n");
}

function loadJson(file: string): LoadedDocument {
    try {
        return { ok: true, data: JSON.parse(readFileSync(file, "utf8")) };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof SyntaxError) return { ok: false, kind: "json", message };
        return { ok: false, kind: "io", message };
    }
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
    const lines = (errors ?? []).slice(0, 10).map((error) => {
        const path = error.instancePath || "/";
        return `  - ${path} ${error.message ?? "is invalid"}`;
    });
    if ((errors?.length ?? 0) > 10) {
        lines.push(`  - ... ${(errors?.length ?? 0) - 10} more error(s)`);
    }
    return lines.length > 0 ? lines.join("\n") : "  - document is invalid";
}

function validateDocument(file: string): ValidatedDocument | LoadedFailure {
    const loaded = loadJson(file);
    if (!loaded.ok) return loaded;

    if (!validateSchema(loaded.data)) {
        return {
            ok: false,
            kind: "schema",
            message: formatSchemaErrors(validateSchema.errors),
        };
    }

    try {
        return { ok: true, doc: validate(loaded.data) };
    } catch (error) {
        const message = error instanceof ValidationError
            ? error.message
            : error instanceof Error
                ? error.message
                : String(error);
        return { ok: false, kind: "validation", message };
    }
}

function printValidationFailure(file: string, result: Exclude<ReturnType<typeof validateDocument>, { ok: true }>): void {
    if (result.kind === "io") {
        console.error(`Could not read ${file}: ${result.message}`);
        return;
    }
    if (result.kind === "json") {
        console.error(`JSON parse error in ${file}: ${result.message}`);
        return;
    }
    if (result.kind === "schema") {
        console.error(`Schema validation failed in ${file}:`);
        console.error(result.message);
        return;
    }
    console.error(`Validation failed in ${file}:`);
    console.error(`  - ${result.message}`);
}

function validateCommand(file: string): number {
    const result = validateDocument(file);
    if (!result.ok) {
        printValidationFailure(file, result);
        return 1;
    }

    console.log(`OK ${file} shape=${documentShape(result.doc)}`);
    return 0;
}

export function main(argv = process.argv.slice(2)): number {
    const [command, file] = argv;
    if ((command !== "validate" && command !== "inspect") || !file || argv.length !== 2) {
        console.error(usage());
        return 2;
    }

    if (command === "validate") return validateCommand(file);

    // `inspect` is implemented in Task 4.
    console.error("inspect is not implemented yet");
    return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = main();
}
