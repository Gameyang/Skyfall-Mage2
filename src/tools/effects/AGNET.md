# src/tools/effects

Local-only effect editing UI and preview code lives here.

- Keep this behind `import.meta.env.DEV` entrypoints.
- Do not write gameplay state or save data from this tool.
- Persist editable effect data through the local Vite API into `src/content/effects/effectPresets.ts`.
