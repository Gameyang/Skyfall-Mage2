# src/features/environment

날씨, 지형 조건, 전장 환경 변화를 둔다.

- 환경은 combat field seed, terrain, emitter rate, heat/wind/rain condition을 바꿀 수 있다.
- 단순 CPU modifier보다 field 변화 중심으로 설계한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
