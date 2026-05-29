# Skyfall Mage TD 기준 게임 상세 분석

작성일: 2026-05-28  
기준 프로젝트: `F:\Workspace\Skyfall-Mage-TD`  
대상 프로젝트: `F:\Workspace\Skyfall-Mage2`

## 1. 분석 요약

기준 게임은 WebGL2 렌더링, Vanilla JavaScript ES module, HTML/CSS UI를 직접 조합한 사이드뷰 액션 타워 디펜스 게임이다. 전투 화면은 WebGL2 단일 캔버스가 담당하고, 인벤토리/장비/스킬트리/상점은 DOM 기반 우측 패널에서 동작한다.

현재 구조는 프로토타입 기능 확장에는 강하지만, v2에서 모바일/PC 동시 지원과 가로/세로 자동 대응을 목표로 삼으려면 화면 레이아웃, 입력 계층, 게임 상태 경계, 시스템 초기화 방식을 다시 잡는 것이 필요하다. 특히 현재는 `1600x900` 고정 컨테이너를 `zoom`으로 축소하는 구조라 모바일 세로 화면과 GitHub Pages 정적 배포용 라우팅/자산 경로를 명확히 분리해야 한다.

이번 문서는 구현 설계가 아니라 기준 게임 분석이다. v2 기술 선택은 이후 설계 단계에서 `Vite + TypeScript`를 기본 전제로 이어가면 좋다.

## 2. 실행 및 배포 구조

기준 프로젝트는 별도 번들 빌드 없이 `src/index.html`을 정적 서버에서 직접 여는 구조다.

- 진입점: `src/index.html`
- 메인 모듈: `src/main.js`
- 실행 방식: 프로젝트 루트에서 `python -m http.server 3000` 또는 유사 정적 서버 실행 후 `/src/index.html` 접속
- `package.json`: 실제 앱 실행 스크립트는 없고 이미지 처리용 `process-skins`, `trim-images`만 존재
- 모듈 방식: `<script src="./main.js" type="module"></script>`와 상대 경로 import
- 런타임 데이터 로딩: `fetch('./data/enemyWaves.json')`, 셰이더 로딩 `./renderer/shaders/*.glsl`
- 저장소 상태: 기준 프로젝트와 v2 프로젝트 모두 현재 git 변경 없음으로 확인됨

GitHub Pages 정적 서빙 관점에서는 상대 경로 기반이라 기본 호환성은 있다. 다만 현재 앱 URL이 `/src/index.html`인 점, 패치노트/셰이더/이미지 경로가 현재 문서 위치를 기준으로 묶여 있는 점, 빌드 산출물 디렉터리가 없다는 점은 v2에서 정리해야 한다.

## 3. 게임 구성과 핵심 루프

### 3.1 초기화 흐름

`src/main.js`의 `DOMContentLoaded`에서 전체 게임이 시작된다.

1. 버전 mismatch 시 `localStorage`의 `skyfall*`, `shopUserState` 관련 데이터를 초기화
2. `updateGameScale()`로 `1600x900` 기준 컨테이너를 현재 창에 맞춰 `zoom` 조정
3. 드래그 방지, 로딩 화면, 가이드 오버레이, 탭 시스템, 스킬트리 UI 초기화
4. `initializeGame({ gameContainer, gameCanvas })` 호출
5. 정보 모달, 입력/인벤토리/BGM 이벤트 핸들러, 디버그 명령어 등록
6. 상점 컨트롤러 초기화
7. `renderer.start(gameState)`와 `requestAnimationFrame(gameLoop)` 시작

중요한 관찰점은 렌더링 루프와 게임 업데이트 루프가 분리되어 각각 `requestAnimationFrame`을 돈다는 점이다. v2에서는 렌더와 시뮬레이션을 하나의 런타임 스케줄러에서 조율하거나, 최소한 고정/가변 timestep 정책을 명확히 분리하는 편이 좋다.

### 3.2 게임 상태

`src/game/GameState.js`는 플레이어, 적, 투사체, 아이템 드랍, 동료, 환경, 저장/부활/레벨/디버프까지 대부분의 상태를 한 객체에 모은다.

주요 상태:

- `player`: 위치, 속도, HP/MP/EXP/레벨, 장비, 해금 아이템, 버프/디버프, 장비 보너스
- `enemies`, `projectiles`, `itemDrops`, `allies`
- `canvasBounds`: 렌더러가 계산한 하늘/물/화면 영역
- 시스템 참조: `renderer`, `equipment`, `inventory`, `enemySpawner`, `itemDropManager`, `projectileManager`, `environmentSystem`
- 진행 상태: `paused`, `gameOver`, `timeScale`, `savedWave`, `revivalWave`

장점은 기능 연결이 빠르다는 점이다. 단점은 각 시스템이 `GameState` 내부 구조에 직접 의존해서 변경 범위가 커지고, 테스트 가능한 순수 로직 단위가 적어진다는 점이다.

## 4. 화면 및 UI 구조

### 4.1 현재 레이아웃

`src/index.html`은 하나의 `.game-container` 안에 전투 영역과 UI 패널을 둔다.

- `.game-play-area`: WebGL2 캔버스, 데미지 플래시, 웨이브 안내
- `.ui-panel`: 플레이어 상태, 탭 패널
- 탭: 인벤토리, 스킬트리, 상점, 잠금 placeholder
- 모달: 타이틀/패치노트, 게임오버 퀴즈, 레벨업 보상 선택

CSS 구조는 `src/styles/game.css`가 모듈 CSS를 import하고, UI 공통 스타일은 `src/ui/styles`에 있다.

현재 레이아웃 핵심:

- `body`: `100vw/100vh`, `overflow: hidden`, 중앙 정렬
- `.game-container`: `width: 1600px`, `height: 900px`, `display: flex`, `zoom`으로 스케일링
- `.game-play-area`: `flex: 7`
- `.ui-panel`: `flex: 3`

### 4.2 모바일/PC 대응 관점의 한계

현재 방식은 PC 가로 화면에서는 빠르게 맞출 수 있지만, 다음 문제가 있다.

- 모바일 세로 화면에서 전투와 인벤토리 패널을 자연스럽게 배치하기 어렵다.
- CSS `zoom`은 브라우저별 차이가 있고 좌표계, 툴팁, 포인터 이벤트 계산을 어렵게 만든다.
- 전투 캔버스와 UI 패널 비율이 하나로 고정되어 있어 세로/가로 전환 정책이 없다.
- 입력은 마우스/키보드 중심이며 터치 이동, 터치 조준, 모바일 드래그 정책이 별도 계층으로 분리되어 있지 않다.

v2에서 모바일과 PC를 동시에 지원하려면 `battle panel`과 `inventory panel`을 독립적인 responsive layout region으로 두고, 화면 방향에 따라 `side-by-side`, `stacked`, `overlay drawer` 같은 배치 정책을 명확히 정해야 한다.

## 5. 주요 시스템 분석

### 5.1 렌더링

핵심 파일은 `src/renderer/UnifiedRenderer.js`다. WebGL2 컨텍스트를 만들고 여러 하위 렌더러와 셰이더를 관리한다.

포함 기능:

- 배경 레이어: 하늘, 별, ambient particles
- 물 시뮬레이션: `WaterSimulation`, splash/ripple
- 스프라이트 렌더링: 플레이어, 적, 드랍 아이템, 동료
- 전투 효과: 파티클, 눈, 체인 라이트닝, 번개, 아이스 토네이도, 선더 대시
- HUD 렌더링: HP bar, 상태 바
- 환경 효과: 비/눈/안개/용암, 수증기, 동결 아이템 overlay
- 아이템/스킨 텍스처 캐시

강점:

- WebGL2 효과가 풍부하고 렌더링 기능이 모듈 파일로 많이 분리되어 있다.
- 셰이더와 렌더러가 기능별로 나뉘어 있어 v2에서 일부 재사용 가능하다.

주의점:

- `UnifiedRenderer`가 배경, 엔티티, 아이템, 환경, HUD까지 모두 orchestration한다.
- 렌더링 데이터 모델이 명확한 DTO로 분리되지 않아 `gameState` 내부 구조에 깊게 의존한다.
- 캔버스 크기는 DOM client size에서 직접 가져오며, DPR/device scale 정책은 별도로 드러나지 않는다.

### 5.2 입력

핵심 파일은 `src/game/InputHandler.js`다.

지원 입력:

- 키보드: WASD, 방향키, Space
- 마우스: down/up/move/leave 기반 홀드 공격
- 방향키 더블탭 질주
- 캔버스 좌표 변환: `canvas.getBoundingClientRect()`와 canvas 내부 해상도 비율 사용

모바일 터치 입력은 현재 핵심 경로에 없다. v2에서는 입력을 `keyboard`, `pointer`, `touch`, `virtual controls`로 분리하고, 전투 좌표 변환을 공통 adapter에서 처리하는 것이 필요하다.

### 5.3 전투

핵심 파일은 `src/combat/AttackSystem.js`, `src/combat/ProjectileManager.js`, `src/combat/EffectManager.js`다.

`AttackSystem`은 장착 무기를 읽고 마나/쿨다운/공격 방향을 계산한 뒤 무기 generator에 투사체 생성을 위임한다.

특징:

- 무기별 generator 인스턴스 캐시
- 마우스 클릭, 마우스 홀드, Space 자동 공격 처리
- `ice_tornado` 같은 차징/채널링 무기 지원
- 마나 소모와 일부 장비 효과 연동
- 생성된 투사체는 `gameState.projectiles` 또는 `gameState.blizzardClouds`에 직접 추가

재사용 후보는 무기 generator의 아이디어와 스킬 context다. v2에서는 공격 입력, 자원 소모, projectile 생성, hit resolution을 더 분리하면 테스트와 밸런싱이 쉬워진다.

### 5.4 적과 웨이브

핵심 파일:

- `src/game/EnemySpawner.js`
- `src/game/EnemyWaveController.js`
- `src/game/enemyPatterns/*`
- `src/data/enemyWaves.json`

현재 웨이브는 JSON timeline 기반이며, `patternId`를 통해 패턴 객체를 생성한다. 일반 적, 미니 보스, 보스 패턴이 같은 spawner 흐름 안에 들어 있다.

특징:

- `enemyWaves.json`의 `cycleMs`, `waves`, `timeline`
- `patternId: "random"` 또는 구체 패턴 ID 사용
- 스폰 방향 변환 지원: left/right/up/down 방향에 맞춰 local/world transform
- 진행도 기반 max enemy, HP, speed scaling
- 보스 처치 보상, 분열 보스 후속 생성, 보스 그룹 보상 처리

좋은 점은 패턴이 파일 단위로 분리되어 확장 가능하다는 점이다. 다만 spawner가 스폰, 진행 스케일링, 충돌, 사망 보상, 보스 보상, 플레이어 피해까지 함께 처리한다. v2에서는 `WaveDirector`, `EnemyRuntime`, `CollisionSystem`, `RewardSystem` 경계를 나누는 편이 좋다.

### 5.5 아이템, 장비, 드랍

핵심 파일:

- `src/items/itemDropManager.js`
- `src/items/itemFactory.js`
- `src/items/itemRoller.js`
- `src/items/generators/**`
- `src/data/equipmentData.js`
- `src/ui/inventory/inventoryController.js`
- `src/ui/inventory/FusionManager.js`

현재 아이템은 크게 장비, 소모품, 재화, 퀘스트, 스킨, 스킬 드랍, 동료 소환 아이템으로 나뉜다.

장비는 generator 기반으로 생성된다. `equipmentData.js`가 각 generator 인스턴스를 모으고, `createItemFromGenerator(generatorKey, options)`를 제공한다.

드랍 시스템 특징:

- 적 위치 기준 아이템 생성
- 중력/물/부력/동결/돌고래/물고기 배 등과 상호작용
- 코인, 장비, 소모품, 스킬 포인트, 스킬 북, 스킨, 동료 소환 아이템 드랍
- 보스 보상 profile과 특수 드랍 처리

인벤토리 특징:

- 20 슬롯 DOM grid
- 포인터 드래그, 장비 슬롯 드랍, 전투 화면으로 드랍 시 삭제
- 1-5 hotbar 사용
- 툴팁 비교, 퀘스트 진행 표시, 쿨다운 overlay
- 재화 관리와 합성 매니저 포함

합성 특징:

- 같은 장비가 가로/세로 3개 이상 이어지면 합성 후보
- 3개는 tier +1, 4개는 +1~2, 5개 이상은 +1~3
- 등급이 섞이면 실패 확률 발생
- 코인 비용이 있고, 실패 시 일부 재료 소모

아이템 시스템은 v2의 핵심 재미로 계승 가치가 높다. 단, DOM 인벤토리와 게임 물리 드랍이 서로 직접 참조하는 부분은 새 구조에서 adapter로 분리하는 것이 좋다.

### 5.6 스킬트리

핵심 파일:

- `src/skilltree/SkillTreeManager.js`
- `src/ui/components/SkillTreeUI.js`
- `src/data/skillTreeData.js`
- `src/game/skillTreeUpdater.js`

`SkillTreeManager`는 싱글톤이며 localStorage에 상태를 저장한다.

특징:

- 스킬 포인트 관리
- 해금 스킬과 활성화 스킬 분리
- 기본 해금 스킬 자동 보장
- 신규 스킬 표시
- 폴더/브레드크럼 기반 탐색
- 활성화 스킬의 총 스탯 계산
- 스킬 데이터 버전이 바뀌면 저장 데이터 초기화

스킬 데이터가 매우 크고 정적 JS 파일로 들어 있다. v2에서는 데이터 파일을 JSON/TS data module로 나눠 타입 검증을 적용하는 편이 안전하다.

### 5.7 상점

핵심 파일:

- `src/ui/shop/ShopController.js`
- `src/ui/shop/ShopUserState.js`
- `src/data/shopData.js`

상점은 3분 리롤 타이머와 수동 리롤을 지원한다. 상품군은 무기, 장비, 스킬북/스킬포인트, 물약, 스킨, 동료, 코인-보석 교환으로 나뉜다.

특징:

- 카테고리별 고정 비율 선별
- 가중치 기반 랜덤 선택
- 할인, 무료 쿠폰, 회원권, 시즌패스 상태 연동
- 구매 효과는 `effect.type` switch로 처리
- 장비 구매는 generator를 통해 실제 아이템 생성

상점의 데이터 주도 접근은 v2에 계승할 만하다. 다만 구매 효과 switch가 커져 있어 v2에서는 effect handler registry로 분리하는 것이 적합하다.

### 5.8 저장과 진행

핵심 파일은 `src/game/saveSystem.js`다.

저장 대상:

- 플레이어 레벨/경험치/스킨/HP/MP/base HP/MP/디버프/해금 아이템
- 현재 웨이브
- 인벤토리
- 장착 장비

저장 방식:

- `localStorage`
- 기본 key: `skyfall-mage-save-v1`
- profile query가 있으면 `skyfall-mage-save-v1:{profile}`
- 이벤트 기반 저장 예약: inventory, equipment, debuff, level/exp, unlock, wave start
- `beforeunload` 시 즉시 저장

v2에서는 저장 schema version을 TypeScript 타입과 migration 함수로 명확히 관리하는 것이 필요하다. GitHub Pages 정적 게임에서는 localStorage 유지가 현실적인 기본값이다.

### 5.9 환경 효과

핵심 파일:

- `src/environment/EnvironmentSystem.js`
- `src/environment/EnvironmentParticleSystem.js`
- `src/ui/EnvironmentIndicator.js`

환경 타입:

- clear
- rain
- snow
- fog, 실제 컨셉은 용암 지역으로 재해석됨

환경은 레벨업 시 확률적으로 변경된다. 원소별 배율도 있다.

- rain: lightning 강화, ice 약화, 수위 상승
- snow: ice 강화, fire 약화, 물에 빠진 아이템 동결
- fog/lava: fire 강화, lightning 약화, 수면 하강/용암/수증기/아이템 상승

환경 시스템은 게임의 차별점이지만, 드랍 물리와 렌더러에 직접 영향을 많이 준다. v2에서는 환경을 `gameplay modifier`, `visual state`, `item interaction rule`로 나누면 확장성이 좋아진다.

### 5.10 레벨업, 디버프, 퀴즈 부활

레벨업은 경험치 획득 후 요구량을 넘으면 발생하며, 보상 선택과 디버프 누적 구조가 있다. 게임오버 시 퀴즈 부활도 있다.

관련 파일:

- `src/game/LevelUpManager.js`
- `src/game/QuizManager.js`
- `src/data/gameOverQuizQuestions.csv`
- `src/ui/components/BuffBookmarkUI.js`
- `src/ui/components/DebuffBookmarkUI.js`

현재 구조는 이벤트와 DOM 모달이 강하게 결합되어 있다. v2에서는 progression logic과 presentation modal을 분리해야 모바일 UI 재배치가 쉬워진다.

## 6. 코드 폴더 구조 분석

기준 프로젝트의 `src` 아래 주요 구조와 파일 수는 다음과 같다.

| 경로 | 파일 수 | 역할 |
| --- | ---: | --- |
| `src/analytics` | 3 | 전투 이상 탐지와 리포트 |
| `src/assets` | 824 | 아이템, 적, 스킨, BGM 등 정적 자산 |
| `src/audio` | 1 | BGM 관리 |
| `src/combat` | 8 | 공격, 투사체, 전투 효과, 옵션 처리 |
| `src/data` | 46 | 웨이브, 밸런스, 장비, 상점, 스킬트리 데이터 |
| `src/effects` | 8 | 사망 연출, 눈/빙결/화염 등 게임 이펙트 |
| `src/engine` | 5 | 샌드박스성 runtime, rng, projectile/target 유틸 |
| `src/environment` | 2 | 환경 상태와 환경 파티클 |
| `src/game` | 46 | 게임 상태, 루프, 입력, 스폰, 보스, 저장, 레벨업 |
| `src/items` | 47 | 아이템 생성, 드랍, 옵션, generator, 동료/특수 아이템 |
| `src/particles` | 1 | 전투 파티클 |
| `src/patchNotes` | 14 | 패치노트와 스크린샷 |
| `src/renderer` | 61 | WebGL2 렌더러, 셰이더, 렌더 모듈 |
| `src/skilltree` | 6 | 스킬트리 상태와 노드 타입 |
| `src/styles` | 17 | 게임 화면 CSS와 모듈 CSS |
| `src/ui` | 42 | DOM UI 컴포넌트, 인벤토리, 상점, 유틸, UI 효과 |
| `src/utils` | 4 | 로딩, 디버그 명령, 텍스처, 스킨 관리 |

루트 레벨 구조는 다음 성격으로 나뉜다.

- `src`: 실제 게임
- `docs`: 기존 설계/기능 문서와 devlog
- `simulation`: 밸런스 분석, 리포트, 시각화 Python 도구
- `scripts`: 이미지 처리, 스킨 manifest 생성, 개발 서버 보조 도구
- `sandbox`: 별도 실험/검증용 페이지
- `thumbs`: README/홍보용 이미지
- `dist-skills`, `.claude`: 개발 보조 산출물

v2에서 그대로 가져가기 좋은 구획:

- `renderer`의 일부 WebGL2 하위 렌더러와 셰이더
- `items/generators`의 장비 generator 아이디어
- `game/enemyPatterns`의 패턴 분리 방식
- `data` 기반 웨이브/상점/밸런스 설정
- `simulation`의 밸런스 분석 도구 컨셉

v2에서 재구조화가 필요한 구획:

- `GameState` 중심 전역 mutable 상태
- DOM 이벤트와 게임 로직이 직접 얽힌 UI 컴포넌트
- `EnemySpawner`에 모인 스폰/충돌/보상/보스 처리
- `UnifiedRenderer`의 과도한 orchestration
- 입력 처리의 마우스/키보드 편중
- CSS `zoom` 기반 고정 해상도 레이아웃

## 7. v2 관점 핵심 리스크

### 7.1 화면 방향 대응

현재는 고정 16:9 화면을 축소한다. v2 요구사항은 모바일/PC와 가로/세로 자동 대응이므로, 전투 화면과 인벤토리 화면을 두 패널로 모델링해야 한다.

문서화할 후속 설계 쟁점:

- 가로 화면: 전투 좌측/인벤토리 우측
- 세로 화면: 전투 상단/인벤토리 하단 또는 인벤토리 drawer
- PC 넓은 화면: 전투 중심 + 우측 정보/인벤토리 패널
- 모바일 조작: 전투 패널 터치와 인벤토리 조작이 충돌하지 않도록 입력 영역 분리

### 7.2 정적 배포

GitHub Pages를 목표로 하면 v2는 다음을 초기에 확정해야 한다.

- base path 처리
- asset URL 생성 규칙
- 빌드 산출물 위치
- 캐시 무효화 방식
- localStorage save schema migration

`Vite + TypeScript`를 쓰면 `base` 설정과 asset import가 정리되지만, WebGL shader와 대량 이미지 로딩 경로 정책을 별도로 정해야 한다.

### 7.3 시스템 경계

현재 기준 게임은 기능 추가가 빠른 대신, 시스템 간 직접 참조가 많다.

대표 예:

- `GameState`가 시스템 객체 참조를 보유
- UI가 `window.dispatchEvent`와 전역 싱글톤에 의존
- 렌더러가 `gameState` 내부 배열과 환경 상태를 직접 읽음
- 스폰 시스템이 충돌/사망/보상까지 담당

v2는 처음부터 다음 계층을 분리하는 것이 좋다.

- `core`: 순수 게임 상태, 규칙, reducer/system
- `runtime`: loop, clock, save, event bus
- `render`: WebGL scene renderer
- `ui`: DOM 또는 component UI
- `input`: keyboard/pointer/touch adapter
- `content`: data, item definitions, wave definitions

## 8. 재사용 판단

### 적극 재사용 후보

- 전투 컨셉: 비타겟 조준, 마법 투사체, 수면/아이템 낙하 상호작용
- 아이템 generator 방식
- 장비 tier와 합성 규칙
- 적 패턴 파일 분리 방식
- 환경 변화와 원소 배율 컨셉
- 상점 상품 데이터와 리롤/할인/쿠폰 컨셉
- simulation 기반 밸런스 검증 문화

### 부분 재사용 후보

- `UnifiedRenderer` 하위 renderer와 shader
- `InventoryController`의 기능 요구사항
- `SkillTreeManager`의 상태 모델
- `saveSystem`의 저장 항목
- `EnemyWaveController`의 timeline 구조

부분 재사용 후보는 그대로 복사하기보다 v2 타입과 경계에 맞춰 옮기는 것이 좋다.

### 재설계 후보

- 고정 해상도 + `zoom` 레이아웃
- 마우스 중심 입력
- 전역 이벤트와 `window` 디버그 객체에 의존하는 연결 방식
- 큰 싱글톤 매니저
- 시스템별 책임이 섞인 spawner/renderer/controller
- UI 텍스트와 상태 업데이트가 DOM id에 직접 묶인 구조

## 9. 다음 단계 제안

이번 문서의 다음 단계는 v2 설계 문서다. 새 문서는 분석이 아니라 구현 기준을 잡아야 한다.

권장 문서:

- `docs/v2-architecture.md`: Vite + TypeScript 기반 폴더 구조, 런타임 계층, 데이터 흐름
- `docs/v2-responsive-layout.md`: 모바일/PC, 가로/세로, 전투/인벤토리 패널 정책
- `docs/v2-content-migration.md`: 기준 게임에서 어떤 기능/데이터/자산을 어떤 순서로 옮길지 정리

v2 초기 구현은 작은 vertical slice로 시작하는 것이 좋다. 전투 캔버스, 플레이어 이동, 적 1종 스폰, 드랍 아이템 1종, 인벤토리 패널 1개까지를 먼저 완성한 뒤 장비/스킬트리/상점을 붙이는 순서가 안전하다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
