# src/core

순수 게임 상태, 공통 규칙, 수학 유틸리티를 둔다.

- DOM, WebGPU, WebGL, audio 같은 browser resource를 import하지 않는다.
- 단위 테스트 가능한 deterministic logic을 우선한다.
- 전투 순간 판정은 field query summary와 결합될 수 있게 작게 유지한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
