# src/content/effects

Serializable effect preset data and pure evaluation rules live here.

- Keep presets JSON-compatible so the local editor can write them safely.
- Do not store WebGPU resources, DOM nodes, or renderer instances here.
- Game render snapshots and local tools should share these presets instead of duplicating effect constants.
- Sprite and textured particle layers should reference shared sheet metadata with `sheetId`.
- Keep layer `sheetRect` values as custom fallback coordinates only; canonical shared crop and frame metadata belongs in `src/content/sheets/sheetLibrary.ts`.
