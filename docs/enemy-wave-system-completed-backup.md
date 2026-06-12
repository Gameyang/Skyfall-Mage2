# Enemy Wave System Completed Backup

백업 일자: 2026-06-12
원본 작업 파일: `Todo.md`
기준 문서: `docs/enemy-spawn-pattern-plan.md`

이 문서는 `Todo.md`에서 완료 처리한 enemy wave system 항목을 보관하기 위한 백업이다. 후속 관찰 후보는 루트의 `Todo.md`에 유지한다.

## 구현 완료

- 기존 반복 스폰 루프에서 sequential wave director로 전환했다.
- legacy wave 정의가 계속 동작하도록 fallback adapter를 유지했다.
- content 파일은 기획 데이터만 담고, runtime 계산은 `src/game/*` 모듈로 분리했다.
- wave 상태를 `currentWaveNumber`, `waveStartedAtMs`, group state 중심으로 전환했다.
- wave `durationMs`, group `startMs`, `repeat`, `repeatIntervalMs`를 처리한다.
- field pressure 기준으로 다음 wave 시작을 짧게 지연하는 규칙을 추가했다.
- 보스/이벤트 wave용 종료 hook을 추가했다.
  - `duration`
  - `allSpawnedCleared`
  - `enemyTypeCleared`
  - `durationOrCleared`
- active enemy cap 초과 스폰은 skip하지 않고 backlog에 보관한 뒤 빈 자리가 생기면 다시 소진한다.

## Path Pattern

- `src/game/content/enemyPathPatterns.js`를 추가했다.
- `src/game/enemyPaths.js`에 path pattern registry와 sampler 구조를 추가했다.
- 기존 S-curve 이동을 `sCurve` path pattern으로 전환했다.
- `straight`, `sCurve`, `zigzag`, `homingSoft`, `dashPause`, `spiralIn` path를 지원한다.
- wave 데이터에서 `pathPatternId`, `pathParams`를 읽는다.
- legacy `wave.pattern` 값은 `sCurve` fallback으로 계속 지원한다.
- enemy runtime 필드에 `pathPatternId`, `pathState`를 추가했다.

## Spawn Pattern

- `src/game/content/enemySpawnPatterns.js`를 추가했다.
- `src/game/enemySpawns.js`를 추가했다.
- `edgeFlock`, `oppositePincer`, `staggeredStream`, `cornerAmbush`, `ringSurround`, `rotatingSides`, `eliteEscort`를 지원한다.
- spawn pattern 결과는 enemy가 아니라 `spawnContext` 배열로 반환한다.
- enemy 생성은 `createEnemyFromSpawnContext`에서 처리한다.
- 같은 enemy/path 조합에서 spawn pattern만 바꿔 다른 wave를 만들 수 있다.
- `spawnGapMs`는 별도 pattern 내부 offset으로 늘리지 않고, 현재 wave model의 `repeat`와 `repeatIntervalMs`로 표현한다.

## Difficulty And Enemy Types

- `src/game/content/enemyDifficulty.js`와 `src/game/enemyDifficulty.js`를 추가했다.
- wave index 기반 difficulty context를 계산한다.
- `intro`, `early`, `mid`, `late`, `endless` tier를 정의했다.
- HP, speed, contact damage, count multiplier를 적용하고 cap 범위를 둔다.
- `normalBat`, `fastBat`, `heavyBat`, `eliteBat`를 사용한다.
- `eliteBat`에는 별도 `scoreValue` 보상을 적용했다.
- sprite가 없는 headless 신규 적은 asset-free definition으로 동작한다.

## Balance Draft

- Wave 1: `rotatingSides`, `straight`, `normalBat`, 3마리.
- Wave 2: `edgeFlock`, 약한 `sCurve`, `normalBat`, 4마리.
- Wave 3: `rotatingSides`, `sCurve`, `normalBat`.
- Wave 4: `oppositePincer`, `sCurve`, `normalBat`.
- Wave 5: `staggeredStream`, 빠른 `straight`, `fastBat`.
- Wave 6: `rotatingSides` + `edgeFlock`, `sCurve`, `normalBat` + `heavyBat`.
- Wave 7: `cornerAmbush`, 약한 `zigzag`, `fastBat`.
- Wave 8: `eliteEscort` + `ringSurround`, `sCurve`, `eliteBat` + `normalBat`.

## Roguelike Random Waves

- 실제 runtime은 run마다 `createRunSeed('skyfall')`로 seed를 만들고 `createWaveSequence({ seed })`로 wave sequence를 생성한다.
- seed가 같으면 같은 wave 순서와 parameter jitter가 재현된다.
- seed가 다르면 wave 순서와 일부 spawn/path parameter가 달라진다.
- 첫 3개 wave는 학습 구간으로 고정하고 parameter randomization도 막는다.
- tier unlock을 제한해 초반 wave에 mid-tier template이 나오지 않게 했다.
- restart 시 새 run seed와 새 wave sequence를 만든다.

## Headless Tooling

- `npm run balance:headless` 스크립트를 추가했다.
- `playerPolicy`는 `stationary`, `orbit`, `human`, `evade`를 지원한다.
- `waveSeed`로 seeded random wave를 검증할 수 있다.
- `contactDamageMultiplier`로 접촉 피해를 0까지 낮춰 path pressure와 contact damage를 분리 측정할 수 있다.
- summary metric과 wave별 metric을 모두 출력한다.
  - spawned
  - killed
  - despawned
  - player hits
  - player damage
  - peak active enemies
  - peak projectiles
  - backlogged spawns
  - wave starts/completions

## 검증 완료

- path pattern이 모바일 `390x844`와 데스크톱 `1280x720` viewport에서 화면 밖 초기 위치를 만든다.
- 같은 seed/context에서 lane jitter가 재현 가능하다.
- spawn pattern이 요청한 count만큼 spawn context를 만든다.
- difficulty scaling이 cap 범위를 넘지 않는다.
- wave scheduler가 repeat와 interval을 처리한다.
- event wave가 모든 spawned enemy 제거 시 조기 완료된다.
- spawn backlog가 active enemy cap 이후 빈 자리가 생기면 소진된다.
- headless가 wave-level metrics를 기록한다.
- `contactDamageMultiplier=0`에서 player damage가 0으로 유지된다.
- seed 기반 wave generation이 재현 가능하고, 초반 tier unlock 제한을 지킨다.
- seed 5개 headless 검증에서 180초 내 death가 없고 wave 1-3 damage 0을 유지했다.
- desktop `1280x720`, mobile `390x844` 브라우저 기본 실행에서 약 60fps를 확인했다.

## 최근 Headless 기준값

### Fixed Waves, Human Policy

명령:

```bash
npm run balance:headless -- --durationMs=300000 --sampleIntervalMs=60000 --playerHp=100 --playerPolicy=human
```

결과:

- spawned 371
- killed 166
- despawned 183
- backlogged 0
- skipped 0
- player hits 8
- player damage 66
- peak active enemies 19
- player death 없음
- wave 1-3 player damage 0
- 주요 피해 wave: wave 4 damage 11, wave 6 damage 11, wave 8 damage 28

### Fixed Waves, Contact Damage Disabled

명령:

```bash
npm run balance:headless -- --durationMs=180000 --sampleIntervalMs=60000 --playerHp=100 --playerPolicy=stationary --contactDamageMultiplier=0
```

결과:

- spawned 206
- killed 95
- despawned 86
- player hits 17
- player damage 0
- peak active enemies 16
- player death 없음

### Seeded Random Waves

명령:

```bash
npm run balance:headless -- --durationMs=180000 --sampleIntervalMs=60000 --playerHp=100 --playerPolicy=human --waveSeed=check-seed-a
```

결과:

- spawned 210
- killed 106
- despawned 89
- player damage 36
- peak active enemies 18
- player death 없음
- wave order: wave 1-3 fixed intro, wave 4-5 early, wave 6 mid
