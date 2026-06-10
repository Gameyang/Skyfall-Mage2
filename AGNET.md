# Repository Contract

이 저장소는 WebGPU 전투 필드 시뮬레이션을 중심으로 `Skyfall Mage2`를 재구현한다.

- 코드 작성 전에는 `docs/todo.md`의 방향을 우선 확인한다.
- v1식 수치 전투를 그대로 옮기지 않고, material/heat/force/field query 기반 전투로 재설계한다.
- 원작 Noita 데이터 원문은 커밋하지 않는다.
- GPU resource, DOM node, renderer instance는 serializable game state에 넣지 않는다.
- `AGNET.md`는 사용자 요청에 맞춘 폴더 책임 문서다.
- 코드 파일을 추가하기 전에는 `docs/code-file-tree.md`의 예정 위치와 네이밍 규칙을 확인한다.

## Sprite combat presentation

전투 스프라이트의 상태 이펙트와 모션은 gameplay state가 아니라 renderer-facing presentation 계약이다. 기본 상태에서는 스프라이트에 장식 효과를 붙이지 않는다.

- canonical data는 `src/render/snapshots/RenderSnapshot.ts`의 `RenderableSprite`다.
- `src/render/snapshots/createRenderableSprites.ts`는 player/enemy/item을 sprite data로만 변환하고, 현재 기본 `statusEffects`는 빈 배열이며 `motionPreset`은 `idle`이다.
- `src/render/webgpu/combatField/CombatSpriteRenderer.ts`는 player sprite의 이전 `hpPercent`를 기억하고 유저 캐릭터 HP가 감소하면 1초 동안 hit flash uniform을 켠다.
- `src/render/webgpu/combatField/combatSpriteRender.wgsl`은 hit flash uniform이 켜진 동안 흰색 tint 깜빡임만 만든다.
- 새 전투 연출을 추가할 때는 gameplay 판정/데미지는 `src/features/combat`와 combat field query에 두고, 스프라이트 장식은 위 render snapshot 계약을 통해 넘긴다.
- unit test는 스프라이트 이펙트/모션의 세부 presentation 값을 고정하지 않는다. 렌더 스냅샷 테스트는 구조와 데이터 경계만 보고, 시각 변경은 typecheck/build와 browser/WebGPU 검증으로 확인한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.

## Unified Effect Authoring

All new combat visual effects should use the shared effect preset pipeline instead of one-off hardcoded renderer constants.

- Canonical editable data lives in `src/content/effects/effectPresets.ts`.
- Shared serializable contracts and pure evaluation rules live in `src/content/effects/effectPresetTypes.ts` and `src/content/effects/effectEvaluation.ts`.
- Game snapshots should convert gameplay/runtime state into effect preset context, then call the shared evaluator through `src/render/snapshots/createEffectSpritesFromPreset.ts`.
- The local-only editor lives under `src/tools/effects` and is loaded only in dev mode from `/effects`.
- Local preset save/load is handled by the Vite dev middleware at `/__local/effects/presets`; do not depend on that endpoint in production code.
- Effect presets must remain JSON-compatible and must not store DOM nodes, GPU resources, renderer instances, or gameplay state.
- Registered effect textures come from `assetUrls.effects`; do not add arbitrary remote image URLs to presets.
