# Noita 원작 재료 입자 상호작용 구현 분석

작성일: 2026-05-29  
대상 프로젝트: `F:\Workspace\Skyfall-Mage2`  
관련 실험 코드: `tech-tests/noita-webgpu`

## 1. 목적과 범위

이 문서는 Noita 원작의 material particle 상호작용을 실제 시뮬레이션으로 구현하기 위한 분석 자료다. 목표는 원작 데이터를 그대로 복사하는 것이 아니라, 원작의 동작 구조를 구현 단위로 분해해서 `Skyfall-Mage2`의 WebGPU material field 또는 CPU reference simulator로 옮길 수 있게 만드는 것이다.

핵심 결론은 다음과 같다.

- Noita의 원천 데이터는 게임을 언팩해서 얻는 `data/materials.xml`이며, 재료 정의는 `CellData`, `CellDataChild`, `Reaction` 중심이다.
- 원작에서 "모래"는 독립 cell type이 아니라 `cell_type="liquid"`에 `liquid_sand="1"`이 붙은 하위 동작이다.
- 지형 대부분은 Box2D solid가 아니라 움직이지 않는 static sand/liquid 계열로 보는 편이 맞다.
- `cell_type="solid"`는 주로 상자, 유리, 얼음 조각 같은 물리 객체에 가깝고 Box2D 쪽과 연결된다.
- 반응은 특정 재료명뿐 아니라 `[water]`, `[lava]`, `[fire]`, `[corrodible]`, `[meltable]` 같은 tag 기반으로 확장된다.
- 완전한 원작 재현을 하려면 재료별 hard-coded switch보다 `materials.xml`을 파싱해서 material registry와 reaction table을 생성해야 한다.

현재 저장소의 `tech-tests/noita-webgpu`는 `empty`, `solid`, `sand`, `water`, `fire`, `smoke`, `spark`만 다루는 기술 검증 단계다. 이 문서는 그 다음 단계에서 필요한 데이터 모델, 업데이트 패스, 반응 규칙, 테스트 기준을 정리한다.

## 2. 자료 출처와 신뢰도

Noita 원작은 상용 게임이므로 원본 `materials.xml`을 이 저장소에 커밋하지 않는다. 구현 단계에서는 사용자의 로컬 Noita 설치본에서 `data.wak`을 언팩하고, 추출한 자료로 사내/개인 개발용 JSON을 생성하는 흐름이 안전하다.

참고한 공개 자료:

- Steam Noita 페이지: Noita는 픽셀 기반 물리, 연소, 용해, 동결, 증발을 핵심 기능으로 설명한다. <https://store.steampowered.com/app/881100/Noita/>
- Nolla Games modding wiki mirror: `data_wak_unpack.bat`로 게임 데이터를 언팩할 수 있다고 설명한다. <https://github-wiki-see.page/m/NollaGames/noita-modding/wiki/Getting-started>
- Noita Wiki, Modding: Making a custom material: `CellData`, `CellDataChild`, `Reaction`, material property 목록, tag reaction 구조를 설명한다. <https://noita.fandom.com/wiki/Modding:Making_a_custom_material>
- Noita Wiki, Materials: 재료군, 액체 밀도, 기체, 분말, 금속, 얼음, 산성/독성 재료의 대표 동작을 설명한다. <https://noita.fandom.com/wiki/Materials>
- Noita Wiki, Alchemy: 주요 alchemy recipe와 물리적 상호작용 예시를 설명한다. <https://noita.fandom.com/wiki/Alchemy>
- The Noita Wiki, Table of Alchemical Reactions: `materials.xml`에서 추출된 reaction table이라고 명시한다. <https://noita.wiki.gg/wiki/Table_of_Alchemical_Reactions>
- Noita Explorer: 개별 material page가 id, cell type, tags, source/product/persistent reactions를 정리한다. <https://www.noita-explorer.com/wiki/materials/acid>

주의할 점:

- 공개 위키는 데이터마이닝 기반이지만, 항상 현재 설치본의 `materials.xml`과 대조해야 한다.
- 원작 엔진 내부 업데이트 순서, chunk scheduler, Box2D 결합 방식은 완전히 공개된 사양이 아니다. 이 문서의 scheduler 부분은 구현 가능한 근사안이다.
- 상업적 배포 게임에서 원작 material id, recipe, 이름, 색상, 수치를 그대로 포함하면 IP 문제가 생길 수 있다. 이 프로젝트에서 "Noita-inspired"로 남길지, "원작 연구용 private simulator"로 둘지 분리해야 한다.

## 3. 원작 material data model

Noita material 하나는 최소한 다음 정보로 구성된다.

| 영역 | 필드 예시 | 구현 의미 |
| --- | --- | --- |
| 식별 | `name`, `ui_name`, `_parent`, `_inherit_reactions` | material registry id, 표시명, 상속 확장 |
| 렌더링 | `wang_color`, `Graphics`, `gfx_glow`, `gfx_glow_color` | world image material lookup, 픽셀 색, 발광 |
| 분류 | `cell_type`, `platform_type`, `tags` | 움직임 solver, 충돌, reaction tag expansion |
| 액체/분말 | `liquid_sand`, `liquid_static`, `liquid_gravity`, `liquid_flow_speed`, `liquid_slime`, `liquid_viscosity`, `density` | 낙하, 수평 흐름, 점성, 밀도 층 분리 |
| 수명 | `lifetime` | 기체/일부 액체가 시간이 지나면 사라짐 |
| 지형/파괴 | `hp`, `durability`, `crackability`, `collapsible`, `stainable`, `slippery` | 폭발/주문/충돌로 파괴되는 정도 |
| 연소 | `burnable`, `fire_hp`, `on_fire`, `on_fire_convert_to_material`, `requires_oxygen`, `temperature_of_fire`, `autoignition_temperature`, `generates_smoke` | 불 확산, 연료 소모, 연기 생성, 자연 발화 |
| 전기 | `electrical_conductivity` | 감전 전파와 conductive material 판정 |
| solid/Box2D | `convert_to_box2d_material`, `solid_static_type`, `solid_restitution`, `solid_friction`, `solid_on_collision_*` | rigid body로 분리되는 물체 계열 |
| AI 위험도 | `danger_fire`, `danger_water`, `danger_poison`, `danger_radioactive` | 적 AI 경로/회피 판단용 |
| 상태 효과 | `StatusEffects`, stain/ingestion 설정 | 젖음, 기름, 독, 변이, 회복 등 entity 상태와 연결 |

구현상 중요한 점은 `cell_type`만으로 동작을 결정하면 안 된다는 것이다. 예를 들어 원작의 지형은 직관적인 "solid"가 아니라 static sand 계열인 경우가 많다. 따라서 material category를 다음처럼 재구성해서 내부 solver에 넘기는 편이 좋다.

```ts
type MaterialMotionClass =
  | 'empty'
  | 'staticTerrain'
  | 'powder'
  | 'liquid'
  | 'gas'
  | 'fire'
  | 'box2dSolid';
```

`materials.xml`에서 읽은 원본 속성을 이 내부 분류로 compile한다. shader에서는 문자열 tag를 직접 다루지 않고 정수 id, bitset, compact reaction table만 사용한다.

## 4. 재료군별 입자 동작

### 4.1 Empty / Air

빈 칸이다. 대부분의 particle은 `air`로 이동할 수 있다. 원작 reaction table에는 `air`와 접촉했을 때 증발, 소멸, 기체 생성, 생물 생성이 일어나는 규칙도 있으므로 단순 empty와 reaction reagent `air`를 구분해야 한다.

구현:

- material id `0`을 empty/air로 예약한다.
- movement solver에서는 passable target으로 취급한다.
- reaction solver에서는 `air`도 정상 reagent로 처리한다.

### 4.2 Static terrain

바위, 벽, ground, brickwork, 일부 snow/ice static류다. 시각적으로 고체 지형이지만 원작 모딩 자료상 지형 대부분은 static sand/liquid 성격으로 취급하는 편이 맞다.

구현:

- `motionClass='staticTerrain'`
- `canMove=false`
- `supportsActor=true`
- `blocksProjectiles`는 material별로 분리한다.
- 폭발/주문 파괴는 `durability`, `hp`, `damageMask`로 처리한다.
- 파괴되면 `air`, powder debris, molten material, smoke 등으로 변환된다.

### 4.3 Powder / liquid sand

모래, 흙, 석탄, 금가루, 금속 가루, gunpowder, snow powder, fungus powder 등이 여기에 들어간다. 원작에서는 `cell_type="liquid"` + `liquid_sand="1"` 조합으로 표현된다.

기본 동작:

- 아래가 비어 있으면 낙하한다.
- 아래가 막히면 아래 좌/우 대각선으로 흐른다.
- 액체보다 밀도가 높으면 액체와 자리 바꿈을 한다.
- `liquid_static` 또는 ceiling stick 속성이 있으면 움직이지 않는 powder terrain으로 남는다.
- powder지만 platform처럼 설 수 있는 재료가 있다.

구현 우선순위:

1. `empty`로 낙하
2. 낮은 density liquid/gas/fire와 swap
3. 대각선 낙하
4. 정지

### 4.4 Liquid

물, 오일, 피, 슬라임, 독성 폐수, 산, 용암, 마법 액체 대부분이 해당한다. 원작은 액체별 density가 있고, 액체끼리는 밀도에 따라 층을 만든다.

기본 동작:

- 중력 방향으로 내려간다.
- 막히면 좌/우로 흐른다.
- density가 높은 액체가 낮은 액체 아래로 파고든다.
- `liquid_flow_speed`, `liquid_slime`, `liquid_viscosity`로 수평 이동 빈도와 속도가 달라진다.
- stain 속성이 있으면 entity에 상태 효과를 남긴다.
- 일부 액체는 lifetime 또는 air/fire/lava 접촉으로 증발한다.

구현:

- 초기에는 좌/우 1칸 흐름으로 충분하다.
- 원작 느낌을 내려면 flow direction 또는 velocity aux field가 필요하다.
- density swap은 material id가 아니라 material definition lookup으로 처리한다.

### 4.5 Gas / Vapor

연기, 수증기, 독가스, 산성 가스, 인화성 가스, freezing vapor 등이 해당한다.

기본 동작:

- 위로 상승한다.
- 막히면 위 좌/우 또는 수평으로 퍼진다.
- lifetime이 끝나면 사라지거나 다른 material로 응축된다.
- 일부 gas는 불이 붙거나 contact damage/status를 준다.

구현:

- gas movement는 liquid와 반대 방향 solver를 쓴다.
- `density`가 있더라도 초반 구현에서는 gas끼리 density layering을 생략해도 된다.
- steam condensation은 reaction/lifetime pass에서 처리한다.

### 4.6 Fire / Flame / Spark / Plasma

Noita의 fire는 단순 색상 효과가 아니라 material cell과 heat/source 역할을 동시에 한다. `cell_type="fire"` 계열과 `burnable`, `temperature_of_fire`, `generates_smoke`가 결합된다.

기본 동작:

- lifetime 또는 fuel에 따라 유지된다.
- 주변 burnable material을 점화한다.
- 물, 눈, 얼음, freezing liquid와 반응한다.
- 연기, steam, molten material, explosion을 만든다.

구현:

- fire 자체 cell과 temperature field를 분리하면 원작에 가까워진다.
- 초기에는 `life` 기반 fire particle과 `burning` flag만 둔다.
- 발화/소화는 reaction pass보다 fire pass에서 우선 처리한다.

### 4.7 Box2D solid / rigid object

상자, 통, 광산 수레, 물리 얼음 조각, 유리 조각 등은 pixel grid만으로 표현하기 어렵다. 원작에서는 Box2D physics도 함께 사용한다.

구현:

- static terrain과 rigid body를 분리한다.
- 일정 크기 이상의 깨진 조각은 rigid body entity로 생성한다.
- rigid body가 깨지거나 녹으면 다시 material emitter로 grid에 뿌린다.
- WebGPU material field를 battle visual layer로 쓰는 현재 프로젝트에서는 이 단계는 후순위다.

## 5. 주요 상호작용 클래스

원작 상호작용은 개별 material switch보다 "재료군 + tag + 확률"로 구현해야 관리된다.

### 5.1 Movement interaction

입자 이동은 반응보다 먼저 처리할지, 반응 후 처리할지에 따라 결과가 달라진다. 원작과 완전히 같은 ordering은 공개 사양이 아니므로, 우리 구현은 다음 deterministic order를 권장한다.

1. 외부 emitter 적용: 주문, 폭발, 비, 물줄기, 피 튐
2. movement proposal 생성
3. conflict resolution
4. movement commit
5. reaction pass
6. fire/heat/lifetime pass
7. entity sampling: damage, stain, suffocation
8. render

### 5.2 XML Reaction

`Reaction`은 대체로 다음 개념이다.

```xml
<Reaction probability="20"
  input_cell1="[fire]"
  input_cell2="water"
  output_cell1="[fire]"
  output_cell2="steam">
</Reaction>
```

구현 포인트:

- input은 material id 또는 tag selector다.
- output도 material id 또는 tag-derived material일 수 있다. 예: `[meltable]_molten`
- 2-input뿐 아니라 일부 3-input recipe가 있다.
- probability는 frame/contact 단위 확률로 해석한다.
- `fast_reaction`은 일반 reaction보다 먼저 처리하는 우선순위 flag로 둔다.
- reaction table은 런타임 문자열 매칭이 아니라 compile-time expansion이 필요하다.

### 5.3 Heat, phase change, evaporation

대표 규칙:

- water + fire -> steam
- water + lava -> rock 계열 + steam
- ice + fire -> water
- freezing liquid + water/freezable material -> ice 계열
- lava + meltable material -> molten material
- acid + air 또는 corrodible -> flammable gas 계열
- poison/toxic liquids -> 해당 gas 또는 damaging material

구현:

- 온도 field 없이도 reaction table만으로 1차 구현 가능하다.
- 다만 연소, 금속 용융, 냉각을 확장하려면 `temperature` aux buffer가 필요하다.

### 5.4 Corrosion and purification

대표 규칙:

- acid + corrodible -> acid remains + flammable gas
- concentrated mana는 금속류를 녹이거나 변환하는 별도 강한 용해제로 취급한다.
- purifying powder + impure -> water
- water + toxic sludge -> water 쪽으로 정화

구현:

- `[corrodible]`, `[impure]`, `[metal]`, `[water]` tag bitset이 필요하다.
- 산성 가스/독가스는 gas material로 생성하고 lifetime을 둔다.
- damage는 material 자체가 아니라 entity damage model sampling으로 처리한다.

### 5.5 Burning and explosive materials

대표 재료:

- oil, alcohol, whiskey: 인화성 액체
- wood, coal, plant material: burnable terrain/powder
- gunpowder, unstable gunpowder: 연소 또는 폭발
- flammable gas: 점화 시 빠른 연소
- brass + fire/liquid fire: shock powder

구현:

- `burnable`, `fire_hp`, `generates_smoke`, `temperature_of_fire`를 material def에 둔다.
- fire pass에서 주변 burnable에 `burning` flag를 부여한다.
- gunpowder 계열은 `burning`이 일정 확률로 explosion emitter를 만든다.
- gas explosion은 flood fill보다 local chain reaction으로 시작한다.

### 5.6 Electrical conduction

금속, 물/일부 액체, shock powder, electric charge entity가 관련된다. 공개 자료상 material property에 `electrical_conductivity`가 있다.

구현:

- particle buffer에 전기 상태를 오래 저장하지 말고, 짧은 electric event field를 별도 pass로 둔다.
- conductive material cluster를 매 프레임 완전 탐색하지 않는다.
- 주문/전기 이벤트가 발생한 지역의 active chunk에서만 확산한다.
- entity 감전 damage는 CPU gameplay system에서 처리한다.

### 5.7 Magical liquids and alchemy

polymorphine, chaotic polymorphine, teleportatium, unstable teleportatium, flummoxium, berserkium, acceleratium, levitatium, hastium, ambrosia, invisiblium, healthium, lively concoction, alchemic precursor, draught of Midas 등이 여기에 들어간다.

구현:

- material cell의 물리 이동은 liquid solver가 담당한다.
- entity 상태 효과는 CPU entity sampling에서 처리한다.
- alchemic precursor와 lively concoction은 world seed 기반 3-reagent recipe가 필요하다.
- draught of Midas는 `[alchemy]` 또는 대상 tag material을 gold로 바꾸는 transmutation reaction으로 처리한다.

### 5.8 Biological materials

blood, worm blood, slime, meat, rotten meat, vomit, fungus blood, fungus powder, spore, plant seed 등이 포함된다.

구현:

- blood/slime은 liquid solver + stain/status effect를 쓴다.
- meat/fungus/plant는 powder/static/organic group으로 나눠야 한다.
- spore, fungus powder, rat powder처럼 air 접촉 시 entity를 생성하는 규칙은 GPU reaction만으로 끝내지 말고 CPU event queue를 생성한다.

## 6. 구현용 재료군 매트릭스

| 재료군 | 예시 id | 이동 | 핵심 반응 | 구현 메모 |
| --- | --- | --- | --- | --- |
| Air | `air` | 없음 | 증발/소멸/생성 trigger | empty와 reagent air를 같은 id로 두되 reaction table에서 정상 처리 |
| Static terrain | `rock_static`, `brickwork`, `ground` 계열 | 고정 | 폭발, 산성 부식, 용융 | Box2D solid로 만들지 않는다 |
| Powder terrain | `sand`, `soil`, `coal`, `snow`, `gold` | 낙하/대각선 | 물과 섞임, 불, 산, 금속 반응 | `liquid_sand=1` 기반 |
| Metal powder | `gold`, `brass`, `copper`, `silver` | powder | 전도, mana/acid, flummoxium, shock powder | density와 conductivity 중요 |
| Water family | `water`, `water_salt`, `swamp`, `water_ice` | liquid | fire->steam, toxic 정화, cold->ice | 기본 액체 기준 |
| Toxic/acid | `radioactive_liquid`, `acid`, `poison` | liquid/gas | 부식, 독가스, 정화 | entity damage sampling 필수 |
| Oil/alcohol | `oil`, `alcohol`, `beer`, `whiskey` | liquid | fire/lava로 gas/fire, slime 반응 | 인화성 chain reaction |
| Lava/molten | `lava`, `*_molten` | liquid/fire hybrid | water->rock, meltable->molten, cold->rock_hard | heat source로 취급 |
| Ice/cold | `ice`, `snow_static`, `blood_cold`, `*_vapour` | static/liquid/gas | fire->water/steam, water/freezable->ice | phase change 테스트 필요 |
| Fire/plasma | `fire`, `liquid_fire`, `plasma_*` | fire/liquid | burnable 점화, water 소화, gas 폭발 | temperature/life 분리 권장 |
| Smoke/vapor/gas | `smoke`, `steam`, `acid_gas`, `poison_gas`, `alcohol_gas` | 상승/확산 | 응축, 연소, 독성, 소멸 | lifetime buffer 필요 |
| Biological | `blood`, `slime`, `meat`, `fungus_powder`, `spore` | liquid/powder/static | stain, entity 생성, alchemy | CPU event queue 연동 |
| Magic liquid | `polymorphine`, `teleportatium`, `ambrosia`, `midas` | liquid | 상태 효과, 변환, alchemy | entity interaction이 주 기능 |
| Rigid solid | barrel, cart, glass/ice chunk | Box2D | 충돌, 파괴, 폭발, material spill | grid와 entity 양방향 변환 |
| Electrical | `shock_powder`, conductive metals/liquids | material dependent | 전기 이벤트, 감전, 폭발 | 별도 electric pass |

## 7. 데이터 파이프라인 설계

원작 충실도 목표라면 수동 enum 확장은 금방 한계가 온다. 아래 파이프라인을 권장한다.

```text
local Noita install
  -> data_wak_unpack.bat
  -> data/materials.xml
  -> parser
  -> expanded material registry
  -> expanded reaction table
  -> generated JSON/TS for simulator
```

저장소에 넣을 수 있는 것은 parser와 schema이며, 원작 `materials.xml` 원문은 넣지 않는다.

권장 산출물:

```text
generated/noita-materials.generated.json
generated/noita-reactions.generated.json
generated/noita-tags.generated.json
generated/noita-random-recipes.generated.json
```

배포 정책:

- private 연구/테스트: generated output 사용 가능.
- 공개/상업 배포: 원작 이름/색/수치/recipe를 그대로 포함하지 말고 자체 material set으로 변환.

### 7.1 Material schema

```ts
export interface MaterialDef {
  id: number;
  name: string;
  uiName?: string;
  parent?: string;
  motionClass: MaterialMotionClass;
  cellType: 'liquid' | 'solid' | 'fire' | 'gas';
  tags: string[];
  tagBits: bigint[];
  color: number;
  density: number;
  durability: number;
  lifetime: number;
  platformType: number;
  liquidSand: boolean;
  liquidStatic: boolean;
  liquidGravity: number;
  liquidFlowSpeed: number;
  liquidSlime: boolean;
  burnable: boolean;
  fireHp: number;
  onFire: boolean;
  onFireConvertToMaterial?: number;
  requiresOxygen: boolean;
  temperatureOfFire: number;
  generatesSmoke: number;
  electricalConductivity: boolean;
  stainEffects: string[];
  ingestionEffects: string[];
  damageProfile?: MaterialDamageProfile;
}
```

### 7.2 Reaction schema

```ts
export interface ReactionDef {
  id: number;
  priority: 'fast' | 'normal' | 'late';
  probability: number;
  input: ReactionSelector[];
  output: ReactionOutput[];
  reqLifetime?: number;
  blobRadius?: [number, number, number];
  source: 'materials.xml' | 'seedRecipe' | 'engineApproximation';
}

export type ReactionSelector =
  | { kind: 'material'; materialId: number }
  | { kind: 'tag'; tagId: number }
  | { kind: 'air' };
```

GPU에는 위 구조를 그대로 넣지 않는다. build step에서 다음 compact table로 바꾼다.

```text
ReactionHeader[]
  inputA material/tag bit
  inputB material/tag bit
  inputC optional
  outputA material resolver
  outputB material resolver
  outputC optional
  probabilityU16
  flags
```

## 8. Runtime cell/buffer 설계

현재 실험은 `u32` 하나에 material, life, aux를 pack한다. 원작 충실도를 올리면 하나의 `u32`로는 부족하다.

권장 단계:

### 8.1 Phase A: compact single cell

```text
u32 cell
bits 0-11: materialId
bits 12-19: life
bits 20-27: aux/random/variant
bits 28-31: flags
```

장점:

- 현재 WebGPU 구조와 가장 가깝다.
- 4096 material까지 가능하다.

한계:

- temperature, velocity, pressure, stain, burning fuel을 제대로 담기 어렵다.

### 8.2 Phase B: multi-buffer

```text
material: u16/u32 grid
life: u16 grid
temperature: i16 grid
velocity: i8x2 grid
flags: u16 grid
variant: u8 grid
```

권장:

- CPU reference simulator는 multi-buffer로 먼저 작성한다.
- GPU는 profiling 후 `material+life+flags`를 pack하고 temperature/velocity는 별도 buffer로 둔다.

## 9. 업데이트 패스 설계

### 9.1 CPU reference simulator

원작 충실도 검증은 GPU보다 CPU에서 먼저 해야 한다. CPU reference는 느려도 deterministic해야 한다.

권장 순서:

1. active chunk 목록 갱신
2. emitter/event 적용
3. fast reaction pass
4. movement pass
5. normal reaction pass
6. fire/heat/lifetime pass
7. electric/event pass
8. entity material sampling
9. dirty rect/render data 생성

CPU pass는 테스트하기 쉽고, GPU shader 결과와 비교할 기준이 된다.

### 9.2 GPU scheduler

현재 실험처럼 각 invocation이 `dst[index]` 하나만 쓰는 gather-style update는 race condition을 줄인다. 하지만 원작 수준의 액체/분말/반응에는 pass 분리가 필요하다.

권장 GPU pass:

```text
Pass 1: clear proposal buffers
Pass 2: movement proposal
Pass 3: resolve movement conflicts
Pass 4: commit movement
Pass 5: fast reactions
Pass 6: normal reactions
Pass 7: heat/fire/lifetime
Pass 8: render
```

단순화 버전:

- Phase 1에서는 current shader처럼 gather-style 유지
- Phase 2에서 checkerboard 또는 Margolus block update 검토
- Phase 3에서 proposal/resolve/commit 구조로 이동

### 9.3 Conflict resolution

여러 particle이 같은 칸으로 이동하려 할 때 필요하다.

해결 기준:

1. target material과 mover material의 density
2. movement priority: powder > liquid > gas 또는 material별 priority
3. random tiebreaker
4. stable frame parity

GPU에서는 atomic compare-exchange를 쓸 수 있지만 WebGPU 호환성과 디버깅 비용이 크다. 초반에는 checkerboard/Margolus 또는 gather-style로 제한하는 편이 낫다.

## 10. 구현 단계 로드맵

### Phase 0: 원본 데이터 추출 도구

목표:

- 로컬 Noita 설치본에서 `materials.xml` 경로를 입력받는다.
- `CellData`, `CellDataChild`, `Reaction`, tag 목록을 파싱한다.
- 상속을 해소한 material registry를 만든다.
- reaction selector를 material/tag 형태로 compile한다.

완료 기준:

- material 수, reaction 수, tag 수가 출력된다.
- 특정 material id로 properties와 reaction을 조회할 수 있다.
- 원본 XML 없이 parser 테스트용 작은 fixture가 있다.

### Phase 1: CPU reference material grid

목표:

- `empty`, `staticTerrain`, `powder`, `liquid`, `gas`, `fire` motion class를 구현한다.
- density swap과 lifetime을 처리한다.
- deterministic seed를 사용한다.

완료 기준:

- sand pile, water pool, smoke rise, oil-water density layer가 재현된다.
- CPU unit test가 같은 seed에서 같은 결과를 낸다.

### Phase 2: tag 기반 reaction engine

목표:

- 2-input reaction을 우선 구현한다.
- tag selector와 material selector를 모두 지원한다.
- fast reaction priority를 지원한다.

완료 기준:

- water + fire -> steam
- acid + corrodible -> acid gas
- water + toxic sludge -> water
- water + soil -> mud
- salt + water -> brine
- lava + water -> rock/steam 계열

### Phase 3: fire, heat, evaporation

목표:

- burnable material의 점화와 `fire_hp` 소모를 처리한다.
- smoke/gas 생성량을 material def에서 가져온다.
- molten/cold/freezing reaction을 처리한다.

완료 기준:

- wood/coal/oil/alcohol이 서로 다른 속도로 탄다.
- 물이 불을 끄고 steam을 만든다.
- lava가 물/얼음/금속/흙과 다른 결과를 만든다.

### Phase 4: entity coupling

목표:

- material grid와 player/enemy entity의 상호작용을 분리한다.
- damage, stain, ingestion, suffocation, polymorph, teleport, healing을 CPU gameplay system에서 처리한다.

완료 기준:

- entity hitbox가 접촉한 material coverage를 sampling한다.
- material effect가 command/event로 gameplay state에 반영된다.
- GPU 전체 grid readback 없이 작은 query만 사용한다.

### Phase 5: WebGPU 이식

목표:

- CPU reference와 같은 material registry/reaction table을 WebGPU buffer로 전송한다.
- movement, reaction, fire/lifetime을 multi-pass shader로 이식한다.
- 현재 `tech-tests/noita-webgpu`의 brush emitter와 bloom render chain을 유지한다.

완료 기준:

- CPU reference와 작은 grid fixture에서 결과 차이를 비교할 수 있다.
- 256x144, 512x288에서 frame time을 측정한다.
- WebGPU 미지원 시 게임 본체가 실패하지 않는다.

### Phase 6: chunk와 game integration

목표:

- active chunk만 update한다.
- battle field overlay로 material canvas를 연결한다.
- 주문, 폭발, 환경 효과가 material emitter queue를 통해 들어간다.

완료 기준:

- 전투 로직은 CPU authoritative 상태를 유지한다.
- material field는 visual/environment layer로 작동한다.
- 필요한 경우 제한된 area query만 gameplay에 반영한다.

## 11. 현재 실험 코드와의 차이

현재 `tech-tests/noita-webgpu/noitaField.wgsl`:

- material id가 7개 고정이다.
- `u32` cell 하나에 material/life/aux만 저장한다.
- density, durability, tags, burnable, liquid flow speed, viscosity, conductivity가 없다.
- reaction table이 없고 shader 함수에 직접 조건이 들어 있다.
- terrain은 `SOLID` 하나라서 static terrain, corrodible terrain, metal, ice, wood를 구분하지 않는다.
- entity damage/stain/ingestion이 없다.

다음 단계에서 필요한 구조:

```text
materials.generated.json
reactions.generated.json
MaterialRegistry.ts
ReactionCompiler.ts
CpuMaterialSimulator.ts
WebGpuMaterialBackend.ts
materialMovement.wgsl
materialReactions.wgsl
materialRender.wgsl
```

WebGPU shader는 원작 material 전체를 switch로 직접 작성하지 말고, material def buffer와 reaction table buffer를 lookup하는 구조로 바꿔야 한다.

## 12. 테스트 시나리오

원작 충실도를 검증할 최소 시나리오다.

| 테스트 | 초기 배치 | 기대 결과 |
| --- | --- | --- |
| Powder pile | 공중 sand 1줄 | 아래로 떨어지고 안정된 사면 형성 |
| Water pool | ground 위 water | 빈 곳을 채우고 수평으로 퍼짐 |
| Density layer | water + oil | oil이 water 위에 남음 |
| Water/fire | water 옆 fire | steam 생성, fire 약화 |
| Lava/water | lava와 water 접촉 | rock 계열 material과 steam 생성 |
| Acid/corrodible | acid가 ground/wood/metal 접촉 | material 소모, acid gas 생성 |
| Toxic purification | water + toxic sludge | water 비중 증가 |
| Ice melting | ice + fire | water 또는 steam 생성 |
| Smoke rise | smoke 아래 공기 | 위로 상승하고 lifetime 감소 |
| Flammable gas | gas + fire | 빠른 연소/폭발성 fire chain |
| Gunpowder | gunpowder + fire | active gunpowder 또는 explosion event |
| Magic stain | polymorphine 위 entity | entity status event 발생 |
| Midas | midas + alchemy-tag material | gold material로 변환 |
| Electrical | shock/electric + conductive metal | electric event 확산 |

각 테스트는 CPU reference에서 먼저 통과시킨 뒤 GPU 결과와 비교한다.

## 13. 우선순위 결정

`Skyfall-Mage2`에 바로 필요한 것은 원작 전체 재현보다 "전투 화면에서 의미 있는 재료 효과"다. 따라서 다음 우선순위를 권장한다.

1. `water`, `sand`, `smoke`, `fire`, `spark`, `staticTerrain`
2. density와 simple liquid layering
3. water/fire/steam, lava/water/rock, acid/corrodible
4. burnable terrain과 smoke generation
5. toxic sludge/water purification
6. magic liquid status effect는 entity sampling으로 제한
7. 원작 전체 alchemy table import
8. Box2D solid coupling

이 순서면 현재 WebGPU 기술 검증을 유지하면서도 원작의 핵심 느낌인 "픽셀 단위 물질 반응"을 단계적으로 확장할 수 있다.

## 14. 구현 결론

원작 Noita의 material interaction은 재료별 if문 모음이 아니라, 데이터 중심 material registry와 tag 기반 reaction table로 보는 것이 맞다. 이 프로젝트에서 실제 구현을 시작할 때는 다음 원칙을 따른다.

- 원작 `materials.xml`은 parser 입력으로만 사용하고 저장소에 포함하지 않는다.
- CPU reference simulator를 먼저 만든다.
- shader는 data-driven lookup 구조로 바꾼다.
- movement, reaction, fire/heat, entity effect를 별도 pass로 분리한다.
- gameplay authoritative state는 CPU에 두고, material grid는 visual/environment layer로 시작한다.
- 원작 충실도를 높이는 작업과 `Skyfall-Mage2` 게임성을 높이는 작업을 분리한다.

이 문서 기준으로 다음 작업은 `materials.xml` fixture parser와 CPU reference simulator 설계 문서 또는 prototype을 만드는 것이다.

## 15. 현재 `tech-tests/noita-webgpu` 구현과 비교

현재 구현은 원작 material system의 전체 재현이 아니라, WebGPU에서 falling-sand 계열 field가 실시간으로 돌아가는지 확인하는 기술 검증이다. 원작 지향 모델과 비교하면 "데이터 기반 재료 엔진"이 아니라 "소수 재료를 shader 함수로 직접 처리하는 시각 효과 레이어"에 가깝다.

### 15.1 현재 구현 요약

현재 코드 기준 주요 구조:

- Grid: `256x144`, 총 `36,864` cell. `main.js`의 `GRID_WIDTH`, `GRID_HEIGHT`에 고정되어 있다.
- Material enum: `empty`, `solid`, `sand`, `water`, `fire`, `smoke`, `spark` 7종만 있다.
- Cell packing: `u32` 하나에 `material 8bit`, `life 8bit`, `aux 8bit`를 저장한다.
- GPU buffer: material grid storage buffer 2개를 ping-pong한다.
- Emitter: pointer/폭발 입력을 `Emitter` storage buffer로 매 frame 전달한다.
- Compute pass: `simulate()` 한 번으로 outgoing, incoming, emitter를 모두 처리한다.
- Render pass: storage buffer를 fullscreen triangle fragment shader에서 직접 읽어 색을 만든다.
- Postprocess: fire/spark 고휘도 값을 `rgba16float` scene texture에 그리고 bloom chain으로 합성한다.

관련 위치:

- `tech-tests/noita-webgpu/main.js`: grid/config/material enum은 3-40행, 초기 terrain/water 배치는 105행, emitter packing은 158행, WebGPU 초기화는 305행, frame loop는 492행 부근이다.
- `tech-tests/noita-webgpu/noitaField.wgsl`: material enum은 1-7행, cell packing은 45행, water pressure 근사는 142행, water movement는 161행, outgoing/incoming 처리는 233행과 297행, compute entry는 447행, 색상 렌더링은 481행 부근이다.

### 15.2 원작 지향 모델 대비 구현 상태

| 항목 | 원작 지향 목표 | 현재 구현 | 상태 |
| --- | --- | --- | --- |
| Material 수 | `materials.xml` 기반 수백 종 material | 7종 하드코딩 | 초기 prototype |
| Material 정의 | `CellData`, `CellDataChild` 상속과 tag | JS/WGSL enum 직접 선언 | 미구현 |
| Reaction | XML `Reaction` table, tag selector, probability | shader if문으로 water/fire, wet/fire 정도만 근사 | 매우 제한적 |
| Movement | density, gravity, flow speed, viscosity, static sand | sand/water/smoke/fire/spark 전용 target 함수 | 부분 구현 |
| Liquid pressure | density/flow/압력성 움직임 | `waterPressure()`로 상부 water 개수만 보는 근사 | 실험적 구현 |
| Density layering | oil/water/lava/acid 등 밀도 교환 | sand가 water와 swap하는 정도 | 대부분 미구현 |
| Fire/heat | burnable, fire_hp, smoke, temperature, oxygen | fire life 감소, water 인접 시 smoke | 부분 구현 |
| Gas/vapor | steam, smoke, acid gas, poison gas, lifetime/condensation | smoke 1종, lifetime 감소, 상승 | 부분 구현 |
| Terrain | static terrain, corrodible, meltable, durability | `SOLID` 1종, 폭발 중심부만 일부 제거 | 초기 prototype |
| Explosion | material별 파괴/연소/압력/파편 | radius 안에서 empty/fire/smoke/spark/sand 생성 | 시각 효과 수준 |
| Entity coupling | damage, stain, polymorph, teleport, suffocation | entity 없음 | 미구현 |
| Electrical | conductivity, electric event 확산 | 없음 | 미구현 |
| Data pipeline | 로컬 `materials.xml` 파싱 후 generated registry | 없음 | 미구현 |
| CPU reference | deterministic reference simulator | 없음 | 미구현 |
| GPU architecture | multi-pass proposal/resolve/reaction/fire | single compute pass gather-style | prototype |
| Integration | v2 battle renderer overlay/fallback | standalone WebGPU page | 독립 실험 |

### 15.3 현재 구현이 이미 잘 검증한 것

현재 실험이 증명한 부분은 명확하다.

- WebGPU storage buffer ping-pong으로 material grid를 매 frame 갱신할 수 있다.
- 브라우저에서 compute pass와 render pass를 한 frame 안에 연결할 수 있다.
- CPU readback 없이 GPU buffer 결과를 바로 렌더링할 수 있다.
- pointer/touch 입력을 emitter storage buffer로 packing해서 shader에 전달할 수 있다.
- `sand`, `water`, `smoke` 같은 기본 falling-sand 이동 규칙을 gather-style로 구현할 수 있다.
- fire/spark의 HDR 색상과 bloom postprocess가 WebGPU chain에서 동작한다.
- WebGPU 미지원/adapter 실패를 fatal overlay로 처리하는 최소 경로가 있다.

즉 현재 코드는 "원작 Noita 재료 시스템 구현"이라기보다 "v2 전투 화면 위에 얹을 GPU material effect layer의 가능성 검증"이다.

### 15.4 현재 구현과 원작의 핵심 차이

가장 큰 차이는 데이터 중심성이다. 원작은 material property와 reaction이 데이터로 정의되고, tag로 반응 범위를 넓힌다. 현재 구현은 `canSandEnter`, `canFluidEnter`, `isWetNear`, `applyCurrentOutgoing` 같은 shader 함수에 규칙이 직접 들어간다. material이 7종을 넘기 시작하면 이 방식은 빠르게 유지보수가 어려워진다.

두 번째 차이는 update pass다. 원작 수준의 액체/분말/반응은 movement, reaction, heat, lifetime, entity sampling을 분리해야 한다. 현재는 `simulate()`에서 한 cell 기준으로 outgoing, incoming, emitter를 순서대로 적용한다. 구현은 단순하고 빠르지만, 여러 material의 동시 반응, 확률 reaction, density swap, 다중 입력 alchemy를 넣기 어렵다.

세 번째 차이는 gameplay 연결이다. 현재 field는 화면에 보이는 독립 simulation이다. 원작처럼 material이 player/enemy에게 damage, stain, suffocation, polymorph, teleport, heal을 주려면 CPU gameplay state가 material coverage를 sampling하고 event로 반영해야 한다.

### 15.5 현재 구현에서 원작 방향으로 확장할 때의 최소 변경 순서

현재 코드를 버리지 않고 이어가려면 다음 순서가 가장 안전하다.

1. `MATERIAL` enum을 `MaterialDef` registry로 감싸고, 현재 7종을 registry fixture로 옮긴다.
2. `canSandEnter`, `canFluidEnter`, `canSmokeEnter`를 material property lookup 기반으로 바꾼다.
3. `SOLID`를 `STATIC_TERRAIN`, `CORRODIBLE`, `WOOD`, `METAL`, `ICE` 같은 1차 지형군으로 쪼갠다.
4. reaction pass를 별도 함수로 분리해서 water/fire/steam, acid/corrodible, lava/water부터 넣는다.
5. CPU reference simulator를 같은 registry로 작성해서 shader 결과 비교 기준을 만든다.
6. `materials.xml` parser는 원작 full import 전에 작은 fixture XML로 먼저 만든다.
7. GPU는 single pass를 유지하다가 reaction 수가 늘어난 뒤 multi-pass로 쪼갠다.

### 15.6 현재 구현 유지 시 권장 목표

현재 `tech-tests/noita-webgpu`는 계속 "전투용 material visual prototype"으로 두는 편이 좋다. 여기에 원작 전체를 바로 얹으면 shader가 비대해지고, v2 게임 본체와의 경계도 흐려진다.

권장 분리:

```text
tech-tests/noita-webgpu
  목적: WebGPU material field, emitter, bloom, 입력 실험

src/features/material-sim 또는 tech-tests/noita-reference
  목적: 원작 지향 CPU reference simulator, registry, reaction parser 실험

docs/
  목적: 원작 분석, 현재 구현 비교, 단계별 이식 계획 유지
```

이 기준이면 현재 구현은 계속 가볍게 유지하면서, 원작 충실도 작업은 별도의 data-driven simulator로 안전하게 키울 수 있다.
