# src/render/webgpu

WebGPU device, pipeline, buffer, texture 계층을 둔다.

- WebGPU 실패 처리는 `src/platform/webgpuSupport`와 합의한다.
- CPU gameplay state를 직접 소유하지 않는다.
- readback은 작은 summary/query buffer로 제한한다.
