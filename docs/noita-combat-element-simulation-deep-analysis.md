# Noita식 전투 원소 연동 시뮬레이션 심층 분석

작성일: 2026-06-12  
대상 프로젝트: `Skyfall-Mage2`  
관련 구현:

- `src/features/material-field/`
- `src/features/material-field/shaders/noitaField.wgsl`
- `src/game/systems.js`
- `src/game/content/skills.js`
- `src/game/headlessCombat.js`

## 1. 목적

이 문서는 `Skyfall-Mage2` 전투에서 Noita식 원소 연동을 어떻게 해석하고, 그 연동이 어떻게 높은 전투 강도와 창의적인 결과를 만들어내는지 분석한다.

여기서 중요한 목표는 Noita 원작을 그대로 복제하는 것이 아니다. 핵심은 다음 세 가지를 이 프로젝트의 전투 구조에 맞게 번역하는 것이다.

1. 전투 스킬이 단순한 피해 숫자가 아니라 월드 셀에 물질을 남긴다.
2. 물질은 각자 이동, 수명, 밀도, 반응 규칙을 가진다.
3. 플레이어와 적은 그 결과를 다시 전투 판단의 일부로 읽게 된다.

Noita 공식 설명의 핵심은 "세계의 픽셀이 각자 물질이며, 물, 기체, 모래, 강체, 화학 반응, 전기, 열역학 같은 간소화된 시뮬레이션이 함께 돌아간다"는 점이다. `Skyfall-Mage2`에서는 이 원리를 전장 전체를 지배하는 완전한 물리 월드가 아니라, 전투를 강화하는 WebGPU material field 레이어로 적용하는 것이 현실적이다.

## 2. 현재 구현 기준

현재 프로젝트에는 이미 Noita식 시뮬레이션의 골격이 들어가 있다.

| 영역 | 현재 구현 |
| --- | --- |
| 물질 필드 | `192 x 192` grid, `u32` packed cell, ping-pong storage buffer |
| 물질 종류 | `empty`, `solid`, `sand`, `water`, `fire`, `smoke`, `spark`, `steam`, `wet sand` |
| 셀 상태 | material id, life, aux 값을 8비트 단위로 packing |
| 원소 입력 | brush/emitter와 전투 `MaterialEmitter` frame effect |
| GPU 규칙 | WGSL compute pass에서 이동, 반응, 유입, emitter 적용 |
| 전투 연결 | `fireball` 투사체의 trail/explosion이 material emitter를 생성 |
| 전투 검증 | `headlessCombat`과 `systems.test.js`에서 CPU 전투 결과 검증 |

현 구조의 핵심은 CPU 전투와 GPU 물질 필드가 직접 서로를 매 프레임 읽지 않는다는 점이다. CPU 전투는 명확한 게임 규칙을 유지하고, GPU material field는 시각적/환경적 결과를 빠르게 누적한다. 이 분리는 성능과 디버깅 안정성을 위해 중요하다.

## 3. 전투와 원소 필드의 연결 흐름

전투에서 원소 효과가 만들어지는 과정은 다음 단계로 볼 수 있다.

```text
스킬 발동
  -> CPU projectile/hazard 생성
  -> frameEffects에 MaterialEmitter 기록
  -> viewport 좌표를 material grid 좌표로 변환
  -> WebGPU emitter buffer에 packing
  -> noitaField.wgsl compute pass 실행
  -> 물질 이동/반응/수명/폭발 처리
  -> bloom이 포함된 material canvas 렌더링
```

현재 대표 사례는 `fireball`이다.

- 시전 시 작은 화염 emitter를 남긴다.
- 투사체가 비행하는 동안 `projectileFire` profile의 불을 trail로 남긴다.
- 충돌 시 남은 에너지 비율에 따라 폭발 반경과 피해량이 커진다.
- 폭발은 `skillExplosionFire`, `spark`, `smoke`를 동시에 방출한다.
- `skillExplosionFire`는 일반 fire와 aux/profile이 달라 더 빠르게 정리되고, 물과 만나면 steam으로 변한다.

이 구조 덕분에 하나의 스킬이 "피해 판정"과 "원소 흔적"을 동시에 갖는다. 숫자 전투와 시뮬레이션 전투가 같은 사건에서 분기되는 셈이다.

## 4. 원소별 동작 모델

### 4.1 Fire

불은 전투 강도를 즉시 높이는 원소다. 현재 shader에서는 다음 성질을 가진다.

- 위쪽 또는 대각선 위쪽으로 움직이며 기체 흐름의 영향을 받는다.
- 수명이 줄어들면 사라지거나 smoke로 바뀐다.
- water 또는 wet sand가 근처에 있으면 steam으로 변한다.
- 일반 fire, projectile fire, skill explosion fire가 profile로 분리된다.

전투 설계상 fire는 "짧은 시간에 공간을 위험하게 만드는 압력"이다. 즉발 피해뿐 아니라 화면에 남은 흔적이 플레이어의 이동 판단을 바꾸는 데 쓰기 좋다.

### 4.2 Water

물은 불을 끄고 모래를 젖게 만드는 제어 원소다.

- 아래로 떨어지고, 막히면 좌우로 흐른다.
- sand와 접촉하면 wet sand를 만든다.
- heat/fire/spark 근처에서는 steam으로 바뀐다.
- wet sand는 움직임이 더 무겁고, 다시 열을 받으면 dry sand로 돌아갈 수 있다.

전투 설계상 water는 "전투 강도를 낮추거나 방향을 바꾸는 원소"다. 불을 제거하지만 steam을 만들기 때문에 결과가 항상 단순한 방어로 끝나지 않는다.

### 4.3 Sand / Wet Sand

모래는 지형성과 누적성을 담당한다.

- 아래로 떨어지고, 막히면 대각선 아래로 미끄러진다.
- 물과 만나면 wet sand가 된다.
- wet sand는 주변 wet sand 접촉 점수에 따라 확산될 수 있다.
- heat 근처에서는 다시 dry sand가 될 수 있다.

전투 설계상 sand는 "공간을 채우고 흐름을 바꾸는 원소"다. 직접 피해보다는 경로 차단, 시야 변화, 불/물 반응의 매개체로 가치가 크다.

### 4.4 Smoke / Steam

연기와 증기는 기체층이다.

- 위로 상승한다.
- wind/noise 기반 gas flow의 영향을 받는다.
- life가 끝나면 사라진다.
- steam은 수명이 줄어들 때 일정 확률로 water로 응결될 수 있다.

전투 설계상 smoke와 steam은 "시야, 분위기, 후속 반응"을 만든다. CPU 전투 판정과 아직 직접 연결되어 있지는 않지만, 향후 적 AI나 플레이어 조준 보정에 영향을 주는 soft obstacle로 확장하기 좋다.

### 4.5 Spark

Spark는 불보다 짧고 불안정한 발화 매개체다.

- powder처럼 아래로 떨어진다.
- 물 또는 wet sand 근처에서는 steam이나 empty로 사라진다.
- 수명이 끝나면 fire로 바뀔 수 있다.
- 폭발의 가장자리, 충격 순간, 전기/번개 계열 스킬의 씨앗으로 쓰기 좋다.

전투 설계상 spark는 "결과를 예측 가능하지만 완전히 고정하지 않는 촉매"다. 작은 확률, 짧은 수명, 주변 반응이 합쳐져 창발성을 만든다.

## 5. 높은 전투 강도가 만들어지는 방식

Noita식 원소 전투의 강도는 적 체력과 피해량만으로 만들어지지 않는다. 강도는 전장이 계속 변한다는 압박에서 나온다.

### 5.1 공간 압박

투사체가 지나간 자리에 fire trail이 남으면, 플레이어는 단순히 적을 피하는 것이 아니라 "위험한 바닥/공기/잔류물"도 피해야 한다. 폭발이 ring 형태로 fire를 남기면 안전지대가 원형으로 갈라지고, smoke/steam은 화면 정보량을 올린다.

현재 구현은 이 압박을 시각 레이어로 먼저 제공한다. 다음 단계에서는 CPU hazard proxy를 붙여 실제 피해나 AI 회피 판단까지 연결할 수 있다.

### 5.2 시간 압박

원소는 영구히 남지 않는다. `life`, `frames`, `trailIntervalMs`, `expansionFrames`가 모두 시간 압박을 만든다.

- `life`가 짧으면 순간 폭발처럼 보인다.
- `life`가 길면 지역 장악형 장판처럼 보인다.
- `frames`가 많으면 emitter가 여러 프레임에 걸쳐 계속 주입된다.
- `trailIntervalMs`가 짧으면 투사체가 더 선명한 원소 궤적을 남긴다.
- `expansionFrames`가 있으면 폭발이 한 프레임 점멸이 아니라 팽창하는 사건처럼 보인다.

전투 강도를 올릴 때는 피해량보다 이 시간 파라미터를 먼저 조절하는 것이 안전하다. 피해 숫자를 올리면 실패가 즉시 죽음으로 바뀌지만, 원소 수명과 반경을 올리면 플레이어가 읽고 대응할 시간이 남는다.

### 5.3 에너지 압축

`fireball`은 projectile energy를 가진다. 충돌 시 남은 에너지 비율이 폭발 반경과 피해량을 결정한다.

```text
ratio = currentEnergy / maxEnergy
radius = lerp(minRadius, maxRadius, ratio)
damage = lerp(minDamage, maxDamage, ratio)
```

이 모델은 전투 강도를 동적으로 만든다.

- 빠르게 맞춘 투사체는 에너지가 많이 남아 큰 폭발을 만든다.
- 오래 날아간 투사체는 덜 강한 폭발을 만든다.
- trail leak이 추가되면 "비행 중 환경을 태우는 대신 충돌 폭발이 약해지는" tradeoff를 만들 수 있다.

즉, 스킬 하나에 순간 피해, 경로 장악, 충돌 폭발 사이의 선택지가 생긴다.

### 5.4 무작위성과 결정성의 균형

shader는 `hash(x, y, frame, salt)` 기반의 pseudo-random 값을 사용한다. 이 방식은 완전한 랜덤이 아니라 위치와 프레임에 묶인 예측 가능한 흔들림이다.

이 흔들림은 다음 결과를 만든다.

- 물이 매번 완전히 같은 줄기로 흐르지 않는다.
- 불과 연기가 살아 있는 것처럼 움직인다.
- 모래와 spark가 작은 차이로 다른 모양을 만든다.
- 같은 스킬도 지형과 원소 상태에 따라 다른 흔적을 남긴다.

전투 강도는 "통제 불가능함"이 아니라 "읽을 수 있지만 완전히 고정되지 않음"에서 나온다.

## 6. 창의적인 결과가 만들어지는 방식

창발성은 많은 규칙을 넣는다고 생기지 않는다. 적은 수의 규칙이 서로 다시 만날 수 있을 때 생긴다.

현재 구현에서 이미 가능한 창발 패턴은 다음과 같다.

| 입력 | 중간 반응 | 결과 |
| --- | --- | --- |
| fire + water | water가 steam으로 증발 | 불이 꺼지면서 증기 구름 생성 |
| fire + wet sand | wet sand가 dry sand로 복귀 | 젖은 지역이 다시 가연/흐름 가능한 지형으로 회복 |
| sand + water | wet sand 생성 | 흐르던 물이 무거운 퇴적층으로 변함 |
| spark + water | steam 또는 empty | 발화 시도가 물에 의해 끊기고 증기만 남음 |
| explosion + solid | 중심부 일부 제거, 외곽 fire/spark/smoke | 폭발이 단순 원형 이미지가 아니라 물질 흔적을 남김 |
| projectileFire + gas flow | 투사체 trail이 바람에 흔들림 | 같은 발사도 장면마다 다른 궤적을 남김 |

이런 결과가 창의적으로 느껴지는 이유는 플레이어가 원소를 "명령"하지 않고 "조건"을 던지기 때문이다. 예를 들어 불을 쏘는 행위는 단순한 `damage +20`이 아니라 다음 질문을 만든다.

- 여기에 물이 있나?
- 이 주변에 wet sand가 있나?
- 폭발이 solid를 건드리나?
- 기체 흐름이 위쪽으로 강한가?
- spark가 fire로 전환되기 전에 꺼질까?

결국 플레이어는 스킬을 누르는 사람이 아니라 전장 조건을 설계하는 사람이 된다.

## 7. 왜 CPU 전투와 GPU 필드를 분리해야 하는가

Noita식 시뮬레이션을 전투에 붙일 때 가장 위험한 설계는 GPU 물질 필드를 매 프레임 CPU로 읽어 전투 판정을 직접 바꾸는 것이다. 그 방식은 다음 문제를 만든다.

- GPU readback이 프레임 지연과 병목을 만든다.
- 같은 전투 결과를 테스트하기 어렵다.
- headless simulation에서 material field를 재현해야 한다.
- 밸런스 원인이 CPU 스킬인지 GPU 셀 반응인지 추적하기 어려워진다.

따라서 현재 프로젝트에는 다음 분리 원칙이 맞다.

| 계층 | 책임 |
| --- | --- |
| CPU combat | 체력, 피해, 충돌, 쿨다운, 적 스폰, 보상, headless 검증 |
| GPU material field | 원소 흔적, 물질 이동, 반응, 시각적 압력, 국소 환경 표현 |
| bridge event | `MaterialEmitter`로 CPU 사건을 GPU 필드에 단방향 전달 |
| future proxy | CPU hazard 또는 coarse probe로 필요한 정보만 제한적으로 되돌림 |

즉, GPU 필드는 전투의 원인 전체가 아니라 전투 사건이 남기는 환경적 결과다. 그리고 필요한 경우에만 제한된 정보가 CPU로 돌아온다.

## 8. 향후 양방향 연동 모델

완전한 GPU readback 대신 다음과 같은 proxy 모델을 권장한다.

### 8.1 CPU hazard proxy

폭발, 독구름, 화염 장판처럼 전투 판정이 필요한 효과는 CPU hazard를 별도로 생성한다.

```js
{
  type: 'burningZone',
  x,
  y,
  radius,
  damagePerSecond,
  lifetimeMs,
  materialEffects: {
    spawn: [...],
    tick: [...]
  }
}
```

GPU material field는 이 hazard를 시각화하고 확장해 보이게 만든다. 실제 피해 판정은 CPU hazard가 담당한다.

### 8.2 Coarse material probes

정밀한 셀 전체를 읽지 않고, 몇 개 구역만 낮은 빈도로 샘플링한다.

```text
probe area:
  center x/y
  radius
  requested channels: heat, wetness, smoke, solidness
  sample interval: 250-500ms
```

이 값은 적 AI나 스킬 보정에만 사용한다. 예를 들어 smoke density가 높으면 원거리 적의 조준 오차를 늘리고, wetness가 높으면 fire 계열 지속 시간을 낮출 수 있다.

### 8.3 Authoritative tags

전투 판정이 필요한 원소 상태는 GPU 셀 자체가 아니라 CPU tag로도 유지한다.

예시:

- `area.firePressure`
- `area.wetness`
- `area.smokeCover`
- `area.instability`

GPU는 이 값을 멋있게 보여주고, CPU는 이 값을 전투 규칙으로 쓴다. 이렇게 하면 "보이는 것"과 "판정되는 것"이 완전히 분리되지는 않지만, 테스트 가능한 범위로 유지된다.

## 9. 확장용 데이터 모델

원소가 늘어나면 shader에 hard-coded branch를 계속 추가하는 방식은 오래 버티기 어렵다. 다음과 같은 material definition을 별도 데이터로 정리하는 방향이 좋다.

```js
{
  id: 'oil',
  phase: 'liquid',
  density: 38,
  movement: {
    gravity: 1,
    flowSpeed: 0.8,
    viscosity: 0.35
  },
  thermal: {
    ignitesAt: 70,
    burnsFor: [80, 140],
    extinguishedBy: ['water', 'steam']
  },
  combat: {
    danger: 'fireFuel',
    aiAvoidance: 0.45
  },
  tags: ['liquid', 'flammable', 'slick']
}
```

반응은 material pair가 아니라 tag 중심으로 작성하는 것이 확장성이 좋다.

```js
{
  when: ['fire', 'wet'],
  chance: 0.65,
  output: ['steam', 'dryResidue'],
  heatDelta: -0.3
}
```

이 모델을 compile 단계에서 compact table로 바꾸면 shader는 문자열이 아니라 숫자 id와 bitset만 보면 된다.

## 10. 전투 강도 조절 파라미터

| 파라미터 | 위치 | 강도에 미치는 영향 |
| --- | --- | --- |
| `radius` | material effect/emitter | 위험 구역 크기 |
| `strength` | emitter | 셀 교체 확률, 흔적 밀도 |
| `frames` | emitter | 원소 주입 지속 시간 |
| `life` | cell | 잔류 시간 |
| `trailIntervalMs` | projectile energy | 투사체 흔적 빈도 |
| `trailLeakPerSecond` | projectile energy | trail과 충돌 폭발 사이 tradeoff |
| `minRadius/maxRadius` | energy explosion | 에너지 기반 폭발 크기 |
| `minDamage/maxDamage` | energy explosion | 에너지 기반 피해량 |
| `radialForce` | material emitter state | 폭발 팽창감 |
| `gasWindStrength` | material field config | smoke/fire/steam 이동 방향성 |
| `density` | shader/material model | 물질 간 자리 교환 우선순위 |

밸런스 원칙은 단순하다. 죽음이 너무 갑작스럽다면 `damage`보다 `life`, `radius`, `frames`를 먼저 줄인다. 화면은 강렬하지만 실제 판정은 약한 상태를 만들 수 있기 때문이다.

## 11. 스킬 설계 패턴

### 11.1 순수 피해형

가장 단순한 스킬이다.

- CPU damage 중심
- material effect는 작고 짧음
- 높은 판독성
- 초반 기본 공격에 적합

### 11.2 흔적형

투사체가 지나간 경로에 원소를 남긴다.

- `trailEffects` 사용
- trail이 길수록 공간 압박 증가
- 충돌 피해는 낮춰야 과밀하지 않음
- fire, poison, frost, lightning 계열에 적합

### 11.3 압축 에너지형

현재 `fireball`에 가까운 모델이다.

- 비행 중 에너지 보존 또는 누수
- 충돌 시 에너지 비율로 폭발 계산
- trail을 강하게 만들수록 충돌 폭발은 약하게 만들 수 있음
- 숙련자가 거리와 타이밍을 계산할 여지가 생김

### 11.4 환경 반응형

스킬 자체 피해보다 주변 물질과의 조합이 핵심이다.

- water field 위에서는 steam 폭발
- sand 위에서는 glass/rock 계열 생성
- smoke 안에서는 lightning chain 강화
- wet target에는 freeze, dry target에는 burn 강화

이 패턴부터는 CPU proxy 또는 coarse probe가 필요하다.

## 12. 테스트 전략

원소 전투는 시각적으로는 화려하지만 테스트는 분리해야 한다.

### 12.1 CPU 전투 테스트

이미 있는 `systems.test.js` 방향을 유지한다.

- 투사체 energy가 생성되는지
- trail effect가 정해진 interval에 생성되는지
- 충돌 시 `EnergyExplosion` event가 나오는지
- radius/damage가 energy ratio로 계산되는지
- material effect가 기대 profile/life/frames를 갖는지

이 테스트는 GPU 없이 실행되어야 한다.

### 12.2 Shader 규칙 테스트

현재처럼 shader source에 특정 profile branch가 존재하는지 검사하는 수준은 최소 안전장치다. 더 나아가려면 작은 grid를 CPU reference simulator로 구현하고 다음 규칙을 검증한다.

- sand + water -> wet sand
- water + heat -> steam
- fire + wet -> steam
- spark + wet -> steam/empty
- steam life 종료 -> empty 또는 water
- skill explosion fire가 일반 fire보다 빠르게 정리됨

### 12.3 Headless 전투 지표

`runHeadlessCombatSimulation`은 물질 필드 없이도 전투 강도 지표를 볼 수 있다.

- peak active enemies
- peak projectiles
- player hits
- player damage
- wave completion time
- skipped/backlogged spawns

향후 material proxy가 CPU 전투에 들어오면 다음 지표를 추가할 수 있다.

- hazard uptime
- average hazard overlap
- average safe area ratio
- player time under smoke cover
- enemy time inside fire pressure
- elemental combo count

## 13. 구현 로드맵

### Phase 1: 현재 구조 정리

- `MaterialEmitter` event schema를 문서화한다.
- skill definition에서 `materialEffects`, projectile `energy`, explosion effect를 일관된 포맷으로 유지한다.
- shader profile 이름과 JS profile 이름이 어긋나지 않게 테스트를 유지한다.

### Phase 2: CPU hazard proxy 확장

- fire explosion이 시각 효과뿐 아니라 짧은 `burningZone`을 만들 수 있게 한다.
- hazard는 CPU에서 피해와 수명을 관리한다.
- hazard tick마다 material effect를 선택적으로 다시 뿌린다.

### Phase 3: 원소별 combat tag 도입

- firePressure, wetness, smokeCover 같은 coarse state를 CPU에 둔다.
- 일부 스킬은 이 값을 보고 피해, 폭발 반경, 상태 이상을 보정한다.
- 적 AI는 danger tag를 보고 회피하거나 진입한다.

### Phase 4: 재료 정의 테이블화

- `materials.js`를 단순 UI 옵션에서 simulation definition으로 확장한다.
- shader hard-coded 규칙 중 일부를 compiled table로 이전한다.
- tag 기반 reaction authoring을 추가한다.

### Phase 5: 디버그/튜닝 도구

- material field overlay에 heat/wetness/smoke density view를 추가한다.
- emitter radius, strength, life, profile을 실시간 조정할 수 있게 한다.
- headless 결과와 시각 결과가 크게 어긋나지 않는지 비교한다.

## 14. 설계 원칙

1. 원소는 시각 효과가 아니라 전투 사건의 잔류 상태로 취급한다.
2. CPU 전투 판정은 테스트 가능해야 한다.
3. GPU field는 많이 계산하되, CPU로 자주 읽지 않는다.
4. 원소 반응은 개별 스킬 script보다 material/tag 규칙에 가깝게 둔다.
5. 강도는 피해량보다 공간, 시간, 정보량, 잔류 위험으로 먼저 조절한다.
6. 창의성은 많은 예외 규칙이 아니라 짧은 규칙들의 재결합에서 나온다.
7. profile을 분리해 같은 fire라도 projectile, explosion, ambient fire가 다르게 정리되게 한다.
8. 전투 결과가 너무 무작위로 보이면 random을 줄이는 대신 reaction order와 visual feedback을 더 명확히 한다.

## 15. 결론

Noita식 전투의 재미는 "불 스킬은 피해를 준다"가 아니라 "불이 세계에 남고, 그 세계가 다시 전투를 바꾼다"는 구조에서 나온다. `Skyfall-Mage2`는 이미 그 방향으로 갈 수 있는 기반을 갖고 있다.

현재 구현의 장점은 CPU 전투와 GPU material field가 명확히 분리되어 있다는 점이다. 이 구조를 유지하면 화려한 원소 시뮬레이션을 추가하면서도 headless 테스트, 웨이브 밸런싱, 피해 판정의 재현성을 잃지 않는다.

다음 단계의 핵심은 GPU 셀 전체를 전투 판정으로 끌고 오는 것이 아니라, CPU hazard proxy와 coarse elemental state를 통해 "보이는 원소"와 "판정되는 전투"를 느슨하게 연결하는 것이다. 그렇게 하면 전투는 더 강렬해지고, 플레이어는 매번 다른 방식으로 원소를 조합해 문제를 해결할 수 있다.

## 참고

- Noita official site: <https://noitagame.com/>
- 기존 프로젝트 문서: `docs/noita-webgpu-simulation-analysis.md`
- 기존 프로젝트 문서: `docs/noita-original-material-interaction-implementation-analysis.md`
