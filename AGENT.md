# Repository Contract

Skyfall Mage2 is a WebGPU combat-field project with local-only authoring tools for visual content.

- Check `docs/todo.md` before broad gameplay or renderer changes.
- Do not store GPU resources, DOM nodes, renderer instances, or other runtime handles in serializable game state.
- Local authoring endpoints are development-only Vite middleware and must not be used by production code.
- Keep visual content data JSON-compatible so tools can edit and save it directly.
- `AGNET.md` is a legacy typo file. Prefer this `AGENT.md` for current agent-facing notes.

## Unified Effect Authoring

All combat visual effects should use the shared effect preset pipeline instead of one-off hardcoded renderer constants.

- Canonical editable effect data lives in `src/content/effects/effectPresets.ts`.
- Shared effect contracts and pure evaluation rules live in `src/content/effects/effectPresetTypes.ts` and `src/content/effects/effectEvaluation.ts`.
- The local-only effect editor lives under `src/tools/effects` and is loaded in dev mode from `/effects`.
- Effect presets should reference shared sprite-sheet metadata with `sheetId` when using sprite or textured particle layers.
- Registered effect textures come from `assetUrls.effects`; do not add arbitrary remote image URLs to presets.

## Shared Sheet Authoring

Sprite-sheet metadata is shared by effects, units, projectiles, items, UI, skins, and future sheet-backed visuals.

- Canonical editable sheet data lives in `src/content/sheets/sheetLibrary.ts`.
- Serializable contracts live in `src/content/sheets/sheetTypes.ts`.
- Runtime lookup helpers live in `src/content/sheets/sheetResolver.ts`.
- The local-only sheet editor lives under `src/tools/sheets` and is loaded in dev mode from `/sheets`.
- Local sheet save/load is handled by `/__local/sheets/definitions`; do not depend on that endpoint in production code.
- Each sheet can store a normalized sheet `rect`, grid `columns` and `rows`, per-frame cut data in `frames`, and multiple animation clips in `clips`.
- A `SheetFrameDefinition` stores:
  - `rect`: the trimmed source rectangle for the visible pixels.
  - `cellRect`: the original grid cell rectangle.
  - `placement`: where the trimmed frame belongs inside its cell.
  - `pivot`: the normalized pivot used by preview and future renderers.
- A `SheetAnimationClip` stores an ordered list of frame IDs plus optional timing overrides.
- Auto mapping should detect the grid, trim transparent bounds per frame, and create an initial `All Frames` clip.
- Preview tools should draw from `frames` and `clips` rather than inventing separate local playback metadata.
