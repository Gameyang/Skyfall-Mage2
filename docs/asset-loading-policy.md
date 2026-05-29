# Asset Loading Policy

작성일: 2026-05-29

## 원칙

- 이미지와 shader 경로는 직접 문자열로 흩뿌리지 않는다.
- 이미지 URL은 `src/platform/assets.ts`에서 관리한다.
- WGSL shader는 Vite `?raw` import로 번들에 포함한다.
- GitHub Pages 배포는 `VITE_BASE_PATH=/Skyfall-Mage2/` 빌드를 기준으로 검증한다.
- 런타임 저장 데이터나 CPU/GPU state에는 원본 외부 asset 파일 내용을 넣지 않는다.

## Shader

- WebGPU shader 파일은 `src/render/webgpu/combatField/*.wgsl`에 둔다.
- renderer는 shader 파일을 `import shaderSource from "./file.wgsl?raw"` 형식으로 가져온다.
- material 색상과 lookup 값은 shader switch가 아니라 registry 기반 GPU buffer로 넘긴다.

## Images

- UI item/enemy icon URL은 `src/platform/assets.ts`에서만 정의한다.
- local dev와 Pages preview 모두 Vite base path를 통과해야 한다.

## 검증

- 기본 검증: `npm run typecheck`, `npm test`, `npm run build`
- Pages base path 검증: `VITE_BASE_PATH=/Skyfall-Mage2/ npm run build`
- preview 검증: `/Skyfall-Mage2/` 경로에서 app shell과 WebGPU canvas가 렌더되는지 확인한다.
