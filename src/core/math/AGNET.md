# src/core/math

벡터, 좌표 변환, random seed, geometry helper를 둔다.

- browser API 의존성을 넣지 않는다.
- field grid와 world 좌표 변환은 deterministic하게 유지한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
