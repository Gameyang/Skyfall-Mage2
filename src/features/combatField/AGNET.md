# src/features/combatField

전투 필드의 gameplay-facing type, queue, adapter를 둔다.

- GPU backend는 `src/render/webgpu/combatField`에 둔다.
- 이 폴더는 serializable config, emitter queue, query request/result 경계를 정의한다.
- Noita-inspired material interaction을 전투 시스템의 중심으로 다룬다.
