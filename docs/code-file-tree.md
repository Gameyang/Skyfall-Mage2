# 코드 파일 트리 계획

작성일: 2026-05-29  
목표: LLM과 사람이 원하는 기능을 빠르게 찾고, 파일 경계를 예측 가능하게 유지한다.

## 1. 파일 배치 원칙

- 한 파일은 하나의 책임만 가진다.
- 파일명은 내부 대표 export 이름과 맞춘다.
- 타입만 모은 파일은 `*.types.ts` 또는 도메인명 `Types.ts`를 쓴다.
- 상태 변경은 `System`, `Reducer`, `Resolver` 이름을 가진 파일에 둔다.
- WebGPU resource 소유 파일은 `src/render/webgpu` 아래에만 둔다.
- CPU gameplay state와 GPU buffer를 같은 파일에서 소유하지 않는다.
- 큰 `utils.ts`를 만들지 않는다. 기능이 보이면 `math`, `rules`, `platform`, `features` 중 하나로 이동한다.
- barrel `index.ts`는 안정된 public API 재노출에만 쓰고, 구현 탐색을 가리는 용도로 남발하지 않는다.
- 각 주요 파일 상단에는 짧은 책임 주석을 둔다.

권장 파일 상단 형식:

```ts
// Responsibility: Pack combat field emitters for GPU upload.
// Owner: features/combatField
```

## 2. 빠른 검색 규칙

원하는 기능을 찾을 때 기준이 되는 키워드다.

- 전투 입력: `MovePlayer`, `AimAt`, `StartAttack`
- 전투 판정: `CombatSystem`, `CombatResolutionSystem`, `CombatFieldQuery`
- GPU 필드: `CombatFieldGpu`, `CombatFieldPass`, `combatField*.wgsl`
- 물질 정의: `MaterialRegistry`, `MaterialDefinition`, `ReactionRegistry`
- CPU 검증: `CpuCombatFieldSimulator`, `reference`
- 인벤토리: `InventorySystem`, `InventorySlot`, `PickupSystem`
- 장비 보정: `EquipmentSystem`, `EquipmentModifier`, `EmitterModifier`
- 웨이브: `WaveDirector`, `SpawnSystem`
- 저장: `SaveRuntime`, `SaveData`, `migrateSaveData`
- UI 표시: `ViewModel`, `Panel`, `Component`

권장 명령:

```powershell
rg "CombatField" src
rg "MaterialDefinition" src/features/combatField src/content
rg "MovePlayer" src/input src/runtime src/features
rg "SaveData|migrateSaveData" src
```

## 3. 최상위 코드 트리

```text
src/
  main.ts
  assets/
  app/
  runtime/
  core/
  render/
  ui/
  input/
  content/
  features/
  platform/
  tools/
  tests/
```

`src/main.ts`는 bootstrap 진입점만 담당한다. 실제 조립은 `src/app`에 둔다.

`src/assets` stores runtime game art that ships through the app bundle. Imported v1 art is normalized to 64x64 WebP under `items`, `skins`, `enemies`, and `projectiles`; UI frame and panel background textures live under `ui`.

## 4. app

```text
src/app/
  bootstrap.ts
  createApp.ts
  AppConfig.ts
  AppServices.ts
```

- `bootstrap.ts`: DOM root를 찾고 앱을 시작한다.
- `createApp.ts`: runtime, renderer, UI shell, input adapter를 조립한다.
- `AppConfig.ts`: 초기 해상도, debug flag, build/runtime 설정.
- `AppServices.ts`: runtime에 주입할 platform service 묶음.

## 5. runtime

```text
src/runtime/
  GameRuntime.ts
  GameClock.ts
  CommandBus.ts
  EventBus.ts
  RuntimeStep.ts
  SaveRuntime.ts
```

- `GameRuntime.ts`: update 순서의 중심.
- `GameClock.ts`: `requestAnimationFrame`, pause/resume, dt clamp.
- `CommandBus.ts`: input/UI command queue.
- `EventBus.ts`: system event queue.
- `RuntimeStep.ts`: CPU step, GPU simulation step, render step 순서 정의.
- `SaveRuntime.ts`: save schedule과 platform storage 연결.

## 6. core

```text
src/core/state/
  GameState.ts
  SessionState.ts
  PlayerState.ts
  EntityState.ts
  InventoryState.ts
  ProgressionState.ts
  EnvironmentState.ts
  BattleFieldState.ts
  Command.ts
  Event.ts
  SaveData.ts
  ids.ts

src/core/systems/
  SystemContext.ts
  SystemScheduler.ts

src/core/rules/
  statRules.ts
  progressionRules.ts
  saveRules.ts
  randomRules.ts

src/core/math/
  vector.ts
  rect.ts
  grid.ts
  rng.ts
  interpolation.ts
```

`core`는 browser API와 WebGPU API를 import하지 않는다.

## 7. combat features

```text
src/features/combat/
  CombatSystem.ts
  CombatResolutionSystem.ts
  ProjectileIntentSystem.ts
  EnemyHitboxSystem.ts
  DamageEventReducer.ts
  CombatTypes.ts
```

- `CombatSystem.ts`: 공격 의도를 emitter/query request로 변환한다.
- `CombatResolutionSystem.ts`: GPU field summary를 받아 HP/status/knockback/death를 확정한다.
- `ProjectileIntentSystem.ts`: projectile을 수치 탄환이 아니라 trace/emitter source로 관리한다.
- `EnemyHitboxSystem.ts`: entity hitbox를 combat field query target으로 만든다.

## 8. combat field gameplay

```text
src/features/combatField/
  CombatFieldTypes.ts
  CombatFieldConfig.ts
  CombatFieldStateAdapter.ts
  CombatFieldStep.ts
  MaterialEmitterQueue.ts
  MaterialEmitterPacking.ts
  CombatFieldCommands.ts
  CombatFieldEvents.ts

src/features/combatField/materials/
  MaterialDefinition.ts
  MaterialRegistry.ts
  MaterialMotionClass.ts
  ReactionDefinition.ts
  ReactionRegistry.ts
  starterMaterials.ts

src/features/combatField/queries/
  CombatFieldQueryTypes.ts
  CombatFieldQueryPlanner.ts
  CombatFieldQueryReducer.ts
  EntityCoverage.ts

src/features/combatField/reference/
  CpuCombatFieldSimulator.ts
  CpuMaterialMovement.ts
  CpuMaterialReaction.ts
  CpuFieldQuery.ts
```

이 폴더는 gameplay-facing 계약을 둔다. WebGPU buffer나 pipeline은 `render/webgpu/combatField`에 둔다.

## 9. WebGPU combat field backend

```text
src/render/webgpu/combatField/
  CombatFieldGpu.ts
  CombatFieldBuffers.ts
  CombatFieldBindGroups.ts
  CombatFieldPipelines.ts
  CombatFieldPasses.ts
  CombatFieldRenderer.ts
  CombatFieldBloom.ts
  CombatFieldReadback.ts
  CombatFieldDebug.ts
  combatFieldCommon.wgsl
  combatFieldMovement.wgsl
  combatFieldReaction.wgsl
  combatFieldEntityQuery.wgsl
  combatFieldRender.wgsl
  combatFieldBloom.wgsl
```

- `CombatFieldGpu.ts`: backend facade.
- `CombatFieldBuffers.ts`: cell, params, emitter, query buffers.
- `CombatFieldPipelines.ts`: compute/render pipeline 생성.
- `CombatFieldPasses.ts`: movement, reaction, query, render pass 실행 순서.
- `CombatFieldReadback.ts`: 작은 summary buffer readback만 담당.
- `CombatFieldDebug.ts`: debug overlay용 counters와 labels.

## 10. render snapshots

```text
src/render/snapshots/
  RenderSnapshot.ts
  BattleRenderSnapshot.ts
  CombatFieldRenderData.ts
  HudRenderData.ts
  SpriteRenderData.ts
```

렌더 snapshot은 renderer가 읽는 데이터다. gameplay state를 직접 수정하지 않는다.

## 11. ui

```text
src/ui/shell/
  AppShell.ts
  LayoutMode.ts
  PanelHost.ts

src/ui/panels/
  BattlePanel.ts
  InventoryPanel.ts
  ProgressPanel.ts
  SkillTreePanel.ts
  ShopPanel.ts
  ModalLayer.ts

src/ui/components/
  Button.ts
  IconButton.ts
  SlotGrid.ts
  Meter.ts
  Tooltip.ts
  Tabs.ts

src/ui/viewModels/
  createBattleViewModel.ts
  createInventoryViewModel.ts
  createProgressViewModel.ts
  createShopViewModel.ts

src/ui/styles/
  base.css
  layout.css
  panels.css
  controls.css
  textures.css
```

UI는 command를 발행한다. state 변경이나 WebGPU resource 접근은 하지 않는다.

## 12. input

```text
src/input/
  KeyboardInput.ts
  PointerInput.ts
  TouchInput.ts
  InputMapper.ts
  ViewportMapper.ts
  InputTypes.ts
```

`ViewportMapper.ts`는 DOM pointer 좌표, world 좌표, combat field grid 좌표 변환의 기준점이다.

## 13. content

```text
src/content/items/
  ItemDefinition.ts
  ItemRegistry.ts
  starterItems.ts

src/content/enemies/
  EnemyDefinition.ts
  EnemyRegistry.ts
  starterEnemies.ts

src/content/waves/
  WaveDefinition.ts
  WaveRegistry.ts
  starterWaves.ts

src/content/skills/
  SkillDefinition.ts
  SkillRegistry.ts
  starterSkills.ts

src/content/shop/
  ShopDefinition.ts
  ShopRegistry.ts
  starterShop.ts

src/content/effects/
  effectPresetTypes.ts
  effectPresets.ts
  effectEvaluation.ts

src/content/strings/
  GameStrings.ts
  gameStrings.csv

src/content/sheets/
  sheetTypes.ts
  sheetLibrary.ts
  sheetResolver.ts
```

content는 data와 registry를 둔다. behavior 구현은 `features`에 둔다.

`src/content/effects` stores serializable effect preset data shared by the game renderer and the local effect editor.

`src/content/strings` stores game-facing display strings in CSV form and exposes runtime lookup for localization.

`src/content/sheets` stores shared sprite-sheet crop/frame metadata referenced by effects, enemies, units, items, and future sheet-backed visual content.

`src/tools/effects` owns local-only effect editing UI and preview code. It must stay behind dev-only entrypoints and must not own gameplay state.

`src/tools/sheets` owns local-only shared sheet metadata editing UI. It must stay behind dev-only entrypoints and must not be imported by production gameplay or renderer code.

## 14. inventory, equipment, progression, shop

```text
src/features/inventory/
  InventorySystem.ts
  PickupSystem.ts
  InventoryTypes.ts

src/features/equipment/
  EquipmentSystem.ts
  EquipmentModifierResolver.ts
  EmitterModifierResolver.ts
  EquipmentTypes.ts

src/features/progression/
  ExperienceSystem.ts
  LevelUpSystem.ts
  UnlockSystem.ts
  ProgressionTypes.ts

src/features/skillTree/
  SkillTreeSystem.ts
  SkillModifierResolver.ts
  SkillTreeTypes.ts

src/features/shop/
  ShopSystem.ts
  PurchaseSystem.ts
  PriceRules.ts
  ShopTypes.ts
```

장비와 스킬은 단순 공격력보다 combat field modifier를 생성하는 방향으로 설계한다.

## 15. environment

```text
src/features/environment/
  EnvironmentSystem.ts
  WeatherSystem.ts
  TerrainSeedSystem.ts
  EnvironmentFieldAdapter.ts
  EnvironmentTypes.ts
```

환경은 field terrain, rain, wind, heat, emitter rate를 바꾸는 입력으로 작동한다.

## 16. platform

```text
src/platform/
  assets.ts
  storage.ts
  githubPages.ts
  webgpuSupport.ts
  browser.ts
  logging.ts
```

platform은 browser 차이를 흡수한다. gameplay rule을 넣지 않는다.

## 17. tests

```text
src/tests/
  setupTests.ts

src/tests/fixtures/
  tinyMaterialRegistry.ts
  tinyCombatFields.ts
  sampleSaveData.ts

src/tests/combatField/
  materialMovement.test.ts
  materialReaction.test.ts
  combatFieldQuery.test.ts
  gpuCpuComparison.test.ts
```

초기 테스트는 작은 grid CPU reference와 pure logic부터 만든다.

## 18. 파일을 추가할 때 체크리스트

- 이 파일의 대표 책임을 한 문장으로 말할 수 있는가?
- 같은 이름을 `rg`로 찾았을 때 예상 위치가 바로 나오는가?
- browser/GPU resource와 serializable state가 섞이지 않았는가?
- `features`와 `render` 경계를 넘나드는 import가 생기지 않았는가?
- 테스트할 수 있는 pure logic은 render/platform 밖에 있는가?
- AGNET.md 책임과 충돌하지 않는가?

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
