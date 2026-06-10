# src/render/snapshots

렌더러가 소비할 immutable snapshot type을 둔다.

- renderer instance나 GPU resource를 넣지 않는다.
- UI view model과 구분한다.
- combat field snapshot은 config, camera, query visualization 같은 표현 데이터만 가진다.

## Sprite effect contract

`RenderableSprite`는 전투 스프라이트 연출을 위한 render-only 계약이다.

- `statusEffects`는 shader가 색/외곽선/flash를 고르기 위한 tag다. 현재 값은 `hit`, `buff`, `burning-field`, `slowed-field`, `magic-field`, `poisoned`, `frozen`이다.
- `motionPreset`은 shader vertex transform용 tag다. 현재 값은 `idle`, `bounce`, `shake`, `pulse`, `sway`이다.
- `createRenderableSprites.ts`에서 player/enemy/item의 상태를 이 tag로 변환한다. gameplay 판정이나 지속시간 계산은 여기서 하지 않는다.
- 새 연출 tag를 추가하면 `RenderSnapshot.ts` 타입, `createRenderableSprites.ts` 매핑, `CombatSpriteRenderer.ts` packing, `combatSpriteRender.wgsl` 소비 코드를 함께 갱신한다.
- 테스트는 특정 tag가 붙는지보다 snapshot이 serializable renderer data로 유지되는지에 집중한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
