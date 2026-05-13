import { mountDemo } from "./preview.js";

const target = document.querySelector<HTMLDivElement>("#app");
if (!target) throw new Error("#app missing");
await mountDemo(target);
