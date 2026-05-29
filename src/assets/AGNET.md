# src/assets

Runtime game art assets live here.

- Keep gameplay image assets under `src/assets`, not `public/assets`.
- Store runtime image assets as 64x64 WebP files unless a feature explicitly documents another format.
- Source work files such as PSD, Clip Studio, Blender, or uncompressed originals do not belong here.
- Use `src/platform/assets.ts` for app-facing URL helpers instead of scattering raw paths through gameplay code.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
