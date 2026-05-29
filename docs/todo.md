# Skyfall Mage2 구현 TODO

작성일: 2026-05-29  
기준 문서:

- `docs/baseline-game-analysis.md`
- `docs/v2-code-system-design-plan.md`
- `docs/noita-webgpu-simulation-analysis.md`
- `docs/noita-webgpu-tech-test-handoff.md`
- `docs/noita-original-material-interaction-implementation-analysis.md`

## 구현 원칙

- 첫 화면은 랜딩 페이지가 아니라 실제 게임 화면으로 만든다.
- 기본 스택은 Vite + TypeScript + WebGPU 전투 필드 시뮬레이션 + DOM UI다.
- WebGPU를 메인 전투 필드 가속 경로로 우선 구현한다.
- WebGL2/Canvas2D는 초기 목표가 아니라 WebGPU 미지원 환경의 제한적 fallback 후보로만 둔다.
- 전투와 인벤토리는 독립 패널로 유지하고, 화면 방향에 따라 배치만 바꾼다.
- `GameState`에는 DOM, 렌더러, GPU resource, 시스템 인스턴스를 넣지 않는다.
- 입력과 UI는 state를 직접 바꾸지 않고 command를 발행한다.
- 기준 게임 코드는 복사보다 개념과 알고리즘 이식을 우선한다.
- v1의 수치 기반 전투 공식을 그대로 옮기지 않고, 실제 필드 시뮬레이션 기반 전투로 리뉴얼한다.
- 공격, 피해, 상태이상, 환경 변화는 가능한 한 material field, force field, heat, fluid, gas, projectile trace의 상호작용에서 발생하게 한다.
- HP, 장비, 경험치, 인벤토리, 웨이브 같은 장기 상태는 CPU state에 남기되, 전투 순간 판정은 GPU field summary/query와 CPU entity state를 결합해 처리한다.
- GPU grid 전체를 매 frame CPU로 읽지 않는다. 필요한 판정은 작은 area query, hit summary buffer, event buffer로 제한한다.
- WebGPU 미지원 또는 device lost가 발생하면 개발/배포 환경에서 명확히 degraded mode로 전환하되, 우선 목표는 WebGPU 기준 게임플레이다.
- 원작 Noita 데이터는 저장소에 포함하지 않고, 필요한 경우 parser 입력으로만 사용한다.

## 0. 정리 작업

- [x] `tech-tests/noita-webgpu` 삭제 대상으로 확정한다.
- [x] `tech-tests/noita-webgpu` 폴더를 삭제한다.
- [x] README, index, GitHub Pages 공개 경로에서 `tech-tests/noita-webgpu` 링크가 남아 있는지 확인한다.
- [x] 삭제 후 남은 구현 지식은 문서 기준으로만 참조한다.

완료 기준:

- `tech-tests/noita-webgpu`가 저장소에서 제거된다.
- WebGPU tech-test의 보존 대상은 `docs/noita-webgpu-tech-test-handoff.md`와 관련 분석 문서에 남아 있다.

## 1. 프로젝트 기반

- [ ] Vite + TypeScript scaffold를 추가한다.
- [ ] `package.json`, `tsconfig.json`, `vite.config.ts`를 만든다.
- [ ] `src/main.ts`와 app bootstrap 진입점을 만든다.
- [x] `src/app`, `src/runtime`, `src/core`, `src/render`, `src/ui`, `src/input`, `src/content`, `src/features`, `src/platform` 폴더를 만든다.
- [x] 코드 작성 전에 주요 폴더별 `AGNET.md` 책임 문서를 만든다.
- [x] LLM 유지보수와 빠른 기능 탐색을 위한 코드 파일 트리 계획을 문서화한다.
- [ ] 기본 `AppShell`을 만든다.
- [ ] 전투 패널과 인벤토리 패널의 responsive layout을 만든다.
- [ ] WebGPU canvas 생성, adapter/device/context 초기화, resize, DPR 제한 처리를 구현한다.
- [ ] WebGPU feature detection과 degraded mode 화면을 만든다.
- [ ] `GameRuntime`, `GameClock`, `CommandBus`, `EventBus` 골격을 만든다.
- [ ] runtime loop의 start, pause, resume, stop 흐름을 구현한다.

완료 기준:

- PC landscape, mobile landscape, mobile portrait에서 전투/인벤토리 패널이 깨지지 않는다.
- 빈 WebGPU canvas가 렌더링된다.
- runtime loop가 시작/정지 가능하다.
- TypeScript strict mode에서 타입 체크가 통과한다.

## 2. 상태, 명령, 이벤트 기반

- [ ] `GameState` 최소 구조를 정의한다.
- [ ] `SessionState`, `PlayerState`, `EntityState`, `InventoryState`, `ProgressionState`, `EnvironmentState`를 분리한다.
- [ ] `BattleFieldState` 또는 `SimulationState`에는 GPU resource가 아니라 field config, seed, active emitter, query request 같은 직렬화 가능한 데이터만 둔다.
- [ ] command 타입을 정의한다.
- [ ] command queue 처리 순서를 runtime에 고정한다.
- [ ] event 타입을 정의한다.
- [ ] event flush와 UI/view model publish 흐름을 만든다.
- [ ] render snapshot 생성 경계를 만든다.

핵심 command:

- [ ] `MovePlayer`
- [ ] `AimAt`
- [ ] `StartAttack`
- [ ] `StopAttack`
- [ ] `UseInventorySlot`
- [ ] `EquipItem`
- [ ] `MoveInventoryItem`
- [ ] `FuseItems`
- [ ] `SelectLevelUpReward`
- [ ] `BuyShopItem`
- [ ] `DismissModal`

완료 기준:

- UI와 input adapter가 `GameState`를 직접 수정하지 않는다.
- system update는 command와 event를 통해서만 외부와 연결된다.
- GPU simulation resource는 runtime/render 계층이 소유하고, CPU state에는 simulation 결과 요약만 반영된다.

## 3. WebGPU 전투 Field Vertical Slice

- [ ] player entity를 만든다.
- [ ] keyboard, pointer, touch 입력 adapter를 만든다.
- [ ] `InputMapper`에서 raw input을 command로 변환한다.
- [ ] player movement system을 만든다.
- [ ] 적 1종 definition과 spawn 흐름을 만든다.
- [ ] wave 없이 단일 spawn test mode를 만든다.
- [ ] WebGPU material grid를 전투 필드의 기본 substrate로 만든다.
- [ ] `air`, `staticTerrain`, `sand`, `water`, `fire`, `smoke`, `steam`, `spark`, `force`, `magicEnergy` 최소 재료군을 정의한다.
- [ ] player와 enemy hitbox를 field query 대상 entity로 등록한다.
- [ ] 기본 projectile 1종을 수치 탄환이 아니라 field emitter/trace로 만든다.
- [ ] 공격 입력이 projectile entity와 material/force emitter를 동시에 만든다.
- [ ] collision은 원형 거리 판정 단독이 아니라 projectile trace, material density, heat/fire/contact summary로 계산한다.
- [ ] 적 HP와 player HP는 field summary event로 변화한다.
- [ ] 간단한 HP bar를 렌더링한다.
- [ ] enemy killed, projectile despawn, cleanup 흐름을 만든다.
- [ ] CPU reference mini simulator를 만들어 작은 grid에서 GPU 결과와 비교한다.

완료 기준:

- PC는 키보드/마우스, 모바일은 터치로 이동과 공격이 가능하다.
- 공격이 fire/spark/force 같은 field 변화를 만들고, 그 변화가 적 피해로 이어진다.
- 물, 모래, 불, 연기, 증기가 전투 필드에서 자연스럽게 움직인다.
- 적 처치와 projectile/field emitter 정리가 안정적으로 동작한다.
- 작은 grid 기준 CPU reference와 GPU simulation 결과를 비교할 수 있다.

## 4. 아이템과 인벤토리

- [ ] item definition schema를 만든다.
- [ ] equipment slot, rarity, stat block을 정의한다.
- [ ] item factory와 equipment generator registry를 만든다.
- [ ] enemy death 후 item drop event를 만든다.
- [ ] item drop physics system을 만든다.
- [ ] pickup system을 만든다.
- [ ] inventory slots UI와 state를 연결한다.
- [ ] equipment slots UI와 state를 연결한다.
- [ ] 장착/해제 시 단순 공격력뿐 아니라 emitter 속성, material affinity, heat/cold/force 계수, field query 저항을 반영한다.
- [ ] hotbar 사용 흐름을 만든다.

완료 기준:

- 적 처치 후 아이템이 드랍되고 획득된다.
- 장비 장착/해제가 state와 UI에 반영된다.
- item factory와 simulation modifier 계산 단위 테스트가 있다.

## 5. 진행 시스템

- [ ] experience system을 만든다.
- [ ] level up threshold와 reward selection을 만든다.
- [ ] level up modal 또는 panel을 만든다.
- [ ] wave director를 만든다.
- [ ] enemy scaling system을 만든다.
- [ ] reward system을 만든다.
- [ ] save schema version을 정의한다.
- [ ] `serializeGameState`, `hydrateGameState`, `migrateSaveData`를 만든다.
- [ ] localStorage save/load를 연결한다.
- [ ] 기본 environment change event를 만든다.
- [ ] 웨이브/환경 변화가 material field seed, terrain, emitter rate, fluid/gas 상태를 바꾸도록 연결한다.

완료 기준:

- 새로고침 후 저장 데이터가 복원된다.
- 웨이브와 레벨업을 독립적으로 테스트할 수 있다.
- save migration 테스트가 있다.

## 6. 기준 게임 기능 이식

- [ ] 장비 generator를 확장한다.
- [ ] fusion preview, cost, result 계산을 만든다.
- [ ] skill tree state와 unlock 조건을 만든다.
- [ ] skill tree DOM UI를 만든다.
- [ ] shop inventory, reroll, purchase 흐름을 만든다.
- [ ] price, discount, coupon 계산을 만든다.
- [ ] boss와 miniboss pattern을 추가한다.
- [ ] debuff, buff, quiz revive 흐름을 이식한다.
- [ ] v1의 수치 기반 공격/스킬을 simulation emitter, material reaction, field query 기반 동작으로 재해석한다.
- [ ] 환경 특수 상호작용을 CPU modifier가 아니라 field terrain/material/reaction 변화 중심으로 만든다.

완료 기준:

- 기준 게임의 핵심 루프가 v2 구조에서 재현되되, 전투는 simulation-first 방식으로 동작한다.
- fusion, shop, skill tree, wave timeline 테스트가 있다.
- 기능별 수동 QA 체크리스트가 존재한다.

## 7. WebGPU 메인 전투 필드 시뮬레이션

초기 목표는 Noita-inspired material field를 전투 화면의 중심 gameplay substrate로 만드는 것이다. 렌더링 효과가 아니라 공격, 피격, 상태이상, 지형 변화, 환경 반응이 발생하는 전투 필드다.

- [ ] `src/platform/webgpuSupport.ts`를 만든다.
- [ ] WebGPU availability check와 failure reason을 정의한다.
- [ ] `src/features/combatField/CombatFieldTypes.ts`를 만든다.
- [ ] material enum, emitter, config type을 정의한다.
- [ ] field cell packing을 정의한다: material, life, aux, heat 또는 flags.
- [ ] entity hitbox, query request, query result, simulation event buffer 타입을 정의한다.
- [ ] `MaterialEmitterQueue.ts`를 만들고 typed array packing을 구현한다.
- [ ] emitter queue 단위 테스트를 만든다.
- [ ] `src/render/webgpu/combatField/CombatFieldGpu.ts`를 만든다.
- [ ] cell ping-pong buffer, params buffer, emitter buffer, bind group을 이식한다.
- [ ] `combatFieldMovement.wgsl`에서 powder/liquid/gas/fire movement pass를 구현한다.
- [ ] `combatFieldReaction.wgsl`에서 water/fire/steam, heat drying, density swap, force propagation을 구현한다.
- [ ] `combatFieldEntityQuery.wgsl`에서 entity hitbox별 material coverage와 damage/status summary를 만든다.
- [ ] `combatFieldRender.wgsl`에서 field를 직접 렌더링한다.
- [ ] `CombatFieldBloom.ts`와 bloom shader를 이식한다.
- [ ] `CombatFieldRenderer.ts`에서 simulation output과 battle visual을 같은 WebGPU pipeline에서 합성한다.
- [ ] DOM/WebGL/WebGPU stacking order를 고정한다.
- [ ] WebGPU canvas가 pointer event를 가로채지 않도록 한다.
- [ ] `CombatSystem`은 damage를 직접 확정하기보다 emitter와 query request를 발행한다.
- [ ] `CombatResolutionSystem`은 GPU query summary를 받아 HP, status, knockback, death event를 확정한다.
- [ ] `EnvironmentSystem`은 terrain/material seed, rain/wind/heat 같은 field 조건을 발행한다.
- [ ] WebGPU 미지원 시 CPU reference low-res simulation 또는 명시적 degraded mode로 진행한다.

완료 기준:

- WebGPU 지원 브라우저에서 fire, smoke, steam, water, sand, spark, force 계열이 전투 판정에 실제 영향을 준다.
- 같은 공격이라도 주변 물, 모래, 불, 연기 상태에 따라 결과가 달라진다.
- WebGPU 미지원 상태에서는 degraded mode가 명확히 표시되거나 low-res CPU reference로 최소 플레이가 가능하다.
- GPU grid 전체를 매 frame CPU로 readback하지 않는다.
- entity별 작은 query summary만 CPU gameplay state에 반영한다.
- UI/HUD가 bloom에 가려지지 않는다.

## 8. Material Interaction 확장

원작 전체 재현보다 전투 방식이 자연스럽게 바뀌는 재료 효과를 우선한다.

- [ ] 현재 최소 재료군을 registry fixture로 감싼다.
- [ ] `water`, `sand`, `smoke`, `fire`, `spark`, `staticTerrain`을 우선 지원한다.
- [ ] density와 simple liquid layering을 구현한다.
- [ ] water/fire/steam 반응을 분리한다.
- [ ] lava/water/rock 반응을 추가한다.
- [ ] acid/corrodible 반응을 추가한다.
- [ ] burnable terrain과 smoke generation을 추가한다.
- [ ] toxic sludge/water purification은 후순위로 둔다.
- [ ] magic liquid status effect는 entity sampling으로 제한한다.
- [ ] force/pressure field를 추가해 폭발, 밀치기, projectile trace가 물질을 변형하게 한다.
- [ ] heat field를 추가해 젖은 모래 건조, 물 증발, 불 확산, 얼음/냉기 반응의 기반으로 삼는다.
- [ ] field obstacle과 terrain destruction을 추가해 공격이 전장 형태를 바꾸게 한다.
- [ ] entity movement가 물, 모래, 연기, 불, terrain density의 영향을 받게 한다.

원작 지향 연구 작업:

- [ ] 원본 `materials.xml`은 저장소에 커밋하지 않는다.
- [ ] 작은 fixture XML로 parser 테스트를 만든다.
- [ ] material registry와 reaction table schema를 설계한다.
- [ ] CPU reference simulator를 먼저 만든다.
- [ ] GPU shader는 data-driven lookup 구조로 확장한다.
- [ ] movement, reaction, fire/heat, entity effect를 별도 pass로 분리한다.

완료 기준:

- CPU reference에서 sand pile, water pool, smoke rise, water/fire, lava/water 테스트가 통과한다.
- GPU 결과는 작은 grid fixture 기준으로 CPU reference와 비교 가능하다.
- 전투 결과는 field simulation summary와 CPU entity state의 결합으로 산출된다.
- v1식 고정 수치 공격보다 환경에 따라 결과가 달라지는 전투 사례가 3개 이상 존재한다.

## 9. 테스트와 검증

자동 테스트:

- [ ] command reducer
- [ ] stat 계산
- [ ] item factory
- [ ] fusion result
- [ ] wave timeline
- [ ] save migration
- [ ] price, discount, coupon 계산
- [ ] material emitter packing
- [ ] material CPU reference fixture
- [ ] combat field query summary
- [ ] simulation damage/status resolution
- [ ] GPU/CPU small-grid comparison

수동/브라우저 검증:

- [ ] desktop landscape
- [ ] mobile landscape
- [ ] mobile portrait
- [ ] GitHub Pages base path preview
- [ ] localStorage save/load
- [ ] canvas resize와 DPR
- [ ] touch input과 inventory drag 충돌 여부
- [ ] WebGPU 지원 브라우저 combat field simulation
- [ ] 물/불/모래/연기 상호작용이 전투 결과를 바꾸는지
- [ ] WebGPU 미지원 degraded mode 또는 CPU fallback

권장 도구:

- [ ] Vitest
- [ ] Playwright
- [ ] TypeScript strict mode

## 10. 배포

- [ ] Vite base path를 GitHub Pages 배포에 맞춘다.
- [ ] static asset 경로를 `platform/assets.ts`로 통일한다.
- [ ] shader와 이미지 asset 로딩 정책을 정리한다.
- [ ] GitHub Actions 배포 workflow를 점검한다.
- [ ] 공개 feed manifest 위치가 실제 공개 빌드와 맞는지 확인한다.

완료 기준:

- GitHub Pages preview에서 앱이 base path 문제 없이 실행된다.
- 저장, asset, shader 경로가 local과 Pages에서 모두 동작한다.
