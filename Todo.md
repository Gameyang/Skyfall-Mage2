# Enemy Wave System TODO

작성 기준: `docs/enemy-spawn-pattern-plan.md` 검토와 2026-06-12 재검증 결과
완료 항목 백업: `docs/enemy-wave-system-completed-backup.md`

## 현재 상태

이번 요청 범위의 enemy wave system 정리, 완료 항목 백업, headless 평가, 밸런스 개선, seed 랜덤 wave 검증, 브라우저 기본 검증을 완료했다.

- [x] 완료된 기존 TODO는 `docs/enemy-wave-system-completed-backup.md`로 백업했다.
- [x] 루트 `Todo.md`는 최신 결과와 완료 상태 기준으로 다시 작성했다.
- [x] 게임 wave는 run마다 seed 기반으로 랜덤화된다.
- [x] 첫 3개 wave는 학습 구간 보호를 위해 seed가 달라도 패턴 parameter를 흔들지 않는다.
- [x] wave 4 이후는 tier 제한 안에서 seed별로 순서와 일부 parameter가 달라진다.
- [x] 같은 seed는 같은 wave 순서와 parameter를 재현한다.
- [x] `human` headless 기준 wave 1-3 player damage 0을 유지한다.
- [x] kill/despawn 비율과 wave 4/6/8 피해 집중을 개선했다.
- [x] desktop/mobile 브라우저 기본 실행과 canvas runtime을 확인했다.

## Headless 최종 평가

| 기준 | 생존 | Spawned | Killed | Despawned | Hits | Damage | Peak Active | 판단 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| fixed + `human`, 5분 | 생존 | 371 | 166 | 183 | 8 | 66 | 19 | 5분 생존, kill/despawn 0.91로 개선. |
| fixed + `stationary` + contact 0, 3분 | 생존 | 206 | 95 | 86 | 17 | 0 | 16 | path 압박과 접촉 피해를 분리해 검증 가능. |
| seed `check-seed-a` + `human`, 3분 | 생존 | 210 | 106 | 89 | - | 36 | 18 | 랜덤 wave도 초반 학습 구간과 생존 조건 통과. |

주요 wave damage:

| Wave | 이전 Damage | 개선 후 Damage | 판단 |
| --- | ---: | ---: | --- |
| 1 | 0 | 0 | 학습 구간 유지. |
| 2 | 0 | 0 | 학습 구간 유지. |
| 3 | 0 | 0 | 학습 구간 유지. |
| 4 | 39 | 11 | pincer 피해 집중 완화. |
| 6 | 36 | 11 | heavy pressure 피해 완화. |
| 8 | 30 | 28 | elite/ring 겹침 허용 범위 내. |

적용한 밸런스 조정:

- [x] fireball cooldown을 `1000ms`에서 `700ms`로 줄였다.
- [x] fireball impact damage를 `8`에서 `12`로 올렸다.
- [x] fireball explosion max damage를 `28`에서 `32`로 올렸다.
- [x] enemy contact damage 기본값을 낮췄다.
- [x] contact damage wave 증가폭을 `0.04`에서 `0.02`로 낮췄다.
- [x] wave 8 elite/ring group에는 `contactDamageMultiplier: 0.6`을 적용했다.

## Seed 랜덤 Wave 검증

검증 명령 형식:

```bash
npm run balance:headless -- --durationMs=180000 --sampleIntervalMs=60000 --playerHp=100 --playerPolicy=human --waveSeed=<seed>
```

| Seed | 생존 | Spawned | Killed | Despawned | Damage | Early Damage | Peak Active | 결과 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `check-seed-a` | 생존 | 210 | 106 | 89 | 36 | 0 | 18 | 통과 |
| `check-seed-b` | 생존 | 206 | 112 | 76 | 11 | 0 | 17 | 통과 |
| `check-seed-c` | 생존 | 206 | 102 | 94 | 19 | 0 | 17 | 통과 |
| `check-seed-d` | 생존 | 222 | 117 | 83 | 53 | 0 | 18 | 통과 |
| `check-seed-e` | 생존 | 206 | 115 | 85 | 22 | 0 | 17 | 통과 |

검증 결과:

- [x] 모든 seed에서 180초 안에 player death가 없다.
- [x] 모든 seed에서 wave 1-3 player damage 합계가 0이다.
- [x] 모든 seed에서 skipped spawns = 0이다.
- [x] 모든 seed에서 backlogged spawns = 0이다.
- [x] 첫 3개 wave는 intro 고정이고, 이후 wave부터 seed별 순서가 달라진다.

## 브라우저 기본 검증

검증 대상: `http://127.0.0.1:5173/`

| Viewport | 실행 시간 | Wave | Enemies | Projectiles | HP | FPS | 결과 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| desktop `1280x720` | 9초 | 1 | 8 | 3 | 100 | 60.2 | 통과 |
| mobile `390x844` | 9초 | 1 | 6 | 2 | 100 | 60.1 | 통과 |

검증 결과:

- [x] desktop과 mobile viewport에서 runtime이 시작된다.
- [x] 각 viewport에서 run seed가 생성된다.
- [x] 적과 투사체가 canvas runtime에 생성된다.
- [x] game over 없이 9초 이상 진행된다.
- [x] headless Chromium에서 약 60fps를 유지한다.
- [x] WebGPU adapter가 없는 환경에서도 material field만 비활성화되고 Canvas2D 전투는 유지된다.

## 테스트 및 빌드

- [x] `npm test`
  - 6 files passed
  - 62 tests passed
- [x] `npm run build`
  - Vite production build 통과
- [x] `npm run balance:headless -- --durationMs=300000 --sampleIntervalMs=60000 --playerHp=100 --playerPolicy=human`
- [x] `npm run balance:headless -- --durationMs=180000 --sampleIntervalMs=60000 --playerHp=100 --playerPolicy=stationary --contactDamageMultiplier=0`
- [x] seed 5개 headless 검증
- [x] Playwright desktop/mobile 기본 실행 검증

## 완료된 구현 범위

- [x] path pattern registry
- [x] spawn pattern 분리
- [x] difficulty scaling
- [x] sequential wave schedule
- [x] enemy type 확장
- [x] advanced spawn/path pattern 추가
- [x] wave 1-8 밸런스 초안
- [x] active enemy cap과 spawn backlog
- [x] event wave 종료 hook
- [x] headless combat script
- [x] `human` headless policy
- [x] wave별 headless metrics
- [x] contact damage 분리 측정
- [x] seed 기반 roguelike random wave
- [x] 모바일/데스크톱 viewport path origin 단위 테스트
- [x] seed 5개 random wave 안전성 검증
- [x] 브라우저 desktop/mobile 기본 성능 검증

## 후속 관찰 후보

이번 요청 범위는 완료했다. 다음에 더 다듬는다면 아래 순서가 효율적이다.

- peak active enemy가 19 수준이라 더 강한 swarm 밀도감을 원하면 spawn count를 올리되 projectile 처리량을 같이 본다.
- wave 7은 피해는 없지만 despawn 비율이 높으므로 zigzag 경로의 교전 시간을 늘릴 수 있다.
- `homingSoft`, `dashPause`, `spiralIn`은 테스트 path로 유지하고, warning marker가 생긴 뒤 기본 rotation 투입을 검토한다.
- 장시간 실제 플레이 감각은 5분 이상 수동 플레이 영상 기준으로 다시 평가한다.
