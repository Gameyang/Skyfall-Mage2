# src/render/shaders

공유 shader source와 shader loading helper의 위치다.

- WebGPU combat field 전용 shader는 `src/render/webgpu/combatField`를 우선 사용한다.
- 여러 render backend가 공유하는 shader만 여기에 둔다.
