# src/ui/panels

Battle, Inventory, Progress, Shop, SkillTree 같은 큰 UI panel을 둔다.

- panel은 view model을 받아 렌더링하고 command를 발행한다.
- panel 내부에 gameplay rule을 넣지 않는다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
