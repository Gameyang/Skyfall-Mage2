# src/features/inventory

인벤토리 slot, pickup, 이동, hotbar 사용 흐름을 둔다.

- UI drag state와 gameplay inventory state를 분리한다.
- 아이템 효과는 equipment/content/combat field modifier와 연결한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
