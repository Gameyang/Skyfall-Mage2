# Weapon Item Equipment System Plan

작성일: 2026-06-13  
대상 프로젝트: `F:\Workspace\Skyfall-Mage2`  
관련 문서:

- `docs/roguelike-shop-system-plan.md`
- `docs/elemental-rpg-skill-ideation.md`
- `docs/v2-code-system-design-plan.md`

## 1. 목표

wave를 클리어하면 플레이어는 전투에서 모은 `coin`으로 4개의 미감정 무기 패널을 열어본다. 무기는 디아블로식 랜덤 옵션 아이템처럼 생성되지만, 처음에는 모든 기본 스탯과 부가 옵션이 `???`로 잠겨 있다. 플레이어는 원하는 패널 영역에 캐릭터를 세워 coin을 1개씩 지불하고, 숨겨진 값을 하나씩 공개한 뒤 무기를 획득한다.

핵심 목표:

- 무기는 `기본 원소 1개 + 공격 방식 1개` 조합으로 만든다.
- 공격력, 발사체 이동 속도, 발사 쿨타임, 공격 범위, 공격 방식 전용 수치, 부가 옵션으로 아이템 개성을 만든다.
- wave마다 4개의 무기 후보를 제공한다.
- 모든 스탯은 처음에 `???`로 표시하고, `3/10` 같은 coin 게이지로 공개한다.
- 기본 스탯은 고정 순서와 저렴한 비용으로 공개한다.
- 부가 옵션은 4-6개를 제공하되, 뒤로 갈수록 공개 비용이 비싸다.
- 기본 스탯을 모두 공개하면 아이템 획득 가능 상태가 된다.
- 부가 옵션은 공개한 개수만 최종 아이템에 적용한다.
- 유저는 최대 3개 무기 슬롯을 가지고, 슬롯 순서를 자유롭게 바꿀 수 있다.

설계 의도는 아이템을 많이 떨어뜨려 비교하게 만드는 스트레스를 줄이고, 제한된 4개의 후보 안에서 직접 옵션을 열어보는 재미를 만드는 것이다. 유저는 패널을 오가며 조금씩 확인하거나, 마음에 드는 후보 하나에 coin을 몰아 넣을 수 있다.

## 2. 게임 루프 안에서의 위치

```text
Wave Clear
  -> coin 지급
  -> 전투 정지, 적 소환 정지
  -> 밤하늘 전장 배경 유지
  -> 무기 아이템 상세 패널 4개를 2x2로 전체 화면에 배치
  -> 모든 기본 스탯과 부가 옵션은 ??? 상태로 잠김
  -> 플레이어가 원하는 패널 칸으로 이동한 뒤 멈춤
  -> coin이 1개씩 소모되며 현재 ??? 게이지가 채워짐
  -> 기본 스탯을 모두 언락하면 해당 아이템 획득 가능
  -> 추가로 부가 옵션을 언락한 만큼 아이템에 붙여 획득
  -> 인벤토리 보관 또는 3개 무기 슬롯에 장착
  -> 슬롯 순서 조정
  -> 다음 Wave 시작
```

별도 상점 화면으로 전환하지 않는다. 감정 phase는 전투 화면 위에 얹히는 정비 구간이며, 플레이어 이동은 유지하지만 자동 공격과 적 소환은 멈춘다.

## 3. 용어

| 용어 | 의미 |
| --- | --- |
| `WeaponDefinition` | 무기의 기본 설계도. 원소, 공격 방식, 기본 스탯 범위, 허용 옵션 풀을 가진다. |
| `WeaponInstance` | 실제로 굴려진 무기 아이템. 고유 ID, 등급, 랜덤 스탯, 부가 옵션, seed를 가진다. |
| `AttackPattern` | 투사체, 부채꼴, 추적탄, 광역 폭발 같은 공격 방식 정의. |
| `Affix` | 랜덤 접두/접미 옵션. 스탯 보정이나 특수 효과를 제공한다. |
| `Rarity` | Common, Uncommon, Rare, Epic, Legendary 등급. 스탯 예산과 옵션 개수를 결정한다. |
| `RevealPanel` | 화면 2x2에 배치되는 미감정 아이템 패널 1개. 총 4개가 등장한다. |
| `RevealRow` | 패널 안의 잠긴 스탯 또는 부가 옵션 한 줄. 처음에는 `???`로 표시된다. |
| `RevealGauge` | `3/10`처럼 표시되는 coin 진행 게이지. coin이 1개씩 소모되며 채워진다. |
| `BasicStatRow` | 아이템 획득에 반드시 필요한 기본 스탯 행. 순서는 고정이고 비용은 저렴하다. |
| `AffixRow` | 선택적으로 여는 부가 옵션 행. 4-6개가 있고 뒤로 갈수록 비용이 크게 오른다. |
| `LoadoutSlot` | 전투에 쓰이는 1-3번 무기 장착 슬롯. 순서가 자동 공격 순서를 결정한다. |
| `InventorySlot` | 획득했지만 장착하지 않은 무기를 보관하는 인벤토리 칸. |

## 4. 무기 구성 규칙

무기 한 개는 아래 조합으로 생성한다.

```text
Weapon = BaseElement + AttackPattern + RolledStats + RevealedAffixes
```

`WeaponInstance` 자체는 감정 phase 시작 시 이미 완전히 굴려져 있어도 된다. 중요한 점은 플레이어에게 처음부터 보여주지 않는 것이다. UI는 `RevealRow.revealed`가 `true`인 값만 표시하고, 나머지는 `???`와 게이지만 보여준다.

### 4.1 기본 원소

초기 원소는 현재 전투 구현과 맞춰 4개를 기준으로 한다.

| 원소 | 전투 역할 | 기본 느낌 |
| --- | --- | --- |
| `fire` | 광역 피해, 폭발, 지속 피해 | 강하지만 흔들림이 큰 공격 |
| `water` | 둔화, 안정성, 낙하/분산 | 제어와 생존 보조 |
| `electric` | 빠른 타격, 연쇄, 순간 피해 | 쿨타임과 속도 중심 |
| `sand` | 다중 발사, 물리 투사체, 장판 견제 | 탄막과 방어적 공간 제어 |

4개 패널 안에서는 원소가 너무 한쪽으로 몰리지 않게 보정한다.

### 4.2 공격 방식

공격 방식은 무기의 플레이 감각을 결정한다.

| 공격 방식 | 설명 | 주요 스탯 |
| --- | --- | --- |
| `bolt` | 단일 대상 기본 투사체 | 공격력, 발사체 속도, 쿨타임 |
| `fan` | 여러 발을 부채꼴로 발사 | 발사 수, 확산각, 공격 범위 |
| `missile` | 느리지만 추적하는 투사체 | 추적력, 폭발 범위, 쿨타임 |
| `meteor` | 지연 후 광역 낙하 공격 | 공격 범위, 피해량, 시전 지연 |
| `rain` | 위쪽에서 여러 투사체 낙하 | 폭, 발사 수, 낙하 속도 |
| `beam` | 짧은 시간 관통 또는 지속 피해 | 지속 시간, 틱 피해, 사거리 |
| `orbit` | 플레이어 주변을 돌며 타격 | 회전 반경, 지속 시간, 타격 간격 |

초기 MVP는 `bolt`, `fan`, `missile`, `meteor`, `rain`부터 구현한다. `beam`, `orbit`은 투사체/히트 시스템이 안정된 뒤 추가한다.

## 5. 기본 스탯과 공개 순서

기본 스탯은 아이템 획득에 반드시 필요한 정보다. 모든 패널에서 순서를 고정해 플레이어가 판단하기 쉽게 만든다.

권장 기본 스탯 순서:

1. 기본 원소 + 공격 방식
2. 공격력
3. 발사 쿨타임
4. 공격 범위
5. 발사체 이동 속도 또는 공격 방식 전용 수치

기본 비용 예시:

| Row | 비용 | 공개 후 표시 |
| --- | ---: | --- |
| 기본 1 | 4 coin | `Fire / Missile` |
| 기본 2 | 5 coin | `공격력 19` |
| 기본 3 | 6 coin | `쿨타임 0.88s` |
| 기본 4 | 7 coin | `범위 480` |
| 기본 5 | 8 coin | `발사체 속도 342` |

기본 스탯 비용은 상대적으로 저렴하게 둔다. 한 wave 보상으로 4개 후보 중 최소 1개는 기본 스탯을 끝까지 열어볼 수 있어야 한다.

## 6. 부가 옵션

부가 옵션은 4-6개를 미리 굴려두되, 전부 `???`로 숨긴다.

| Affix row | 비용 예시 | 의도 |
| --- | ---: | --- |
| 부가 1 | 10 coin | 가볍게 열어볼 수 있는 첫 보너스 |
| 부가 2 | 16 coin | 선택 압력 시작 |
| 부가 3 | 24 coin | 좋은 아이템에 더 투자할지 판단 |
| 부가 4 | 36 coin | 고가 sink |
| 부가 5 | 52 coin | 후반 coin 소모처 |
| 부가 6 | 74 coin | 매우 좋은 후보에만 투자 |

부가 옵션은 공개한 개수만큼만 최종 `WeaponInstance.affixes`에 들어간다. 공개하지 않은 옵션은 폐기된다.

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

## 7. 등급 결정

등급은 단순히 이름만 바꾸는 값이 아니라 `스탯 예산`, `부가 옵션 후보 수`, `공개 비용`, `등장 시점`을 함께 결정한다.

| 등급 | 스탯 예산 | affix 후보 수 | 등장 시점 | 의도 |
| --- | ---: | ---: | --- | --- |
| Common | 1.00x | 4 | 초반부터 | 기본 교체용 |
| Uncommon | 1.18x | 4-5 | Wave 3+ | 방향성이 있는 무기 |
| Rare | 1.42x | 5 | Wave 6+ | 빌드 핵심 후보 |
| Epic | 1.75x | 5-6 | Wave 10+ | 강한 시너지 무기 |
| Legendary | 2.15x | 6 + 고유 효과 | Wave 14+ 또는 보스 후 | 판의 방향을 바꾸는 무기 |

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

rarity = scoreBand(powerScore, waveIndex, candidateBias)
revealCostBudget = baseCost * rarityMultiplier * waveMultiplier * statQualityMultiplier
```

감정 후보 생성 시 먼저 등급을 뽑고 스탯을 굴리는 방식을 기본으로 한다. 이렇게 하면 Wave 4에서 Legendary급 스탯이 우연히 튀어나오는 문제를 막기 쉽다.

## 8. 랜덤 옵션 설계

랜덤 옵션은 `prefix`, `suffix`, `uniqueEffect`로 나눈다.

### 8.1 Prefix

Prefix는 공격 성향을 바꾼다.

| Prefix | 효과 예시 | 허용 등급 |
| --- | --- | --- |
| `날카로운` | damage +10-18% | Common+ |
| `신속한` | cooldownMs -6-12% | Uncommon+ |
| `관통하는` | projectile pierce +1 | Rare+ |
| `폭발하는` | areaRadius +12-25% | Rare+ |
| `갈라지는` | projectileCount +1, damage -8% | Rare+ |
| `과충전된` | electric 계열 chain chance 추가 | Epic+ |

### 8.2 Suffix

Suffix는 운용 편의나 보조 효과를 준다.

| Suffix | 효과 예시 | 허용 등급 |
| --- | --- | --- |
| `명중의` | projectileSpeed +8-20% | Common+ |
| `사거리의` | attackRange +10-18% | Common+ |
| `회수의` | 적 처치 시 coin 획득률 +3-7% | Uncommon+ |
| `집중의` | 같은 원소 무기 장착 수에 따라 damage +4% | Rare+ |
| `연쇄의` | 명중 후 가까운 적에게 2차 피해 | Epic+ |
| `균열의` | GPU material 반응 강도 증가 | Epic+ |

### 8.3 Legendary 고유 효과

Legendary는 일반 affix와 별개로 고유 효과를 가진다.

| 고유 효과 | 설명 |
| --- | --- |
| `Inferno Split` | fire projectile이 폭발 후 작은 fire bolt 3개로 분열 |
| `Tide Lock` | water 명중 대상 주변에 짧은 둔화 영역 생성 |
| `Chain Overload` | electric 연쇄가 마지막 대상에서 작은 폭발 발생 |
| `Sand Crown` | sand 투사체가 일정 확률로 방어용 orbit 파편 생성 |

고유 효과는 수치 보정만으로 만들지 않는다. 플레이어가 설명을 읽었을 때 공격 방식이 달라진다고 느껴져야 한다.

## 9. 데이터 모델

### 9.1 WeaponDefinition

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

### 9.2 WeaponInstance

```ts
export interface WeaponInstance {
  instanceId: string;
  definitionId: string;
  displayName: string;
  rarity: Rarity;
  level: number;
  rolledStats: WeaponStats;
  affixes: RolledAffix[];
  hiddenAffixes?: RolledAffix[];
  uniqueEffectId?: string;
  revealCostBudget: number;
  seed: string;
  createdAtWave: number;
  source: 'revealPanel' | 'reward' | 'debug';
}
```

감정 phase 안에서는 `hiddenAffixes`를 가지고 있다가, 획득 시 공개된 affix만 `affixes`로 확정한다. 구현 편의상 처음부터 `affixes`에 모두 넣고 `RevealRow.revealed`로 적용 여부를 제어해도 된다. 단, 전투 runtime에 넘길 때는 공개된 옵션만 적용해야 한다.

### 9.3 RevealPanel

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

## 10. 랜덤 생성 절차

감정 패널 후보는 아래 순서로 만든다.

```text
1. waveIndex와 revealSeed를 받는다.
2. 4개 패널의 rarity를 뽑는다.
3. 4개 패널 안에서 baseElement 다양성 가중치를 적용한다.
4. WeaponDefinition 후보를 필터링한다.
5. attackPattern 가중치를 적용해 무기 정의를 선택한다.
6. rarity 예산에 맞게 rolledStats를 생성한다.
7. affix 풀에서 중복되지 않게 4-6개 옵션을 선택한다.
8. 기본 스탯 row와 부가 옵션 row를 만든다.
9. 모든 row는 `revealed: false`, `revealProgress: 0`으로 시작한다.
10. panelId와 instanceId를 부여해 2x2 RevealPanel에 배치한다.
```

필터 조건:

- `definition.minWave <= currentWave`
- 같은 4패널 안에 이미 나온 `definitionId`는 중복 가중치 감소
- 같은 4패널 안에서 원소와 공격 방식이 너무 겹치지 않게 보정
- 플레이어가 같은 공격 방식만 장착 중이면 다른 공격 방식 가중치 증가
- 플레이어가 비어 있는 무기 슬롯을 가지고 있으면 저가 Common/Uncommon 보장
- 보스 wave 후에는 Rare 이상 후보와 affix row 수를 보정

## 11. 4패널 감정 규칙

무기 획득은 완성된 상품을 바로 고르는 방식이 아니다. wave 종료 후 4개의 `RevealPanel`이 화면을 2x2로 채우고, 각 패널 안의 아이템 스탯은 모두 `???` 상태로 시작한다.

기본 규칙:

- 한 번의 감정 phase에는 무기 후보 패널 4개가 등장한다.
- 4개 후보는 감정 phase가 시작될 때 seed 기반으로 미리 결정된다.
- 화면 전체를 2x2 패널로 나누고, 플레이어 위치가 어느 패널 영역 안에 있는지 판정한다.
- 플레이어가 패널 안에서 멈춰 있을 때만 현재 선택된 `???` 게이지가 찬다.
- 이동 중에는 게이지가 차지 않는다.
- 패널 밖으로 나가면 진행 중이던 게이지는 0으로 초기화된다.
- 이미 언락한 row는 유지된다.
- coin이 부족해도 같은 연출로 게이지가 차다가, coin이 0이 되는 순간 진행이 멈춘다.
- 모든 기본 스탯 row를 언락하면 해당 아이템은 획득 가능 상태가 된다.
- 부가 옵션 row는 선택이다. 언락한 부가 옵션만 최종 아이템에 붙는다.
- 획득 가능 후에도 같은 패널에 계속 머물면 남은 부가 옵션을 더 열 수 있다.

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
│ ??? 기본 스탯 5       0/8     │
├──────────────────────────────┤
│ ??? 부가 옵션 1       0/10    │
│ ??? 부가 옵션 2       0/16    │
│ ??? 부가 옵션 3       0/24    │
│ ??? 부가 옵션 4       0/36    │
│ ??? 부가 옵션 5       0/52    │
└──────────────────────────────┘
```

### 11.1 정지 충전과 coin 소모

coin은 row가 완전히 언락될 때 한 번에 빠지는 것이 아니라, 게이지가 찰 때 1개씩 빠진다.

```text
플레이어가 Panel A 영역 진입
  -> 이동 중이면 대기
  -> 정지 상태가 되면 Panel A의 다음 잠금 row 선택
  -> 일정 tick마다 coin -1, revealProgress +1
  -> revealProgress == revealCost이면 row 언락
  -> 다음 잠금 row로 이동
```

정지 판정 권장값:

- 이동 입력 없음
- 실제 속도 `0` 또는 아주 낮은 임계값 이하
- 최소 정지 시간 0.15-0.25초

### 11.2 중단 규칙

- 플레이어가 움직이면 진행 중 row의 `revealProgress`는 0으로 초기화한다.
- 플레이어가 패널 영역 밖으로 나가도 진행 중 row의 `revealProgress`는 0으로 초기화한다.
- 이미 언락된 row는 유지한다.
- 이미 언락한 row에 사용한 coin은 환불하지 않는다.
- coin이 0이면 진행 중 row는 그 지점에서 멈춘다.
- coin을 추가로 얻을 방법이 감정 phase 안에 없다면, 플레이어는 현재 언락 상태로 확정하거나 포기해야 한다.

### 11.3 coin 부족 예시

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

## 12. 획득과 인벤토리

### 12.1 획득 가능 조건

아이템 획득 조건:

- 해당 패널의 모든 기본 스탯 row가 공개됨
- 아직 `claimed` 상태가 아님
- 인벤토리에 빈 칸이 있거나 장착 교체 UI가 열릴 수 있음

기본 스탯을 모두 공개하기 전에는 아이템을 획득할 수 없다.

### 12.2 최종 아이템 적용

획득 시점에 `WeaponInstance`를 최종화한다.

```text
finalWeapon.rolledStats = hiddenWeapon.rolledStats
finalWeapon.affixes = revealedAffixRows.map(row => row.affix)
```

공개하지 않은 affix는 최종 아이템에 붙지 않는다.

### 12.3 인벤토리 규칙

- 획득한 무기는 먼저 인벤토리에 들어간다.
- 빈 무기 슬롯이 있으면 즉시 장착 선택지를 제공한다.
- 인벤토리가 가득 찬 상태에서는 즉시 장착, 판매, 버리기 중 하나를 선택해야 한다.
- 감정되지 않은 다른 후보는 다음 wave 시작 시 폐기한다.
- 획득한 무기의 공개 결과는 저장/로드 후에도 유지되어야 한다.

## 13. 무기 슬롯과 공격 순서

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
- 슬롯 순서는 감정 phase 이후 정비 화면에서 자유롭게 교환할 수 있다.

### 13.1 공격 순서

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

### 13.2 쿨타임

각 무기는 독립 쿨타임을 가진다.

```ts
export interface EquippedWeaponRuntimeState {
  slotIndex: 0 | 1 | 2;
  weaponInstanceId: string;
  cooldownRemainingMs: number;
}
```

자동 공격 시스템은 전역 쿨타임 하나로 모든 무기를 묶지 않는다. 각 슬롯의 무기가 자기 쿨타임을 소모하고, 순번 시스템은 어떤 슬롯을 다음에 시전할지만 결정한다.

## 14. 공격 생성 책임

랜덤 무기 시스템에서 중요한 원칙은 `아이템 인스턴스가 직접 투사체 로직을 들고 있지 않는 것`이다.

| 계층 | 책임 |
| --- | --- |
| `WeaponDefinition` | 어떤 원소와 공격 방식을 쓰는지 정의 |
| `WeaponInstance` | 이 판에서 굴린 수치와 공개된 옵션 저장 |
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
  -> apply revealed affixes
  -> create AttackSpec
  -> spawn projectiles / area hit / material effects
```

이렇게 해야 랜덤 옵션이 늘어나도 투사체 시스템이 아이템 개수만큼 복잡해지지 않는다.

## 15. UI 요구사항

### 15.1 2x2 감정 패널

```text
┌──────────────────────────────┬──────────────────────────────┐
│ Panel A                      │ Panel B                      │
│ Rare ??? Staff               │ Uncommon ??? Wand            │
│ ??? 기본 스탯 1       0/4    │ ??? 기본 스탯 1       0/4    │
│ ??? 기본 스탯 2       0/5    │ ??? 기본 스탯 2       0/5    │
│ ??? 부가 옵션 1       0/10   │ ??? 부가 옵션 1       0/10   │
├──────────────────────────────┼──────────────────────────────┤
│ Panel C                      │ Panel D                      │
│ Epic ??? Rod                 │ Rare ??? Staff               │
│ ??? 기본 스탯 1       0/6    │ ??? 기본 스탯 1       0/4    │
│ ??? 기본 스탯 2       0/7    │ ??? 기본 스탯 2       0/5    │
│ ??? 부가 옵션 1       0/14   │ ??? 부가 옵션 1       0/12   │
└──────────────────────────────┴──────────────────────────────┘
```

패널은 화면 전체를 덮지만, 플레이어 캐릭터 조작은 유지한다. 각 패널은 화면 사분면과 연결된 선택 영역이다.

### 15.2 필수 피드백

- 캐릭터가 들어간 패널을 강조한다.
- 캐릭터가 움직이는 동안에는 `이동 중` 상태로 표시하고 게이지를 멈춘다.
- 캐릭터가 정지하면 짧은 대기 후 현재 row가 충전된다.
- coin이 1개 빠질 때마다 숫자와 게이지가 동시에 증가한다.
- row가 공개되는 순간 짧은 reveal 효과를 준다.
- coin이 0이면 현재 row에 `coin 부족` 상태를 표시한다.
- 패널 밖으로 나가거나 다른 패널로 이동하면 현재 row의 부분 진행도가 0으로 돌아가는 것을 즉시 보여준다.
- 기본 스탯이 모두 공개되면 `획득 가능` 표시를 붙인다.

### 15.3 비교 표시

모든 정보가 처음부터 보이지 않기 때문에 비교 UI는 공개된 값만 비교한다.

```text
현재 2번 슬롯: 물 화살 지팡이
감정 후보: Rare ??? Staff

공격력 10 -> 19
쿨타임 0.76s -> ???
범위 420 -> ???
부가 옵션 공개 0/5
```

공개되지 않은 값은 비교하지 않는다. 추정값이나 예상 평균을 보여주면 감정의 재미가 약해진다.

### 15.4 장착 정비 UI

아이템 획득 후에는 장착/인벤토리 정비 흐름을 사용한다.

- 1-3번 슬롯을 명확히 표시
- 슬롯 순서 교환
- 인벤토리에서 슬롯으로 장착
- 장착 중인 무기와 인벤토리 무기 비교
- 판매 또는 버리기
- 다음 wave 시작 버튼

슬롯 순서는 전투 성능에 직접 영향을 주므로, 단순한 정렬이 아니라 `공격 순서 편집`으로 보여줘야 한다.

## 16. 권장 파일 구조

초기 구현 시 권장 파일:

```text
src/game/content/
  weapons.js
  weaponAffixes.js
  attackPatterns.js

src/game/weapons/
  weaponRoller.js
  weaponRuntimeBuilder.js
  weaponSequence.js
  weaponInventory.js

src/game/shop/
  revealShopEncounter.js
  revealPanelRoller.js
  revealProgressSystem.js
```

상태 모델 권장:

```ts
export interface PlayerWeaponState {
  equippedWeaponInstanceIds: [string | null, string | null, string | null];
  inventoryWeaponInstanceIds: string[];
  weaponInstancesById: Record<string, WeaponInstance>;
}

export interface RevealShopState {
  waveIndex: number;
  panels: RevealPanel[];
  activePanelId?: string;
  coinAtStart: number;
  status: 'inactive' | 'revealing' | 'equip' | 'complete';
}
```

## 17. 밸런싱 기준

### 17.1 선택 압력

좋은 감정 phase는 아래 선택지를 만든다.

- 4개 패널을 조금씩 열어볼 것인가
- 힌트가 좋은 후보 하나에 coin을 몰아 넣을 것인가
- 기본 스탯만 보고 바로 획득할 것인가
- 더 좋은 결과를 노리고 부가 옵션까지 열 것인가
- 다음 wave를 위해 coin을 아낄 것인가

### 17.2 coin 경제

초기 권장값:

| 구간 | wave 보상 coin | 기본 스탯 전체 비용 | 부가 옵션 1-2 비용 |
| --- | ---: | ---: | ---: |
| Wave 3-5 | 25-35 | 25-30 | 26 |
| Wave 6-10 | 45-65 | 32-42 | 32-44 |
| Wave 11+ | 70-110 | 45-60 | 44-70 |

목표:

- 기본 스탯 전체 공개는 한 wave 보상으로 최소 1개 후보에서 가능해야 한다.
- 4개 후보를 전부 깊게 열 수는 없어야 한다.
- 부가 옵션 3개 이상 공개는 의도적인 투자여야 한다.

### 17.3 위험과 대응

| 위험 | 대응 |
| --- | --- |
| 공격력만 높은 무기가 항상 정답이 됨 | 쿨타임, 사거리, 공격 방식 점수를 등급과 비용에 강하게 반영 |
| 느린 무기가 strict 순서를 막아 답답함 | ready-scan round-robin 옵션 준비 |
| 랜덤 옵션 설명이 너무 어려움 | 패널에는 핵심 수치만 표시하고 상세 설명은 보조 UI로 분리 |
| 같은 원소만 강해짐 | wave 적 구성과 후보 생성 보정으로 다른 원소 가치 제공 |
| 감정 운이 나쁘면 장착 슬롯을 못 채움 | 빈 슬롯 보유 시 저가 기본 후보 보장 |
| 인벤토리가 빨리 막힘 | 판매, 즉시 교체, 버리기, 슬롯 확장 보상 제공 |
| 4패널이 너무 복잡함 | 기본 스탯 row는 고정 순서로 두고 부가 옵션만 선택 투자로 둠 |
| 이동 중 실수로 coin이 빠짐 | 정지 상태에서만 충전하고 이동 중에는 절대 coin을 소모하지 않음 |
| 일부 진행도가 사라져 불쾌함 | 진행 중 row만 초기화하고 이미 언락한 row는 유지한다고 명확히 표시 |
| coin 부족 상태가 버그처럼 보임 | coin 0에서 게이지가 멈추는 전용 피드백 제공 |

## 18. 초기 콘텐츠 제안

### 18.1 무기 정의 MVP

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

### 18.2 초기 affix 풀

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

## 19. 구현 순서

1. `WeaponDefinition`, `WeaponInstance`, `AffixDefinition` 데이터 스키마를 만든다.
2. 현재 스킬 정의를 무기 정의와 공격 패턴 정의로 나눌 수 있는 최소 어댑터를 만든다.
3. `weaponRoller`로 wave, revealSeed 기반 랜덤 무기를 생성한다.
4. 플레이어 상태에 `equippedWeaponInstanceIds`, `inventoryWeaponInstanceIds`, `weaponInstancesById`를 추가한다.
5. 기존 `equippedSkillIds` 자동 공격을 `equippedWeaponInstanceIds` 기반으로 확장한다.
6. wave 종료 후 `shopIntermission` 상태를 추가하고 자동 공격, 쿨타임, 적 소환을 멈춘다.
7. `RevealPanel` 4개와 `RevealRow` 목록을 생성한다.
8. 캐릭터 위치가 2x2 패널 중 어디에 속하는지 판정한다.
9. 정지 상태에서만 `RevealGauge`가 차고 coin이 1개씩 소모되게 한다.
10. 패널 이탈 또는 이동 시 진행 중 row만 초기화한다.
11. 기본 스탯 전체 언락 시 아이템 획득 가능 상태를 만든다.
12. 부가 옵션은 언락한 row만 최종 아이템에 적용한다.
13. 획득 후 인벤토리/장착/슬롯 교환 UI를 붙인다.
14. 등급/공개 비용/스탯 예산을 wave 진행도와 함께 밸런싱한다.

## 20. 테스트 체크리스트

- 같은 seed, 같은 wave이면 같은 4개 패널과 같은 hidden `WeaponInstance`가 생성된다.
- 다른 seed에서는 후보, 스탯, affix가 달라진다.
- wave가 낮을 때 높은 등급 무기가 나오지 않는다.
- wave 종료 후 4개의 미감정 아이템 패널이 2x2로 표시된다.
- 감정 phase 동안 플레이어 이동은 가능하지만 자동 공격과 적 소환은 멈춘다.
- 모든 스탯 row는 처음에 `???`와 게이지로 표시된다.
- 기본 스탯 row 순서는 항상 고정이다.
- 부가 옵션 row 수는 4-6개 범위다.
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
- 저장/로드 후에도 `WeaponInstance`가 같은 수치와 공개 옵션을 유지한다.

## 21. 결정이 필요한 항목

초기 구현 전에 확정할 항목:

- 자동 공격 순서를 strict round-robin으로 유지할지, ready-scan round-robin으로 시작할지
- 인벤토리 기본 칸 수
- 무기 판매 가격 비율
- 같은 원소 3개 장착 시 보너스를 MVP에 넣을지
- Legendary 고유 효과를 첫 구현에 포함할지
- 감정 phase 안에서 패널을 2개 이상 획득할 수 있게 할지

권장 MVP 결정:

- 자동 공격은 strict round-robin으로 시작한다.
- 인벤토리 기본 칸은 12칸으로 둔다.
- 판매 가격은 획득 시점 추정 가치의 30%로 둔다.
- 같은 원소 보너스는 UI가 복잡해지므로 2차 구현으로 미룬다.
- Legendary는 데이터 구조만 열어두고, 첫 구현은 Rare까지 만든다.
- 한 감정 phase에서는 기본적으로 1개 아이템만 획득하게 하고, 추후 고비용 다중 획득을 검토한다.
