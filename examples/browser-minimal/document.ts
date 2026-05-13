import type { PxdDocument } from "../../src/index.js";

export const browserDoc: PxdDocument = {
    format: "pxd",
    version: 1,
    root: {
        id: "root",
        type: "container",
        x: 80,
        y: 80,
        children: [
            {
                id: "card",
                type: "graphics",
                shape: "roundRect",
                width: 360,
                height: 160,
                radius: 18,
                fill: "#1f2937",
                stroke: "#60a5fa",
                strokeWidth: 3,
            },
            {
                id: "title",
                type: "text",
                x: 24,
                y: 24,
                text: "Hello from PXD",
                style: "title",
            },
            {
                id: "caption",
                type: "text",
                x: 24,
                y: 76,
                text: "Edit the document and call apply() to patch this tree.",
                style: "caption",
                maxWidth: 300,
            },
        ],
    },
};
