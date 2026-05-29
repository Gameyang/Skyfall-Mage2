# src/ui/components

버튼, 슬롯, meter, tooltip 같은 재사용 UI component를 둔다.

- component는 가능한 한 stateless하게 유지한다.
- domain-specific orchestration은 panels 또는 features에 둔다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
