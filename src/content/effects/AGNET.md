# src/content/effects

Serializable effect preset data and pure evaluation rules live here.

- Keep presets JSON-compatible so the local editor can write them safely.
- Do not store WebGPU resources, DOM nodes, or renderer instances here.
- Game render snapshots and local tools should share these presets instead of duplicating effect constants.
