# src/features/combatField

전투 필드의 gameplay-facing type, queue, adapter를 둔다.

- GPU backend는 `src/render/webgpu/combatField`에 둔다.
- 이 폴더는 serializable config, emitter queue, query request/result 경계를 정의한다.
- Noita-inspired material interaction을 전투 시스템의 중심으로 다룬다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
