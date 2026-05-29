# src/features/shop

상점 진열, 구매, reroll, coupon 적용을 둔다.

- 가격과 상품 생성은 테스트 가능한 pure logic으로 유지한다.
- UI panel 직접 조작을 하지 않는다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
