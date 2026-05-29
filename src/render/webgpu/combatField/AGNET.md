# src/render/webgpu/combatField

메인 전투 필드 시뮬레이션의 GPU backend를 둔다.

- movement, reaction, entity query, render pass를 명확히 분리한다.
- 전체 grid를 매 frame CPU로 읽지 않는다.
- shader는 material/heat/force 기반 전투 결과를 만들기 위한 구조로 작성한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
