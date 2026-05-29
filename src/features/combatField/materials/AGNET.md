# src/features/combatField/materials

material registry, density, heat, force, reaction metadata를 둔다.

- shader가 lookup할 수 있는 compact definition으로 변환 가능해야 한다.
- 원작 `materials.xml` 원문은 넣지 않는다.
- 최소 재료군부터 시작해 data-driven 구조로 확장한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
