# src/render/textures

texture atlas, texture metadata, GPU texture cache 경계를 둔다.

- Runtime image files live under `src/assets`.
- texture cache는 serializable state에 들어가면 안 된다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
