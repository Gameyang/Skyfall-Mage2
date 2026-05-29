# src/features/combatField/reference

작은 grid용 CPU reference simulator를 둔다.

- 정확도 검증과 단위 테스트가 목적이며 성능 목표가 아니다.
- GPU shader와 비교 가능한 deterministic 결과를 만든다.
- 원작 전체 재현보다 현재 combat field 규칙 검증을 우선한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
