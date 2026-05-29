# src/features/combat

entity 전투 상태, 공격 의도, 피해 확정, 사망 처리를 둔다.

- damage를 거리 공식만으로 즉시 확정하지 않는다.
- 공격은 combat field emitter/query request로 변환한다.
- GPU query summary를 받아 HP/status/knockback/death event를 확정한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
