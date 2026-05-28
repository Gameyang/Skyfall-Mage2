# Noita-Style WebGPU Material Field Test

Minimal WebGPU-only technology test for the v2 battle field effect layer. It renders a full-screen material grid without the formal game UI, inventory, stats, or combat systems.

## Run

From the repository root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/tech-tests/noita-webgpu/
```

GitHub Pages path:

```text
https://{account}.github.io/{repo}/tech-tests/noita-webgpu/
```

## Browser Requirements

- WebGPU support is required.
- HTTPS or localhost secure context is required.
- There is no CPU, Canvas2D, or WebGL fallback path in this test.

## Controls

- Drag: emit current material.
- Right click or Shift+drag: water.
- Alt+drag: sand.
- `1`: fire brush.
- `2`: water brush.
- `3`: sand brush.
- `Space`: explosion at the last pointer position.
- Mobile one-finger drag: fire/current material.
- Mobile two-finger drag: water.
- Mobile double tap: explosion.

## Current Scope

- WebGPU compute pass updates the material grid on GPU storage buffers.
- WebGPU render pass draws the storage-buffer result into an offscreen scene texture.
- Bloom postprocessing extracts bright fire/spark pixels, builds a mip-chain blur, and composites back to the canvas.
- Emitters are packed into a GPU storage buffer each frame.
- Materials: empty, solid, sand, water, fire, smoke, spark, steam.
- First-pass reactions: water/fire contact creates steam, and old steam can condense back into water.

This is a GPU material simulation experiment, not the final v2 battle renderer.

## Bloom Postprocessing

Bloom lives in `bloomPostProcess.js` and `bloomPostProcess.wgsl`. The scene and bloom chain use `rgba16float` so fire and spark colors can exceed `1.0` before the final canvas composite. Runtime tuning is intentionally limited to the `BLOOM_CONFIG` constant in `main.js` so this tech test stays focused on the render chain instead of UI controls.
