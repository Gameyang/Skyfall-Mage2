# src/ui/viewModels

GameState를 UI 표시용 데이터로 변환하는 code를 둔다.

- DOM node를 만들지 않는다.
- UI가 필요한 derived value를 여기서 계산한다.
- WebGPU query summary는 읽기 쉬운 표시 상태로 변환한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
