# src/features/combat

entity 전투 상태, 공격 의도, 피해 확정, 사망 처리를 둔다.

- damage를 거리 공식만으로 즉시 확정하지 않는다.
- 공격은 combat field emitter/query request로 변환한다.
- GPU query summary를 받아 HP/status/knockback/death event를 확정한다.
