# src/core/rules

공통 gameplay rule과 계산식을 둔다.

- 장비 보정, reward rule, save-safe 계산처럼 rendering과 무관한 규칙만 둔다.
- v1 수치 공식을 그대로 복사하기보다 simulation modifier로 재해석한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
