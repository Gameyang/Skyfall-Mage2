# Enemy Spawn Pattern System Plan

작성일: 2026-06-12  
대상 프로젝트: `F:\Workspace\Skyfall-Mage2`

## 1. 목표

현재 적 출현은 테스트용으로 단순한 고정 wave 목록과 S-curve 이동 경로만 사용한다. 다음 단계에서는 뱀파이어 서바이벌류 게임처럼 적의 이동 경로, 출현 방식, 난이도 증가 규칙을 각각 라이브러리화하고, wave 진행에 따라 여러 패턴을 조립해서 사용할 수 있게 만든다.

핵심 목표:

- 적 이동 경로를 여러 프리셋으로 분리하고, 파라미터로 변형할 수 있게 한다.
- 한 번에 몇 마리 적이 등장하는지, 어떤 시간 간격으로 등장하는지, 어디서 시작하는지를 spawn pattern으로 분리한다.
- 적 HP, 수량, 이동 속도, 접촉 피해량을 난이도 시스템에서 파라미터화해 증가시킨다.
- 난이도는 wave 번호와 진행 시간에 따라 결정되며, wave가 지날수록 적 강도, 이동 경로, 등장 패턴이 점점 어려워진다.
- 기획 데이터만 바꿔도 신규 wave 조합을 만들 수 있게 한다.

## 2. 현재 구조 요약

현재 관련 파일:

- `src/game/enemyPaths.js`: S-curve 경로 생성, 경로 샘플링, wave 기반 적 생성.
- `src/game/content/waves.js`: 고정 wave 정의. `startMs`, `intervalMs`, `count`, `side`, `enemyType`, `pattern` 정도만 가진다.
- `src/game/content/enemies.js`: 적 기본 스탯 정의. 현재 `normalBat` 단일 타입만 있다.
- `src/game/systems.js`: `updateWaveSpawns`, `spawnWaveGroup`, `updateEnemies`에서 spawn과 이동 갱신을 처리한다.

현재 한계:

- 이동 경로가 사실상 S-curve 하나뿐이다.
- spawn 위치가 `left/right/top/bottom` side와 lane 분배 중심이다.
- wave가 시간표 역할만 하며, 난이도 단계나 패턴 조립 개념이 없다.
- 적 스탯은 enemy definition에 고정되어 wave 진행에 따른 scaling이 없다.
- wave별 spawn count와 interval만 조정할 수 있고, burst, ring, chase, ambush 같은 패턴이 없다.

## 3. 설계 원칙

### 3.1 경로, 출현, 난이도 분리

적 출현 시스템은 세 레이어로 나눈다.

```text
Wave Schedule
  -> Spawn Pattern
  -> Enemy Stat Scaling
  -> Movement Path Pattern
  -> Runtime Enemy Entity
```

- Wave Schedule: 몇 번째 wave에서 어떤 패턴 세트를 실행할지 결정한다.
- Spawn Pattern: 한 번에 몇 마리, 몇 번에 나눠서, 어디에서, 어떤 간격으로 등장할지 결정한다.
- Enemy Stat Scaling: wave 난이도에 따라 HP, speed, contactDamage, spawn count를 보정한다.
- Movement Path Pattern: 적이 어떤 경로를 따라 이동할지 결정한다.
- Runtime Enemy Entity: 최종 계산된 스탯과 경로 상태를 가진 실제 적 객체다.

### 3.2 데이터 주도 방식

구현은 함수 라이브러리로 만들되, 실제 게임 밸런스는 content 데이터로 제어한다.

권장 파일 분리:

```text
src/game/content/
  enemies.js
  enemyPathPatterns.js
  enemySpawnPatterns.js
  enemyDifficulty.js
  waves.js

src/game/
  enemyPaths.js
  enemySpawns.js
  enemyDifficulty.js
```

content 파일은 기획 데이터, game 파일은 런타임 계산 로직을 담당한다.

## 4. 이동 경로 패턴

이동 경로는 `pathPatternId`와 `pathParams`로 선택한다.

예시 데이터:

```js
{
  pathPatternId: 'sCurve',
  pathParams: {
    amplitude: 64,
    frequency: 2.1,
    margin: 44,
  },
}
```

### 4.1 기본 경로 라이브러리

초기 구현 후보:

| ID | 설명 | 주요 파라미터 | 난이도 효과 |
| --- | --- | --- | --- |
| `straight` | 화면 가장자리에서 반대편으로 직선 이동 | `side`, `laneT`, `margin` | 초반 기본형 |
| `sCurve` | 현재 구현된 사인 곡선 이동 | `amplitude`, `frequency`, `phase` | 회피 예측을 어렵게 함 |
| `zigzag` | 일정 주기로 방향을 꺾는 이동 | `amplitude`, `segmentLength`, `sharpness` | 투사체 명중률 감소 |
| `arc` | 화면 바깥에서 휘어져 지나가는 곡선 | `curve`, `entryAngle`, `exitAngle` | 측면 압박 |
| `spiralIn` | 플레이어 주변 또는 화면 중심을 향해 감기는 이동 | `turns`, `radiusDecay`, `targetMode` | 중후반 압박 |
| `homingSoft` | 플레이어 방향을 천천히 추적 | `turnRate`, `maxSteer`, `predictionMs` | 이동 대응 요구 |
| `dashPause` | 짧게 돌진하고 멈추는 반복 이동 | `dashSpeed`, `pauseMs`, `dashMs` | 리듬 교란 |
| `orbitThenExit` | 중심부를 잠시 돈 뒤 이탈 | `orbitRadius`, `durationMs`, `exitSide` | 화면 점유율 증가 |

### 4.2 경로 런타임 계약

경로 패턴은 공통 인터페이스를 가져야 한다.

```js
createPath({
  state,
  enemyDefinition,
  spawnContext,
  pathParams,
  difficulty,
})

samplePath({
  enemy,
  state,
  dtMs,
})
```

단순 경로는 `progress` 기반으로 위치를 계산하고, 추적형 경로는 `vx/vy`, `heading`, `steer` 같은 상태를 사용할 수 있다.

런타임 enemy에 필요한 공통 필드:

- `pathPatternId`
- `pathState`
- `x`, `y`
- `speed`
- `progress`
- `travelDistance` 또는 `lifetimeMs`

## 5. Spawn Pattern

Spawn Pattern은 적이 등장하는 모양과 시간 구조를 담당한다.

예시 데이터:

```js
{
  spawnPatternId: 'edgeFlock',
  spawnParams: {
    side: 'left',
    count: 6,
    burstCount: 1,
    intervalMs: 5200,
    laneMode: 'spread',
  },
}
```

### 5.1 기본 spawn 패턴 라이브러리

| ID | 설명 | 주요 파라미터 | 용도 |
| --- | --- | --- | --- |
| `edgeFlock` | 한쪽 가장자리에서 여러 마리 동시 등장 | `side`, `count`, `laneMode` | 초반 기본 wave |
| `oppositePincer` | 양쪽 가장자리에서 동시에 협공 | `sides`, `countPerSide`, `syncOffsetMs` | 좌우/상하 압박 |
| `rotatingSides` | spawn side가 순서대로 회전 | `sideOrder`, `groups`, `groupIntervalMs` | 방향 전환 유도 |
| `ringSurround` | 화면 사방에서 원형 포위 | `count`, `radius`, `angleOffset` | 중반 이벤트 wave |
| `cornerAmbush` | 모서리 근처에서 짧은 간격으로 등장 | `corners`, `count`, `jitter` | 안전지대 붕괴 |
| `staggeredStream` | 긴 시간 동안 한두 마리씩 연속 등장 | `count`, `spawnGapMs`, `sideSelector` | 지속 압박 |
| `eliteEscort` | 강한 적 주변에 약한 적을 배치 | `leaderType`, `escortType`, `escortCount` | 미니보스 도입 |
| `randomEdgeNoise` | 가장자리 랜덤 위치에서 불규칙 등장 | `count`, `randomness`, `minGapMs` | 후반 혼란 |

### 5.2 시작 위치 규칙

Spawn 위치는 `spawnArea`로 표현한다.

```js
{
  spawnArea: {
    type: 'edge',
    side: 'left',
    laneMode: 'spread',
    margin: 44,
    jitter: 0.08,
  },
}
```

지원할 위치 타입:

- `edge`: 화면 상하좌우 가장자리.
- `corner`: 네 모서리 주변.
- `ring`: 화면 바깥 원형 둘레.
- `visibleSafeMargin`: 화면 내부 특정 영역은 피해서 등장.
- `nearPlayerOuter`: 플레이어 근처가 아니라 플레이어 바깥 반경에서 등장.

초기 버전에서는 화면 바깥 spawn만 허용한다. 화면 내부 spawn은 경고 이펙트, 지연 시간, spawn marker가 준비된 후 도입한다.

## 6. 난이도 시스템

난이도는 wave index를 중심으로 계산한다.

```js
{
  waveIndex: 1,
  elapsedMs: 0,
  tier: 'early',
  scalar: 1.0,
}
```

### 6.1 난이도 단계

| Wave 구간 | Tier | 의도 |
| --- | --- | --- |
| 1-3 | `intro` | 기본 이동과 기본 spawn 학습 |
| 4-7 | `early` | S-curve, 양쪽 협공 시작 |
| 8-12 | `mid` | staggered stream, corner ambush 추가 |
| 13-18 | `late` | 추적형/돌진형 경로, ring surround 추가 |
| 19+ | `endless` | 여러 패턴 조합, elite 비중 증가 |

### 6.2 스탯 scaling

적 기본 스탯은 `enemies.js`에 두고, wave 난이도에서 multiplier를 적용한다.

```js
{
  hpMultiplier: 1 + waveIndex * 0.08,
  speedMultiplier: 1 + waveIndex * 0.025,
  contactDamageMultiplier: 1 + waveIndex * 0.04,
  countMultiplier: 1 + Math.floor(waveIndex / 4) * 0.15,
}
```

권장 제한값:

- HP multiplier: 최소 `1.0`, 최대 `8.0`
- Speed multiplier: 최소 `1.0`, 최대 `2.0`
- Contact damage multiplier: 최소 `1.0`, 최대 `4.0`
- 동시 적 수: 기기 성능과 가독성을 위해 초기 목표 최대 `80-120`마리

### 6.3 난이도 점수

각 wave는 난이도 예산을 가진다.

```js
{
  waveIndex: 8,
  budget: 120,
  allowedPathPatterns: ['straight', 'sCurve', 'zigzag'],
  allowedSpawnPatterns: ['edgeFlock', 'oppositePincer', 'staggeredStream'],
  eliteChance: 0.08,
}
```

패턴마다 비용을 둔다.

| 요소 | 비용 예시 |
| --- | --- |
| 일반 적 1마리 | 4 |
| 빠른 적 1마리 | 6 |
| elite 적 1마리 | 20 |
| `straight` 경로 | 0 |
| `sCurve` 경로 | 4 |
| `zigzag` 경로 | 8 |
| `homingSoft` 경로 | 14 |
| `edgeFlock` spawn | 0 |
| `oppositePincer` spawn | 8 |
| `ringSurround` spawn | 18 |

이 방식은 wave가 진행될수록 더 어려운 조합을 허용하되, 한 wave가 갑자기 과하게 어려워지는 문제를 줄인다.

## 7. Wave 데이터 모델

기존 `WAVE_DEFINITIONS`는 반복 타이머 목록에 가깝다. 신규 모델은 wave 단위의 phase와 pattern group을 가진다.

예시:

```js
{
  id: 'wave-04-pincer',
  waveIndex: 4,
  durationMs: 30000,
  difficultyTier: 'early',
  groups: [
    {
      startMs: 500,
      repeat: 4,
      repeatIntervalMs: 5200,
      enemyType: 'normalBat',
      spawnPatternId: 'oppositePincer',
      spawnParams: {
        sides: ['left', 'right'],
        countPerSide: 3,
        laneMode: 'spread',
      },
      pathPatternId: 'sCurve',
      pathParams: {
        amplitude: 58,
        frequency: 2.2,
      },
      scaling: {
        hpMultiplier: 1.25,
        speedMultiplier: 1.05,
      },
    },
  ],
}
```

### 7.1 Wave 진행 방식

권장 흐름:

```text
currentWaveIndex
  -> load wave definition
  -> calculate difficulty context
  -> schedule group events
  -> spawn group events during wave duration
  -> when duration ends and field pressure is acceptable, advance wave
```

Wave 전환 조건:

- 기본: `durationMs` 경과.
- 선택 조건: 남은 적 수가 너무 많으면 다음 wave 시작을 최대 몇 초 지연.
- 보스/이벤트 wave: 특정 enemy 사망 조건으로 종료 가능.

## 8. 적 타입 확장

초기 적 타입 후보:

| ID | 역할 | 기본 스탯 방향 |
| --- | --- | --- |
| `normalBat` | 표준 적 | 현재 기준 |
| `fastBat` | 빠르지만 약함 | 낮은 HP, 높은 speed |
| `heavyBat` | 느리지만 단단함 | 높은 HP, 낮은 speed |
| `splitImp` | 사망 시 소형 적 생성 | 중간 HP |
| `blinkShade` | 순간 이동 또는 dash pause | 낮은 HP, 특수 경로 |
| `eliteBat` | 중간 보스급 | 높은 HP, 큰 sprite, 높은 보상 |

Enemy definition에는 기본값만 둔다.

```js
{
  id: 'fastBat',
  hp: 18,
  speed: 128,
  radius: 15,
  contactDamage: 8,
  defaultPathPatternId: 'straight',
  tags: ['fast', 'small'],
}
```

최종 spawn 시점에는 wave scaling과 difficulty scaling이 합쳐진다.

## 9. 구현 단계

### Phase 1: 현재 구조 확장

- `enemyPaths.js`에 path registry 추가.
- 기존 S-curve를 `sCurve` path pattern으로 감싼다.
- `straight`, `sCurve` 두 경로부터 지원한다.
- 기존 `waves.js` 데이터가 계속 동작하도록 fallback을 유지한다.

완료 기준:

- 기존 게임 동작이 깨지지 않는다.
- wave 데이터에서 `pathPatternId`를 지정할 수 있다.
- 기존 테스트가 통과한다.

### Phase 2: Spawn Pattern 분리

- `enemySpawns.js` 추가.
- `edgeFlock`, `oppositePincer`, `staggeredStream` 구현.
- spawn 결과는 `spawnContext` 배열로 반환하고, enemy 생성은 공통 함수에서 처리한다.

완료 기준:

- 같은 enemy/path라도 spawn pattern만 바꿔 다른 wave를 만들 수 있다.
- count, interval, side, laneMode를 데이터로 조정할 수 있다.

### Phase 3: Difficulty Scaling

- `enemyDifficulty.js` 추가.
- wave index 기반 `difficultyContext` 계산.
- HP, speed, contactDamage, count multiplier 적용.
- 동시 적 수 cap과 spawn backlog 규칙 추가.

완료 기준:

- wave 번호를 올리면 별도 enemy definition 수정 없이 적 강도가 증가한다.
- 너무 많은 적이 한 프레임에 생성되지 않는다.

### Phase 4: Wave Schedule 개편

- `waves.js`를 wave group 기반으로 전환.
- `currentWaveIndex`, `waveElapsedMs`, `waveStartedAtMs` 상태 추가.
- wave duration과 group repeat 처리.
- 난이도 tier별 pattern unlock 적용.

완료 기준:

- wave가 명확히 1, 2, 3 순서로 진행된다.
- wave가 지날수록 spawn pattern과 path pattern 선택지가 넓어진다.

### Phase 5: 고급 패턴 추가

- `zigzag`, `cornerAmbush`, `ringSurround` 추가.
- 경고 marker가 필요한 내부/근접 spawn은 별도 시각 피드백 후 도입.
- elite enemy와 escort group 추가.

완료 기준:

- 초반, 중반, 후반 wave의 체감이 분리된다.
- 패턴 조합만으로 신규 wave를 빠르게 제작할 수 있다.

## 10. 테스트 계획

단위 테스트:

- path pattern이 viewport 밖 origin과 유효한 초기 위치를 만든다.
- 같은 seed/context에서 lane jitter가 재현 가능하다.
- spawn pattern이 요청한 count만큼 spawn context를 만든다.
- difficulty scaling이 cap 범위를 넘지 않는다.
- wave scheduler가 repeat와 interval을 정확히 처리한다.

플레이 테스트 체크:

- 초반 1분 동안 적이 너무 빠르게 플레이어에게 닿지 않는다.
- 화면 바깥 spawn이 모바일/데스크톱 viewport에서 모두 자연스럽다.
- wave 증가 시 적 수, HP, 이동 경로 난이도가 체감된다.
- 동시 적 수가 많아져도 프레임 드랍이 과하지 않다.
- 랜덤 요소가 있어도 불공정한 즉사 패턴이 나오지 않는다.

## 11. 밸런스 초기값 제안

초기 wave 예시:

| Wave | Spawn | Path | Enemy | 의도 |
| --- | --- | --- | --- | --- |
| 1 | `edgeFlock` left/right 교대, 3-4마리 | `straight` | `normalBat` | 기본 조작 적응 |
| 2 | `edgeFlock` 4-5마리 | `sCurve` 약함 | `normalBat` | 곡선 이동 소개 |
| 3 | `rotatingSides` | `straight`/`sCurve` | `normalBat` | 방향 전환 |
| 4 | `oppositePincer` | `sCurve` | `normalBat` | 협공 시작 |
| 5 | `staggeredStream` | `straight` 빠름 | `fastBat` | 지속 압박 |
| 6 | `edgeFlock` + `heavyBat` 소수 | `sCurve` | `heavyBat` | 단단한 적 소개 |
| 7 | `cornerAmbush` | `zigzag` 약함 | `fastBat` | 모서리 위협 |
| 8 | `eliteEscort` | `sCurve` | `eliteBat` + `normalBat` | 미니 이벤트 |

권장 기본 scaling:

```js
{
  hpPerWave: 0.08,
  speedPerWave: 0.025,
  damagePerWave: 0.04,
  countBonusEveryWaves: 4,
  countBonusRatio: 0.15,
  maxActiveEnemies: 100,
}
```

## 12. 주의사항

- 이동 속도 scaling은 HP scaling보다 천천히 올린다. 속도가 너무 빠르면 회피보다 피격 운이 커진다.
- spawn count scaling은 기기 성능과 가독성 cap을 반드시 가진다.
- 화면 내부 spawn은 사전 경고 없이 도입하지 않는다.
- 추적형 경로는 모든 적에게 적용하지 않고, 일부 wave나 일부 enemy type에만 적용한다.
- wave가 어려워지는 축은 HP, 수량, 속도, 경로, spawn 위치를 동시에 크게 올리지 않는다. 한 wave에서는 1-2개 축만 강조한다.
- 신규 패턴은 먼저 content 데이터로 작은 wave를 만들어 플레이 테스트한 뒤 기본 rotation에 넣는다.

## 13. 다음 구현 우선순위

1. `sCurve`를 registry 기반 path pattern으로 포장한다.
2. `straight` path pattern을 추가한다.
3. `edgeFlock` spawn pattern을 현재 wave 구조와 호환되게 분리한다.
4. `oppositePincer`, `staggeredStream`을 추가한다.
5. wave index 기반 difficulty context와 stat multiplier를 적용한다.
6. `waves.js`를 group 기반 wave schedule로 점진 전환한다.
