# src/ui

DOM 기반 shell, panel, component, style, view model을 둔다.

- UI는 command를 발행하고 state를 직접 바꾸지 않는다.
- 전투 canvas 위의 조작 overlay는 pointer 충돌을 명확히 처리한다.
- WebGPU simulation resource를 직접 만지지 않는다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
