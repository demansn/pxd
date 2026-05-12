/**
 * §7.2 String bindings — `{path}` substitution.
 *
 * Any string value MAY contain `{path}` bindings. Resolution happens AFTER
 * decision resolution but BEFORE typed resolvers (texture, style).
 *
 * Pure functions — no Pixi dependency.
 */

const BINDING_OR_ESCAPE = /[{\\]/;

/**
 * Walks `value` once, expanding `{path}` via `resolve` and honoring `\{` / `\\`
 * escapes. Substituted values are NOT re-scanned for further bindings.
 */
export function resolveBindings(value: string, resolve: (path: string) => string): string {
    if (!BINDING_OR_ESCAPE.test(value)) return value;
    let out = "";
    let i = 0;
    while (i < value.length) {
        const ch = value[i];
        if (ch === "\\" && i + 1 < value.length) {
            const next = value[i + 1];
            if (next === "{" || next === "\\") {
                out += next;
                i += 2;
                continue;
            }
        }
        if (ch === "{") {
            const end = value.indexOf("}", i + 1);
            if (end === -1) {
                throw new Error(`unterminated binding starting at index ${i} in '${value}'`);
            }
            const path = value.slice(i + 1, end);
            if (path.length === 0) {
                throw new Error(`empty binding '{}' at index ${i} in '${value}'`);
            }
            out += resolve(path);
            i = end + 1;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

/** Pass-through resolver when no binding callback is registered (§11 tolerant default). */
const passthrough = (path: string): string => `{${path}}`;

/**
 * Build a string reader for the given binding resolver. Returns a function that
 * applies `resolveBindings` to each string, or a no-op when no `{...}` / `\` is
 * present (cheap check up-front).
 */
export function makeStringReader(
    binding: ((path: string) => string) | undefined,
): (value: string) => string {
    if (binding) {
        return (value: string) => resolveBindings(value, binding);
    }
    return (value: string) =>
        BINDING_OR_ESCAPE.test(value) ? resolveBindings(value, passthrough) : value;
}
