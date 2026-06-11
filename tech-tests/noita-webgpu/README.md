# Noita-Style WebGPU Material Field Test

This prototype has been promoted into the official source tree.

Runtime code now lives in:

```text
src/features/material-field/
src/rendering/webgpu/bloom/
```

This folder is kept only as a redirect for old local and GitHub Pages links.

## Run

From the repository root:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

Build:

```bash
npm run build
```

## Browser Requirements

- WebGPU support is required.
- HTTPS or localhost secure context is required.
- There is no CPU, Canvas2D, or WebGL fallback path in this feature.

## Controls

- Top scrollable slot hub: select any implemented brush.
- Drag: emit current material.
- Right click or Shift+drag: water.
- Alt+drag: sand.
- `1`: fire brush.
- `2`: water brush.
- `3`: sand brush.
- `4`: smoke brush.
- `5`: steam brush.
- `6`: spark brush.
- `7`: rock brush.
- `8`: wet sand brush.
- `0`: erase brush.
- `Space`: explosion at the last pointer position.
- Mobile one-finger drag: fire/current material.
- Mobile two-finger drag: water.
- Mobile double tap: explosion.

## Bloom Postprocessing

Bloom lives in `src/rendering/webgpu/bloom/BloomPostProcess.js` and `src/rendering/webgpu/bloom/bloomPostProcess.wgsl`. Runtime tuning is in `src/features/material-field/config.js`.
