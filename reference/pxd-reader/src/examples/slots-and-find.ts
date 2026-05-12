/**
 * Example: slots and label-path lookup.
 *
 *   - `slot` nodes are passive named mount points. The caller drops external
 *     content into them via `mountSlot(root, slotName, child)` — independent
 *     of label, cross-module-safe (slot identity is a Symbol-tagged Container).
 *   - `find` / `findAll` / `requirePath` walk the tree by dotted label path.
 *     A node's label is `node.label ?? node.id` (§3.2).
 */
import { Sprite, Texture, type Container, type Text } from "pixi.js";
import { build, mountSlot, requirePath } from "pxd";
import type { CoreDocument } from "pxd";

const doc: CoreDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        children: [
            {
                id: "hud",
                type: "container",
                children: [
                    {
                        id: "bet",
                        type: "container",
                        children: [
                            { id: "value", type: "text", text: "10" },
                        ],
                    },
                    // Two slots — the host fills them after build.
                    { id: "logoSlot", type: "slot", slot: "logo" },
                    { id: "footerSlot", type: "slot", slot: "footer" },
                ],
            },
        ],
    },
};

export function buildScene(): Container {
    const root = build(doc, {
        resolve: { texture: () => Texture.WHITE },
    });

    // Dotted path: walks `hud → bet → value` matching `Container.label`.
    // `findAll` is the same lookup but returns every match at the final segment
    // — use it when paths fan out into a list.
    const betValue = requirePath<Text>(root, "hud.bet.value");
    betValue.text = "42";

    // Mount external content into a named slot. Slot lookup ignores labels and
    // searches by `slot` tag instead.
    mountSlot(root, "logo", new Sprite(Texture.WHITE));
    mountSlot(root, "footer", new Sprite(Texture.WHITE));

    return root;
}
