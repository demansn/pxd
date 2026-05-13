# Minimal browser example

A tiny Pixi browser bootstrap that builds a PXD tree and adds it to the stage.

This folder is intentionally bundler-light. In a real app, point Vite/esbuild/etc. at `index.html`.
The repo test suite validates `document.ts`; the DOM bootstrap is typechecked by TypeScript.
