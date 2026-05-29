# src/render

화면 출력과 render snapshot 소비를 담당한다.

- gameplay state를 직접 수정하지 않는다.
- WebGPU combat field render path가 기본이다.
- DOM UI는 `src/ui`가 담당한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
