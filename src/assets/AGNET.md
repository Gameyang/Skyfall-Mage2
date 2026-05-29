# src/assets

Runtime game art assets live here.

- Keep gameplay image assets under `src/assets`, not `public/assets`.
- Store runtime image assets as 64x64 WebP files unless a feature explicitly documents another format.
- Source work files such as PSD, Clip Studio, Blender, or uncompressed originals do not belong here.
- Use `src/platform/assets.ts` for app-facing URL helpers instead of scattering raw paths through gameplay code.
