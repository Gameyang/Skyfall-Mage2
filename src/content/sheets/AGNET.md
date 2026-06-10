# src/content/sheets

Shared sprite-sheet metadata lives here.

- `sheetLibrary.ts` is the canonical editable registry for sprite sheet asset refs, normalized crop rectangles, frame counts, and animation timing.
- `sheetTypes.ts` must stay serializable. Do not store DOM nodes, GPU resources, functions, or runtime game state.
- `sheetResolver.ts` is the only place in this folder that resolves sheet metadata to bundled asset URLs.
- Effects, enemies, units, items, and future visual systems should reference `sheetDefinitions` by `sheetId` instead of duplicating sheet crop coordinates in their own content files.
- Edit sheet crop and timing data through the local-only `/sheets` tool. Production code must not depend on `/__local/sheets/definitions`.
