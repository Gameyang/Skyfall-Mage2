# Weapon Item Equipment System Plan

작성일: 2026-06-13  
대상 프로젝트: `F:\Workspace\Skyfall-Mage2`  
관련 문서:

- `docs/roguelike-shop-system-plan.md`
- `docs/elemental-rpg-skill-ideation.md`
- `docs/v2-code-system-design-plan.md`

## 1. 목표

wave를 클리어하면 플레이어는 전투에서 모은 `coin`으로 랜덤 상점에 입장하고, 디아블로식 랜덤 옵션이 붙은 무기를 구매해 다음 wave를 준비한다.

이 문서는 `무기 아이템 정의`, `랜덤 옵션 생성`, `무기 슬롯 장착`, `인벤토리 정비`, `상점 구매`의 기준을 정한다.

핵심 목표:

- 무기는 `기본 원소 1개 + 공격 방식 1개`의 조합으로 만든다.
- 같은 무기라도 공격력, 발사체 이동 속도, 발사 쿨타임, 공격 범위, 공격 방식 옵션이 달라지게 한다.
- 유저는 최대 3개 무기 슬롯을 가진다.
- 장착된 무기는 슬롯 순서대로 자동 공격한다.
- 유저는 wave 사이 상점에서 무기를 구매하고, 인벤토리와 장착 슬롯을 정비할 수 있다.
- 랜덤 생성 아이템이 많아져도 데이터 정의와 밸런싱이 무너지지 않도록 `정의 데이터`와 `생성된 인스턴스`를 분리한다.

## 2. 게임 루프 안에서의 위치

```text
Wave Clear
  -> coin 지급
  -> 전투 정지, 적 소환 정지
  -> 무기 아이템 상세 패널 4개를 2x2로 전체 화면에 배치
  -> 모든 스탯과 부가 옵션은 ??? 상태로 잠김
  -> 플레이어가 원하는 패널 칸으로 이동한 뒤 멈춤
  -> 코인이 1개씩 소모되며 현재 ??? 게이지가 채워짐
  -> 기본 스탯을 모두 언락하면 해당 아이템 획득 확정
  -> 추가로 부가 옵션을 언락한 만큼 아이템에 붙여 획득
  -> 인벤토리 보관 또는 3개 무기 슬롯에 장착
  -> 슬롯 순서 조정
  -> 다음 Wave 시작
```

무기 상점은 상점 NPC나 비행선이 아니라 `미감정 아이템 4개를 직접 열어보는 정비 구간`이다. 플레이어는 한 번에 4개의 기회를 받고, 코인을 써서 어떤 아이템인지 조금씩 공개한다. 설계 의도는 아이템을 대량으로 떨어뜨려 비교하게 만드는 스트레스 대신, 제한된 4개의 후보를 직접 감정하면서 랜덤 옵션을 열어보는 재미를 주는 것이다.

## 3. 용어

| 용어 | 의미 |
| --- | --- |
| `WeaponDefinition` | 무기의 기본 설계도. 원소, 공격 방식, 기본 스탯 범위, 허용 옵션 풀을 가진다. |
| `WeaponInstance` | 상점에서 실제로 굴려진 무기 아이템. 고유 ID, 등급, 랜덤 스탯, affix, 가격을 가진다. |
| `AttackPattern` | 투사체, 부채꼴, 추적탄, 광역 폭발 같은 공격 방식 정의. |
| `Affix` | 랜덤 접두/접미 옵션. 스탯 보정이나 특수 효과를 제공한다. |
| `Rarity` | Common, Uncommon, Rare, Epic, Legendary 등급. 스탯 예산과 옵션 개수를 결정한다. |
| `LoadoutSlot` | 전투에 쓰이는 1-3번 무기 장착 슬롯. 순서가 자동 공격 순서를 결정한다. |
| `InventorySlot` | 구매했지만 장착하지 않은 무기를 보관하는 인벤토리 칸. |
| `RevealPanel` | 화면 2x2에 배치되는 미감정 아이템 패널 1개. 총 4개가 등장한다. |
| `RevealRow` | 패널 안의 잠긴 스탯 또는 부가 옵션 한 줄. 처음에는 `???`로 표시된다. |
| `RevealGauge` | `3/10`처럼 표시되는 코인 진행 게이지. 코인이 1개씩 소모되며 채워진다. |
| `BasicStatRow` | 아이템 획득에 반드시 필요한 기본 스탯 행. 순서는 고정이고 비용은 저렴하다. |
| `AffixRow` | 선택적으로 여는 부가 옵션 행. 4-6개가 있고 뒤로 갈수록 비용이 크게 오른다. |

## 4. 무기 구성 규칙

무기 한 개는 아래 조합으로 생성한다.

```text
Weapon = BaseElement + AttackPattern + RolledStats + Affixes
```

### 4.1 기본 원소

초기 원소는 현재 전투 구현과 맞춰 4개를 기준으로 한다.

| 원소 | 전투 역할 | 기본 느낌 |
| --- | --- | --- |
| `fire` | 광역 피해, 폭발, 지속 피해 | 강하지만 흔들림이 큰 공격 |
| `water` | 둔화, 안정성, 낙하/분산 | 제어와 생존 보조 |
| `electric` | 빠른 타격, 연쇄, 순간 피해 | 쿨타임과 속도 중심 |
| `sand` | 다중 발사, 물리 투사체, 장판 견제 | 탄막과 방어적 공간 제어 |

초기 상점은 원소별 무기 상점을 분리한다.

```text
불 무기 상점
물 무기 상점
전기 무기 상점
모래 무기 상점
```

### 4.2 공격 방식

공격 방식은 무기의 플레이 감각을 결정한다.

| 공격 방식 | 설명 | 주요 스탯 |
| --- | --- | --- |
| `bolt` | 단일 대상 기본 투사체 | 공격력, 발사체 속도, 쿨타임 |
| `fan` | 여러 발을 부채꼴로 발사 | 발사 수, 확산각, 공격 범위 |
| `missile` | 느리지만 추적하는 투사체 | 추적력, 폭발 범위, 쿨타임 |
| `meteor` | 지연 후 광역 낙하 공격 | 공격 범위, 피해량, 시전 지연 |
| `beam` | 짧은 시간 관통 또는 지속 피해 | 지속 시간, 틱 피해, 사거리 |
| `rain` | 위쪽에서 여러 투사체 낙하 | 폭, 발사 수, 낙하 속도 |
| `orbit` | 플레이어 주변을 돌며 타격 | 회전 반경, 지속 시간, 타격 간격 |

초기 MVP는 `bolt`, `fan`, `missile`, `meteor`, `rain`부터 구현한다. `beam`, `orbit`은 투사체/히트 시스템이 안정된 뒤 추가한다.

## 5. 핵심 스탯

무기 등급과 가격은 아래 스탯의 총 예산으로 결정한다.

| 스탯 | 의미 | 낮을 때 | 높을 때 |
| --- | --- | --- | --- |
| `damage` | 1회 명중 기준 피해량 | 안정적이지만 약함 | 강하지만 가격과 쿨타임 부담 증가 |
| `projectileSpeed` | 발사체 이동 속도 | 회피 가능, 장판형에 적합 | 명중 안정성 증가 |
| `cooldownMs` | 해당 무기의 재공격 시간 | 자주 발사 | 느리지만 강한 무기 가능 |
| `attackRange` | 타겟 탐색 및 유효 사거리 | 근접 운용 | 안전한 원거리 운용 |
| `areaRadius` | 폭발, 장판, 광역 판정 범위 | 단일/좁은 공격 | 군중 제어와 광역 피해 |
| `projectileCount` | 한 번에 나가는 발사체 수 | 단일 집중 | 탄막/분산 |
| `castDelayMs` | 발사 전 지연 시간 | 즉시 반응 | 강한 광역 공격의 리스크 |

`cooldownMs`는 작을수록 좋은 스탯이므로 등급 점수 계산 시 역방향으로 평가한다.

## 6. 등급 결정

등급은 단순히 이름만 바꾸는 값이 아니라 `스탯 예산`, `옵션 개수`, `가격`, `상점 등장 시점`을 동시에 결정한다.

| 등급 | 스탯 예산 | affix 수 | 등장 시점 | 의도 |
| --- | ---: | ---: | --- | --- |
| Common | 1.00x | 0-1 | 초반부터 | 기본 교체용 |
| Uncommon | 1.18x | 1 | Wave 3+ | 방향성이 있는 무기 |
| Rare | 1.42x | 2 | Wave 6+ | 빌드 핵심 후보 |
| Epic | 1.75x | 3 | Wave 10+ | 강한 시너지 무기 |
| Legendary | 2.15x | 3 + 고유 효과 | Wave 14+ 또는 보스 후 | 판의 방향을 바꾸는 무기 |

권장 등급 산식:

```text
powerScore =
  damageScore
  + projectileSpeedScore
  + cooldownScore
  + rangeScore
  + areaScore
  + patternScore
  + affixScore

rarity = scoreBand(powerScore, waveIndex, shopBias)
price = basePrice * rarityMultiplier * waveMultiplier * statQualityMultiplier
```

상점에서 먼저 등급을 뽑고 스탯을 굴리는 방식을 기본으로 한다. 이렇게 하면 Wave 4 상점에서 Legendary급 스탯이 우연히 튀어나오는 문제를 막기 쉽다.

## 7. 랜덤 옵션 설계

랜덤 옵션은 `prefix`, `suffix`, `uniqueEffect`로 나눈다.

### 7.1 Prefix

Prefix는 공격 성향을 바꾼다.

| Prefix | 효과 예시 | 허용 등급 |
| --- | --- | --- |
| `날카로운` | damage +10-18% | Common+ |
| `신속한` | cooldownMs -6-12% | Uncommon+ |
| `관통하는` | projectile pierce +1 | Rare+ |
| `폭발하는` | areaRadius +12-25% | Rare+ |
| `갈라지는` | projectileCount +1, damage -8% | Rare+ |
| `과충전된` | electric 계열 chain chance 추가 | Epic+ |

### 7.2 Suffix

Suffix는 운용 편의나 보조 효과를 준다.

| Suffix | 효과 예시 | 허용 등급 |
| --- | --- | --- |
| `명중의` | projectileSpeed +8-20% | Common+ |
| `사거리의` | attackRange +10-18% | Common+ |
| `회수의` | 적 처치 시 coin 획득률 +3-7% | Uncommon+ |
| `집중의` | 같은 원소 무기 장착 수에 따라 damage +4% | Rare+ |
| `연쇄의` | 명중 후 가까운 적에게 2차 피해 | Epic+ |
| `균열의` | GPU material 반응 강도 증가 | Epic+ |

### 7.3 Legendary 고유 효과

Legendary는 일반 affix와 별개로 고유 효과를 가진다.

예시:

| 고유 효과 | 설명 |
| --- | --- |
| `Inferno Split` | fire projectile이 폭발 후 작은 fire bolt 3개로 분열 |
| `Tide Lock` | water 명중 대상 주변에 짧은 둔화 영역 생성 |
| `Chain Overload` | electric 연쇄가 마지막 대상에서 작은 폭발 발생 |
| `Sand Crown` | sand 투사체가 일정 확률로 방어용 orbit 파편 생성 |

고유 효과는 수치 보정만으로 만들지 않는다. 플레이어가 카드 설명을 읽었을 때 공격 방식이 달라진다고 느껴져야 한다.

## 8. 무기 인스턴스 데이터 모델

정의 데이터와 실제 아이템을 반드시 분리한다.

### 8.1 WeaponDefinition

```ts
export interface WeaponDefinition {
  id: string;
  name: string;
  baseElement: 'fire' | 'water' | 'electric' | 'sand';
  attackPattern: AttackPatternId;
  tags: string[];
  minWave: number;
  baseStats: WeaponStatRange;
  allowedAffixTags: string[];
  spriteId: string;
}
```

예시:

```js
{
  id: 'fire_missile_staff',
  name: 'Fire Missile Staff',
  baseElement: 'fire',
  attackPattern: 'missile',
  tags: ['weapon', 'fire', 'projectile', 'homing', 'explosion'],
  minWave: 4,
  baseStats: {
    damage: [14, 22],
    projectileSpeed: [250, 380],
    cooldownMs: [950, 1350],
    attackRange: [360, 520],
    areaRadius: [24, 48],
  },
  allowedAffixTags: ['damage', 'cooldown', 'projectile', 'area', 'fire'],
  spriteId: 'fire_missile_staff',
}
```

### 8.2 WeaponInstance

```ts
export interface WeaponInstance {
  instanceId: string;
  definitionId: string;
  displayName: string;
  rarity: Rarity;
  level: number;
  rolledStats: WeaponStats;
  affixes: RolledAffix[];
  uniqueEffectId?: string;
  price: number;
  seed: string;
  createdAtWave: number;
  source: 'shop' | 'reward' | 'debug';
}
```

예시:

```js
{
  instanceId: 'weapon-7f3a',
  definitionId: 'fire_missile_staff',
  displayName: '신속한 화염 미사일 지팡이 명중의',
  rarity: 'rare',
  level: 7,
  rolledStats: {
    damage: 19,
    projectileSpeed: 342,
    cooldownMs: 880,
    attackRange: 480,
    areaRadius: 42,
  },
  affixes: [
    { affixId: 'prefix_quick', stat: 'cooldownMs', operation: 'multiply', value: 0.9 },
    { affixId: 'suffix_accuracy', stat: 'projectileSpeed', operation: 'multiply', value: 1.14 },
  ],
  price: 92,
  seed: 'shop-wave-7-offer-2',
  createdAtWave: 7,
  source: 'shop',
}
```

## 9. 랜덤 생성 절차

상점 재고는 아래 순서로 만든다.

```text
1. shopType과 waveIndex를 받는다.
2. wave 구간에 맞는 rarity를 뽑는다.
3. shopType에 맞는 baseElement 후보를 제한한다.
4. WeaponDefinition 후보를 필터링한다.
5. attackPattern 가중치를 적용해 무기 정의를 선택한다.
6. rarity 예산에 맞게 rolledStats를 생성한다.
7. affix 풀에서 중복되지 않게 옵션을 선택한다.
8. 기본 스탯 row와 부가 옵션 row를 만든다.
9. 패널에는 `???`와 revealCost만 표시하고 실제 수치는 숨긴다.
10. panelId와 instanceId를 부여해 2x2 RevealPanel에 배치한다.
```

필터 조건:

- `definition.minWave <= currentWave`
- `definition.baseElement`가 상점 타입과 일치
- 이미 같은 상점에 나온 `definitionId`는 중복 가중치 감소
- 플레이어가 같은 공격 방식만 장착 중이면 다른 공격 방식 가중치 증가
- 플레이어가 비어 있는 무기 슬롯을 가지고 있으면 저가 Common/Uncommon 보장

## 10. 4패널 미감정 상점 규칙

무기 구매는 완성된 상품을 바로 고르는 방식이 아니다. wave 종료 후 4개의 `RevealPanel`이 화면을 2x2로 채우고, 각 패널 안의 아이템 스탯은 모두 `???` 상태로 시작한다.

기본 규칙:

- 한 번의 상점 phase에는 무기 후보 패널 4개가 등장한다.
- 4개 후보는 상점 phase가 시작될 때 seed 기반으로 미리 결정된다.
- 화면 전체를 2x2 패널로 나누고, 플레이어 위치가 어느 패널 영역 안에 있는지 판정한다.
- 플레이어가 패널 안에서 멈춰 있을 때만 현재 선택된 `???` 게이지가 찬다.
- 이동 중에는 게이지가 차지 않는다.
- 패널 밖으로 나가면 진행 중이던 게이지는 0으로 초기화된다.
- 이미 언락한 row는 유지된다.
- 코인이 부족해도 같은 연출로 게이지가 차다가, coin이 0이 되는 순간 진행이 멈춘다.
- 모든 기본 스탯 row를 언락하면 해당 아이템은 획득 확정 상태가 된다.
- 부가 옵션 row는 선택이다. 언락한 부가 옵션만 최종 아이템에 붙는다.
- 획득 확정 후에도 같은 패널에 계속 머물면 남은 부가 옵션을 더 열 수 있다.
- 플레이어가 `획득 확정` 입력을 하거나 다음 wave 시작을 선택하면 해당 패널의 현재 언락 상태로 아이템을 받는다.

패널 예시:

```text
┌──────────────────────────────┐
│ ??? 미감정 지팡이             │
│ Rare / Fire / Missile         │
├──────────────────────────────┤
│ ??? 기본 스탯 1       0/4     │
│ ??? 기본 스탯 2       0/5     │
│ ??? 기본 스탯 3       0/6     │
│ ??? 기본 스탯 4       0/7     │
├──────────────────────────────┤
│ ??? 부가 옵션 1       0/10    │
│ ??? 부가 옵션 2       0/16    │
│ ??? 부가 옵션 3       0/24    │
│ ??? 부가 옵션 4       0/36    │
│ ??? 부가 옵션 5       0/52    │
└──────────────────────────────┘
```

### 10.1 패널 배치

wave가 끝나면 별도 상점 배경이나 비행선을 띄우지 않는다. 전투는 멈추고, 현재 밤하늘 전장 위에 4개의 아이템 상세 패널을 2x2로 배치한다.

```text
┌───────────────┬───────────────┐
│ Panel A       │ Panel B       │
│ 미감정 아이템 │ 미감정 아이템 │
├───────────────┼───────────────┤
│ Panel C       │ Panel D       │
│ 미감정 아이템 │ 미감정 아이템 │
└───────────────┴───────────────┘
```

상점 phase 규칙:

- 적 소환을 멈춘다.
- 자동 공격과 무기 쿨타임 진행을 멈춘다.
- 남은 적은 제거하거나 퇴각 연출로 정리한다.
- 위험한 투사체와 피해 판정은 제거한다.
- 플레이어 이동은 유지한다.
- 각 패널 영역은 월드 이동 판정 영역이기도 하다.
- 플레이어가 한 패널 영역 안에서 완전히 정지하면 그 패널의 다음 잠금 row가 충전된다.
- 플레이어가 이동하거나 다른 패널로 넘어가면 현재 충전 중인 row만 초기화된다.
- 이미 언락한 row와 이미 소모한 unlock 결과는 되돌리지 않는다.

### 10.2 기본 스탯 언락

기본 스탯은 아이템의 정체를 판단하는 최소 정보다. 순서는 모든 패널에서 고정한다.

권장 기본 스탯 순서:

```text
1. 기본 원소 + 공격 방식
2. 공격력
3. 발사 쿨타임
4. 공격 범위
5. 발사체 이동 속도 또는 공격 방식 전용 수치
```

기본 스탯 비용은 상대적으로 낮게 둔다. 플레이어가 4개 후보 중 최소 1개는 끝까지 확인할 수 있어야 한다.

초기 비용 예시:

| Row | 비용 | 언락 후 표시 |
| --- | ---: | --- |
| 기본 1 | 4 coin | `Fire / Missile` |
| 기본 2 | 5 coin | `공격력 19` |
| 기본 3 | 6 coin | `쿨타임 0.88s` |
| 기본 4 | 7 coin | `범위 480` |
| 기본 5 | 8 coin | `발사체 속도 342` |

기본 스탯을 모두 언락하면 아이템은 `획득 가능` 상태가 된다. 이 시점에 플레이어가 멈추면 더 비싼 부가 옵션 언락을 이어갈 수 있고, 확정 입력을 하면 현재까지 공개된 부가 옵션만 붙은 아이템을 얻는다.

### 10.3 부가 옵션 언락

부가 옵션은 4-6개를 미리 굴려두되, 전부 `???`로 숨긴다.

부가 옵션 비용은 뒤로 갈수록 크게 증가한다.

| Affix row | 비용 예시 | 의도 |
| --- | ---: | --- |
| 부가 1 | 10 coin | 가볍게 찍어볼 수 있는 첫 보너스 |
| 부가 2 | 16 coin | 선택 압력 시작 |
| 부가 3 | 24 coin | 좋은 아이템에 더 투자할지 판단 |
| 부가 4 | 36 coin | 고가 sink |
| 부가 5 | 52 coin | 후반 coin 소모처 |
| 부가 6 | 74 coin | 매우 좋은 후보에만 투자 |

부가 옵션은 언락한 개수만큼만 최종 `WeaponInstance.affixes`에 들어간다. 언락하지 않은 옵션은 폐기된다.

예시:

```text
기본 스탯 5개 언락 완료
부가 옵션 1 언락: 신속한 - 쿨타임 -8%
부가 옵션 2 언락: 명중의 - 발사체 속도 +12%
부가 옵션 3은 잠김

획득 결과:
신속한 화염 미사일 지팡이 명중의
affixes: [prefix_quick, suffix_swift]
```

### 10.4 정지 충전과 코인 소모

코인은 row가 완전히 언락될 때 한 번에 빠지는 것이 아니라, 게이지가 찰 때 1개씩 빠진다.

상호작용 흐름:

```text
플레이어가 Panel A 영역 진입
  -> 이동 중이면 대기
  -> 정지 상태가 되면 Panel A의 다음 잠금 row 선택
  -> 일정 tick마다 coin -1, revealProgress +1
  -> revealProgress == revealCost이면 row 언락
  -> 다음 잠금 row로 이동
```

중단 규칙:

- 플레이어가 움직이면 진행 중 row의 `revealProgress`는 유지하지 않고 0으로 초기화한다.
- 플레이어가 패널 영역 밖으로 나가도 진행 중 row의 `revealProgress`는 0으로 초기화한다.
- 이미 언락된 row는 유지한다.
- 이미 언락한 row에 사용한 coin은 환불하지 않는다.
- coin이 0이면 진행 중 row는 그 지점에서 멈춘다.
- coin을 추가로 얻을 방법이 상점 phase 안에 없다면, 플레이어는 현재 언락 상태로 확정하거나 포기해야 한다.

코인이 부족한 경우도 연출은 동일하다.

```text
부가 옵션 3 비용: 24
현재 coin: 9
정지 유지
  -> 0/24, coin 9
  -> 1/24, coin 8
  ...
  -> 9/24, coin 0
  -> coin 부족으로 충전 정지
```

플레이어가 패널 밖으로 나가면 이 `9/24` 진행도는 0으로 돌아간다. 단, 이미 열었던 기본 스탯과 이전 부가 옵션은 유지된다.

### 10.5 RevealPanel 데이터 모델

```ts
export interface RevealPanel {
  panelId: string;
  weaponInstanceId: string;
  quadrant: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  rows: RevealRow[];
  activeRowIndex: number;
  claimState: 'locked' | 'claimable' | 'claimed' | 'abandoned';
}

export interface RevealRow {
  rowId: string;
  type: 'basicStat' | 'affix';
  labelWhenLocked: '???';
  revealCost: number;
  revealProgress: number;
  revealed: boolean;
  statKey?: keyof WeaponStats;
  affixId?: string;
}
```

`WeaponInstance`는 상점 phase 시작 시 이미 완전히 굴려져 있어도 된다. 중요한 점은 플레이어에게 처음부터 보여주지 않는 것이다. UI는 `RevealRow.revealed`가 `true`인 값만 표시하고, 나머지는 `???`와 게이지만 보여준다.

### 10.6 4번의 기회와 reroll 감각

이 시스템의 핵심 재미는 `아이템을 줍고 버리는 반복`이 아니라 `4개의 감정 후보 중 어디에 코인을 더 넣을지 판단하는 것`이다.

- 플레이어는 4개 패널을 오가며 기본 스탯 일부만 열어볼 수 있다.
- 마음에 들지 않는 패널은 더 투자하지 않고 버릴 수 있다.
- 마음에 드는 패널은 기본 스탯을 끝까지 열어 획득 확정한다.
- 더 좋은 결과를 노리고 부가 옵션까지 비싸게 열 수 있다.
- 결과적으로 유저가 직접 옵션을 reroll하고 감정하는 듯한 감각을 준다.

기본적으로 패널 자체를 다시 굴리는 reroll 버튼은 MVP에 넣지 않는다. 먼저 4개 후보의 `부분 공개와 투자 중단`만으로 선택 압력을 만든다.

## 11. 인벤토리와 장착 슬롯

### 11.1 슬롯 구조

플레이어는 전투용 무기 슬롯 3개를 가진다.

```text
Weapon Slot 1
Weapon Slot 2
Weapon Slot 3
Inventory Slots...
```

규칙:

- 슬롯에는 `WeaponInstance`만 장착한다.
- 같은 `definitionId`의 무기도 서로 다른 인스턴스면 동시에 장착 가능하다.
- 같은 `instanceId`를 두 슬롯에 중복 장착할 수 없다.
- 슬롯이 비어 있으면 자동 공격 순서에서 건너뛴다.
- 인벤토리가 가득 찬 상태에서 구매하려면 즉시 장착, 판매, 버리기 중 하나를 선택해야 한다.

### 11.2 정비 액션

상점 화면과 인벤토리 화면에서 필요한 액션:

| 액션 | 설명 |
| --- | --- |
| `equip` | 인벤토리 무기를 지정 슬롯에 장착 |
| `unequip` | 장착 무기를 인벤토리로 이동 |
| `swapWeaponSlots` | 1-3번 무기 슬롯의 순서를 교환 |
| `swapInventoryItems` | 인벤토리 내부 위치 교환 |
| `replaceEquippedWeapon` | 새 무기를 장착하고 기존 무기를 인벤토리로 이동 |
| `sellWeapon` | 무기를 판매해 coin 일부 회수 |
| `compareWeapon` | 현재 슬롯 무기와 구매 후보의 핵심 수치 비교 |

### 11.3 슬롯 순서의 의미

무기 슬롯 순서는 자동 공격 순서다.

```text
1번 슬롯 공격
  -> 2번 슬롯 공격
  -> 3번 슬롯 공격
  -> 1번 슬롯 공격
```

초기 규칙은 `strict round-robin`으로 둔다.

- 다음 순번 슬롯이 쿨타임 중이면 해당 슬롯이 준비될 때까지 기다린다.
- 대상이 없어서 발사하지 못하면 짧은 재시도 지연 후 같은 슬롯을 다시 확인한다.
- 슬롯이 비어 있으면 다음 슬롯으로 즉시 넘어간다.
- 공격이 성공해야 다음 슬롯으로 순번이 넘어간다.

이 규칙은 슬롯 순서의 의미를 강하게 만든다. 다만 느린 무기 하나가 전체 공격 템포를 막을 수 있으므로, 테스트 후 필요하면 `ready-scan round-robin` 옵션을 추가한다.

`ready-scan round-robin` 대안:

- 다음 순번부터 3개 슬롯을 훑는다.
- 준비된 무기가 있으면 그 무기를 발사하고, 그 다음 슬롯을 다음 순번으로 둔다.
- 준비된 무기가 하나도 없으면 가장 빨리 쿨타임이 끝나는 무기까지 기다린다.

MVP는 strict 방식으로 시작하고, 플레이 감각이 답답하면 ready-scan으로 바꾼다.

## 12. 쿨타임과 공격 빈도

각 무기는 독립 쿨타임을 가진다.

```ts
export interface EquippedWeaponRuntimeState {
  slotIndex: 0 | 1 | 2;
  weaponInstanceId: string;
  cooldownRemainingMs: number;
}
```

자동 공격 시스템은 전역 쿨타임 하나로 모든 무기를 묶지 않는다. 각 슬롯의 무기가 자기 쿨타임을 소모하고, 순번 시스템은 어떤 슬롯을 다음에 시전할지만 결정한다.

권장 처리:

```text
updateWeaponCooldowns(dtMs)
  -> 모든 장착 무기의 cooldownRemainingMs 감소

updateWeaponSequence()
  -> 현재 sequenceIndex 슬롯 확인
  -> 비어 있으면 다음 슬롯
  -> 쿨타임이 남아 있으면 대기
  -> 타겟이 있으면 공격 생성
  -> 해당 무기 cooldownRemainingMs = rolledStats.cooldownMs
  -> sequenceIndex = nextSlot
```

현재 구현의 `equippedSkillIds`와 `skillSequence`는 이 구조의 원형으로 볼 수 있다. 이후에는 `skillId` 배열을 `weaponInstanceId` 배열로 확장하고, 공격 생성 시 `WeaponInstance.rolledStats`와 `WeaponDefinition.attackPattern`을 합성한다.

## 13. 공격 생성 책임

랜덤 무기 시스템에서 중요한 원칙은 `아이템 인스턴스가 직접 투사체 로직을 들고 있지 않는 것`이다.

책임 분리:

| 계층 | 책임 |
| --- | --- |
| `WeaponDefinition` | 어떤 원소와 공격 방식을 쓰는지 정의 |
| `WeaponInstance` | 이 판에서 굴린 수치와 옵션 저장 |
| `AttackPatternDefinition` | 투사체 생성 방식 정의 |
| `WeaponRuntimeBuilder` | definition + instance + affix를 합쳐 runtime attack spec 생성 |
| `ProjectileSystem` | 생성된 projectile spec을 실제 entity로 변환 |
| `HitSystem` | 명중, 피해, 광역 판정 처리 |

공격 생성 흐름:

```text
Equipped Weapon Slot
  -> WeaponInstance lookup
  -> WeaponDefinition lookup
  -> AttackPatternDefinition lookup
  -> apply rolledStats
  -> apply affixes
  -> create AttackSpec
  -> spawn projectiles / area hit / material effects
```

이렇게 해야 랜덤 옵션이 늘어나도 투사체 시스템이 아이템 개수만큼 복잡해지지 않는다.

## 14. 권장 파일 구조

초기 구현 시 권장 파일:

```text
src/game/content/
  weapons.js
  weaponAffixes.js
  attackPatterns.js

src/game/weapons/
  weaponRoller.js
  weaponPricing.js
  weaponRuntimeBuilder.js
  weaponSequence.js
  weaponInventory.js

src/game/shop/
  shopEncounter.js
  shopRoller.js
  purchaseSystem.js
```

상태 모델 권장:

```ts
export interface PlayerWeaponState {
  equippedWeaponInstanceIds: [string | null, string | null, string | null];
  inventoryWeaponInstanceIds: string[];
  weaponInstancesById: Record<string, WeaponInstance>;
  sequenceIndex: 0 | 1 | 2;
}
```

저장 데이터에는 `WeaponDefinition` 전체를 복사하지 않는다. 저장에는 `definitionId`, `rolledStats`, `affixes`, `seed`만 보관하고, 정적 정의는 콘텐츠 registry에서 다시 조회한다.

## 15. UI 요구사항

### 15.1 2x2 미감정 패널 표시

필수 표시:

- 현재 coin
- 2x2로 배치된 무기 패널 4개
- 각 패널의 등급, 원소 힌트, 무기 타입 힌트
- 잠긴 row의 `???` 표시
- 각 row의 코인 게이지: `0/4`, `3/10` 같은 형식
- 현재 충전 중인 row 강조
- 이미 언락된 row의 실제 수치
- 기본 스탯 전체 언락 여부
- 부가 옵션 언락 개수
- 획득 가능 상태
- 인벤토리 용량
- 다음 wave 시작 버튼

디아블로식 아이템 설명 참고 방향:

- 등급에 따라 패널 테두리와 아이템 이름 색상을 다르게 한다.
- 기본 스탯과 부가 옵션을 시각적으로 분리한다.
- 잠긴 값은 같은 너비의 `???`로 표시해 공개 전후 레이아웃이 흔들리지 않게 한다.
- 공개된 부가 옵션은 짧은 문장으로 표시한다.
- 비용 게이지는 버튼보다 row 오른쪽의 작은 숫자/바로 표시한다.

패널 표시 예시:

```text
┌──────────────────────────────┐
│ Rare ??? Staff               │
│ Fire / ???                   │
├──────────────────────────────┤
│ 원소/공격 방식     Fire Missile │
│ 공격력             19          │
│ 쿨타임             ???   3/6   │
│ 공격 범위          ???   0/7   │
│ 발사체 속도        ???   0/8   │
├──────────────────────────────┤
│ ??? 부가 옵션      0/10        │
│ ??? 부가 옵션      0/16        │
│ ??? 부가 옵션      0/24        │
│ ??? 부가 옵션      0/36        │
└──────────────────────────────┘
```

### 15.2 캐릭터 위치와 정지 판정

패널 UI는 화면 전체를 덮지만, 플레이어 캐릭터 조작은 유지한다. 각 패널은 화면 사분면과 연결된 선택 영역이다.

필수 피드백:

- 캐릭터가 들어간 패널을 강조한다.
- 캐릭터가 움직이는 동안에는 `이동 중` 상태로 표시하고 게이지를 멈춘다.
- 캐릭터가 정지하면 짧은 대기 후 현재 row가 충전된다.
- coin이 1개 빠질 때마다 숫자와 게이지가 동시에 증가한다.
- coin이 0이면 현재 row에 `coin 부족` 상태를 표시한다.
- 패널 밖으로 나가거나 다른 패널로 이동하면 현재 row의 부분 진행도가 0으로 돌아가는 것을 즉시 보여준다.

### 15.3 획득과 장착

기본 스탯이 모두 공개되기 전에는 아이템을 획득할 수 없다.

기본 스탯을 모두 공개하면:

- 패널에 `획득 가능` 표시를 붙인다.
- `획득` 입력을 활성화한다.
- 부가 옵션이 남아 있으면 `추가 감정 가능` 상태를 유지한다.
- 획득 시 언락된 부가 옵션만 붙은 `WeaponInstance`를 인벤토리에 넣는다.
- 빈 무기 슬롯이 있으면 획득 후 즉시 장착 선택지를 제공한다.

### 15.4 비교 표시

모든 정보가 처음부터 보이지 않기 때문에 비교 UI는 공개된 값만 비교한다.

비교 패널 예시:

```text
현재 2번 슬롯: 물 화살 지팡이
감정 후보: Rare ??? Staff

공격력 10 -> 19
쿨타임 0.76s -> ???
범위 420 -> ???
부가 옵션 공개 0/5
```

공개되지 않은 값은 비교하지 않는다. 추정값이나 예상 평균을 보여주면 감정의 재미가 약해진다.

### 15.5 시각 계층

우선순위:

1. 현재 coin
2. 현재 캐릭터가 서 있는 패널
3. 현재 충전 중인 row와 게이지
4. 기본 스탯 완료 여부
5. 부가 옵션 공개 결과
6. 획득/다음 wave 버튼

화면이 4개 패널로 꽉 차기 때문에, 장식보다 텍스트 가독성과 게이지 상태가 우선이다.

### 15.6 기존 장착 화면

아이템 획득 후에는 기존 장착/인벤토리 정비 흐름을 사용한다.

- 1-3번 슬롯을 가로 또는 세로로 명확히 표시
- 슬롯 순서 교환
- 인벤토리에서 슬롯으로 드래그 또는 버튼 장착
- 장착 중인 무기와 인벤토리 무기 비교
- 판매 또는 분해
- 다음 wave 시작 버튼

슬롯 순서는 전투 성능에 직접 영향을 주므로, 단순한 정렬이 아니라 `공격 순서 편집`으로 보여줘야 한다.

## 16. 밸런싱 기준

### 16.1 무기 선택 압력

좋은 상점 무기는 아래 선택지를 만든다.

- 더 높은 damage를 위해 cooldown이 긴 무기로 교체할 것인가
- 빠른 무기를 앞 슬롯에 둬 안정적으로 마무리할 것인가
- 광역 무기를 한 개 섞어 wave 밀집 구간을 처리할 것인가
- 같은 원소 3개로 시너지를 볼 것인가
- 서로 다른 원소를 섞어 GPU material 반응을 노릴 것인가

### 16.2 가격 기준

초기 가격 공식:

```text
basePrice = 28 + waveIndex * 4
price = basePrice * rarityMultiplier * patternMultiplier * statQualityMultiplier
```

권장 배율:

| 값 | 배율 |
| --- | ---: |
| Common | 1.00 |
| Uncommon | 1.35 |
| Rare | 1.90 |
| Epic | 2.70 |
| Legendary | 4.20 |
| bolt | 1.00 |
| fan | 1.18 |
| missile | 1.32 |
| meteor | 1.48 |
| rain | 1.36 |

판매 가격은 구매가의 25-35%로 둔다. 판매만 반복해 상점 리롤 비용을 무력화하지 않게 한다.

### 16.3 위험과 대응

| 위험 | 대응 |
| --- | --- |
| 공격력만 높은 무기가 항상 정답이 됨 | 쿨타임, 사거리, 공격 방식 점수를 가격과 등급에 강하게 반영 |
| 느린 무기가 strict 순서를 막아 답답함 | ready-scan round-robin 옵션 준비 |
| 랜덤 옵션 설명이 너무 어려움 | 카드에는 핵심 2줄만 표시하고 상세 패널로 분리 |
| 같은 원소만 강해짐 | wave 적 구성과 상점 가중치로 다른 원소 보정 |
| 상점 운이 나쁘면 장착 슬롯을 못 채움 | 빈 슬롯 보유 시 저가 무기 보장 |
| 인벤토리가 빨리 막힘 | 판매, 분해, 즉시 교체, 슬롯 확장 보상 제공 |
| 4패널이 너무 복잡함 | 기본 스탯 row는 고정 순서로 두고 부가 옵션만 선택 투자로 둠 |
| 패널 이동 중 실수로 코인이 빠짐 | 정지 상태에서만 충전하고 이동 중에는 절대 코인을 소모하지 않음 |
| 일부 진행도가 사라져 불쾌함 | 진행 중 row만 초기화하고 이미 언락한 row는 유지한다고 명확히 표시 |
| 코인 부족 상태가 버그처럼 보임 | coin 0에서 게이지가 멈추는 전용 피드백을 제공 |

## 17. 초기 콘텐츠 제안

### 17.1 무기 정의 MVP

| ID | 원소 | 공격 방식 | 등급 시작 | 역할 |
| --- | --- | --- | --- | --- |
| `fire_bolt_staff` | fire | bolt | Common | 기본 화염 단일 공격 |
| `fire_fan_staff` | fire | fan | Uncommon | 근거리 다중 화염 |
| `fire_missile_staff` | fire | missile | Uncommon | 추적 폭발 |
| `fire_meteor_staff` | fire | meteor | Rare | 지연 광역 폭발 |
| `water_bolt_staff` | water | bolt | Common | 안정적 단일 공격 |
| `water_burst_staff` | water | meteor | Uncommon | 짧은 광역 제어 |
| `rain_fall_staff` | water | rain | Rare | 낙하형 범위 공격 |
| `electric_bolt_staff` | electric | bolt | Common | 빠른 단일 공격 |
| `chain_lightning_staff` | electric | missile | Rare | 연쇄 공격 |
| `sand_bolt_staff` | sand | bolt | Common | 물리 투사체 |
| `sand_barrage_staff` | sand | fan | Uncommon | 다중 탄막 |

현재 `src/game/content/skills.js`에 있는 `fireball`, `water_bolt`, `water_burst`, `electric_bolt`, `sand_bolt`, `sand_barrage`, `rain_fall`은 위 무기 정의로 이전할 수 있는 기준 샘플이다.

### 17.2 초기 affix 풀

| ID | 등급 | 효과 |
| --- | --- | --- |
| `prefix_sharp` | Common | damage +10% |
| `prefix_quick` | Uncommon | cooldownMs -8% |
| `prefix_longshot` | Common | attackRange +12% |
| `suffix_swift` | Common | projectileSpeed +12% |
| `suffix_bursting` | Rare | areaRadius +18% |
| `suffix_split` | Rare | projectileCount +1, damage -8% |
| `suffix_coin` | Uncommon | 처치 시 coin 보너스 소량 |
| `suffix_element_focus` | Rare | 같은 원소 장착 수에 따라 damage 증가 |

## 18. 구현 순서

1. `WeaponDefinition`, `WeaponInstance`, `AffixDefinition` 데이터 스키마를 만든다.
2. 현재 스킬 정의를 무기 정의와 공격 패턴 정의로 나눌 수 있는 최소 어댑터를 만든다.
3. `weaponRoller`로 wave, shopType, seed 기반 랜덤 무기를 생성한다.
4. 플레이어 상태에 `equippedWeaponInstanceIds`, `inventoryWeaponInstanceIds`, `weaponInstancesById`를 추가한다.
5. 기존 `equippedSkillIds` 자동 공격을 `equippedWeaponInstanceIds` 기반으로 확장한다.
6. wave 종료 후 `shopIntermission` 상태를 추가하고 자동 공격, 쿨타임, 적 소환을 멈춘다.
7. `RevealPanel` 4개와 `RevealRow` 목록을 생성한다.
8. 캐릭터 위치가 2x2 패널 중 어디에 속하는지 판정한다.
9. 정지 상태에서만 `RevealGauge`가 차고 coin이 1개씩 소모되게 한다.
10. 기본 스탯 전체 언락 시 아이템 획득 가능 상태를 만든다.
11. 부가 옵션은 언락한 row만 최종 아이템에 적용한다.
12. 획득 후 인벤토리/장착/슬롯 교환 UI를 붙인다.
13. 등급/가격/스탯 예산을 wave 진행도와 함께 밸런싱한다.

## 19. 테스트 체크리스트

- 같은 seed, 같은 wave, 같은 shopType이면 같은 무기 재고가 생성된다.
- 다른 seed에서는 재고, 스탯, affix가 달라진다.
- wave가 낮을 때 높은 등급 무기가 나오지 않는다.
- wave 종료 후 4개의 미감정 아이템 패널이 2x2로 표시된다.
- shopIntermission 동안 플레이어 이동은 가능하지만 자동 공격과 적 소환은 멈춘다.
- 모든 스탯 row는 처음에 `???`와 게이지로 표시된다.
- 플레이어가 패널 안에서 정지할 때만 현재 row 게이지가 찬다.
- 이동 중에는 게이지가 차지 않고 coin도 소모되지 않는다.
- 패널 밖으로 나가면 진행 중 row의 게이지는 0으로 초기화된다.
- 이미 언락한 row는 유지된다.
- coin이 부족하면 남은 coin만큼 차오르다가 0에서 멈춘다.
- 기본 스탯을 모두 언락하기 전에는 아이템을 획득할 수 없다.
- 기본 스탯을 모두 언락하면 아이템 획득 가능 상태가 된다.
- 부가 옵션은 언락한 개수만 최종 아이템에 적용된다.
- 획득 성공 시 인벤토리에 무기가 추가된다.
- 빈 슬롯에 즉시 장착할 수 있다.
- 이미 장착된 instanceId를 다른 슬롯에 중복 장착할 수 없다.
- 1번, 2번, 3번 슬롯 순서대로 자동 공격한다.
- 쿨타임 중인 무기는 다시 발사하지 않는다.
- 슬롯 순서를 바꾸면 다음 전투의 공격 순서가 바뀐다.
- 저장/로드 후에도 WeaponInstance가 같은 수치와 옵션을 유지한다.

## 20. 결정이 필요한 항목

초기 구현 전에 확정할 항목:

- 자동 공격 순서를 strict round-robin으로 유지할지, ready-scan round-robin으로 시작할지
- 인벤토리 기본 칸 수
- 무기 판매 가격 비율
- 같은 원소 3개 장착 시 보너스를 MVP에 넣을지
- Legendary 고유 효과를 첫 구현에 포함할지
- 무기 강화와 무기 구매를 같은 상점에서 처리할지, 별도 상점으로 나눌지

권장 MVP 결정:

- 자동 공격은 strict round-robin으로 시작한다.
- 인벤토리 기본 칸은 12칸으로 둔다.
- 판매 가격은 구매가의 30%로 둔다.
- 같은 원소 보너스는 UI가 복잡해지므로 2차 구현으로 미룬다.
- Legendary는 데이터 구조만 열어두고, 첫 구현은 Rare까지 만든다.
- 무기 강화는 첫 구현에서 제외하고 구매/교체/판매에 집중한다.
