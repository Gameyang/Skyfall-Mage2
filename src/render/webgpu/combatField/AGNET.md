# src/render/webgpu/combatField

메인 전투 필드 시뮬레이션의 GPU backend를 둔다.

- movement, reaction, entity query, render pass를 명확히 분리한다.
- 전체 grid를 매 frame CPU로 읽지 않는다.
- shader는 material/heat/force 기반 전투 결과를 만들기 위한 구조로 작성한다.
