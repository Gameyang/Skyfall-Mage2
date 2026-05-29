# src/core/state

직렬화 가능한 game state type과 초기 상태를 둔다.

- GPU buffer, renderer, DOM reference는 금지한다.
- save schema와 migration을 고려해 versioned shape를 유지한다.
- combat field는 seed/config/query request 같은 데이터만 가진다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
