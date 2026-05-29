# src/content

정적 gameplay data와 registry를 둔다.

- code behavior는 handler registry로 연결하되 data 정의와 분리한다.
- 원작 Noita material 원문 데이터는 넣지 않는다.
- content schema version을 유지한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
