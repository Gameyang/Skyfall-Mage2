# src/core

순수 게임 상태, 공통 규칙, 수학 유틸리티를 둔다.

- DOM, WebGPU, WebGL, audio 같은 browser resource를 import하지 않는다.
- 단위 테스트 가능한 deterministic logic을 우선한다.
- 전투 순간 판정은 field query summary와 결합될 수 있게 작게 유지한다.
