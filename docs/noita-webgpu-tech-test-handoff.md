# Noita WebGPU Tech Test Handoff

작성일: 2026-05-29  
대상 구현: `tech-tests/noita-webgpu`  
상태: 삭제 준비용 보존 문서

## 1. 목적

`tech-tests/noita-webgpu`는 WebGPU material field 가능성을 검증한 독립 기술 테스트다. 정식 게임 구현에서는 이 폴더를 그대로 유지하지 않고, 아래 설계와 규칙만 `src/features/environment` 및 `src/render/webgpu` 계층으로 이식한다.

이 문서는 `tech-tests/noita-webgpu` 삭제 전에 남겨야 할 구현 사실, 이식 대상, 버릴 코드, 정식 구현 순서를 정리한다.

## 2. 현재 보존해야 할 핵심

### 2.1 파일별 역할

| 파일 | 보존할 내용 | 정식 구현 처리 |
| --- | --- | --- |
| `main.js` | WebGPU 초기화, buffer/pipeline 구성, emitter packing, frame 순서 | TypeScript 모듈로 분리 |
| `noitaField.wgsl` | material enum, density, movement, reaction, render color | shader를 `materialField.wgsl`로 이식 |
| `bloomPostProcess.js` | HDR bloom render chain | `MaterialFieldBloom.ts`로 이식 |
| `bloomPostProcess.wgsl` | bloom downsample/upsample/final composite | `materialFieldBloom.wgsl`로 이식 |
| `index.html` | top material slot hub, fatal overlay, canvas shell | 정식 게임에는 이식하지 않음 |
| `README.md` | 실행법과 조작법 | docs에 보존 완료 후 삭제 가능 |

### 2.2 현재 material enum

JS와 WGSL의 id를 맞춘다.

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

### 2.3 Cell packing

현재 한 cell은 `u32` 하나다.

```text
bits 0-7: material
bits 8-15: life
bits 16-23: aux
bits 24-31: unused
```

정식 구현 v1도 이 packing을 유지한다. material 수가 256을 넘거나 temperature/pressure가 필요해지면 `material`, `life`, `flags`, `temperature`를 별도 buffer로 분리한다.

### 2.4 Density 기준

현재 shader의 단순 density hierarchy:

```text
solid: 255
wet sand: 76
sand: 68
water: 42
spark: 24
fire/smoke/steam: 8
empty: 0
```

규칙:

- powder는 자기보다 낮은 density material로만 들어갈 수 있다.
- `solid`, `sand`, `wet sand`는 powder target을 막는다.
- water는 `solid`, `sand`, `wet sand`, `water` 위에서 지지된다.
- sand는 water로 들어갈 수 있고, dry sand가 water를 만나면 `wet sand`로 변한다.

### 2.5 Emitter buffer

정식 구현에서도 CPU event를 GPU field로 넘기는 최소 인터페이스는 emitter queue다.

```text
MAX_EMITTERS = 32
EMITTER_WORDS = 8
```

WGSL shape:

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

정식 TypeScript type:

```ts
export interface MaterialEmitter {
  material: MaterialId;
  x: number;
  y: number;
  radius: number;
  strength: number;
  seed: number;
  flags: number;
}
```

`flags & 1`은 explosion emitter다.

## 3. 현재 simulation 규칙

### 3.1 Update 구조

현재 compute pass는 gather-style single pass다.

```text
src cell buffer
  -> applyCurrentOutgoing
  -> applyIncoming
  -> applyEmitters
  -> dst cell buffer
```

한 invocation은 자기 `dst[index]`만 쓴다. atomic write 없이 동작하지만, 완전한 질량 보존이나 원작 Noita 수준의 conflict resolution은 아니다.

### 3.2 Powder

`sand`와 `wet sand`는 `sandTarget(x, y, moverMat)`를 사용한다.

- 아래로 이동 가능하면 아래로 간다.
- 아니면 좌하단/우하단을 frame hash로 흔들어 선택한다.
- target density가 낮아야 이동한다.
- dry sand가 water로 들어가면 `wet sand`가 되고 water는 소비된다.
- wet sand가 water로 들어가면 water를 이전 위치로 밀어내는 swap에 가깝게 동작한다.

### 3.3 Wet sand

현재 wet sand behavior:

- dry sand + water contact -> wet sand
- settled dry sand가 주변 water를 일정 확률로 흡수 -> wet sand
- wet sand가 주변 settled dry sand에 천천히 수분 확산
- heat/fire/spark 근처 wet sand는 낮은 확률로 dry sand로 마름

수분 확산은 `wetSandContactScore()`와 `shouldSpreadWetSand()`로 처리한다.

- 아래 wet sand 영향이 가장 강하다.
- 좌우 wet sand 영향은 중간이다.
- 위/대각선 아래 영향은 약하다.
- cell별 phase를 두고 `params.frame & 3` 기준으로 4프레임에 한 번만 판정한다.

### 3.4 Water

`waterTarget()`은 아래쪽 fill을 우선한다.

- 아래 empty/gas/fire/steam이면 아래로 이동한다.
- 대각선 아래가 가능하면 대각선 아래로 이동한다.
- 지지된 깊은 물은 대부분 정지한다.
- 표면 물만 주로 좌우로 퍼진다.
- sand/wet sand/solid/water는 water를 지지한다.

목표는 U자 basin에서 물이 아래부터 차오르고 고이는 모습이다.

### 3.5 Fire, spark, smoke, steam

현재 fire/spark는 visual effect 중심이다.

- fire는 수명이 줄고, 위쪽 empty/gas로 일부 상승한다.
- fire가 wet material 근처에 있으면 steam을 만든다.
- fire가 이동하거나 수명이 줄면서 smoke를 남긴다.
- spark는 짧은 수명의 falling heat particle이고, wet material에 닿으면 steam/empty로 꺼진다.
- smoke와 steam은 위로 상승한다.
- steam은 오래되면 water로 응축될 수 있다.

정식 gameplay damage, burn status, suffocation은 CPU combat/environment system이 처리한다.

### 3.6 Render

Render는 storage buffer를 fragment shader에서 직접 읽어 `rgba16float` scene texture에 그린다.

```text
cell storage buffer
  -> materialColor()
  -> HDR scene texture
  -> bloom chain
  -> canvas final composite
```

fire/spark는 1.0보다 큰 HDR 값을 낸다. bloom 없이는 현재 visual intent가 약해진다.

## 4. 정식 구현으로 옮길 대상

권장 폴더:

```text
src/features/environment/materialField/
  MaterialFieldSystem.ts
  MaterialEmitterQueue.ts
  MaterialFieldTypes.ts
  MaterialFieldConfig.ts

src/render/webgpu/materialField/
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

### 4.1 `MaterialFieldSystem`

CPU gameplay event를 material emitter로 바꾼다.

예시:

```text
Fire spell hit -> fire/spark emitter
Explosion spell -> explosion emitter
Rain/environment event -> water emitter
Ground impact -> sand/smoke emitter
```

이 시스템은 GPU buffer를 직접 소유하지 않는다.

### 4.2 `MaterialEmitterQueue`

이번 frame에 발생한 emitter를 typed array로 packing한다.

책임:

- `MAX_EMITTERS` 초과 clamp
- material id mapping
- world coordinate -> material grid coordinate 변환 후 정수화
- deterministic seed 부여
- queue clear

### 4.3 `MaterialFieldGpu`

WebGPU 리소스를 소유한다.

책임:

- adapter/device/context 생성 또는 외부 device 주입
- cell ping-pong buffers
- params buffer
- emitter buffer
- compute/render bind groups
- simulation pipeline
- scene render pipeline
- resize/destroy

### 4.4 `MaterialFieldBloom`

`bloomPostProcess.js`를 TypeScript class로 옮긴다.

책임:

- `rgba16float` scene texture chain
- bright downsample/downsample/upsample/final composite pipelines
- bloom params buffer
- resize/destroy

### 4.5 `webgpuSupport`

정식 게임에서 WebGPU 실패는 fatal이 아니다.

정책:

- `navigator.gpu` 없음 -> material field disabled
- adapter 없음 -> material field disabled
- device lost -> material field disabled + fallback visual event 발행
- WebGL2 본 렌더러와 gameplay는 계속 동작

## 5. 정식 구현에서 버릴 것

삭제해도 되는 tech-test 전용 요소:

- `index.html`의 standalone full-screen shell
- top material slot hub
- keyboard brush controls
- pointer/touch direct drawing input
- initial sine terrain scene
- U자 basin debug scene
- fatal overlay wording
- `python -m http.server` 전용 README 실행 안내

보존해야 하는 concept:

- emitter queue
- storage buffer ping-pong
- gather-style update baseline
- material density/wet sand/water/fire/smoke/steam rules
- HDR scene texture + bloom chain
- WebGPU failure isolation

## 6. 삭제 준비 체크리스트

`tech-tests/noita-webgpu` 폴더 삭제 전 아래를 만족해야 한다.

- 이 문서가 최신 material enum과 density를 포함한다.
- `docs/noita-webgpu-simulation-analysis.md`가 현재 behavior 분석을 포함한다.
- `docs/noita-original-material-interaction-implementation-analysis.md`가 원작 지향 확장 방향을 포함한다.
- 정식 구현에 필요한 shader rules가 `src/render/webgpu/materialField/materialField.wgsl`로 이동했다.
- bloom shader가 `src/render/webgpu/materialField/materialFieldBloom.wgsl`로 이동했다.
- emitter packing이 `MaterialEmitterQueue.ts`로 이동했다.
- WebGPU 지원 실패가 정식 게임에서 fatal이 아님을 확인했다.
- README나 index에서 `tech-tests/noita-webgpu`로 링크하는 공개 경로가 없다.

삭제 명령은 위 조건을 만족한 뒤 별도 커밋에서 수행한다.

```powershell
Remove-Item -Recurse -Force tech-tests\noita-webgpu
```

이 명령은 아직 실행하지 않는다.

## 7. 정식 구현 시작 순서

### Phase 1: Skeleton

- Vite/TypeScript `src` 구조가 없다면 먼저 만든다.
- `webgpuSupport.ts`에서 WebGPU availability check를 작성한다.
- `MaterialFieldTypes.ts`에 material enum, emitter, config type을 작성한다.
- `MaterialEmitterQueue.ts`를 작성하고 unit test 가능한 packing 함수로 둔다.

### Phase 2: GPU backend

- `MaterialFieldGpu.ts`에 cell buffers, params buffer, emitter buffer, bind groups를 옮긴다.
- `materialField.wgsl`은 tech-test shader를 그대로 시작하되, debug input과 demo terrain은 제거한다.
- initial cells는 gameplay snapshot 또는 environment event에서 받는다.

### Phase 3: Rendering

- `MaterialFieldRenderer.ts`가 WebGL2 battle canvas와 별도 WebGPU canvas의 layering을 담당한다.
- `MaterialFieldBloom.ts`를 붙인다.
- HUD와 UI가 bloom에 가려지지 않도록 DOM/WebGL/WebGPU stacking order를 고정한다.

### Phase 4: Gameplay integration

- `CombatSystem`과 `EnvironmentSystem`이 material emitter event를 발행한다.
- GPU field 결과를 매 frame CPU로 readback하지 않는다.
- 필요한 경우 작은 area query만 저빈도로 추가한다.

### Phase 5: Validation

필수 시나리오:

- water가 U자 지형에서 고인다.
- sand가 water보다 아래로 가라앉는다.
- dry sand가 water를 흡수해 wet sand가 된다.
- wet sand가 주변 dry sand로 천천히 확산된다.
- heat가 wet sand를 dry sand로 말린다.
- fire/spark가 wet material에 닿으면 꺼지고 steam을 만든다.
- WebGPU 미지원 상태에서도 게임 본체가 실행된다.

## 8. 최종 판단

`tech-tests/noita-webgpu`는 정식 게임 코드가 아니라 구현 실험이다. 이제 역할은 끝났고, 남길 가치는 다음 세 가지다.

- material field shader rule set
- emitter queue와 WebGPU buffer 흐름
- HDR bloom visual chain

정식 구현은 이 세 가지를 TypeScript/WebGPU 모듈로 재구성하고, tech-test UI와 standalone entry는 삭제한다.
