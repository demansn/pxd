#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { Ajv2020 as Ajv } from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";

import { ValidationError, documentShape, validate } from "./validate.js";
import type { LibraryDocument, Node, PxdDocument } from "./types.js";

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

interface Stats {
    nodes: number;
    types: Map<string, number>;
}

function createStats(): Stats {
    return { nodes: 0, types: new Map<string, number>() };
}

function addNode(stats: Stats, node: Node): void {
    stats.nodes += 1;
    stats.types.set(node.type, (stats.types.get(node.type) ?? 0) + 1);
    if (Array.isArray(node.children)) {
        for (const child of node.children) addNode(stats, child);
    }
}

function formatTypes(types: Map<string, number>): string {
    return [...types.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => `${type}=${count}`)
        .join(", ");
}

function formatNode(node: Node, depth = 0): string[] {
    const indent = "  ".repeat(depth);
    const suffix = typeof node.label === "string" && node.label !== node.id
        ? ` label=${node.label}`
        : "";
    const lines = [`${indent}- ${node.id} (${node.type})${suffix}`];
    if (Array.isArray(node.children)) {
        for (const child of node.children) lines.push(...formatNode(child, depth + 1));
    }
    return lines;
}

function inspectCommand(file: string): number {
    const result = validateDocument(file);
    if (!result.ok) {
        printValidationFailure(file, result);
        return 1;
    }

    const shape = documentShape(result.doc);
    const rootStats = createStats();
    addNode(rootStats, result.doc.root);

    console.log(`file: ${file}`);
    console.log(`shape: ${shape}`);
    console.log(`nodes: ${rootStats.nodes}`);
    console.log(`types: ${formatTypes(rootStats.types)}`);

    if (shape === "library") {
        const prefabs = (result.doc as LibraryDocument).prefabs;
        const prefabStats = createStats();
        for (const prefab of Object.values(prefabs)) addNode(prefabStats, prefab);
        console.log(`prefabs: ${Object.keys(prefabs).length}`);
        console.log(`prefab nodes: ${prefabStats.nodes}`);
        console.log(`prefab types: ${formatTypes(prefabStats.types)}`);
    } else {
        console.log("prefabs: 0");
    }

    console.log("tree:");
    console.log(formatNode(result.doc.root).join("\n"));

    return 0;
}

export function main(argv = process.argv.slice(2)): number {
    const [command, file] = argv;
    if ((command !== "validate" && command !== "inspect") || !file || argv.length !== 2) {
        console.error(usage());
        return 2;
    }

    if (command === "validate") return validateCommand(file);
    return inspectCommand(file);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = main();
}
