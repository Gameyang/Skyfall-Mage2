# src/features/combatField/queries

entity hitbox와 field summary query 계약을 둔다.

- readback은 작은 area/query summary로 제한한다.
- HP/status/knockback 처리를 위한 typed result shape를 유지한다.
- query delay와 frame boundary를 명시적으로 다룬다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
