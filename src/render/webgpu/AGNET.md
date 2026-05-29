# src/render/webgpu

WebGPU device, pipeline, buffer, texture 계층을 둔다.

- WebGPU 실패 처리는 `src/platform/webgpuSupport`와 합의한다.
- CPU gameplay state를 직접 소유하지 않는다.
- readback은 작은 summary/query buffer로 제한한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
