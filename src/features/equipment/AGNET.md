# src/features/equipment

장비 장착, 해제, stat/modifier 계산을 둔다.

- v1식 공격력 수치만 만들지 않는다.
- material affinity, emitter shaping, resistance, heat/force 계수를 계산한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
