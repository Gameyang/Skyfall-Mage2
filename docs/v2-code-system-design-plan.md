# Skyfall Mage TD v2 코드 시스템 설계 계획

작성일: 2026-05-28  
대상 프로젝트: `F:\Workspace\Skyfall-Mage2`  
기준 분석 문서: `docs/baseline-game-analysis.md`
관련 WebGPU handoff: `docs/noita-webgpu-tech-test-handoff.md`

## 1. 목표

v2는 기준 게임의 핵심 재미를 유지하되, 처음부터 확장 가능한 코드 시스템으로 다시 구성한다.

핵심 목표:

- GitHub Pages에서 정적으로 서빙되는 웹 게임
- 모바일과 PC 동시 지원
- 가로/세로 화면 자동 대응
- 전투 화면과 인벤토리 화면을 독립 패널로 구성
- WebGL2 전투 렌더링과 DOM UI의 책임 분리
- TypeScript 기반 타입 안정성 확보
- 아이템, 웨이브, 스킬, 상점 데이터를 코드와 분리해 장기 확장 가능하게 유지

기술 기본값:

- Build: Vite
- Language: TypeScript
- UI: HTML/CSS + TypeScript DOM 컴포넌트
- Rendering: WebGL2 Canvas
- Deploy: GitHub Pages 정적 배포
- Save: `localStorage` schema version + migration

## 2. 전체 아키텍처 원칙

v2는 기준 게임처럼 하나의 `GameState`와 전역 이벤트에 모든 기능을 몰아넣지 않는다. 각 시스템은 명확한 입력과 출력만 갖고, 런타임이 시스템 실행 순서를 조율한다.

설계 원칙:

- 게임 규칙과 화면 표현을 분리한다.
- UI는 게임 상태를 직접 수정하지 않고 command를 보낸다.
- 렌더러는 `GameState` 전체가 아니라 render snapshot만 읽는다.
- 저장 데이터는 런타임 상태 객체를 그대로 직렬화하지 않고 save schema로 변환한다.
- 데이터 정의는 TypeScript 타입으로 검증 가능한 형태로 둔다.
- 모바일/PC 입력은 같은 game command로 변환한다.

권장 데이터 흐름:

```text
Input Adapter
  -> Game Command
  -> Runtime Queue
  -> Core Systems update
  -> Game State
  -> Render Snapshot + UI View Model
  -> WebGL Renderer + DOM UI
```

## 3. 권장 폴더 구조

초기 구현 기준 폴더 구조는 아래처럼 잡는다.

```text
Skyfall-Mage2/
├── docs/
│   ├── baseline-game-analysis.md
│   └── v2-code-system-design-plan.md
├── public/
│   ├── assets/
│   │   ├── items/
│   │   ├── enemies/
│   │   ├── skins/
│   │   ├── audio/
│   │   └── shaders/
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── bootstrap.ts
│   │   ├── createApp.ts
│   │   └── config.ts
│   ├── runtime/
│   │   ├── GameRuntime.ts
│   │   ├── GameClock.ts
│   │   ├── CommandBus.ts
│   │   ├── EventBus.ts
│   │   └── SaveRuntime.ts
│   ├── core/
│   │   ├── state/
│   │   ├── systems/
│   │   ├── rules/
│   │   └── math/
│   ├── render/
│   │   ├── webgl/
│   │   ├── snapshots/
│   │   ├── shaders/
│   │   └── textures/
│   ├── ui/
│   │   ├── shell/
│   │   ├── panels/
│   │   ├── components/
│   │   ├── viewModels/
│   │   └── styles/
│   ├── input/
│   │   ├── KeyboardInput.ts
│   │   ├── PointerInput.ts
│   │   ├── TouchInput.ts
│   │   └── InputMapper.ts
│   ├── content/
│   │   ├── items/
│   │   ├── enemies/
│   │   ├── waves/
│   │   ├── skills/
│   │   └── shop/
│   ├── features/
│   │   ├── combat/
│   │   ├── inventory/
│   │   ├── equipment/
│   │   ├── progression/
│   │   ├── skillTree/
│   │   ├── shop/
│   │   └── environment/
│   ├── platform/
│   │   ├── assets.ts
│   │   ├── storage.ts
│   │   └── githubPages.ts
│   ├── tests/
│   ├── main.ts
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

역할 기준:

- `app`: 앱 조립, 환경 설정, 최초 bootstrap
- `runtime`: 루프, 명령 큐, 이벤트, 저장, pause/resume
- `core`: 순수 게임 상태와 공통 시스템
- `features`: 도메인별 구현체
- `render`: WebGL2 렌더링과 렌더 전용 데이터 변환
- `ui`: DOM UI, 패널, 컴포넌트, view model
- `input`: 키보드/마우스/터치 입력을 command로 변환
- `content`: 정적 게임 데이터와 content registry
- `platform`: 브라우저, asset path, GitHub Pages, storage 추상화

## 4. 핵심 타입과 상태 설계

### 4.1 GameState

`GameState`는 순수 데이터만 갖는다. 렌더러, DOM 요소, 컨트롤러 인스턴스 같은 객체 참조를 넣지 않는다.

최소 상태 그룹:

- `session`: pause, gameOver, elapsedMs, wave 상태
- `player`: 위치, 생명력, 마나, 레벨, 경험치, 이동/공격 상태
- `entities`: enemies, projectiles, itemDrops, allies
- `inventory`: 슬롯, 재화, 장착 장비
- `progression`: unlocks, skill tree, debuffs, buffs
- `environment`: 현재 환경, 전환 진행도, 환경별 gameplay modifier
- `rng`: seed 또는 난수 상태

예시 타입 방향:

```ts
export interface GameState {
  session: SessionState;
  player: PlayerState;
  entities: EntityState;
  inventory: InventoryState;
  progression: ProgressionState;
  environment: EnvironmentState;
}
```

### 4.2 Command

입력과 UI 액션은 모두 command로 변환한다.

주요 command:

- `MovePlayer`
- `AimAt`
- `StartAttack`
- `StopAttack`
- `UseInventorySlot`
- `EquipItem`
- `MoveInventoryItem`
- `FuseItems`
- `SelectLevelUpReward`
- `BuyShopItem`
- `DismissModal`

command는 런타임 큐에 들어가고, 시스템 업데이트 전에 처리한다.

### 4.3 Event

event는 시스템 간 알림용이다. 저장, UI 토스트, 사운드, 튜토리얼 표시처럼 핵심 상태 전이를 직접 일으키지 않는 후속 작업에 사용한다.

주요 event:

- `EnemyKilled`
- `ItemDropped`
- `ItemCollected`
- `InventoryChanged`
- `EquipmentChanged`
- `PlayerLevelUp`
- `WaveStarted`
- `WaveCleared`
- `EnvironmentChanged`
- `GameOver`

## 5. 런타임 설계

`GameRuntime`은 앱의 중심 실행기다.

책임:

- clock tick 계산
- command queue 처리
- core system update 순서 보장
- render snapshot 생성
- UI view model 생성
- save schedule 호출
- pause, resume, reset 제어

권장 update 순서:

1. 입력 command 수집
2. command reducer 처리
3. player/input system
4. wave/spawn system
5. combat system
6. projectile system
7. collision system
8. item drop physics system
9. inventory/equipment side effect 처리
10. progression/environment system
11. cleanup/despawn system
12. event flush
13. render snapshot 생성
14. UI view model publish

`GameClock` 정책:

- 렌더링은 `requestAnimationFrame`
- 시뮬레이션은 가변 timestep으로 시작하되 `dt` 상한을 둔다.
- 일시 정지, 모달, 탭 비활성화 시 update 정책을 명확히 둔다.
- 추후 밸런스 검증이 필요하면 fixed timestep 옵션을 추가한다.

## 6. 렌더링 시스템 설계

v2 렌더러는 `GameState`를 직접 읽지 않는다. `RenderSnapshot`만 읽는다.

렌더링 입력:

```ts
export interface RenderSnapshot {
  viewport: RenderViewport;
  world: WorldRenderData;
  player: SpriteRenderData;
  enemies: SpriteRenderData[];
  projectiles: ProjectileRenderData[];
  itemDrops: ItemDropRenderData[];
  effects: EffectRenderData[];
  environment: EnvironmentRenderData;
  hud: HudRenderData;
}
```

렌더러 구성:

- `RenderBackend`: WebGL2 기본 백엔드와 WebGPU 선택 백엔드 선택
- `WebGLRenderer`: 전체 orchestration
- `WebGPUMaterialRenderer`: Noita-inspired material field 같은 compute 기반 고급 이펙트
- `LayerRenderer`: 하늘, 배경, 물
- `SpriteBatchRenderer`: 플레이어, 적, 아이템
- `ProjectileRenderer`: 투사체
- `EffectRenderer`: 파티클과 특수 효과
- `HudRenderer`: WebGL 위에 그리는 전투 HUD
- `TextureAtlas`: 아이템/스킨/적 텍스처 캐시
- `ShaderLoader`: Vite 환경에 맞춘 shader 로딩

기준 게임에서 재사용 후보:

- `WaterSimulation`
- 일부 shader
- sprite renderer 개념
- chain lightning, ice tornado 등 특수 renderer 알고리즘

재설계할 부분:

- `UnifiedRenderer`가 `gameState`를 직접 읽는 방식
- 렌더링과 게임 canvas bounds 계산이 뒤섞인 방식
- DPR 대응 부재

WebGPU는 필수 렌더링 경로가 아니라 고급 전투 이펙트 검증/가속 경로로 둔다. GitHub Pages HTTPS 환경에서는 WebGPU를 사용할 수 있으나, 브라우저 지원 차이를 고려해 정식 게임은 WebGL2 기본 렌더러를 유지한다.

## 7. UI와 반응형 패널 설계

v2 화면은 `AppShell`이 전투 패널과 인벤토리 패널을 배치한다.

주요 UI 영역:

- `BattlePanel`: WebGL canvas, 전투 HUD, 모바일 전투 입력 overlay
- `InventoryPanel`: 장비, 인벤토리, 상세 정보, 합성 UI
- `ProgressPanel`: 레벨, HP/MP, 버프/디버프, 웨이브
- `TabPanel`: 스킬트리, 상점, 설정
- `ModalLayer`: 레벨업, 게임오버, 퀴즈, 확인 대화상자
- `ToastLayer`

반응형 정책:

- PC landscape: 좌측 전투, 우측 인벤토리/탭 패널
- Mobile landscape: 전투 영역 우선, 인벤토리는 축약 패널 또는 drawer
- Mobile portrait: 상단 전투, 하단 인벤토리 패널
- 작은 화면: 인벤토리 상세 정보는 modal/drawer로 표시

CSS 원칙:

- `zoom` 사용 금지
- `grid`, `flex`, `clamp`, `minmax`, `aspect-ratio` 사용
- 전투 캔버스는 패널 크기에 맞춰 resize
- 버튼/슬롯/툴바는 고정 터치 목표 크기 확보
- UI 텍스트가 슬롯/버튼 밖으로 넘치지 않도록 min-width와 overflow 정책 지정

## 8. 입력 시스템 설계

입력은 장치별 adapter와 공통 mapper로 나눈다.

구성:

- `KeyboardInput`: WASD, 방향키, Space, 숫자 hotbar
- `PointerInput`: 마우스 이동, 클릭, 홀드, 드래그
- `TouchInput`: 터치 이동, 조준, 공격, 인벤토리 드래그
- `InputMapper`: raw input을 command로 변환

정책:

- 전투 패널 입력과 UI 패널 입력을 명확히 분리한다.
- 모바일에서는 전투 이동/조준 제스처와 인벤토리 드래그가 충돌하지 않아야 한다.
- 캔버스 좌표 변환은 `ViewportMapper` 하나에서 처리한다.
- 장치별 입력은 게임 상태를 직접 바꾸지 않는다.

## 9. 콘텐츠와 데이터 설계

정적 데이터는 `content` 아래에 둔다. 데이터는 registry를 통해 접근한다.

주요 registry:

- `ItemRegistry`
- `EquipmentGeneratorRegistry`
- `EnemyPatternRegistry`
- `WaveRegistry`
- `SkillRegistry`
- `ShopRegistry`
- `EnvironmentRuleRegistry`

데이터 원칙:

- 데이터 파일은 가능한 JSON 또는 순수 TS object로 둔다.
- 런타임 객체 생성은 registry/factory에서 담당한다.
- 아이템 효과, 상점 효과, 스킬 효과는 string switch 대신 handler registry로 분리한다.
- 데이터 schema version을 둔다.

예시:

```ts
export interface EquipmentDefinition {
  id: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  baseStats: StatBlock;
  generatorId: string;
  iconId: string;
}
```

## 10. 주요 기능별 시스템 경계

### 10.1 전투

구성:

- `AttackSystem`: 공격 가능 여부, 마나/쿨다운 계산
- `ProjectileSystem`: 투사체 이동과 수명
- `HitSystem`: 충돌 결과와 피해 계산
- `EffectSystem`: 전투 효과 생성 이벤트
- `WeaponBehaviorRegistry`: 무기별 공격 생성 로직

기준 게임의 weapon generator 개념은 유지하되, generator는 projectile 생성 데이터만 반환하도록 제한한다.

### 10.2 웨이브와 적

구성:

- `WaveDirector`: 웨이브 timeline 진행
- `SpawnSystem`: spawn request를 enemy entity로 변환
- `EnemyBehaviorSystem`: 패턴별 이동/행동
- `EnemyScalingSystem`: 진행도 기반 HP/속도 조정
- `RewardSystem`: 사망 보상, 보스 보상

`EnemySpawner` 하나가 모든 일을 처리하던 구조를 나눈다.

### 10.3 아이템과 인벤토리

구성:

- `ItemDropPhysicsSystem`: 드랍 아이템 낙하/물/환경 상호작용
- `PickupSystem`: 획득 판정
- `InventorySystem`: 슬롯, stack, 이동, 사용
- `EquipmentSystem`: 장착/해제, 스탯 계산
- `FusionSystem`: 합성 후보/비용/결과
- `CurrencySystem`: 코인/보석 등 재화

UI는 inventory state를 표시하고 command만 보낸다.

### 10.4 진행과 스킬트리

구성:

- `ExperienceSystem`
- `LevelUpSystem`
- `DebuffSystem`
- `UnlockSystem`
- `SkillTreeSystem`

스킬트리는 v1의 폴더 탐색/해금/활성화 개념을 유지하되, 상태와 UI를 분리한다.

### 10.5 상점

구성:

- `ShopSystem`: 진열, 리롤, 재고
- `PurchaseSystem`: 가격, 할인, 쿠폰, 재화 차감
- `ShopEffectRegistry`: 구매 효과 처리
- `ShopUserState`: 회원권/쿠폰/시즌패스

상점 UI는 현재 진열 view model만 렌더링한다.

### 10.6 환경

구성:

- `EnvironmentSystem`: 현재 환경과 전환
- `ElementModifierSystem`: 원소 배율
- `WeatherInteractionSystem`: 물, 눈, 용암, 동결, 아이템 상호작용
- `EnvironmentRenderAdapter`: 렌더 snapshot 변환

환경은 gameplay modifier와 visual state를 분리한다.

### 10.7 Material particle 이펙트

구성:

- `MaterialFieldSystem`: CPU gameplay/environment event를 material emitter로 변환
- `MaterialEmitterQueue`: fire, water, sand, wet sand, smoke, steam, spark, explosion emitter packing
- `MaterialInteractionSystem`: density, water pooling, sand-water absorption, wet sand spread, fire/smoke/steam 규칙
- `WebGPUMaterialBackend`: compute shader 기반 grid update와 render
- `MaterialFieldBloom`: `rgba16float` scene texture와 bloom 후처리

이 시스템은 전투 판정 엔진이 아니라 비주얼/환경 이펙트 레이어로 제한한다. 플레이어 피격, 투사체 명중, 적 충돌 같은 판정은 기존 core combat system이 담당한다.

`tech-tests/noita-webgpu`는 정식 구현 전용 코드가 아니므로 삭제 준비 대상으로 둔다. 이식할 세부 구현은 `docs/noita-webgpu-tech-test-handoff.md`를 기준으로 하며, top slot hub, standalone page, debug terrain은 정식 게임에 포함하지 않는다.

## 11. 저장 시스템 설계

저장은 runtime state를 직접 저장하지 않고 `SaveData`로 변환한다.

저장 대상:

- save version
- player progression
- inventory slots
- equipment
- unlocks
- skill tree state
- current wave/session checkpoint
- settings

저장하지 않을 것:

- 렌더러 객체
- DOM/UI 상태
- texture/cache
- 현재 프레임의 transient effect
- 계산 가능한 derived stats

필수 함수:

- `createNewSave()`
- `serializeGameState(state): SaveData`
- `hydrateGameState(save): GameState`
- `migrateSaveData(raw): SaveData`
- `clearSave(profileId?)`

## 12. GitHub Pages 배포 설계

Vite 설정:

- `base`는 repository name 배포를 고려해 환경 변수로 설정 가능하게 둔다.
- 빌드 산출물은 `dist/`
- shader와 대량 이미지 자산은 `public/assets` 기준으로 관리한다.
- 앱 내부 asset URL은 `platform/assets.ts`에서 생성한다.

필수 npm scripts:

```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "typecheck": "tsc --noEmit"
}
```

## 13. 초기 구현 순서

### Phase 1: 프로젝트 기반

- Vite + TypeScript scaffold
- 기본 `AppShell`
- responsive battle/inventory two-panel layout
- `GameRuntime`, `GameClock`, `CommandBus` 골격
- WebGL canvas resize와 DPR 대응

완료 기준:

- PC/모바일 viewport에서 전투 패널과 인벤토리 패널이 깨지지 않는다.
- 빈 WebGL canvas가 렌더링된다.
- runtime loop가 시작/정지 가능하다.

### Phase 2: 전투 vertical slice

- player entity
- keyboard/pointer/touch 입력 command
- 이동 system
- 적 1종 spawn
- 기본 projectile 1종
- 충돌과 피해
- 간단한 HP bar

완료 기준:

- PC는 키보드/마우스, 모바일은 터치로 플레이어 조작과 공격이 가능하다.
- 적 처치와 projectile 제거가 안정적으로 동작한다.

### Phase 3: 아이템과 인벤토리

- 아이템 definition
- 드랍 아이템 물리
- pickup
- inventory slots
- equipment slots
- 장착 스탯 반영
- hotbar

완료 기준:

- 적 처치 후 아이템이 드랍되고 획득된다.
- 장비 장착/해제가 state와 UI에 반영된다.

### Phase 4: 진행 시스템

- 경험치와 레벨업
- 레벨업 보상 선택
- 웨이브 director
- 저장/불러오기
- 기본 환경 변화

완료 기준:

- 새로고침 후 저장 데이터가 복원된다.
- 웨이브와 레벨업이 독립적으로 테스트 가능하다.

### Phase 5: 기준 게임 기능 이식

- 장비 generator 확장
- 합성
- 스킬트리
- 상점
- 보스/미니보스 패턴
- 환경 특수 상호작용
- WebGPU material particle 이펙트 선택 적용
- 퀴즈 부활

완료 기준:

- 기준 게임의 핵심 루프를 v2 구조 위에서 재현한다.
- 기능별 테스트와 수동 QA 체크리스트가 존재한다.

## 14. 테스트 계획

초기부터 자동 테스트와 수동 viewport 검증을 같이 둔다.

자동 테스트:

- command reducer
- stat 계산
- item factory
- fusion result
- wave timeline
- save migration
- price/discount/coupon 계산

수동 테스트:

- desktop landscape
- mobile landscape
- mobile portrait
- GitHub Pages base path preview
- localStorage save/load
- canvas resize/DPR
- 터치 입력과 인벤토리 드래그 충돌 여부

권장 도구:

- Vitest: 순수 로직 테스트
- Playwright: viewport/screenshot/입력 흐름 테스트
- TypeScript strict mode: schema와 command 타입 검증

## 15. 결정된 기본값

- v2는 `Vite + TypeScript`로 시작한다.
- 첫 화면은 랜딩 페이지가 아니라 실제 게임 화면이다.
- 전투와 인벤토리는 항상 독립 패널로 존재하며, 화면 방향에 따라 배치만 바뀐다.
- WebGL2는 전투 렌더링에 집중하고, 인벤토리/상점/스킬트리는 DOM UI로 구현한다.
- WebGPU는 Noita-inspired material field 같은 고급 이펙트용 선택 백엔드로 사용하며, 실패해도 게임 본체를 중단하지 않는다.
- `GameState`에는 시스템 인스턴스와 DOM 참조를 넣지 않는다.
- UI와 입력은 state를 직접 변경하지 않고 command를 보낸다.
- 저장은 versioned save schema를 사용한다.
- 기준 게임 코드는 복사보다 개념/알고리즘 이식을 우선한다.
