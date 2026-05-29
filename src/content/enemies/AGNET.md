# src/content/enemies

적과 보스 definition을 둔다.

- enemy는 field query에 필요한 hitbox, material resistance, movement behavior를 정의한다.
- AI 구현 세부는 features/combat 또는 features/environment와 분리한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
