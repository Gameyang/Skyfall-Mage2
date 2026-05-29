# src/render/shaders

공유 shader source와 shader loading helper의 위치다.

- WebGPU combat field 전용 shader는 `src/render/webgpu/combatField`를 우선 사용한다.
- 여러 render backend가 공유하는 shader만 여기에 둔다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
