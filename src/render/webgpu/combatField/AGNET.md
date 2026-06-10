# src/render/webgpu/combatField

메인 전투 필드 시뮬레이션의 GPU backend를 둔다.

- movement, reaction, entity query, render pass를 명확히 분리한다.
- 전체 grid를 매 frame CPU로 읽지 않는다.
- shader는 material/heat/force 기반 전투 결과를 만들기 위한 구조로 작성한다.

## Combat sprite effects

전투 스프라이트 이펙트는 `CombatSpriteRenderer.ts`와 `combatSpriteRender.wgsl`이 담당한다.

- 입력은 `RenderSnapshot.sprites`뿐이다. WebGPU renderer가 game state를 직접 읽지 않는다.
- uniform packing은 `CombatSpriteRenderer.writeSpriteParams`에 모은다.
- `CombatSpriteRenderer`는 player sprite의 이전 `hpPercent`를 저장하고, 유저 캐릭터 HP 감소가 감지되면 `effects.x`를 1초 동안 켠다.
- WGSL에서는 `effects.x`가 켜진 동안 흰색 tint 깜빡임을 만든다.
- 적 피격 flash, 기본 rarity outline, buff outline, 상태 tint, idle/bounce/shake/pulse/sway 모션은 현재 꺼져 있다.
- 새 전투 연출은 먼저 snapshot tag 또는 renderer-local trigger를 정하고, renderer packing에 연결한 뒤 shader에서만 시각화한다. gameplay damage/status source of truth는 combat system과 field query에 둔다.
- shader 시각 변경은 unit test에 세부 수치를 묶지 말고 `npm run typecheck`, `npm run build`, 필요 시 browser/WebGPU 검증으로 확인한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
