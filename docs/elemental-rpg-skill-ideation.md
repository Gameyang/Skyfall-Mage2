# 원소 RPG 공격 스킬 및 GPU 파생 원소 설계

작성일: 2026-06-12  
대상 프로젝트: `Skyfall-Mage2`  
관련 문서: `docs/noita-combat-element-simulation-deep-analysis.md`  
목표: 유저가 불, 물, 전기, 모래 4개 기본 원소를 다양한 공격 형태로 전장에 뿌리고, GPU compute shader가 원소 반응과 파생 원소를 시각적으로 시뮬레이션하는 구조 정리

## 1. 설계 방향

이 문서는 원소를 단순 속성 피해로만 쓰지 않고, 전장에 남는 물질 흔적과 GPU 원소 반응을 통해 다양한 공격 연출을 만드는 것을 목표로 한다.

핵심 원칙은 다음과 같다.

1. 유저가 직접 사용하는 원소는 `불`, `물`, `전기`, `모래` 4개뿐이다.
2. RPG식 스킬은 이 4개 원소를 단일, 멀티, 광역, 추적, 지속, 소환, 전파형 등 다양한 공격 형태로 살포하는 방식이다.
3. 4개 원소가 서로 만나 만들어지는 `증기`, `스파크`, `바위`, `얼음`, `먼지`, `고정 영역`은 GPU material simulation의 파생 원소다.
4. 1차 파생 원소는 `보여주기 전용`이다.
5. 2차 반응은 선택적으로 `damage feedback buffer`에 피해 후보를 기록할 수 있다.
6. CPU 전투 로직은 체력, 실제 피해 확정, 충돌, 쿨다운, 웨이브 밸런스를 계속 담당한다.
7. GPU compute shader는 원소 잔상, 이동, 반응, 파생 원소, 2차 반응 시각 효과와 피해 후보 생성을 담당한다.
8. 최종 구현 전에는 이 문서의 수치보다 `스킬 살포 방식`, `GPU 반응 규칙`, `화면에서 읽히는 결과`를 우선한다.

### 1.1 사이드 뷰 공중전 전제

`Skyfall-Mage2`의 전투는 하늘에서 벌어지는 사이드 뷰 전투로 본다. 따라서 스킬은 바닥에 깔리는 장판이나 지면에서 솟는 공격보다, 공중에 생성된 원소가 중력/부력에 따라 위아래로 갈라지는 모습을 중심으로 설계한다.

기본 물리 방향은 다음과 같다.

| 물질 계열 | 기본 이동 | 전투 해석 |
| --- | --- | --- |
| 기체 | 위로 상승 | smoke, steam, hot air, plasma mist는 위쪽 시야를 가리고 상승하면서 퍼진다 |
| 액체 | 아래로 추락 | water, rain, mud droplet은 아래 적을 적시고 낙하 경로에 흔적을 남긴다 |
| 고체/분말 | 아래로 추락 | sand, ice shard, glass shard, rock은 낙하 탄막과 물리 파편이 된다 |
| 불/열기 | 위로 흔들리며 상승 | flame은 짧게 머물다가 위로 말려 올라가고, 폭발은 smoke/steam을 만든다 |
| 전기 | 매질을 따라 전파 | wet trail, steam cloud, charged particle을 따라 옆/위/아래로 튄다 |

이 전제 때문에 문서에서 `field`, `pool`, `zone`이라고 부르는 것은 고정된 바닥 장판이 아니라 `공중 체류 구역`이다. 생성 순간에는 원형/타원형 hazard로 판정하되, GPU material field에서는 기체는 상승하고 액체/고체는 낙하하면서 자연스럽게 형태가 무너진다.

스킬 작성 시에는 아래 규칙을 우선한다.

1. 액체와 고체 스킬은 생성 위치보다 아래쪽에 후속 압박을 만든다.
2. 기체와 열기 스킬은 생성 위치보다 위쪽에 시야 방해와 전파 조건을 만든다.
3. 번개 스킬은 젖은 낙하 궤적, 증기 상승 구름, charged dust를 따라 전파된다.
4. 모래/유리/얼음 파편은 공중에서 떨어지는 물리 탄막으로 설계한다.
5. 지면 의존 표현은 `공중 구름`, `낙하 폭포`, `소용돌이`, `부유 지뢰`, `입자 폭풍`으로 바꾼다.

### 1.2 검토 평가

현재 문서의 강점은 네 원소의 전투 정체성이 분명하고, 공격 형태별 스킬 후보가 충분히 넓다는 점이다. 다만 처음 작성본은 아이디어 카탈로그 성격이 강해서, 실제 구현 순서와 데이터 기준으로 옮기려면 다음 보강이 필요했다.

| 평가 항목 | 기존 완성도 | 보강 방향 |
| --- | --- | --- |
| 원소 콘셉트 | 높음 | 각 원소가 맡는 전투 역할 유지 |
| 공격 형태 커버리지 | 중간 | 단일/멀티/광역/추적/지속/소환/전파가 원소별로 빠지지 않게 정리 |
| 구현 가능성 | 중간 | 현재 코드에서 즉시 가능한 것과 신규 시스템이 필요한 것을 분리 |
| 상호작용 규칙 | 중간 | 태그, 반응 우선순위, CPU/GPU 책임을 명확화 |
| 밸런스 기준 | 낮음 | CPU 피해, 쿨다운, 원소 살포량, GPU material life를 분리 |
| 테스트 가능성 | 낮음 | headless 테스트와 material effect 검증 항목 추가 |

보강 후 이 문서는 스킬 이름 목록이 아니라 `src/game/content/skills.js` 확장, hazard proxy 추가, 원소 tag 도입의 기준 문서로 사용할 수 있어야 한다.

## 2. 기본 4원소 역할 요약

| 기본 원소 | 전투 정체성 | GPU 이동 성질 | 유저 스킬 역할 | CPU 피해 판정 |
| --- | --- | --- | --- | --- |
| 불 | 열기, 연소, 폭발 | 위로 흔들리며 상승, smoke를 남김 | 화염탄, 화염 부채, 폭발, 지속 화염 구역 | 스킬 명중/폭발 시 CPU가 직접 처리 |
| 물 | 젖음, 냉각, 무게 | 액체라 아래로 추락, 충돌 지점에서 퍼짐 | 물 폭발, 물줄기, 낙하 비, 젖음 준비 | 물 스킬 자체 피해만 CPU가 처리 |
| 전기 | 즉발, 관통감, 전파 씨앗 | 직접 물질이라기보다 spark/charge로 퍼짐 | 낙뢰, 전격탄, 전기 지뢰, 전기 구체 | 전기 스킬 명중만 CPU가 처리 |
| 모래 | 분말, 물리 파편, 무게 | 고체/분말이라 아래로 추락 | 모래 탄막, 낙하 모래, 모래 구름, 압축 탄 | 모래 투사체/폭발만 CPU가 처리 |

유저는 위 4개 원소를 공격 형태로 전장에 뿌린다. 이후 원소끼리 만나는 과정은 GPU compute shader가 처리한다. 단, 전체 material field를 CPU로 읽지는 않고, 2차 반응에서 발생한 제한된 피해 후보만 작은 feedback buffer로 CPU에 전달할 수 있다.

### 2.1 GPU 파생 원소 요약

| 기본 조합 | 파생 원소 | 이동 성질 | 화면 역할 |
| --- | --- | --- | --- |
| 불 + 물 | `증기` | 천천히 상승 | 시야 방해, 상승 구름, 전기 전파 매질 |
| 불 + 전기 | `스파크` | 튀고 퍼짐 | 점화 씨앗, 폭파 트리거, 짧은 잔광 |
| 불 + 모래 | `바위` | 무겁게 낙하 | 핀볼 낙하 구체, 물리 충돌 연출 |
| 물 + 전기 | `얼음` | 고체로 낙하 | 파편, 깨짐, 블리자드 씨앗 |
| 물 + 모래 | `먼지` | 천천히 낙하/부유 | 시야 방해, 지속 디버프 구름 연출 |
| 전기 + 모래 | `고정 영역` | 공중에 잠시 고정 | 증폭/감속/중력 영역의 기반 |

### 2.2 현재 구현 대비 요구 기능

| 구분 | 현재 지원 | 추가 필요 |
| --- | --- | --- |
| 기본 물질 시각화 | `fire`, `water`, `sand`, `smoke`, `spark`, `steam`, `wetSand` emitter | `electric`, `rock`, `ice`, `dust`, `fixedZone` material/profile |
| 투사체 | 단일 projectile, energy, trail, explosion | fan shot, piercing, multi projectile helper |
| 광역 피해 | `impact.areaDamage`, energy explosion | 지정 위치 cast, delayed explosion |
| 지속 피해 | CPU hazard, hazard tick material effect | GPU 파생 반응과 별도인 CPU hazard만 유지 |
| GPU 파생 반응 | 일부 hard-coded 반응 | 6개 파생 원소와 2차 반응 rule table |
| 전파 시각 효과 | 없음 | GPU 내부 spark/steam/zone 기반 chain visual |
| 추적 | projectile `homing` 필드 형태는 있음 | 실제 homing 동작 확장과 튜닝 |
| 소환 | hazard로 간접 표현 가능 | turret/orbit/summon entity 모델 |
| CPU feedback | 제한적으로 사용 | 전체 field readback 금지. 2차 반응 damage feedback buffer만 허용 |

따라서 1차 스킬은 4개 기본 원소를 뿌리는 공격 형태를 늘리는 데 집중한다. 1차 파생 원소는 material field에서 시각적으로만 확인하고, 2차 반응부터는 필요한 경우 damage feedback buffer를 통해 CPU 피해 후보로 전달한다.

## 3. 공격 형태 분류

| 형태 | 설명 | 구현 힌트 |
| --- | --- | --- |
| 단일 | 한 대상에게 높은 정확도로 피해 | `projectile`, `targeting: nearest/progress-risk` |
| 멀티 | 여러 투사체 또는 여러 대상 동시 공격 | projectile fan, split shot, repeated casts |
| 광역 | 충돌 지점 또는 지정 위치 중심 폭발 | `areaDamage`, `energy.explosion`, explosion emitter |
| 추적 | 적을 따라가는 투사체 | projectile `homing` 확장 |
| 지속 | 일정 시간 공중 구역/구름/폭풍 유지 | CPU hazard proxy + material tick effect |
| 소환 | 원소 구조물이나 임시 공격체 생성 | hazard, turret, orbiting entity |
| 전파 | 대상에서 다른 대상으로 번짐 | CPU 전파 스킬은 별도 구현, GPU 전파는 visual reaction |
| 관통 | 일직선으로 여러 적 타격 | beam, piercing projectile |
| 함정 | 일정 조건에서 발동하는 지점 설치 | delayed hazard, proximity trigger |
| 변환 | 기존 물질을 다른 물질로 바꿈 | material emitter, reaction profile |

### 3.1 원소별 공격 형태 커버리지 목표

각 원소는 한 가지 공격 방식에만 갇히면 장비/스킬 선택이 단조로워진다. 최소 목표는 아래 표처럼 모든 원소가 기본 공격, 광역, 지속 제어, 고유 변형을 하나씩 갖는 것이다.

| 기본 원소 | 단일 | 멀티 | 광역 | 추적 | 지속 | 소환/부유 | GPU 반응 유도 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 불 | `fire_bolt` | `fire_fan` | `fireball` | `heat_ray` | `burning_cloud` | `flame_orbit` | 물/전기/모래와 접촉 |
| 물 | `water_bolt` | `water_fan` | `water_burst` | `tidal_pull` | `rain_fall` | `water_orbit` | 불/전기/모래 위로 낙하 |
| 전기 | `electric_bolt` | `electric_fan` | `thunder_strike` | `electric_orb` | `arc_beam` | `static_mine` | 증기/물/모래 관통 |
| 모래 | `sand_bolt` | `sand_barrage` | `sand_wave` | `sand_mine` | `sand_fall` | `sand_orbit` | 불/물/전기와 오래 접촉 |

이 표를 기준으로 특정 원소의 스킬이 전부 광역기나 전부 단일기 쪽으로 쏠리지 않게 관리한다.

## 4. 원소 상호작용 규칙

### 4.1 기본 2원소 파생표

아래 6개 조합은 GPU material field의 핵심 파생 원소다. 1차 파생 원소는 화면 연출과 후속 GPU 반응에만 쓰이며, CPU 피해 판정으로 되돌아오지 않는다.

| 기본 조합 | 파생 원소 | GPU 이동/수명 | 게임적 의미 |
| --- | --- | --- | --- |
| 불 + 물 | `증기` | 천천히 상승하고 퍼짐 | 상승 구름, 시야 방해, 후속 전기 전파 매질 |
| 불 + 전기 | `스파크` | 튀고 번지며 짧게 생존 | 점화 씨앗, 연쇄 폭파 트리거 |
| 불 + 모래 | `바위` | 무겁게 낙하하고 튕김 | 핀볼 구체, 충돌감 있는 낙하 물리 연출 |
| 물 + 전기 | `얼음` | 고체 파편으로 낙하 | 깨짐, 파편, 블리자드 씨앗 |
| 물 + 모래 | `먼지` | 천천히 낙하하거나 부유 | 흐린 구름, 지속 디버프처럼 보이는 연출 |
| 전기 + 모래 | `고정 영역` | 공중에 잠시 고정 | 증폭/감속/중력 같은 마법 영역 기반 |

### 4.2 파생 원소 + 기본 원소 2차 반응

파생 원소는 다시 기본 원소와 만나 더 강한 화면 사건을 만든다. 2차 반응은 화면 연출을 만들고, 필요한 경우 작은 damage feedback record를 남겨 CPU가 최종 피해 판정을 할 수 있다.

#### 증기 반응

| 반응 | 결과 | 화면 효과 |
| --- | --- | --- |
| 증기 + 모래 | `토네이도` | 상승 회오리, 모래 입자가 말려 올라가는 다단 히트 연출 |
| 증기 + 전기 | `체인 번개` | 증기 구름 내부에서 번개가 여러 갈래로 연쇄 |
| 증기 + 불 | `과열 증기` | 더 빠르게 상승하는 뜨거운 구름, 붉은 열기 |
| 증기 + 물 | `안개비` | 증기가 식어 작은 물방울로 천천히 낙하 |

#### 스파크 반응

| 반응 | 결과 | 화면 효과 |
| --- | --- | --- |
| 스파크 + 모래 | `연쇄 폭파` | 모래 입자 사이로 작은 폭발이 연속 발생 |
| 스파크 + 물 | `각도 레이저` | 물방울을 타고 꺾이는 전격 빔 |
| 스파크 + 불 | `화염 점화` | 주변 불 입자를 다시 키우고 번짐 |
| 스파크 + 전기 | `과충전 스파크` | 짧은 시간 더 넓게 튀는 전기 폭발 |

#### 바위 반응

| 반응 | 결과 | 화면 효과 |
| --- | --- | --- |
| 바위 + 물 | `핀볼 구체` | 젖은 바위가 튕기며 낙하하는 구체 |
| 바위 + 전기 | `낙뢰 표식 바위` | 바위의 수직 위치로 낙뢰가 꽂힘 |
| 바위 + 불 | `용암탄` | 느리게 떨어지는 고열 구체 |
| 바위 + 모래 | `암석비` | 작은 파편으로 쪼개져 아래로 쏟아짐 |

#### 얼음 반응

| 반응 | 결과 | 화면 효과 |
| --- | --- | --- |
| 얼음 + 불 | `빙결 파열` | 얼음이 깨지며 사방으로 파편 방출 |
| 얼음 + 모래 | `블리자드` | 얼음 파편과 모래가 섞여 지속 낙하 폭풍 |
| 얼음 + 전기 | `전도 얼음` | 얼음 파편 사이로 전격이 튐 |
| 얼음 + 물 | `빙결 확장` | 더 큰 얼음 덩어리와 낙하 파편 생성 |

#### 먼지 반응

| 반응 | 결과 | 화면 효과 |
| --- | --- | --- |
| 먼지 + 불 | `화염 분진` | 먼지 구름에 불이 붙어 뜨거운 잔광 유지 |
| 먼지 + 전기 | `전하 분진` | 먼지 구름 안에서 작은 전기 잔광 반복 |
| 먼지 + 물 | `진흙비` | 무겁게 떨어지는 진흙 입자 |
| 먼지 + 모래 | `모래폭풍` | 넓은 시야 방해와 낙하 입자 압박 |

#### 고정 영역 반응

| 반응 | 결과 | 화면 효과 |
| --- | --- | --- |
| 고정 영역 + 불 | `공격 증폭 영역` | 영역 안 화염/폭발 연출이 커짐 |
| 고정 영역 + 물 | `감속 영역` | 물방울과 냉각 입자가 느리게 떠다님 |
| 고정 영역 + 전기 | `전기 증폭 영역` | 번개 전파 거리와 가지 수가 증가한 것처럼 보임 |
| 고정 영역 + 모래 | `중력 영역` | 모래, 바위, 얼음 파편 낙하가 빨라짐 |

### 4.3 구현용 material id 제안

| 분류 | material id | 설명 |
| --- | --- | --- |
| 기본 | `fire` | 유저가 직접 뿌리는 불 |
| 기본 | `water` | 유저가 직접 뿌리는 물 |
| 기본 | `electric` | 유저가 직접 뿌리는 전기 |
| 기본 | `sand` | 유저가 직접 뿌리는 모래 |
| 파생 | `steam` | 불 + 물 |
| 파생 | `spark` | 불 + 전기 |
| 파생 | `rock` | 불 + 모래 |
| 파생 | `ice` | 물 + 전기 |
| 파생 | `dust` | 물 + 모래 |
| 파생 | `fixedZone` | 전기 + 모래 |
| 2차 | `tornado`, `chainArc`, `laserArc`, `blizzard`, `chargedDust`, `gravityZone` | 시각 material/profile로 추가하고, 일부는 damage feedback 후보 생성 |

### 4.4 2차 반응 피해 후보 정책

1차 파생 원소는 피해 후보를 만들지 않는다. 2차 반응만 damage feedback을 만들 수 있다.

| 2차 반응 | damage feedback 기본값 | 이유 |
| --- | --- | --- |
| `tornado` | 선택 | 끌어올리는 연출은 강하지만 직접 피해는 낮게 시작 |
| `chainArc` | 사용 | 증기+전기 조합 보상으로 짧은 연쇄 피해 후보 생성 |
| `chainExplosion` | 사용 | 스파크+모래 조합의 폭발 보상 |
| `laserArc` | 사용 | 스파크+물 조합의 각도 전격 빔 |
| `pinballRock` | 사용 | 바위+물 조합의 낙하 충돌 후보 |
| `lightningRock` | 사용 | 바위+전기 조합의 수직 낙뢰 후보 |
| `iceBurst` | 사용 | 얼음+불 조합의 파편 후보 |
| `blizzard` | 선택 | 넓은 지속 연출이므로 피해는 낮거나 간헐적으로 |
| `fireDust` | 선택 | 화면 압박 중심, 직접 피해는 낮게 |
| `chargedDust` | 선택 | 지속 전기 잔광 중심 |
| `amplifyZone` | 미사용 | 증폭 연출. 직접 피해 대신 다른 visual 강화 |
| `slowZone` | 미사용 | CPU 둔화로 쓰려면 별도 디자인 필요. 기본은 visual |

### 4.5 반응 우선순위

한 셀이나 주변 셀에서 여러 반응 후보가 동시에 생기면 우선순위가 필요하다.

1. 기본 원소 2개가 직접 맞닿으면 1차 파생 원소를 먼저 만든다.
2. 파생 원소가 이미 존재하면 파생+기본 2차 반응을 우선한다.
3. 같은 위치에 여러 2차 반응 후보가 있으면 `고정 영역`, `전기`, `불`, `물`, `모래` 순으로 우선순위를 둔다.
4. 2차 반응 중 damage feedback 대상인 경우 축약된 피해 후보 record를 남긴다.
5. 전체 material field readback은 하지 않는다.

이 순서를 따르면 플레이어는 4개 기본 원소만 뿌리지만, 화면에서는 Noita식 연쇄 반응과 마법적 파생 현상이 풍부하게 만들어진다.

## 5. 유저가 사용하는 기본 원소 스킬

유저 스킬은 기본 원소를 `어떻게 뿌리는가`에 집중한다. 스킬 자체의 CPU 피해는 기존 전투 로직에서 처리하고, material field에는 기본 원소 emitter만 넘긴다. 이후 파생 원소와 2차 반응은 GPU가 알아서 만든다.

### 5.1 불 스킬

| Skill ID | 이름 | 형태 | CPU 전투 효과 | GPU 살포 방식 |
| --- | --- | --- | --- | --- |
| `fire_bolt` | 화염탄 | 단일 | 빠른 단일 피해 | 작은 fire trail |
| `fire_fan` | 부채꼴 화염 | 멀티 | 전방 다중 투사체 | 여러 갈래 fire emitter |
| `fireball` | 화염구 | 광역 | 충돌 시 폭발 피해 | fire, smoke, 열기 ring |
| `flame_orbit` | 화염 궤도 | 소환/지속 | 플레이어 주변 접촉 피해 | 회전 fire emitter |
| `heat_ray` | 열선 | 관통/지속 | 직선 지속 피해 | 얇은 fire line |
| `burning_cloud` | 연소 구름 | 지속/광역 | CPU hazard 피해 | 공중 fire cloud, 위로 상승 |

### 5.2 물 스킬

| Skill ID | 이름 | 형태 | CPU 전투 효과 | GPU 살포 방식 |
| --- | --- | --- | --- | --- |
| `water_bolt` | 물탄 | 단일 | 낮은 단일 피해 | water droplet trail |
| `water_burst` | 물 폭발 | 광역 | 낮은 광역 피해 | 원형 water splash 후 아래로 낙하 |
| `rain_fall` | 낙하 비 | 지속/멀티 | 약한 반복 피해 | 위쪽에서 water가 떨어짐 |
| `water_fan` | 부채꼴 물줄기 | 멀티 | 전방 다중 타격 | 여러 갈래 water stream |
| `tidal_pull` | 조류 끌어당김 | 광역/제어 | CPU 위치 보정 또는 짧은 끌림 | 물덩이가 모였다가 아래로 무너짐 |
| `water_orbit` | 물 궤도 | 소환/지속 | 주변 접촉 피해 | 회전 water emitter |

### 5.3 전기 스킬

| Skill ID | 이름 | 형태 | CPU 전투 효과 | GPU 살포 방식 |
| --- | --- | --- | --- | --- |
| `electric_bolt` | 전격탄 | 단일 | 빠른 단일 피해 | electric trail, 짧은 spark seed |
| `thunder_strike` | 낙뢰 | 광역 | 위에서 아래로 즉발 강타 | vertical electric column |
| `electric_fan` | 전기 산탄 | 멀티 | 여러 작은 전격 | arc 형태 electric emitter |
| `electric_orb` | 전기 구체 | 추적/소환 | 느린 추적 피해 | 공중 electric core |
| `static_mine` | 정전 지뢰 | 함정 | 접근 시 폭발 피해 | 부유 electric mine |
| `arc_beam` | 전기 광선 | 관통/지속 | 직선 지속 피해 | 얇은 electric beam |

### 5.4 모래 스킬

| Skill ID | 이름 | 형태 | CPU 전투 효과 | GPU 살포 방식 |
| --- | --- | --- | --- | --- |
| `sand_bolt` | 모래탄 | 단일 | 물리 단일 피해 | sand trail, 아래로 낙하 |
| `sand_barrage` | 모래 탄막 | 멀티 | 여러 물리 투사체 | sand 입자 다량 방출 |
| `sand_fall` | 모래비 | 지속/광역 | 약한 반복 피해 | 위쪽에서 sand 낙하 |
| `sand_wave` | 모래 파도 | 광역 | 전방 넓은 피해 | 전방으로 밀린 뒤 아래로 무너짐 |
| `sand_mine` | 모래 지뢰 | 함정 | 접근 시 물리 폭발 | 부유 sand cluster |
| `sand_orbit` | 모래 궤도 | 소환/지속 | 주변 접촉 피해 | 회전 sand emitter |

## 6. 파생 원소는 직접 스킬이 아니다

`증기`, `스파크`, `바위`, `얼음`, `먼지`, `고정 영역`은 유저가 직접 장착하는 스킬이 아니다. 이들은 GPU material field에서 기본 원소가 만난 결과로 생성된다.

| 파생 원소 | 직접 스킬화 여부 | 이유 |
| --- | --- | --- |
| 증기 | 직접 스킬 아님 | 불+물 조합 결과로 나와야 조합 학습이 생김 |
| 스파크 | 직접 스킬 아님 | 전기 스킬과 구분하기 위해 불+전기 결과로 제한 |
| 바위 | 직접 스킬 아님 | 모래+불의 무거운 낙하 결과로 쓰는 편이 직관적 |
| 얼음 | 직접 스킬 아님 | 물+전기의 마법 반응 결과로 유지 |
| 먼지 | 직접 스킬 아님 | 물+모래의 느린 낙하/부유 결과로 유지 |
| 고정 영역 | 직접 스킬 아님 | 전기+모래 조합으로 생기는 마법적 장치 역할 |

## 7. CPU 판정과 GPU 반응 분리

| 구분 | 담당 | 예시 |
| --- | --- | --- |
| CPU 전투 | 스킬 명중, 피해, 쿨다운, 적 사망, 웨이브 | `fireball` 폭발 피해, `sand_bolt` 물리 피해 |
| GPU material field | 기본 원소 이동, 1차 파생 원소, 2차 반응, 시각 연쇄, 피해 후보 생성 | 증기 상승, 스파크 연쇄 폭파, 얼음 파편, 고정 영역 |
| 연결 방식 | CPU가 기본 원소 emitter를 GPU에 단방향 전달 | `MaterialEmitter { material: 'fire' }` |
| 제한적 feedback | 2차 반응 피해 후보만 작은 buffer로 CPU에 전달 | `chainArc` 위치/반경/강도 record |
| 금지 사항 | 전체 material field readback 금지 | 192x192 전체 셀을 매 프레임 CPU로 읽지 않음 |

이 분리를 유지해야 headless combat, 웨이브 밸런스, 테스트가 안정적이다. GPU는 실제 HP를 깎지 않고, CPU가 feedback record를 읽은 뒤 기존 `damageEnemy()` 같은 경로로 최종 피해를 확정한다.

### 7.1 Damage Feedback Buffer

2차 반응 피해를 전투에 반영하려면 전체 필드가 아니라 축약된 피해 후보만 읽는다.

```text
GPU material field
  -> 2차 반응 발생
  -> damage feedback record append
  -> CPU가 1-2프레임 뒤 readback
  -> CPU가 적 위치와 겹침 판정
  -> CPU damageEnemy() 호출
```

권장 record 형태:

```js
{
  x,
  y,
  radius,
  damageType: 'chainArc',
  intensity,
  sourceReaction: 'steam+electric',
  frame
}
```

권장 제한:

| 항목 | 권장값 | 이유 |
| --- | --- | --- |
| record count | 128-256개 | readback 크기 제한 |
| readback delay | 1-2프레임 허용 | GPU stall 방지 |
| buffer 방식 | ring buffer 2-3개 | GPU write와 CPU read 충돌 방지 |
| damage source | 2차 반응만 | 1차 파생까지 피해를 주면 밸런스가 급격히 흔들림 |
| CPU 처리 | 최종 판정 담당 | 적 radius, 무적, 사망, 점수 처리를 기존 로직으로 유지 |

### 7.2 Feedback 처리 흐름

```text
CPU frame N
  - skill update
  - projectile/hazard damage 처리
  - base MaterialEmitter 업로드

GPU frame N
  - emitter 적용
  - material 이동
  - 1차 반응
  - 2차 반응
  - damage feedback buffer 작성

CPU frame N+1 또는 N+2
  - 이전 feedback buffer map/read
  - damage 후보를 enemy와 충돌 검사
  - damageEnemy() 호출
```

이 구조는 완전한 GPU 권위 전투가 아니다. GPU는 “피해 후보를 제안”하고 CPU는 “게임 규칙에 맞게 확정”한다.

## 8. GPU 반응 연출 예시

| 플레이어 행동 | GPU에서 벌어지는 일 | 화면 결과 |
| --- | --- | --- |
| 물 폭발 후 화염구 | 물과 불이 만나 증기 생성 | 증기가 천천히 상승하며 시야를 채움 |
| 화염 부채 후 전격탄 | 불과 전기가 만나 스파크 생성 | 작은 전기 불꽃이 주변으로 튐 |
| 모래비에 화염구 | 모래와 불이 만나 바위 생성 | 무거운 바위 입자가 아래로 떨어짐 |
| 물줄기에 낙뢰 | 물과 전기가 만나 얼음 생성 | 얼음 파편이 생기고 떨어짐 |
| 모래 탄막에 물 폭발 | 물과 모래가 만나 먼지 생성 | 탁한 먼지가 천천히 낙하/부유 |
| 모래 구름에 전기 지뢰 | 전기와 모래가 만나 고정 영역 생성 | 공중에 룬 같은 영역이 잠시 고정 |

## 9. 파생 원소 기반 화면 콤보

| 콤보 | 설명 |
| --- | --- |
| 증기 + 모래 -> 토네이도 | 물과 불로 증기를 만든 뒤 모래를 뿌리면 상승 회오리 |
| 증기 + 전기 -> 체인 번개 | 증기 구름에 전기를 넣으면 구름 내부에서 전기 가지가 번짐 |
| 스파크 + 모래 -> 연쇄 폭파 | 불+전기로 만든 스파크가 모래 입자를 따라 폭파 |
| 스파크 + 물 -> 각도 레이저 | 스파크가 물방울을 따라 꺾이는 전격 빔처럼 보임 |
| 바위 + 물 -> 핀볼 구체 | 불+모래로 만든 바위가 물을 만나 튕기며 낙하 |
| 바위 + 전기 -> 수직 낙뢰 | 바위 위치를 기준으로 낙뢰 기둥이 꽂힘 |
| 얼음 + 불 -> 빙결 파열 | 물+전기로 만든 얼음이 불을 만나 사방 파편으로 깨짐 |
| 얼음 + 모래 -> 블리자드 | 얼음과 모래가 섞여 낙하 파편 폭풍 |
| 먼지 + 불 -> 화염 분진 | 먼지 구름에 불이 붙어 뜨거운 잔광 유지 |
| 먼지 + 전기 -> 전하 분진 | 먼지 구름 안에서 전기 잔광 반복 |
| 고정 영역 + 불 -> 공격 증폭 영역 | fire visual이 커지고 밝아지는 증폭 구역 |
| 고정 영역 + 물 -> 감속 영역 | 물방울이 느리게 떠다니는 감속 구역 |

## 10. 스킬 ID 네이밍 규칙

권장 규칙은 `기본원소_살포형태`다. 파생 원소 이름은 GPU material id로만 쓰고, 유저 장착 스킬 ID에는 쓰지 않는다.

| 원소 | prefix | 예시 |
| --- | --- | --- |
| 불 | `fire`, `flame`, `heat` | `fire_bolt`, `fire_fan`, `fireball`, `heat_ray` |
| 물 | `water`, `rain`, `tidal` | `water_bolt`, `water_burst`, `rain_fall`, `tidal_pull` |
| 전기 | `electric`, `thunder`, `arc` | `electric_bolt`, `thunder_strike`, `arc_beam` |
| 모래 | `sand` | `sand_bolt`, `sand_barrage`, `sand_fall`, `sand_wave` |

예약어:

| 예약어 | 용도 |
| --- | --- |
| `steam`, `spark`, `rock`, `ice`, `dust`, `fixed_zone` | GPU 파생 material id |
| `tornado`, `chain_arc`, `laser_arc`, `blizzard`, `gravity_zone` | GPU 2차 반응 material/profile |
| `frost`, `glass`, `mud`, `plasma` | 향후 확장 가능하지만 현재 유저 직접 스킬 prefix로는 쓰지 않음 |

구현에서는 다음 필드를 우선 맞춘다.

```js
{
  id: 'electric_bolt',
  element: 'electric',
  tags: ['electric', 'base-element', 'single'],
  cooldownMs: 850,
  targeting: { type: 'progress-risk' },
  projectile: {
    speed: 620,
    damage: 14,
    radius: 5,
    lifetimeMs: 1600
  },
  materialEffects: {
    cast: [{ material: 'electric', radius: 5, strength: 220, frames: 1 }],
    hit: []
  }
}
```

혼합 결과는 skill id가 아니라 GPU material reaction table에서 관리한다.

### 10.1 권장 스킬 데이터 스키마

현재 `fireball` 정의와 호환되게 시작하되, 확장 필드는 선택값으로 둔다.

```js
{
  id: 'water_burst',
  name: 'Water Burst',
  element: 'water',
  tags: ['water', 'base-element', 'area', 'falling-liquid'],
  tier: 1,
  cooldownMs: 1200,
  targeting: {
    type: 'self-area'
  },
  spawnShape: {
    shape: 'fallingRain',
    offsetY: -48,
    gravityBias: 1
  },
  projectile: null,
  impact: {
    damage: 6,
    areaDamage: {
      radius: 58,
      damage: 6
    }
  },
  materialEffects: {
    cast: [
      { material: 'water', radius: 58, strength: 220, frames: 2, life: 0 }
    ],
    hit: []
  },
  materialPhysicsHint: {
    liquidFall: true,
    gravityBias: 1,
    windDrift: 0.08
  },
  gpuReactionRole: 'base-input-only',
  balance: {
    role: 'area-primer',
    expectedDps: 'low',
    crowdControl: 'none',
    screenPressure: 'medium'
  }
}
```

### 10.2 스킬 구현 레벨

모든 스킬을 한 번에 같은 깊이로 구현하지 않는다. 레벨을 나누면 기획량이 커져도 개발 순서를 통제할 수 있다.

| 레벨 | 의미 | 필요 시스템 | 예시 |
| --- | --- | --- | --- |
| L1 | 기본 원소 projectile/material effect만 구현 | 기존 `skills.js`, `MaterialEmitter` | `fire_bolt`, `water_bolt`, `electric_bolt`, `sand_bolt` |
| L2 | 기본 원소의 광역/멀티 살포 구현 | `impact.areaDamage`, fan/multi shot helper | `fire_fan`, `water_burst`, `thunder_strike`, `sand_barrage` |
| L3 | CPU 지속 피해/소환 구현 | hazard tick, orbit/summon helper | `burning_cloud`, `water_orbit`, `electric_orb`, `sand_orbit` |
| L4 | GPU 1차 파생 반응 구현 | shader reaction table | `steam`, `spark`, `rock`, `ice`, `dust`, `fixedZone` |
| L5 | GPU 2차 반응 구현 | shader reaction priority/profile | `tornado`, `chainArc`, `laserArc`, `blizzard`, `gravityZone` |

1차 구현은 L1-L2까지만 잡는 것이 좋다. L4-L5는 CPU 전투 로직을 건드리지 않고 material field shader와 시각 검증 중심으로 진행한다.

### 10.3 ECS 유사 스킬 구현 구조

이 프로젝트에는 완전한 ECS를 새로 도입하기보다, 현재 `skills.js`, `systems.js`, `projectiles`, `hazards`, `frameEffects` 흐름을 유지하면서 ECS처럼 다루는 방식이 적합하다.

핵심 개념은 다음과 같다.

| ECS 개념 | 이 프로젝트에서의 대응 |
| --- | --- |
| Entity | runtime projectile, hazard, summon, status, enemy, player |
| Component | projectile, impact, areaDamage, status, chain, materialEmitter 같은 데이터 조각 |
| System | `updateProjectiles`, `resolveProjectileHits`, `updateHazards`, future `GpuMaterialReactionSystem` |
| Prefab | `src/game/content/skills.js`의 skill definition |
| Event | `frameEvents`, `frameEffects` |

스킬 하나를 큰 함수로 작성하지 말고, 여러 component를 조합한 prefab처럼 작성한다. 이렇게 하면 새 스킬을 추가할 때 시스템 코드를 매번 고치지 않고, 데이터 파라미터만 바꿔서 변형을 만들 수 있다.

```text
Skill Definition
  -> cast component
  -> targeting component
  -> projectile component
  -> impact component
  -> optional CPU status/hazard component
  -> material emitter component
  -> gpu reaction role metadata
  -> visual/balance metadata
```

### 10.4 스킬 컴포넌트 목록

| Component | 역할 | 현재 지원 | 예시 필드 |
| --- | --- | --- | --- |
| `cooldown` | 자동 시전 주기 | 지원 | `cooldownMs` |
| `targeting` | 대상 선택 | 일부 지원 | `type`, `range`, `priority` |
| `projectile` | 투사체 생성 | 지원 | `speed`, `damage`, `radius`, `lifetimeMs`, `homing`, `energy` |
| `multiShot` | 여러 투사체 생성 | 추가 필요 | `count`, `spreadDeg`, `delayMs`, `damageScale` |
| `impact` | 명중 시 처리 | 지원 | `damage`, `areaDamage`, `hazards`, `statuses` |
| `areaDamage` | 광역 피해 | 지원 | `radius`, `damage`, `falloff` |
| `hazard` | 지속 공중 구역/구름 | 지원 | `type`, `radius`, `damagePerSecond`, `lifetimeMs`, `tickMs` |
| `status` | CPU 상태 이상 | 추가 필요/선택 | 기본 4원소 스킬 자체가 줄 때만 사용. GPU 파생 반응에는 사용하지 않음 |
| `chain` | CPU 전파 공격 | 추가 필요/선택 | 기본 전기 스킬의 CPU 판정용. GPU `chainArc`와 분리 |
| `summon` | 소환체 | 추가 필요 | `type`, `count`, `lifetimeMs`, `attackIntervalMs` |
| `materialEffects` | GPU 물질 흔적 | 지원 | `cast`, `hit`, `tick`, `expire` |
| `spawnShape` | 공중 생성 형태 | 추가 필요 | `shape`, `offsetY`, `arc`, `spreadDeg`, `gravityBias` |
| `materialPhysicsHint` | 물질 이동 의도 | 문서/추가 필요 | `gasRise`, `liquidFall`, `solidFall`, `windDrift` |
| `gpuReactionRules` | GPU 원소 반응 | 추가 필요 | `inputA`, `inputB`, `output`, `profile`, `priority` |
| `gpuDamageFeedback` | 2차 반응 피해 후보 | 추가 필요 | `enabled`, `damageType`, `radius`, `intensityScale`, `maxRecords` |
| `scaling` | 레벨/아이템 성장 | 추가 필요 | `damage`, `radius`, `cooldown`, `duration` |
| `visual` | 렌더링 힌트 | 일부 지원 | `color`, `coreColor`, `glowColor` |
| `balance` | 튜닝 메타데이터 | 문서용 | `role`, `expectedDps`, `crowdControl` |

컴포넌트는 가능한 한 순수 데이터여야 한다. 스킬 정의 안에 함수를 넣으면 직렬화, 테스트, 툴링, 밸런스 비교가 어려워진다.

### 10.4.1 사이드 뷰 공중전 파라미터

공중전에서는 같은 원형 폭발이라도 물질의 이후 이동 방향이 다르다. 스킬 데이터에는 판정용 숫자와 별도로 물질의 의도를 표현하는 힌트를 둘 수 있다.

| 파라미터 | 의미 | 권장 사용 |
| --- | --- | --- |
| `spawnShape` | 생성 형태 | `point`, `ring`, `cone`, `verticalColumn`, `fallingRain`, `risingCloud`, `orbit` |
| `offsetY` | 시전자/대상 기준 위아래 생성 위치 | 낙뢰는 음수, 낙하 모래/우박은 음수에서 시작 |
| `gravityBias` | 액체/고체가 아래로 무너지는 의도 | water, sand, ice shard, glass shard |
| `buoyancyBias` | 기체가 위로 올라가는 의도 | smoke, steam, heat mist |
| `windDrift` | 좌우 흐름 영향 | smoke, steam, dust |
| `fallSpeedHint` | 시각/판정상 낙하 속도 기준 | meteor, hailstorm, sandfall |
| `riseSpeedHint` | 시각/판정상 상승 속도 기준 | steam, smoke, hot air |
| `lingerMs` | 공중에 머무르는 hazard 시간 | static_field, burning_field, mist_veil |

예시는 다음과 같다.

```js
spawnShape: Object.freeze({
  shape: 'fallingRain',
  offsetY: -96,
  width: 140,
  gravityBias: 1,
  fallSpeedHint: 420,
})
```

```js
materialPhysicsHint: Object.freeze({
  gasRise: true,
  buoyancyBias: 0.8,
  windDrift: 0.45,
})
```

이 힌트는 처음에는 문서/튜닝 메타데이터로만 둬도 된다. 이후 `MaterialEmitter`가 방향성이나 shape를 지원하면 실제 emitter buffer packing으로 연결한다.

### 10.5 권장 코드 작성 방식

#### 10.5.1 스킬 정의는 데이터로 작성

```js
export const WATER_BURST_SKILL = Object.freeze({
  id: 'water_burst',
  name: 'Water Burst',
  element: 'water',
  tags: Object.freeze(['water', 'base-element', 'area', 'falling-liquid']),
  cooldownMs: 1200,
  targeting: Object.freeze({
    type: 'self-area',
    radius: 58,
  }),
  impact: Object.freeze({
    damage: 6,
    areaDamage: Object.freeze({
      radius: 58,
      damage: 6,
      falloff: 'none',
    }),
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      Object.freeze({ material: 'water', radius: 58, strength: 210, frames: 2 }),
    ]),
    hit: Object.freeze([]),
  }),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    role: 'area-primer',
    expectedDps: 'low',
    crowdControl: 'none',
    screenPressure: 'medium',
  }),
});
```

이 방식의 장점은 `water_burst`를 `rain_fall`, `water_fan`, `water_orbit`로 바꿀 때 시스템 코드를 수정하지 않고 component 파라미터만 조정할 수 있다는 점이다. `steam`이나 `ice` 같은 파생 원소는 여기서 직접 넣지 않는다.

#### 10.5.2 변형 스킬은 base prefab에서 파생

반복되는 스킬은 얕은 복사로 변형한다. 단, 중첩 객체를 직접 공유하면 나중에 수정 실수가 생기므로 최종 export 전에 `deepFreeze` 또는 명시적 `Object.freeze`를 적용한다.

```js
const BASE_BURST = Object.freeze({
  targeting: Object.freeze({ type: 'self-area', radius: 56 }),
  impact: Object.freeze({
    areaDamage: Object.freeze({ radius: 56, damage: 6 }),
  }),
});

export const RAIN_FALL_SKILL = Object.freeze({
  ...BASE_BURST,
  id: 'rain_fall',
  name: 'Rain Fall',
  element: 'water',
  tags: Object.freeze(['water', 'base-element', 'falling-liquid', 'multi']),
  cooldownMs: 1500,
  spawnShape: Object.freeze({
    shape: 'fallingRain',
    offsetY: -120,
    width: 160,
    gravityBias: 1,
  }),
  impact: Object.freeze({
    ...BASE_BURST.impact,
    areaDamage: Object.freeze({ radius: 72, damage: 5 }),
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      Object.freeze({ material: 'water', radius: 6, strength: 180, frames: 6 }),
    ]),
  }),
});
```

#### 10.5.3 GPU 반응은 별도 reaction table로 작성

예를 들어 `증기 + 전기 = 체인 번개`는 유저 스킬이 아니라 GPU reaction rule이다. 스킬 정의에 넣지 말고 material field의 reaction table로 관리한다.

```js
export const GPU_REACTION_RULES = Object.freeze([
  Object.freeze({
    inputA: 'fire',
    inputB: 'water',
    output: 'steam',
    profile: 'risingGas',
    priority: 10,
  }),
  Object.freeze({
    inputA: 'steam',
    inputB: 'electric',
    output: 'chainArc',
    profile: 'visualChainLightning',
    priority: 30,
    feedback: Object.freeze({
      enabled: true,
      damageType: 'chainArc',
      radius: 34,
      intensityScale: 0.32,
      maxRecordsPerFrame: 32,
    }),
  }),
]);
```

이 구조에서는 CPU 피해 없이도 전장에 원소를 뿌리는 순서만으로 복잡한 시각 반응이 만들어진다.

### 10.6 ECS 유사 시스템 처리 순서

현재 `updateGame` 순서를 유지하되, 스킬 확장 시스템은 아래처럼 붙이는 것이 좋다.

```text
syncRuntimeCollections
updatePlayer
updateWaveSpawns
updateEnemies
updateAutoSkills
spawnSkillRuntimeEntities
updateProjectiles
resolveProjectileHits
updateHazards
emitMaterialEffects
runGpuMaterialReactions
readGpuDamageFeedback
applyGpuDamageFeedback
cleanupEntities
```

단기적으로는 별도 `emitMaterialEffects` system을 만들지 않아도 된다. 현재처럼 각 system이 `state.frameEffects`에 `MaterialEmitter`를 push해도 된다. GPU material reaction은 CPU update loop 안에서 판정하지 않고, 렌더링/compute pass 쪽에서만 처리한다.

| System | 읽는 component | 생성/수정하는 것 |
| --- | --- | --- |
| `SkillCastSystem` | `cooldown`, `targeting`, `projectile`, `materialEffects.cast` | projectile, cast event, cast emitter |
| `ProjectileSystem` | projectile runtime component | projectile position, projectile energy |
| `ImpactSystem` | `impact`, `areaDamage`, `materialEffects.hit` | damage event, area damage, hit emitter |
| `HazardSystem` | `hazard`, `materialEffects.tick` | hazard tick damage, tick emitter |
| `StatusSystem` | optional CPU `status` | enemy/player status duration, stack. GPU 반응과 무관 |
| `GpuMaterialReactionSystem` | `gpuReactionRules`, material field cells | 파생 원소와 2차 반응 시각 효과, feedback record 작성 |
| `GpuDamageFeedbackSystem` | damage feedback buffer | CPU가 읽은 피해 후보를 적과 충돌 검사 후 실제 피해 확정 |
| `SummonSystem` | `summon` | summon entity, summon attacks |

### 10.7 런타임 엔티티 형태

스킬 정의는 prefab이고, 전투 중 생성되는 것은 runtime entity다.

```js
{
  id: 41,
  kind: 'projectile',
  skillId: 'fireball',
  components: {
    transform: { x: 420, y: 280 },
    velocity: { x: 360, y: -120 },
    collision: { radius: 7 },
    damage: { amount: 20, element: 'fire' },
    lifetime: { ageMs: 0, maxMs: 2600 },
    energy: { current: 96, max: 96 },
    materialTrail: {
      intervalMs: 48,
      effects: [{ material: 'fire', profile: 'projectileFire', life: 10, radius: 4 }]
    }
  }
}
```

현재 코드는 `components` 객체를 쓰지 않고 projectile 필드를 평평하게 둔다. 당장은 평평한 구조를 유지해도 된다. 중요한 것은 시스템이 `skillId`로 원본 skill definition을 찾아 component를 해석하는 방향을 유지하는 것이다.

### 10.8 파라미터화 규칙

| 규칙 | 이유 |
| --- | --- |
| 피해, 반경, 수명, 쿨다운은 항상 숫자 파라미터로 둔다 | 밸런스 표와 테스트에서 비교하기 쉽다 |
| 확률은 `chance` 또는 `strength`로 통일한다 | emitter와 전투 반응을 같은 방식으로 튜닝 가능 |
| CPU 상태 이상을 추가한다면 `id`, `durationMs`, `power`, `maxStacks`를 기본 필드로 둔다 | GPU 파생 반응과 섞지 않고 별도 system에서 처리 |
| 조건부 반응은 callback 대신 tag 조건으로 쓴다 | 데이터화와 headless 테스트가 쉬움 |
| 스킬별 특수 로직은 먼저 component로 일반화 가능한지 검토한다 | `fireball`만 되는 예외 코드 증가 방지 |
| 시각 효과는 전투 피해와 같은 객체에 섞지 않는다 | GPU material field와 CPU 판정 분리 유지 |
| GPU 파생 원소는 skill definition에 직접 넣지 않는다 | 유저가 4원소만 뿌린다는 규칙 유지 |
| GPU reaction 결과를 피해에 쓰려면 `gpuDamageFeedback` record만 사용한다 | 전체 field readback 금지 |
| `profile`은 material behavior 차이가 있을 때만 추가한다 | 불필요한 shader branch 증가 방지 |

### 10.9 폴더 구조 제안

스킬 수가 늘어나면 `skills.js` 하나에 모든 정의와 helper를 넣기 어렵다. 아래처럼 분리하는 것을 권장한다.

```text
src/game/content/skills/
  index.js
  fire.js
  water.js
  lightning.js
  sand.js
  skillComponents.js
  skillPresets.js
  gpuReactionRules.js
  gpuDamageFeedback.js

src/game/systems/
  SkillCastSystem.js
  ProjectileSystem.js
  ImpactSystem.js
  HazardSystem.js
  StatusSystem.js

src/features/material-field/
  gpuReactionRules.js
  MaterialReactionTable.js
  DamageFeedbackBuffer.js
```

단, 현재 프로젝트는 `src/game/systems.js`에 전투 시스템이 모여 있으므로 한 번에 파일을 나누지 않는다. 먼저 component schema를 문서화하고, 스킬 수가 10개 이상이 되거나 테스트가 복잡해질 때 분리한다.

### 10.10 마이그레이션 순서

1. 기존 `fireball` 정의에 `element: 'fire'`, `tags`, `balance`, `gpuReactionRole: 'base-input-only'`를 추가한다.
2. `water_bolt`, `electric_bolt`, `sand_bolt`처럼 L1 기본 원소 스킬을 데이터로 추가한다.
3. `water_burst`, `thunder_strike`, `sand_barrage`처럼 L2 살포 방식 스킬을 추가한다.
4. `systems.test.js`에 skill definition shape 테스트와 material effect 테스트를 추가한다.
5. material field에 `electric`, `rock`, `ice`, `dust`, `fixedZone` material/profile을 추가한다.
6. `GPU_REACTION_RULES`를 shader-friendly table로 compile하는 경로를 만든다.
7. 2차 반응 damage feedback buffer를 추가하되 전체 material field readback은 금지한다.
8. CPU가 feedback record를 읽고 최종 피해를 확정하는 테스트를 추가한다.

### 10.11 작성 체크리스트

새 스킬을 추가할 때는 다음을 확인한다.

1. `id`가 snake_case이고 원소 prefix 또는 결과 이름을 따른다.
2. `element`, `tags`, `cooldownMs`, `targeting`이 있다.
3. 피해 판정은 `projectile.damage`, `impact.damage`, `impact.areaDamage`, `hazard.damagePerSecond` 중 하나 이상에 명확히 들어간다.
4. material field 표현은 `fire`, `water`, `electric`, `sand` 기본 원소 emitter만 직접 넣는다.
5. `steam`, `spark`, `rock`, `ice`, `dust`, `fixedZone`은 skill definition에 직접 넣지 않는다.
6. 파생/2차 반응은 `gpuReactionRules`에 데이터로 둔다.
7. headless 테스트에서 GPU 없이도 핵심 피해 결과를 검증할 수 있다.
8. GPU 2차 반응 피해는 `gpuDamageFeedback`이 켜진 reaction에서만 발생한다.
9. GPU 반응이 화려한 스킬은 기본 CPU 피해를 낮게 시작한다.

## 11. 구현 우선순위 제안

### 11.1 1차 구현 후보

현재 `fireball` 구조를 크게 바꾸지 않고, 4개 기본 원소를 모두 전장에 뿌릴 수 있게 만드는 단계다.

| 우선순위 | Skill ID | 이유 |
| --- | --- | --- |
| 1 | `fireball` | 기존 기준 스킬, fire 입력 유지 |
| 2 | `water_burst` | water 기본 입력과 액체 낙하 확인 |
| 3 | `electric_bolt` | electric 기본 입력 추가 |
| 4 | `sand_barrage` | sand 기본 입력과 분말 낙하 확인 |
| 5 | `thunder_strike` | 수직 electric column 살포 확인 |

### 11.1.1 1차 MVP 스킬팩

가장 먼저 넣을 스킬팩은 네 원소의 조작감 차이와 GPU 기본 반응을 확인하는 데 집중한다.

| Slot | Skill ID | 구현 레벨 | 핵심 검증 | 권장 기본값 |
| --- | --- | --- | --- | --- |
| 1 | `fireball` | L1 | 기존 기준 스킬, 폭발과 trail 유지 | 현 수치 유지 |
| 2 | `water_burst` | L1 | water emitter가 fire를 steam으로 바꾸는지 | cooldown 1200ms, radius 58, damage 6 |
| 3 | `electric_bolt` | L1 | electric emitter와 fire 접촉 시 spark 생성 | cooldown 850ms, damage 14 |
| 4 | `sand_barrage` | L1 | sand emitter와 fire 접촉 시 rock 생성 | cooldown 850ms, 5 shots, damage 7 each |
| 5 | `rain_fall` | L2 | 위쪽에서 물이 낙하하며 fire/sand/electric과 반응 | cooldown 1500ms, width 160, damage 5 |

이 다섯 개만 구현해도 불+물, 불+전기, 불+모래, 물+전기, 물+모래의 1차 반응 대부분을 확인할 수 있다.

### 11.2 2차 구현 후보

기본 원소 살포 형태를 늘려 2차 GPU 반응을 더 쉽게 만들기 위한 스킬이다.

| 우선순위 | Skill ID | 이유 |
| --- | --- | --- |
| 1 | `fire_fan` | 불을 넓게 뿌려 spark/rock/steam 반응 면적 확대 |
| 2 | `sand_fall` | 위쪽에서 모래를 떨어뜨려 rock/dust/fixedZone 생성 검증 |
| 3 | `electric_orb` | 공중에 전기 입력을 오래 남겨 spark/ice/fixedZone 검증 |
| 4 | `water_fan` | 다방향 물 입력으로 steam/ice/dust 생성 검증 |
| 5 | `sand_mine` | 공중 sand cluster와 fire/electric 반응 검증 |

### 11.3 3차 구현 후보

GPU reaction table과 shader profile 확장 단계다. CPU 전투 로직 변경 없이 진행한다.

| 우선순위 | 작업 | 이유 |
| --- | --- | --- |
| 1 | 6개 1차 파생 원소 추가 | steam/spark/rock/ice/dust/fixedZone |
| 2 | 증기 2차 반응 | tornado, chainArc |
| 3 | 스파크 2차 반응 | chainExplosion, laserArc |
| 4 | 바위/얼음 2차 반응 | pinballRock, lightningRock, iceBurst, blizzard |
| 5 | 먼지/고정 영역 2차 반응 | fireDust, chargedDust, amplifyZone, slowZone |

### 11.4 계열별 성장 트리

스킬 성장은 파생 원소를 직접 해금하는 방식이 아니라, 기본 원소를 더 다양한 형태로 뿌리는 방식으로 간다.

| 원소 | 초급 | 중급 | 고급 | GPU 반응을 잘 일으키는 방향 |
| --- | --- | --- | --- | --- |
| 불 | `fire_bolt` | `fireball`, `fire_fan` | `heat_ray`, `burning_cloud` | 물/전기/모래와 닿는 면적 확대 |
| 물 | `water_bolt` | `water_burst`, `rain_fall` | `water_fan`, `tidal_pull` | 불/전기/모래 위로 떨어지는 낙하 패턴 |
| 전기 | `electric_bolt` | `thunder_strike`, `arc_beam` | `electric_orb`, `static_mine` | 증기/물/모래 구역을 관통하는 입력 |
| 모래 | `sand_bolt` | `sand_barrage`, `sand_fall` | `sand_wave`, `sand_mine` | 불/물/전기와 오래 접촉하는 입자량 |

빌드 예시는 다음처럼 나눌 수 있다.

| 빌드 | 핵심 스킬 | 플레이 감각 |
| --- | --- | --- |
| 증기 연출 빌드 | `water_burst`, `fireball`, `rain_fall` | 불+물로 증기를 많이 만들고 상승 구름 연출 |
| 스파크 폭파 빌드 | `fire_fan`, `electric_bolt`, `sand_barrage` | spark를 만든 뒤 모래로 연쇄 폭파 연출 |
| 바위 낙하 빌드 | `sand_fall`, `fireball`, `water_fan` | rock을 만들고 물로 핀볼 구체 연출 |
| 얼음 폭풍 빌드 | `rain_fall`, `thunder_strike`, `sand_fall` | ice를 만들고 모래로 blizzard 연출 |
| 영역 제어 빌드 | `sand_mine`, `electric_orb`, `fire_fan` | fixedZone을 만들고 불로 증폭 영역 연출 |

## 12. 밸런스 가이드

| 형태 | 피해 | 쿨다운 | 잔류 시간 | 설계 주의 |
| --- | --- | --- | --- | --- |
| 단일 | 높음 | 짧음-중간 | 짧음 | 자동 추적이 강하면 피해를 낮춘다 |
| 멀티 | 중간 | 중간 | 짧음 | 투사체 수가 늘면 개별 피해를 낮춘다 |
| 광역 | 중간-높음 | 중간-김 | 중간 | 반경과 피해를 동시에 키우지 않는다 |
| 추적 | 낮음-중간 | 중간 | 짧음 | 명중 보장이 있으므로 직접 피해를 낮게 둔다 |
| 지속 | 낮음 | 김 | 김 | 공중 체류 구역 피해는 낮게, 제어 효과는 명확하게 둔다 |
| 소환 | 낮음-중간 | 김 | 김 | 소환체가 화면을 과점하지 않게 수 제한 필요 |
| 전파 | 낮음-중간 | 중간 | 짧음 | CPU 전파 스킬은 별도 설계. GPU 전파는 2차 feedback이 켜진 경우에만 피해 후보 생성 |
| 함정 | 높음 | 중간 | 김 | 발동 조건을 화면에서 읽을 수 있어야 한다 |

### 12.1 수치 튜닝 기준

| 항목 | 낮음 | 중간 | 높음 | 주의점 |
| --- | --- | --- | --- | --- |
| 직접 피해 | 5-10 | 11-25 | 26+ | 자동 명중/추적이면 한 단계 낮춘다 |
| 광역 반경 | 24-48 | 49-88 | 89+ | 반경이 크면 직접 피해나 원소 살포량을 줄인다 |
| 쿨다운 | 500-900ms | 1000-2200ms | 2300ms+ | 광역+제어+잔류가 있으면 길게 둔다 |
| CPU 상태 지속 | 0.2-0.8s | 0.9-2.0s | 2.1s+ | GPU 파생 원소와 별개로 기본 스킬 자체가 줄 때만 사용 |
| hazard 지속 | 1.0-2.0s | 2.1-4.0s | 4.1s+ | 플레이어가 피할 수 있는 시각 피드백 필요 |
| GPU material life | 8-20 | 21-60 | 61+ | life가 길면 화면 혼잡과 성능을 확인한다 |

밸런스 우선순위는 `명중 보장도 -> CPU 피해 -> CPU 제어 -> 원소 살포량 -> 화면 압박` 순서로 본다. GPU 파생 반응이 화려해져도 실제 피해가 자동으로 늘어나지 않게 한다.

### 12.2 원소별 실패 모드

| 원소 | 과하면 생기는 문제 | 완화 방법 |
| --- | --- | --- |
| 불 | 화면 전체가 위험 구역이 되어 회피 공간이 사라짐 | burn 피해보다 fire life/radius를 먼저 낮춤 |
| 물 | 물 입자가 너무 많아 화면 하단이 항상 젖어 보임 | water strength, frames, lifetime을 낮춤 |
| 전기 | chain visual이 실제 피해처럼 오해됨 | 전기 visual과 CPU damage event 피드백을 명확히 분리 |
| 모래 | 낙하 입자/잔류물이 너무 많아 화면이 답답해짐 | sand emitter strength와 frames 제한 |
| 파생 반응 | 조합 결과가 이해되지 않아 무작위처럼 보임 | 반응 우선순위와 시각 색/소리 명확화 |

## 13. 테스트와 완료 기준

### 13.1 스킬별 최소 테스트

| 테스트 | 확인 항목 |
| --- | --- |
| cast event | 쿨다운이 적용되고 올바른 projectile/hazard/effect가 생성되는가 |
| hit event | 피해량과 areaDamage가 CPU 전투 로직에서 기대대로 들어가는가 |
| base material effect | 스킬이 `fire`, `water`, `electric`, `sand` 기본 material만 직접 방출하는가 |
| gpu reaction table | 기본 2원소 조합이 6개 파생 원소로 변환되는가 |
| second reaction table | 파생+기본 원소 2차 반응이 우선순위대로 실행되는가 |
| feedback buffer | 2차 반응이 제한된 damage feedback record만 생성하는가 |
| feedback apply | CPU가 feedback record를 읽고 최종 피해를 기존 damage path로 적용하는가 |
| hazard tick | 지속형 스킬이 tick마다 피해와 시각 효과를 내는가 |
| no full readback | 전체 material field를 CPU로 읽지 않는가 |
| headless result | 120초 시뮬레이션에서 플레이어 피해와 웨이브 완료 시간이 과도하지 않은가 |

### 13.2 완료 기준

1. 4개 기본 원소가 모두 `skills.js`에서 데이터로 정의된다.
2. 각 스킬의 frame effect가 material field에 기본 원소 emitter로 전달된다.
3. GPU material field에서 6개 1차 파생 원소가 생성된다.
4. 최소 6개 이상의 파생+기본 2차 반응이 화면에서 확인된다.
5. 2차 반응 중 지정된 reaction만 damage feedback record를 만든다.
6. CPU 전투 테스트에서 직접 피해, 광역 피해, hazard tick이 GPU 없이 재현 가능하다.
7. GPU feedback 피해는 별도 통합 테스트에서 제한된 record 기반으로 검증한다.

## 14. 다음 단계

1. 기존 `fireball`에 `element: 'fire'`, `tags`, `balance`, `gpuReactionRole`을 붙여 기준 샘플로 만든다.
2. `water_burst`, `electric_bolt`, `sand_barrage`, `rain_fall`을 `src/game/content/skills.js`에 순수 데이터로 추가한다.
3. `MaterialEmitter`가 `fire`, `water`, `electric`, `sand` 기본 material을 안정적으로 받을 수 있게 한다.
4. material field에 `steam`, `spark`, `rock`, `ice`, `dust`, `fixedZone` 파생 material을 추가한다.
5. `GPU_REACTION_RULES`에 6개 1차 반응과 주요 2차 반응을 데이터로 추가한다.
6. 2차 반응용 `DamageFeedbackBuffer`를 추가한다.
7. 전체 material field readback은 금지하고, feedback record readback만 허용하는 구조를 테스트와 문서로 고정한다.

## 15. 요약

불은 전장을 태우고 위로 번지는 압박을 만든다. 물은 아래로 떨어지며 다른 원소를 만나 증기, 얼음, 먼지의 재료가 된다. 전기는 접촉한 매질을 따라 스파크와 고정 영역을 만든다. 모래는 아래로 무너지는 물리 입자이며 불, 물, 전기와 만나 바위, 먼지, 고정 영역을 만든다.

유저는 4개 기본 원소만 직접 사용한다. 재미의 핵심은 혼합 스킬을 따로 장착하는 것이 아니라, 4개 원소를 어떤 위치와 순서로 뿌리느냐에 따라 GPU compute shader가 증기, 스파크, 바위, 얼음, 먼지, 고정 영역과 2차 연쇄 반응을 만들어내는 데 있다. 2차 반응이 전투 피해에 참여해야 할 때는 전체 필드를 읽지 않고 작은 damage feedback buffer만 CPU로 넘긴다. CPU는 그 후보를 기존 전투 규칙으로 확정해 밸런스와 테스트 안정성을 지킨다.
