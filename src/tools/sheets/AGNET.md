# src/tools/sheets

Local-only sprite-sheet editing tools live here.

- `SheetRectEditor.ts` is the reusable crop-position editor used by `/sheets` and any local authoring tool that needs sheet coordinates.
- `bootstrapSheetTool.ts` owns the standalone `/sheets` tool for editing shared `src/content/sheets/sheetLibrary.ts` metadata.
- Keep this folder behind dev-only entrypoints. Production game code must import `content/sheets`, not `tools/sheets`.
- Do not store renderer instances, DOM nodes, GPU resources, or gameplay state in sheet definitions.
