# Noita-Style WebGPU 물질 시뮬레이션 분석

작성일: 2026-05-28  
대상 프로젝트: `F:\Workspace\Skyfall-Mage2`  
기술 검증 코드: `tech-tests/noita-webgpu`

## 1. 분석 요약

Noita류의 `sand`, `water`, `fire`, `smoke`, `spark` 물질 효과는 rigid-body 물리 엔진보다 falling-sand/cellular automata 방식이 더 적합하다. 각 셀은 주변 몇 칸만 읽고 다음 상태를 결정하므로 GPU compute shader로 병렬화하기 좋다. 다만 픽셀이 서로 자리를 바꾸는 규칙은 race condition이 생기기 쉬워서, GPU 구현은 CPU 구현처럼 "한 셀을 움직이고 이웃 셀을 즉시 수정"하는 방식으로 작성하면 안 된다.

현재 `tech-tests/noita-webgpu`는 WebGPU 가능성을 확인하기 위한 독립 프로토타입이다. 정식 게임 UI, 적, 체력, 인벤토리, 판정은 없고, 전체 화면 material field만 갱신한다. 구현은 `256x144` 셀 grid를 `u32` storage buffer 두 개로 ping-pong하며, WGSL compute pass에서 다음 상태를 만들고 render pass에서 fullscreen triangle로 확대 표시한다.

v2 본게임에 편입할 때는 WebGPU field를 게임 판정의 절대 원천으로 두기보다, 전투 판정과 분리된 비주얼/환경 이펙트 레이어로 시작하는 편이 안전하다. 매 프레임 GPU 결과를 CPU로 읽어오면 병목이 되므로, CPU 게임 로직은 기존 TypeScript 상태계를 유지하고 WebGPU material field는 마법 폭발, 환경 변화, 연기/불/물 표현, 제한적 area query 정도만 담당하게 한다.

## 2. 참고할 만한 외부 구현

아래 프로젝트들은 "Noita와 같은 전체 게임"이라기보다, GPU로 falling-sand 또는 유사 물질장을 처리하는 방식의 참고 자료다.

| 프로젝트 | 기술 | 참고 포인트 |
| --- | --- | --- |
| [GelamiSalami/GPU-Falling-Sand-CA](https://github.com/GelamiSalami/GPU-Falling-Sand-CA) | GPU cellular automata | 병렬 업데이트에서 충돌을 피하기 위한 Margolus block 방식 참고 |
| [m4ym4y/falling-sand-shader](https://github.com/m4ym4y/falling-sand-shader) | WebGL fragment shader | 브라우저 GPU에서 sand/water/fire/lightning/metal을 표현하는 shader 기반 구조 참고 |
| [Maximilian-Seitz/PixelSim](https://github.com/Maximilian-Seitz/PixelSim) | Godot compute shader | sand/water 계열 pixel simulation을 compute shader로 처리하는 게임 엔진 사례 |
| [HexSleeves/bevy_shader_playground](https://github.com/HexSleeves/bevy_shader_playground) | Rust, Bevy, wgpu, WGSL | wgpu/WGSL 기반 cellular automata와 falling-sand 실험 참고 |
| [piellardj/water-webgpu](https://github.com/piellardj/water-webgpu) | WebGPU | 물 시뮬레이션을 GPU에 유지하고 CPU 왕복을 줄이는 구조 참고 |
| [AlinLucianBrb/Granular](https://github.com/AlinLucianBrb/Granular) | Unity Jobs/Burst, compute shader render | chunked world, checkerboard update, sand/water/smoke 게임 구조 참고 |

외부 사례에서 공통으로 확인되는 핵심은 "GPU에 잘 맞는 규칙으로 물질장을 다시 설계한다"는 점이다. CPU falling-sand 구현은 보통 아래에서 위로 순회하면서 즉시 셀을 바꾸지만, GPU에서는 모든 invocation이 동시에 실행되므로 같은 셀을 여러 입자가 동시에 쓰는 문제를 피해야 한다.

## 3. 현재 프로토타입 구조

### 3.1 파일 구성

`tech-tests/noita-webgpu`는 세 파일로 구성된다.

- `index.html`: 전체 화면 canvas와 WebGPU 미지원 안내 overlay
- `main.js`: WebGPU device/pipeline/buffer 초기화, 입력, frame loop
- `noitaField.wgsl`: material simulation compute shader와 fullscreen render shader

이 프로토타입은 Vite나 TypeScript에 연결되어 있지 않고, 저장소 루트에서 정적 서버를 띄운 뒤 상대 경로로 실행한다.

```text
python -m http.server 8000
http://localhost:8000/tech-tests/noita-webgpu/
```

GitHub Pages 같은 HTTPS secure context에서도 같은 상대 경로 정책으로 동작하도록 설계되어 있다.

### 3.2 Grid와 material 상수

`main.js`의 기본 해상도는 아래 값으로 고정되어 있다.

```js
const GRID_WIDTH = 256;
const GRID_HEIGHT = 144;
const WORKGROUP_SIZE = 8;
const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;
```

전체 셀 수는 `36,864`개다. 현재 셀 하나는 `u32` 하나로 저장되므로 material buffer 하나는 약 `144KB`이고, ping-pong buffer 두 개를 써도 셀 데이터 자체는 약 `288KB` 수준이다. 이 정도 크기는 WebGPU compute 실험용으로 충분히 가볍다.

material id는 JS와 WGSL에서 같은 숫자를 사용한다.

```text
0 empty
1 solid
2 sand
3 water
4 fire
5 smoke
6 spark
```

### 3.3 Cell packing

셀은 `u32` 하나에 세 값을 packing한다.

```js
function pack(material, life = 0, aux = 0) {
  return (material & 0xff) | ((life & 0xff) << 8) | ((aux & 0xff) << 16);
}
```

WGSL에서도 같은 구조를 쓴다.

```wgsl
fn material(cell: u32) -> u32 {
  return cell & 255u;
}

fn life(cell: u32) -> u32 {
  return (cell >> 8u) & 255u;
}

fn aux(cell: u32) -> u32 {
  return (cell >> 16u) & 255u;
}
```

현재 bit 배치는 다음 의미다.

| bit range | 값 | 용도 |
| --- | --- | --- |
| 0-7 | material | 셀 종류 |
| 8-15 | life | fire/smoke/spark 수명 |
| 16-23 | aux | 색 흔들림, 난수 seed 보조값 |
| 24-31 | 미사용 | 추후 온도, flags, variant 등에 사용 가능 |

이 방식은 storage buffer 대역폭을 줄이고 shader에서 분기 입력을 단순화한다. 반대로 material별 추가 상태가 많아지면 `u32` 하나만으로 부족해질 수 있으므로, v2에서 열/압력/속도까지 넣으려면 별도 field buffer를 추가하는 편이 낫다.

## 4. WebGPU 초기화와 GPU 데이터 흐름

### 4.1 Device와 canvas context

`createWebGpuState()`는 `navigator.gpu` 지원 여부를 먼저 확인하고, adapter와 device를 요청한다. 실패하면 canvas 위에 안내 overlay를 띄운다.

핵심 흐름은 아래와 같다.

```text
navigator.gpu
  -> requestAdapter()
  -> requestDevice()
  -> canvas.getContext('webgpu')
  -> context.configure({ device, format, alphaMode: 'opaque' })
```

정식 v2에서는 이 초기화를 앱 bootstrap에 직접 섞지 말고 `platform/webgpu.ts` 또는 `render/webgpu/MaterialFieldGpu.ts` 같은 모듈로 격리하는 편이 좋다. WebGPU는 지원 브라우저와 secure context 조건이 있으므로, 실패가 게임 전체 실패로 이어지지 않게 해야 한다.

### 4.2 Storage buffer ping-pong

현재 프로토타입은 storage buffer 두 개를 만든다.

```text
material-cells-a
material-cells-b
```

한 프레임에서 `src`를 읽고 `dst`에 다음 상태를 쓴 뒤, 다음 프레임에는 두 buffer 역할을 뒤집는다.

```text
frame N:     A -> B
frame N + 1: B -> A
frame N + 2: A -> B
```

이 ping-pong 구조는 GPU cellular automata에서 가장 기본적인 안전장치다. 같은 pass에서 같은 buffer를 읽고 쓰면 셀 업데이트 순서가 불명확해져 결과가 흔들릴 수 있다.

### 4.3 Uniform params

`paramsBuffer`는 `Uint32Array` 16개 크기의 uniform buffer다. 매 프레임 CPU에서 아래 값을 써서 GPU로 보낸다.

| index | 값 |
| --- | --- |
| 0 | grid width |
| 1 | grid height |
| 2 | frame |
| 3 | emitter active |
| 4 | emitter x |
| 5 | emitter y |
| 6 | emitter radius |
| 7 | emitter material |
| 8 | explosion active |
| 9 | explosion x |
| 10 | explosion y |
| 11 | explosion radius |
| 12 | canvas width |
| 13 | canvas height |
| 14-15 | padding |

이 구조는 CPU에서 GPU로 전달하는 데이터가 매우 작다는 장점이 있다. 현재 입력은 pointer 위치와 material 선택, 폭발 트리거뿐이라 uniform buffer 하나로 충분하다.

v2에서는 플레이어 마법, 적 투사체, 환경 이벤트를 모두 uniform 하나에 넣기 어렵다. 이때는 다음처럼 나누는 편이 낫다.

- `MaterialFieldParams`: frame, grid, viewport, global environment
- `EmitterBuffer`: 이번 프레임에 발생한 마법/폭발/환경 emitter 목록
- `QueryRequestBuffer`: 선택적으로 필요한 저빈도 GPU query 요청

### 4.4 Compute pipeline

compute pipeline은 `noitaField.wgsl`의 `simulate` entry point를 사용한다.

```js
const computePipeline = device.createComputePipeline({
  label: 'material-simulation-pipeline',
  layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
  compute: {
    module: shaderModule,
    entryPoint: 'simulate',
  },
});
```

dispatch 크기는 grid 크기를 workgroup 크기 `8x8`로 나눈 값이다.

```js
computePass.dispatchWorkgroups(
  Math.ceil(GRID_WIDTH / WORKGROUP_SIZE),
  Math.ceil(GRID_HEIGHT / WORKGROUP_SIZE),
);
```

현재 값으로는 `32 x 18 = 576`개 workgroup이 dispatch되고, 각 workgroup은 최대 64개 invocation을 실행한다. 총 invocation 수는 grid 셀 수와 같은 `36,864`개다.

### 4.5 Render pipeline

render pipeline도 같은 WGSL 파일을 사용한다. vertex shader는 fullscreen triangle을 만들고, fragment shader는 현재 canvas pixel 위치를 grid 좌표로 변환해 `src` buffer에서 셀을 읽는다.

```text
vertexMain
  -> fullscreen triangle
fragmentMain
  -> canvas position to grid coordinate
  -> src[index]
  -> materialColor(cell)
```

장점은 별도 texture upload가 없다는 점이다. compute 결과가 storage buffer에 남아 있고, fragment shader가 그 buffer를 바로 읽는다. v2에서도 material field가 독립 overlay라면 이 방식을 유지할 수 있다.

## 5. WGSL simulation 규칙 분석

### 5.1 기본 접근

`simulate()`는 현재 셀 하나를 담당한다.

```wgsl
@compute @workgroup_size(8, 8, 1)
fn simulate(@builtin(global_invocation_id) globalId: vec3<u32>) {
  if (globalId.x >= params.width || globalId.y >= params.height) {
    return;
  }

  let x = i32(globalId.x);
  let y = i32(globalId.y);
  let index = indexOf(globalId.x, globalId.y);
  let current = src[index];

  var out = applyCurrentOutgoing(current, x, y);
  out = applyIncoming(out, x, y);
  out = applyExplosion(out, x, y);
  out = applyEmitter(out, x, y);

  dst[index] = out;
}
```

한 invocation은 `dst[index]` 하나만 쓴다. 이 점이 중요하다. 여러 invocation이 같은 `dst` 위치에 동시에 쓰는 구조를 피하고, 현재 셀 관점에서 "내가 떠났는가"와 "이웃이 내 자리로 들어오는가"를 계산한다.

### 5.2 Outgoing과 incoming 분리

`applyCurrentOutgoing()`은 현재 셀이 이동하려는 경우 현재 위치를 비운다. 예를 들어 sand가 아래로 이동할 수 있으면 현재 위치는 empty가 된다. 이동 대상이 water라면 현재 위치에 water를 남겨 sand-water swap처럼 보이게 한다.

`applyIncoming()`은 주변 셀이 이 위치로 들어오려고 하는지 다시 계산한다. 예를 들어 현재 위치 위쪽, 좌상단, 우상단에 있는 sand가 `sandTarget()` 기준으로 이 위치를 목표로 잡았다면 현재 위치는 sand가 된다.

이 방식은 간단한 병렬 CA에서 흔히 쓰는 gather-style update다.

```text
outgoing: 현재 셀이 떠날지 결정
incoming: 이웃 셀이 내 자리로 들어올지 결정
write: 내 dst[index]만 기록
```

장점은 atomic write 없이도 구현이 단순하다는 점이다. 단점은 두 이웃이 같은 칸을 목표로 할 때 우선순위가 코드 순서에 고정되고, 완전한 질량 보존이나 물리적 정확성을 보장하지 않는다는 점이다.

### 5.3 Sand

`sandTarget()`은 아래, 좌하단/우하단 순서로 이동 후보를 고른다. 좌우 우선순위는 frame 기반 hash로 흔들어 자연스러운 퍼짐을 만든다.

Sand가 들어갈 수 있는 material은 다음이다.

```text
empty, water, smoke, fire
```

water로 들어갈 수 있게 둔 덕분에 sand가 물을 밀어내며 가라앉는 느낌을 만든다. 현재 구현은 간단한 swap 근사라서 큰 수조나 압력 표현까지는 담당하지 않는다.

### 5.4 Water

`waterTarget()`은 아래로 떨어질 수 있으면 아래로 이동하고, 아니면 좌우로 흐른다.

Water가 들어갈 수 있는 material은 다음이다.

```text
empty, smoke, fire
```

현재 water는 압력, 점성, 수평 속도 상태를 갖지 않는다. 그래서 좁은 틈을 따라 긴 거리로 퍼지는 물보다는, 한 셀 단위로 좌우를 더듬는 단순 액체에 가깝다. Noita식 액체 느낌을 강화하려면 v2 이후 단계에서 다음 중 하나가 필요하다.

- material cell의 `aux`에 flow direction 저장
- 별도 velocity/pressure buffer 추가
- water 전용 multi-pass 확산
- chunk 단위 반복 iteration 수 증가

### 5.5 Smoke

`smokeTarget()`은 위, 좌상단/우상단 순서로 이동한다. `life`가 줄어들고, 수명이 0에 가까워지면 사라진다.

Smoke가 들어갈 수 있는 material은 다음이다.

```text
empty, fire
```

현재 smoke는 시야 차폐나 게임 판정을 만들지 않고 색상과 수명만 갖는다. v2에서 연기 장판, 화염 장판, 독구름처럼 gameplay modifier가 필요해지면 GPU field를 직접 읽기보다 CPU에 별도 area effect를 생성하고, GPU smoke는 그 area effect의 시각화로 두는 편이 안전하다.

### 5.6 Fire와 spark

Fire는 `life` 기반으로 줄어들며, 주변에 water가 있으면 smoke로 바뀐다. 수명이 끝난 fire도 smoke를 남긴다.

Spark는 짧은 수명을 갖고 sand와 비슷한 낙하 target을 쓰며, 수명이 끝나면 fire가 된다.

현재 fire/spark는 연소 가능한 material을 태우는 시스템은 아니다. `solid`가 나무인지 돌인지 같은 variant가 없고, 온도 field도 없다. 정식 게임에서 불 마법의 gameplay 효과가 필요하다면 다음처럼 분리하는 것이 좋다.

```text
CPU combat:
  fire projectile hit
  -> enemy damage / burn status / area effect
  -> GPU material emitter event

GPU material field:
  fire/smoke/spark visual propagation
  -> optional low-frequency heat query only
```

### 5.7 Emitter와 explosion

`applyEmitter()`는 pointer 주변 반경 안에 material을 생성한다. water/sand 선택 시 해당 material만 뿌리고, fire 선택 시 roll 값에 따라 spark, smoke, fire를 섞는다.

`applyExplosion()`은 폭발 반경 안에서 solid 일부를 비우거나, spark/fire/smoke/sand를 만든다. 현재 JS에서는 `Space` 입력 시 `explosionFrames = 4`로 설정해 몇 프레임 동안 폭발 pass가 적용된다.

v2에서는 이 emitter 개념을 마법과 환경 이벤트의 공통 인터페이스로 확장할 수 있다.

```ts
export interface MaterialEmitter {
  kind: 'fire' | 'water' | 'sand' | 'smoke' | 'spark' | 'explosion';
  x: number;
  y: number;
  radius: number;
  strength: number;
  durationFrames: number;
}
```

다만 실제 구현 시에는 JS object 배열을 그대로 GPU로 넘기지 않고, 고정 크기 `ArrayBuffer` 또는 typed array로 packing해 storage buffer에 써야 한다.

## 6. 현재 구현의 강점과 한계

### 6.1 강점

- WebGPU 초기화, compute pass, render pass가 최소 구조로 분리되어 있어 학습 비용이 낮다.
- CPU에서 GPU로 보내는 데이터가 uniform params뿐이라 frame loop가 가볍다.
- storage buffer ping-pong 구조라 read/write ordering 문제가 비교적 명확하다.
- material color를 fragment shader에서 바로 계산하므로 별도 texture upload가 없다.
- pointer emitter와 explosion이 있어 마법 이펙트로 확장할 수 있는 형태가 보인다.

### 6.2 한계

- grid가 전역 `256x144` 하나라 월드 스크롤, chunk streaming, 큰 맵에는 아직 대응하지 않는다.
- race condition을 완전히 해결한 물리 모델은 아니다. gather-style 우선순위로 충돌을 근사한다.
- water는 압력/부피/속도 상태가 없어 Noita식 액체보다 단순하다.
- solid는 파괴 가능한 지형처럼 보이지만 tile collision이나 pathfinding과 연결되어 있지 않다.
- CPU readback 경로가 없으므로 게임 로직이 material field 결과를 직접 알 수 없다.
- WebGPU 미지원 브라우저에 대한 fallback은 안내 overlay뿐이다.

이 한계는 프로토타입으로서는 타당하다. 정식 게임에 넣을 때는 "어디까지를 gameplay로 인정할 것인가"를 먼저 정해야 한다.

## 7. v2 편입 설계

### 7.1 권장 역할

v2에서는 WebGPU material field를 아래 역할로 제한해서 시작한다.

```text
주 역할:
  전투 필드 위의 환경/마법 비주얼 레이어

허용:
  폭발 흔적, 불꽃, 연기, 물 튐, 모래/파편, 환경 전환 연출

제한:
  적 충돌의 단일 판정 원천
  매 프레임 CPU가 읽는 물리 상태
  인벤토리/웨이브/스킬의 핵심 상태 저장소
```

이렇게 하면 WebGPU 지원 여부와 무관하게 게임의 핵심 루프를 유지할 수 있고, GPU field는 지원 브라우저에서만 고급 효과로 켤 수 있다.

### 7.2 모듈 경계

v2 코드 시스템에 편입한다면 다음 모듈 경계가 적합하다.

```text
src/features/environment/
  MaterialFieldSystem.ts
  MaterialEmitterQueue.ts

src/render/webgpu/
  MaterialFieldGpu.ts
  MaterialFieldRenderer.ts
  materialField.wgsl

src/render/snapshots/
  MaterialFieldRenderData.ts

src/platform/
  webgpuSupport.ts
```

책임은 다음처럼 나눈다.

| 모듈 | 책임 |
| --- | --- |
| `MaterialFieldSystem` | CPU 게임 이벤트를 material emitter로 변환 |
| `MaterialEmitterQueue` | 이번 frame에 GPU로 보낼 emitter를 typed array로 packing |
| `MaterialFieldGpu` | device, buffers, bind groups, pipelines 소유 |
| `MaterialFieldRenderer` | WebGL2/WebGPU 렌더 순서 조율과 canvas 합성 |
| `webgpuSupport` | 지원 여부, adapter/device 생성 실패 처리 |

기존 v2 설계 문서의 `EnvironmentSystem`, `EnvironmentRenderAdapter`, `EffectRenderer`와 연결하되, `GameState`에 GPU buffer나 WebGPU object를 넣지 않는다.

### 7.3 Render 통합 방식

현재 v2 설계 기본값은 WebGL2 Canvas다. WebGPU field를 넣는 방법은 두 가지다.

1. 별도 WebGPU canvas를 WebGL2 canvas 위/아래에 overlay한다.
2. 전투 렌더러 전체를 WebGPU로 전환한다.

초기 편입은 1번이 안전하다. WebGL2 렌더러와 DOM UI를 유지하면서 material field만 별도 canvas로 합성한다.

```text
BattlePanel
  WebGL2 main canvas: player, enemies, projectiles, HUD
  WebGPU material canvas: fire/smoke/water/spark overlay
  DOM overlay: mobile controls, modal blockers
```

장점:

- 기존 WebGL2 renderer를 다시 작성하지 않아도 된다.
- WebGPU 실패 시 material canvas만 숨기면 된다.
- material field의 실험 속도를 높일 수 있다.

주의점:

- 두 canvas의 DPR, viewport, camera transform을 같은 `ViewportMapper`에서 받아야 한다.
- pointer 좌표를 grid 좌표로 바꿀 때 전투 world 좌표와 material grid 좌표의 기준을 통일해야 한다.
- WebGPU canvas가 pointer event를 가로채지 않도록 input layer 정책을 명확히 해야 한다.

### 7.4 Gameplay 연동 정책

GPU field에서 CPU로 매 프레임 전체 grid를 읽어오지 않는다. 필요한 gameplay 연동은 CPU 이벤트를 원천으로 삼는다.

예시:

```text
화염 마법 명중:
  CPU CombatSystem이 적 피해와 burn status 처리
  MaterialFieldSystem이 fire emitter 생성

폭발 마법:
  CPU CollisionSystem이 범위 피해 처리
  MaterialFieldSystem이 explosion emitter 생성

비 환경:
  EnvironmentSystem이 water/rain visual state 발행
  MaterialFieldSystem이 상단 water/smoke emitter 생성
```

GPU 결과를 gameplay에 반영해야 한다면 저빈도 query만 허용한다.

- 특정 작은 영역의 평균 fire/smoke 밀도
- 플레이어 주변 물질 타입 히스토그램
- 보스 패턴용 제한적 heat field

이 query는 매 프레임 전체 readback이 아니라 작은 staging buffer로 제한하고, 결과는 1-3프레임 늦게 반영되는 것으로 설계한다.

### 7.5 저장과 재현성

정식 저장 데이터에 전체 material grid를 포함하지 않는 것을 기본값으로 둔다. 이유는 다음과 같다.

- GPU field는 시각 효과 성격이 강하다.
- grid 전체 저장은 save schema를 키우고 migration 부담을 늘린다.
- WebGPU 난수/hash와 frame timing이 완전 결정론을 보장하지 않는다.

필요하면 저장 시점에 다음 정도만 남긴다.

- 활성 환경 타입
- 지속 중인 area effect 목록
- 화면에 남길 큰 폭발/화염 이벤트 seed

로드 후 material field는 몇 프레임 동안 재생성 warm-up을 거치면 된다.

## 8. 확장 로드맵

### 8.1 1단계: 현재 프로토타입 정리

- grid 크기, workgroup 크기, material enum을 config로 분리한다.
- shader compile error를 사용자에게 더 명확히 표시한다.
- emitter를 uniform 단일 값에서 storage buffer 목록으로 바꾼다.
- FPS/debug overlay를 선택적으로 추가한다.

### 8.2 2단계: v2 BattlePanel overlay

- WebGL2 main canvas와 WebGPU material canvas를 같은 BattlePanel에 배치한다.
- camera/viewport mapping을 공통 모듈에서 받는다.
- CombatSystem 이벤트를 material emitter로 변환한다.
- WebGPU 미지원 시 material field를 비활성화하고 WebGL2 particle fallback을 사용한다.

### 8.3 3단계: Chunk와 큰 월드 대응

- 전역 grid 대신 camera 주변 active chunk만 시뮬레이션한다.
- chunk 경계 셀 교환 정책을 둔다.
- 비활성 chunk는 압축된 seed/event 상태로 보관한다.
- 큰 폭발이나 보스 패턴처럼 중요한 이벤트만 chunk를 깨운다.

### 8.4 4단계: 더 깊은 물질 규칙

- water flow direction 또는 pressure buffer 추가
- heat/flammability buffer 추가
- material별 density와 swap priority 정의
- Margolus block 또는 checkerboard pass 검토
- multi-pass로 movement, reaction, render를 분리

## 9. 결론

현재 `tech-tests/noita-webgpu`는 v2에 바로 넣을 수 있는 완성 시스템은 아니지만, WebGPU로 Noita-inspired material field를 구현할 수 있다는 기술 검증으로는 충분하다. 구조상 CPU/GPU 데이터 흐름이 단순하고, compute pass와 render pass가 한 파일에 명확히 들어 있어 다음 단계 실험 기반으로 쓰기 좋다.

정식 v2에서는 WebGPU field를 핵심 게임 상태로 끌어올리기보다, 전투 판정과 분리된 GPU 환경 이펙트 레이어로 편입하는 것이 현실적이다. 이 방향이면 기존 WebGL2 렌더링 계획을 유지하면서도, 지원 브라우저에서는 fire/smoke/water/spark 계열 효과를 훨씬 풍부하게 만들 수 있다.

추후 `docs/v2-code-system-design-plan.md`에 반영할 항목은 다음 세 가지다.

- `render/webgpu` 또는 `features/environment/materialField` 하위 모듈 추가
- `EnvironmentSystem`에서 `MaterialEmitter` 이벤트를 발행하는 경계 정의
- WebGPU 미지원 브라우저의 fallback 정책 명시
