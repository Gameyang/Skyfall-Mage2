# src/core/systems

공통 update system을 둔다.

- feature 전용 system은 `src/features`에 둔다.
- system은 command/event/state를 입력으로 받고 side effect를 최소화한다.
- GPU resource에 직접 접근하지 않는다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
