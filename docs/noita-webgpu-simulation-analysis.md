# Noita-Style WebGPU 물질 시뮬레이션 분석

작성일: 2026-05-28  
수정일: 2026-05-29  
기술 검증 코드: `tech-tests/noita-webgpu`

## 1. 분석 요약

Noita류의 `sand`, `water`, `fire`, `smoke`, `spark` 물질 효과는 rigid-body 물리 엔진보다 falling-sand/cellular automata 방식이 더 적합하다. 각 셀은 주변 몇 칸만 읽고 다음 상태를 결정하므로 GPU compute shader로 병렬화하기 좋다. 다만 픽셀이 서로 자리를 바꾸는 규칙은 race condition이 생기기 쉬워서, GPU 구현은 CPU 구현처럼 "한 셀을 움직이고 이웃 셀을 즉시 수정"하는 방식으로 작성하면 안 된다.

현재 `tech-tests/noita-webgpu`는 WebGPU 가능성을 확인하기 위한 독립 프로토타입이다. 정식 게임 UI, 적, 체력, 인벤토리, 판정은 없고, 전체 화면 material field만 갱신한다. 구현은 `256x144` 셀 grid를 `u32` storage buffer 두 개로 ping-pong하며, WGSL compute pass에서 다음 상태를 만들고 render pass에서 `rgba16float` scene texture에 그린 뒤 bloom 후처리를 거쳐 canvas에 합성한다.

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

`tech-tests/noita-webgpu`는 다음 파일로 구성된다.

| 파일 | 역할 |
| --- | --- |
| `index.html` | 전체 화면 canvas와 WebGPU 미지원 안내 overlay |
| `main.js` | WebGPU device/pipeline/buffer 초기화, 입력, frame loop, emitter packing |
| `noitaField.wgsl` | material simulation compute shader와 scene render shader |
| `bloomPostProcess.js` | scene texture에서 bloom mip-chain을 만들고 canvas에 최종 합성 |
| `bloomPostProcess.wgsl` | bright downsample, downsample, upsample, final composite shader |

이 프로토타입은 Vite나 TypeScript에 연결되어 있지 않고, 저장소 루트에서 정적 서버를 띄운 뒤 상대 경로로 실행한다.

```text
python -m http.server 8000
http://localhost:8000/tech-tests/noita-webgpu/
```

GitHub Pages 같은 HTTPS secure context에서도 같은 상대 경로 정책으로 동작하도록 설계되어 있다. WebGPU는 localhost 또는 HTTPS secure context가 필요하며, 이 테스트에는 CPU, Canvas2D, WebGL fallback이 없다.

### 3.2 입력과 조작

현재 조작은 material emitter를 직접 만드는 테스트용 입력이다.

| 입력 | 동작 |
| --- | --- |
| top scrollable slot hub | 구현된 brush와 explosion 선택/실행 |
| drag | 현재 선택 material 방출 |
| right click 또는 `Shift` + drag | water 방출 |
| `Alt` + drag | sand 방출 |
| `1` | fire brush 선택 |
| `2` | water brush 선택 |
| `3` | sand brush 선택 |
| `4` | smoke brush 선택 |
| `5` | steam brush 선택 |
| `6` | spark brush 선택 |
| `7` | rock brush 선택 |
| `8` | wet sand brush 선택 |
| `0` | erase brush 선택 |
| `Space` | 마지막 pointer 위치에 explosion 생성 |
| mobile one-finger drag | fire 또는 현재 material 방출 |
| mobile two-finger drag | water 방출 |
| mobile double tap | explosion 생성 |

이 입력은 게임 UX가 아니라 GPU material field의 반응을 빠르게 확인하기 위한 테스트 인터페이스다.

### 3.3 Grid와 주요 상수

`main.js`의 기본 해상도와 dispatch 설정은 아래 값으로 고정되어 있다.

```js
const GRID_WIDTH = 256;
const GRID_HEIGHT = 144;
const WORKGROUP_SIZE = 8;
const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;
```

전체 셀 수는 `36,864`개다. 현재 셀 하나는 `u32` 하나로 저장되므로 material buffer 하나는 약 `144KB`이고, ping-pong buffer 두 개를 써도 셀 데이터 자체는 약 `288KB` 수준이다.

입력 이벤트는 매 프레임 emitter storage buffer로 packing된다.

```js
const PARAM_WORDS = 16;
const MAX_EMITTERS = 32;
const EMITTER_WORDS = 8;
const EMITTER_FLAG_EXPLOSION = 1;
```

렌더링은 HDR scene texture와 bloom 후처리를 사용한다.

```js
const HDR_SCENE_FORMAT = 'rgba16float';
const BLOOM_CONFIG = Object.freeze({
  enabled: true,
  threshold: 0.98,
  intensity: 0.95,
  radius: 1.35,
  levels: 6,
  bloomFormat: HDR_SCENE_FORMAT,
});
```

### 3.4 Material 상수와 cell packing

material id는 JS와 WGSL에서 같은 숫자를 사용한다.

```text
0 empty
1 solid
2 sand
3 water
4 fire
5 smoke
6 spark
7 steam
8 wet sand
```

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
| 8-15 | life | fire, smoke, spark, steam 수명 |
| 16-23 | aux | 색 흔들림, 난수 seed 보조값 |
| 24-31 | 미사용 | 추후 온도, flags, variant 등에 사용 가능 |

이 방식은 storage buffer 대역폭을 줄이고 shader에서 분기 입력을 단순화한다. 반대로 material별 추가 상태가 많아지면 `u32` 하나만으로 부족해질 수 있으므로, v2에서 열/압력/속도까지 넣으려면 별도 field buffer를 추가하는 편이 낫다.

### 3.5 초기 field

`seedInitialField()`는 아래 요소로 테스트용 지형을 만든다.

- sine 기반의 바닥 solid 지형
- 지형 위 일부 sand
- 왼쪽 하단 water 웅덩이
- 중앙 부근 solid 기둥
- 오른쪽 하단 U자 solid basin과 내부 water pool
- basin 위쪽 dry sand 더미

이 초기 상태는 물질 규칙과 bloom을 확인하기 위한 고정 테스트 장면이다. 정식 v2에서는 map, wave, spell 이벤트에서 emitter를 공급하고, GPU field는 매치 시작이나 환경 전환 시점에 별도로 초기화하는 방식이 더 적합하다.

## 4. WebGPU 초기화와 GPU 데이터 흐름

### 4.1 Device와 canvas context

`createWebGpuState()`는 `navigator.gpu` 지원 여부를 먼저 확인하고, adapter와 device를 요청한다. 실패하면 canvas 위에 안내 overlay를 띄운다.

핵심 흐름은 아래와 같다.

```text
navigator.gpu
  -> requestAdapter({ powerPreference: 'high-performance' })
  -> requestDevice()
  -> canvas.getContext('webgpu')
  -> context.configure({ device, format, alphaMode: 'opaque' })
```

정식 v2에서는 이 초기화를 앱 bootstrap에 직접 섞지 말고 `platform/webgpuSupport.ts` 또는 `render/webgpu/MaterialFieldGpu.ts` 같은 모듈로 격리하는 편이 좋다. WebGPU는 지원 브라우저와 secure context 조건이 있으므로, 실패가 게임 전체 실패로 이어지지 않게 해야 한다.

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
| 3 | emitter count |
| 4 | canvas width |
| 5 | canvas height |
| 6 | max emitters |
| 7 | time in milliseconds |
| 8-15 | padding |

초기 문서의 단일 emitter uniform 방식과 달리, 현재 구현은 pointer와 burst explosion을 모두 emitter storage buffer로 보낸다. uniform에는 grid, frame, canvas, emitter 개수처럼 모든 shader가 공통으로 참조하는 값만 둔다.

### 4.4 Emitter storage buffer

`buildEmitterBuffer()`는 현재 활성 pointer와 burst emitter를 `Uint32Array`에 packing한다. GPU에서는 `array<Emitter>`로 읽는다.

```wgsl
struct Emitter {
  material: u32,
  x: u32,
  y: u32,
  radius: u32,
  strength: u32,
  seed: u32,
  flags: u32,
  pad0: u32,
};
```

현재 emitter는 최대 32개다. pointer drag는 brush emitter로, Space나 mobile double tap은 `EMITTER_FLAG_EXPLOSION`이 켜진 burst emitter로 들어간다. burst emitter는 JS에서 여러 프레임 동안 유지되고, 매 프레임 반경이 조금 줄어든다.

v2에서 이 구조는 마법, 투사체 충돌, 환경 이벤트를 GPU material field로 넘기는 공통 인터페이스가 될 수 있다. 단, JS object를 그대로 넘기지 않고 지금처럼 fixed-size typed array에 packing해야 한다.

### 4.5 Bind group과 pipeline

compute bind group은 다음 리소스를 가진다.

| binding | 리소스 | 접근 |
| --- | --- | --- |
| 0 | source cell buffer | storage read |
| 1 | destination cell buffer | storage read/write |
| 2 | simulation params | uniform |
| 3 | emitters | storage read |

render bind group은 현재 cell buffer와 params만 참조한다.

| binding | 리소스 | 접근 |
| --- | --- | --- |
| 0 | current cell buffer | storage read |
| 2 | simulation params | uniform |

pipeline은 두 종류다.

```text
material-simulation-pipeline
  noitaField.wgsl: simulate

material-render-pipeline
  noitaField.wgsl: vertexMain, fragmentMain
  target format: rgba16float
```

pipeline 생성은 `createComputePipelineAsync()`와 `createRenderPipelineAsync()`를 사용하고, validation error scope로 shader나 layout 오류를 잡는다.

### 4.6 Frame 순서

`renderFrame()`의 GPU command 순서는 아래와 같다.

```text
resize canvas and render targets
build emitter buffer
write paramsBuffer and emitterBuffer
compute pass: src cells -> dst cells
flip currentBufferIndex
render pass: current cells -> rgba16float scene texture
bloom passes: scene texture -> canvas texture
submit command buffer
age burst emitters
request next animation frame
```

compute 결과가 바로 canvas로 가지 않고 scene texture를 거치는 점이 현재 구현의 중요한 변화다. 이 덕분에 fire와 spark의 색을 1.0 이상으로 출력하고, final composite에서 bloom을 더할 수 있다.

## 5. 렌더링과 bloom 후처리

### 5.1 Scene render

`noitaField.wgsl`의 vertex shader는 fullscreen triangle을 만들고, fragment shader는 현재 canvas pixel 위치를 grid 좌표로 변환해 `src` buffer에서 셀을 읽는다.

```text
vertexMain
  -> fullscreen triangle
fragmentMain
  -> canvas position to grid coordinate
  -> src[index]
  -> materialColor(cell)
  -> rgba16float scene texture
```

장점은 별도 CPU texture upload가 없다는 점이다. compute 결과가 storage buffer에 남아 있고, fragment shader가 그 buffer를 바로 읽는다. v2에서도 material field가 독립 overlay라면 이 방식을 유지할 수 있다.

### 5.2 HDR material color

`materialColor()`는 material별 색을 직접 계산한다. fire와 spark는 `rgba16float` scene texture를 전제로 RGB 값이 1.0을 넘는다.

```text
fire  -> 강한 orange/red HDR 값
spark -> 더 강한 yellow/white HDR 값
smoke -> life 기반 gray
steam -> smoke보다 차갑고 푸른 gray
water -> blue
sand  -> yellow/brown
wet sand -> darker brown
solid -> dark rock
empty -> vertical sky tint
```

이 색은 gameplay 상태가 아니라 render 표현이다. 정식 게임에서 불 피해, 젖음, 연기 장판 같은 판정이 필요하면 CPU의 combat/environment system이 별도 상태를 가져야 한다.

### 5.3 Bloom pass

Bloom은 `bloomPostProcess.js`와 `bloomPostProcess.wgsl`에 분리되어 있다. 전체 흐름은 아래와 같다.

```text
scene texture
  -> brightDownsampleFragment
  -> downsampleFragment 반복
  -> upsampleFragment 반복
  -> finalCompositeFragment
  -> canvas texture
```

`brightDownsampleFragment`는 threshold 이상 밝은 픽셀만 bloom chain으로 보낸다. 이후 downsample/upsample pass가 작은 texture들을 오가며 blur를 만들고, `finalCompositeFragment`가 원본 scene과 bloom texture를 더한다.

런타임 조절값은 `main.js`의 `BLOOM_CONFIG`에 고정되어 있다. 이 테스트에서는 UI slider를 만들지 않고, WebGPU render chain의 구조를 검증하는 데 집중한다.

### 5.4 리사이즈 처리

`resizeCanvas()`는 DPR을 `DPR_LIMIT = 2`로 제한한다. `resizeRenderTargets()`는 canvas pixel size가 바뀌면 기존 scene texture를 destroy하고 새 `rgba16float` scene texture와 bloom chain을 만든다.

v2에 넣을 때도 DPR 제한은 유지하는 편이 좋다. material field는 full-resolution UI보다 낮은 grid 해상도를 사용하므로, 지나치게 높은 DPR은 bloom texture 비용만 올리고 체감 품질 이득은 제한적이다.

## 6. WGSL simulation 규칙 분석

### 6.1 기본 접근

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
  out = applyEmitters(out, x, y);

  dst[index] = out;
}
```

한 invocation은 `dst[index]` 하나만 쓴다. 이 점이 중요하다. 여러 invocation이 같은 `dst` 위치에 동시에 쓰는 구조를 피하고, 현재 셀 관점에서 "내가 떠났는가"와 "이웃이 내 자리로 들어오는가"를 계산한다.

### 6.2 Outgoing과 incoming 분리

`applyCurrentOutgoing()`은 현재 셀이 이동하려는 경우 현재 위치를 비운다. 예를 들어 sand가 아래로 이동할 수 있으면 현재 위치는 empty가 된다. 이동 대상이 water라면 현재 위치에 water를 남겨 sand-water swap처럼 보이게 한다.

`applyIncoming()`은 주변 셀이 이 위치로 들어오려고 하는지 다시 계산한다. 예를 들어 현재 위치 위쪽, 좌상단, 우상단에 있는 sand가 `sandTarget()` 기준으로 이 위치를 목표로 잡았다면 현재 위치는 sand가 된다.

이 방식은 간단한 병렬 CA에서 흔히 쓰는 gather-style update다.

```text
outgoing: 현재 셀이 떠날지 결정
incoming: 이웃 셀이 내 자리로 들어올지 결정
emitters: 외부 입력과 burst 이벤트 적용
write: 내 dst[index]만 기록
```

장점은 atomic write 없이도 구현이 단순하다는 점이다. 단점은 두 이웃이 같은 칸을 목표로 할 때 우선순위가 코드 순서에 고정되고, 완전한 질량 보존이나 물리적 정확성을 보장하지 않는다는 점이다.

### 6.3 Sand

`sandTarget()`은 아래, 좌하단/우하단 순서로 이동 후보를 고른다. 좌우 우선순위는 frame 기반 hash로 흔들어 자연스러운 퍼짐을 만든다.

현재 shader에는 단순 density helper가 있다. `solid > wet sand > sand > water > spark > gas/fire/empty` 순서이며, powder 계열은 자기보다 낮은 density material로만 들어갈 수 있다. 그래서 sand는 water를 밀고 가라앉고, water는 sand나 solid를 통과하지 못한다.

Sand가 들어갈 수 있는 material은 다음이다.

```text
empty, water, smoke, fire, steam
```

water로 들어갈 수 있게 둔 덕분에 sand가 물을 밀어내며 가라앉는 느낌을 만든다. dry sand가 water 셀로 이동하면 water를 단순 swap하지 않고 `wet sand`로 변해 물을 흡수한다. 움직이지 않는 dry sand도 인접한 water를 일정 확률로 흡수해서 젖은 모래가 된다. `wet sand`는 주변에 안정된 dry sand가 있으면 4프레임 단위의 낮은 확률 판정으로 천천히 수분을 퍼뜨린다. 이미 젖은 모래는 더 이상 물을 먹지 않고, water 안으로 내려갈 때는 water를 위쪽/이전 위치로 밀어내는 swap에 가깝게 동작한다.

### 6.4 Water

`waterTarget()`은 아래로 떨어질 수 있으면 아래로 이동하고, 대각선 아래가 비어 있으면 sand처럼 아래쪽 빈 공간을 먼저 채운다. 바닥, sand, wet sand, solid, 다른 water 위에 지지된 상태에서는 표면 물만 주로 좌우로 퍼지고, 위에 물이 쌓인 깊은 물은 대부분 정지한다. 이 규칙은 U자 basin에서 물이 계속 빠져나가는 것처럼 보이지 않고, 아래부터 쌓여 차오르는 느낌을 우선한다.

Water가 들어갈 수 있는 material은 다음이다.

```text
empty, smoke, fire, steam
```

물 주변에 fire가 있으면 일정 확률로 steam이 된다. 이 반응은 완전한 열역학 모델이 아니라 fire/water 접촉을 시각적으로 읽히게 만드는 1차 규칙이다.

물 주변에 dry sand가 있으면 sand 쪽 결정 규칙에 따라 water가 소비되고 wet sand가 된다. 이후 wet sand끼리 직접 이동하지 않아도 접촉한 dry sand에 젖음이 천천히 확산된다. 이는 원작 전체의 porous material 모델은 아니지만, "모래가 물을 먹어 젖고 안정화되는" 현상을 최소 규칙으로 넣은 것이다.

Noita식 액체 느낌을 강화하려면 v2 이후 단계에서 다음 중 하나가 필요하다.

- material cell의 `aux`에 flow direction 저장
- 별도 velocity/pressure buffer 추가
- water 전용 multi-pass 확산
- chunk 단위 반복 iteration 수 증가

### 6.5 Smoke와 steam

`smokeTarget()`은 위, 좌상단/우상단 순서로 이동한다. 현재 구현에서는 smoke와 steam이 같은 이동 규칙을 쓴다.

Smoke가 들어갈 수 있는 material은 다음이다.

```text
empty, fire
```

Smoke는 `life`가 줄어들고, 수명이 0에 가까워지면 사라진다. Steam도 같은 방식으로 위로 움직이지만, 오래되거나 수명이 낮아지면 일정 확률로 water로 응축된다.

현재 smoke와 steam은 시야 차폐나 게임 판정을 만들지 않고 색상과 수명만 갖는다. v2에서 연기 장판, 화염 장판, 독구름처럼 gameplay modifier가 필요해지면 GPU field를 직접 읽기보다 CPU에 별도 area effect를 생성하고, GPU gas는 그 area effect의 시각화로 두는 편이 안전하다.

### 6.6 Fire와 spark

Fire는 `life` 기반으로 줄어든다. 주변에 water가 있으면 steam으로 바뀌고, 수명이 끝나면 smoke를 남긴다. fire는 위쪽으로 번지는 듯한 incoming 규칙도 일부 갖고 있지만, 연소 가능한 material을 태우는 시스템은 아니다.

Spark는 짧은 수명을 갖고 sand와 비슷한 낙하 target을 쓰며, 수명이 끝나면 fire가 된다. explosion emitter가 spark를 많이 만들고, bloom이 spark와 fire를 밝게 증폭한다.

정식 게임에서 불 마법의 gameplay 효과가 필요하다면 다음처럼 분리하는 것이 좋다.

```text
CPU combat:
  fire projectile hit
  -> enemy damage / burn status / area effect
  -> GPU material emitter event

GPU material field:
  fire/smoke/spark/steam visual propagation
  -> optional low-frequency heat query only
```

### 6.7 Emitter와 explosion

`applyEmitters()`는 이번 프레임의 emitter 목록을 순회하고, 현재 셀이 emitter 반경 안에 있으면 brush 또는 explosion 규칙을 적용한다.

`applyBrushEmitter()`는 material별로 다른 결과를 만든다.

```text
water brush -> water 생성, sand는 보존
sand brush  -> sand 생성
smoke brush -> smoke 생성
steam brush -> steam 생성
spark brush -> spark 생성
solid brush -> solid 지형 생성
empty brush -> 셀 제거
wet sand brush -> wet sand 생성
fire brush  -> roll에 따라 spark, smoke, fire 혼합
```

`applyExplosionEmitter()`는 중심부를 비우거나 fire를 만들고, 외곽에는 spark, fire, smoke, sand를 흩뿌린다. solid는 중심에 가까운 일부만 파괴되며, 바깥쪽 solid는 유지된다.

v2에서는 이 emitter 개념을 마법과 환경 이벤트의 공통 인터페이스로 확장할 수 있다.

```ts
export interface MaterialEmitter {
  kind: 'fire' | 'water' | 'sand' | 'wetSand' | 'smoke' | 'steam' | 'spark' | 'explosion';
  x: number;
  y: number;
  radius: number;
  strength: number;
  durationFrames: number;
  seed: number;
}
```

실제 GPU 전송 시에는 이 interface를 그대로 넘기지 않고, 현재 프로토타입처럼 고정 크기 typed array로 packing한다.

## 7. 현재 구현의 강점과 한계

### 7.1 강점

- WebGPU 초기화, compute pass, scene render pass, bloom pass가 작게 분리되어 있어 학습 비용이 낮다.
- CPU에서 GPU로 보내는 데이터가 params와 emitter buffer뿐이라 frame loop가 가볍다.
- storage buffer ping-pong 구조라 read/write ordering 문제가 비교적 명확하다.
- material color를 fragment shader에서 바로 계산하므로 CPU texture upload가 없다.
- emitter storage buffer가 이미 있어 pointer, explosion, 향후 spell event로 확장하기 쉽다.
- `rgba16float` scene texture와 bloom chain 덕분에 fire/spark 계열 이펙트의 시각적 존재감이 크다.
- steam 반응이 추가되어 water/fire 접촉이 단순 소멸보다 읽기 좋다.

### 7.2 한계

- grid가 전역 `256x144` 하나라 월드 스크롤, chunk streaming, 큰 맵에는 아직 대응하지 않는다.
- race condition을 완전히 해결한 물리 모델은 아니다. gather-style 우선순위로 충돌을 근사한다.
- water는 제한적인 pressure 근사만 있고, 부피 보존이나 수평 속도 field는 없다.
- solid는 파괴 가능한 지형처럼 보이지만 tile collision이나 pathfinding과 연결되어 있지 않다.
- CPU readback 경로가 없으므로 게임 로직이 material field 결과를 직접 알 수 없다.
- WebGPU 미지원 브라우저에 대한 fallback은 안내 overlay뿐이다.
- bloom chain은 시각 품질을 올리지만 render pass와 texture 메모리를 추가로 요구한다.

이 한계는 프로토타입으로서는 타당하다. 정식 게임에 넣을 때는 "어디까지를 gameplay로 인정할 것인가"를 먼저 정해야 한다.

## 8. v2 편입 설계

### 8.1 권장 역할

v2에서는 WebGPU material field를 아래 역할로 제한해서 시작한다.

```text
주 역할:
  전투 필드 위의 환경/마법 비주얼 레이어

허용:
  폭발 흔적, 불꽃, 연기, 증기, 물 튐, 모래/파편, 환경 전환 연출

제한:
  적 충돌의 단일 판정 원천
  매 프레임 CPU가 읽는 물리 상태
  인벤토리/웨이브/스킬의 핵심 상태 저장소
```

이렇게 하면 WebGPU 지원 여부와 무관하게 게임의 핵심 루프를 유지할 수 있고, GPU field는 지원 브라우저에서만 고급 효과로 켤 수 있다.

### 8.2 모듈 경계

v2 코드 시스템에 편입한다면 다음 모듈 경계가 적합하다.

```text
src/features/environment/
  MaterialFieldSystem.ts
  MaterialEmitterQueue.ts

src/render/webgpu/
  MaterialFieldGpu.ts
  MaterialFieldRenderer.ts
  MaterialFieldBloom.ts
  materialField.wgsl
  materialFieldBloom.wgsl

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
| `MaterialFieldGpu` | device, buffers, bind groups, simulation/render pipelines 소유 |
| `MaterialFieldBloom` | HDR scene texture, bloom textures, postprocess pipelines 소유 |
| `MaterialFieldRenderer` | WebGL2/WebGPU 렌더 순서 조율과 canvas 합성 |
| `webgpuSupport` | 지원 여부, adapter/device 생성 실패 처리 |

기존 v2 설계 문서의 `EnvironmentSystem`, `EnvironmentRenderAdapter`, `EffectRenderer`와 연결하되, `GameState`에 GPU buffer나 WebGPU object를 넣지 않는다.

### 8.3 Render 통합 방식

현재 v2 설계 기본값은 WebGL2 Canvas다. WebGPU field를 넣는 방법은 두 가지다.

1. 별도 WebGPU canvas를 WebGL2 canvas 위/아래에 overlay한다.
2. 전투 렌더러 전체를 WebGPU로 전환한다.

초기 편입은 1번이 안전하다. WebGL2 렌더러와 DOM UI를 유지하면서 material field만 별도 canvas로 합성한다.

```text
BattlePanel
  WebGL2 main canvas: player, enemies, projectiles, HUD
  WebGPU material canvas: fire/smoke/steam/water/spark overlay
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
- bloom composite가 이미 canvas 최종 출력을 만들기 때문에, WebGL2와의 DOM stacking 순서를 명확히 정해야 한다.

### 8.4 Gameplay 연동 정책

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
  MaterialFieldSystem이 상단 water/steam emitter 생성
```

GPU 결과를 gameplay에 반영해야 한다면 저빈도 query만 허용한다.

- 특정 작은 영역의 평균 fire/smoke/steam 밀도
- 플레이어 주변 물질 타입 히스토그램
- 보스 패턴용 제한적 heat field

이 query는 매 프레임 전체 readback이 아니라 작은 staging buffer로 제한하고, 결과는 1-3프레임 늦게 반영되는 것으로 설계한다.

### 8.5 저장과 재현성

정식 저장 데이터에 전체 material grid를 포함하지 않는 것을 기본값으로 둔다. 이유는 다음과 같다.

- GPU field는 시각 효과 성격이 강하다.
- grid 전체 저장은 save schema를 키우고 migration 부담을 늘린다.
- WebGPU 난수/hash와 frame timing이 완전 결정론을 보장하지 않는다.

필요하면 저장 시점에 다음 정도만 남긴다.

- 활성 환경 타입
- 지속 중인 area effect 목록
- 화면에 남길 큰 폭발/화염 이벤트 seed

로드 후 material field는 몇 프레임 동안 재생성 warm-up을 거치면 된다.

## 9. 확장 로드맵

### 9.1 1단계: 현재 프로토타입 정리

- grid 크기, workgroup 크기, material enum, bloom config를 config로 분리한다.
- shader compile error와 WebGPU device lost 메시지를 사용자에게 더 명확히 표시한다.
- FPS, GPU pass timing, emitter count, active material을 보여주는 debug overlay를 선택적으로 추가한다.
- reset, pause, single-step 같은 시뮬레이션 검증용 입력을 추가한다.
- bloom enabled, threshold, intensity를 최소 UI 또는 URL param으로 조절할 수 있게 한다.

### 9.2 2단계: v2 BattlePanel overlay

- WebGL2 main canvas와 WebGPU material canvas를 같은 BattlePanel에 배치한다.
- camera/viewport mapping을 공통 모듈에서 받는다.
- CombatSystem과 EnvironmentSystem 이벤트를 material emitter로 변환한다.
- WebGPU 미지원 시 material field를 비활성화하고 WebGL2 particle fallback을 사용한다.
- bloom canvas가 HUD 가독성을 해치지 않도록 합성 순서와 alpha 정책을 정한다.

### 9.3 3단계: Chunk와 큰 월드 대응

- 전역 grid 대신 camera 주변 active chunk만 시뮬레이션한다.
- chunk 경계 셀 교환 정책을 둔다.
- 비활성 chunk는 압축된 seed/event 상태로 보관한다.
- 큰 폭발이나 보스 패턴처럼 중요한 이벤트만 chunk를 깨운다.

### 9.4 4단계: 더 깊은 물질 규칙

- water flow direction 또는 pressure buffer 추가
- heat/flammability buffer 추가
- material별 density와 swap priority 정의
- Margolus block 또는 checkerboard pass 검토
- multi-pass로 movement, reaction, render를 분리
- steam, smoke, poison gas 같은 gas 계열을 gameplay area effect와 연결

## 10. 결론

현재 `tech-tests/noita-webgpu`는 v2에 바로 넣을 수 있는 완성 시스템은 아니지만, WebGPU로 Noita-inspired material field를 구현할 수 있다는 기술 검증으로는 충분하다. 구조상 CPU/GPU 데이터 흐름이 단순하고, compute pass, render pass, bloom pass가 분리되어 있어 다음 단계 실험 기반으로 쓰기 좋다.

정식 v2에서는 WebGPU field를 핵심 게임 상태로 끌어올리기보다, 전투 판정과 분리된 GPU 환경 이펙트 레이어로 편입하는 것이 현실적이다. 이 방향이면 기존 WebGL2 렌더링 계획을 유지하면서도, 지원 브라우저에서는 fire/smoke/steam/water/spark 계열 효과를 훨씬 풍부하게 만들 수 있다.

추후 `docs/v2-code-system-design-plan.md`에 반영할 항목은 다음 세 가지다.

- `render/webgpu` 또는 `features/environment/materialField` 하위 모듈 추가
- `EnvironmentSystem`에서 `MaterialEmitter` 이벤트를 발행하는 경계 정의
- WebGPU 미지원 브라우저의 fallback 정책 명시

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
