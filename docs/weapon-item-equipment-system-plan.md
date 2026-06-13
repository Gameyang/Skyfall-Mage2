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
  -> 밤하늘 전장 배경 위에 비행선 상점 오브젝트 등장
  -> 비행선 매대별 랜덤 무기 재고 표시
  -> 플레이어가 캐릭터를 원하는 상품 위치로 이동
  -> 상품 근처에서 coin 지불 후 구매
  -> 인벤토리 보관 또는 3개 무기 슬롯에 장착
  -> 슬롯 순서 조정
  -> 다음 Wave 시작
```

무기 상점은 별도 메뉴 화면이 아니라 전장 위에 등장하는 `인월드 정비 구간`이다. 플레이어가 밤하늘 배경과 캐릭터 조작을 유지한 채, `지금 가진 슬롯 3개를 어떤 공격 사이클로 구성할지` 결정한다.

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
| `AirshipShop` | wave 종료 후 전장에 등장하는 비행선 상점 오브젝트. |
| `ShopStand` | 비행선 아래 또는 주변에 배치되는 상품 위치. 플레이어가 접근하면 구매 UI가 열린다. |

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
8. displayName, price, compareSummary를 만든다.
9. offerId와 instanceId를 부여해 상점 재고에 넣는다.
```

필터 조건:

- `definition.minWave <= currentWave`
- `definition.baseElement`가 상점 타입과 일치
- 이미 같은 상점에 나온 `definitionId`는 중복 가중치 감소
- 플레이어가 같은 공격 방식만 장착 중이면 다른 공격 방식 가중치 증가
- 플레이어가 비어 있는 무기 슬롯을 가지고 있으면 저가 Common/Uncommon 보장

## 10. 상점 구매 규칙

무기 구매는 `coin`을 지불하고 `WeaponInstance`를 획득하는 방식이다.

기본 규칙:

- 구매 전 현재 coin이 가격 이상인지 확인한다.
- 구매 성공 시 coin을 차감한다.
- 구매한 무기는 먼저 인벤토리에 들어간다.
- 빈 무기 슬롯이 있으면 `즉시 장착` 버튼을 함께 제공한다.
- 구매한 상품은 해당 상점에서 품절 처리한다.
- 재고는 비행선 상점이 등장한 순간 고정된다. 같은 intermission 안에서는 위치를 벗어나도 바뀌지 않는다.
- 플레이어가 상품 위치의 상호작용 반경에 들어가면 상세 정보와 구매 가능 상태를 표시한다.
- 실제 구매는 확인 입력으로 처리한다. 단순 이동만으로 즉시 구매되면 실수 구매가 잦아진다.

상품 카드 표시 정보:

```text
[아이콘] 신속한 화염 미사일 지팡이 명중의
Rare / Fire Missile
공격력 19 / 쿨타임 0.88s / 범위 480 / 폭발 42
옵션: 쿨타임 -10%, 발사체 속도 +14%
92 coin
[구매] [구매 후 1번 슬롯에 장착]
```

### 10.1 인월드 비행선 상점 UX

wave가 끝나면 전장은 완전히 다른 화면으로 전환되지 않는다. 기존 밤하늘 전장 배경을 유지하고, 카메라와 캐릭터 위치도 전투의 연속처럼 남긴다.

상점 phase 규칙:

- 적 소환을 멈춘다.
- 자동 공격과 무기 쿨타임 진행을 멈춘다.
- 남은 적은 제거하거나 퇴각 연출로 정리한다.
- 위험한 투사체와 피해 판정은 제거한다.
- 플레이어 이동은 유지한다.
- 비행선 상점 오브젝트가 화면 위쪽 또는 배경 레이어에서 날아와 정박한다.
- 상품은 비행선 아래 매대, 매달린 화물칸, 보급 상자 같은 위치 오브젝트로 배치한다.
- 플레이어가 원하는 상품 위치로 이동하면 해당 상품의 상세 패널과 구매 버튼이 뜬다.
- 정비 완료 지점 또는 비행선 출발 레버에 접근해 다음 wave를 시작한다.

화면 예시:

```text
          [Airship Shop]
   [상품 A]   [상품 B]   [상품 C]   [리롤 장치]

                 Player
```

이 방식은 상점도 게임 공간의 일부처럼 느끼게 한다. 전투와 상점이 완전히 분리된 메뉴가 아니라, wave 사이 밤하늘에서 잠깐 내려오는 보급선 이벤트가 된다.

### 10.2 상품 위치 상호작용

각 상품은 `ShopStand`로 배치한다.

```ts
export interface ShopStand {
  standId: string;
  offerId: string;
  x: number;
  y: number;
  interactRadius: number;
  purchased: boolean;
}
```

상호작용 흐름:

```text
플레이어가 ShopStand 반경 진입
  -> 상품 요약 패널 표시
  -> 현재 장착 슬롯과 비교 표시
  -> 구매 가능하면 확인 입력 활성화
  -> 구매 성공 시 상품 오브젝트가 품절 상태로 변경
```

품절된 매대는 완전히 사라지기보다 `Sold Out`, 빈 화물칸, 꺼진 조명처럼 표시한다. 그래야 플레이어가 이미 구매한 위치를 기억하기 쉽다.

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

### 15.1 인월드 상점 표시

필수 표시:

- 현재 coin
- 비행선 상점 오브젝트
- 무기 재고 3-5개를 나타내는 상품 위치
- 등급 색상
- 원소 아이콘 또는 색상
- 공격 방식 라벨
- 핵심 수치 4개: 공격력, 쿨타임, 범위, 특수 수치
- 현재 장착 슬롯과 비교
- 접근 시 구매, 즉시 장착, 상세 보기
- 인벤토리 용량
- 다음 wave 시작 위치

비교 패널 예시:

```text
현재 2번 슬롯: 물 화살 지팡이
교체 후보: 신속한 화염 미사일 지팡이

공격력 10 -> 19
쿨타임 0.76s -> 0.88s
범위 420 -> 480
광역 없음 -> 폭발 42
```

상점 정보는 전체 화면을 덮는 모달이 아니라, 상품 근처에 붙는 compact panel과 하단 비교 패널로 나눈다. 플레이어는 캐릭터를 움직이며 어떤 상품을 볼지 직접 고른다.

### 15.2 장착 화면

필수 기능:

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
7. `AirshipShop`과 `ShopStand` 월드 오브젝트를 배치한다.
8. 상점 구매 시 `WeaponInstance`를 인벤토리에 추가하고 coin을 차감한다.
9. 인월드 상점 UI에 접근 구매, 비교, 즉시 장착, 슬롯 교환을 붙인다.
10. 등급/가격/스탯 예산을 wave 진행도와 함께 밸런싱한다.

## 19. 테스트 체크리스트

- 같은 seed, 같은 wave, 같은 shopType이면 같은 무기 재고가 생성된다.
- 다른 seed에서는 재고, 스탯, affix가 달라진다.
- wave가 낮을 때 높은 등급 무기가 나오지 않는다.
- wave 종료 후 비행선 상점이 전장 위에 등장하고 별도 화면으로 전환되지 않는다.
- shopIntermission 동안 플레이어 이동은 가능하지만 자동 공격과 적 소환은 멈춘다.
- 상품 위치에 접근하면 상세 패널이 뜨고, 위치를 벗어나면 닫힌다.
- coin이 부족하면 구매할 수 없다.
- 구매 성공 시 coin이 차감되고 인벤토리에 무기가 추가된다.
- 상품 매대는 구매 후 품절 상태로 바뀐다.
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
