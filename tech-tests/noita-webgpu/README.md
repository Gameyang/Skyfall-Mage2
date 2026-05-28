# Noita-Style WebGPU Material Field Test

독립 WebGPU 기술 검증 페이지입니다. v2 정식 게임 UI 없이 전투 필드의 material particle 느낌만 확인합니다.

## 실행

저장소 루트에서 정적 서버를 실행합니다.

```bash
python -m http.server 8000
```

접속:

```text
http://localhost:8000/tech-tests/noita-webgpu/
```

GitHub Pages에서는 아래처럼 상대 경로로 실행됩니다.

```text
https://{account}.github.io/{repo}/tech-tests/noita-webgpu/
```

## 브라우저 조건

- 최신 Chrome 또는 Edge 권장
- WebGPU 지원 필요
- GitHub Pages처럼 HTTPS secure context에서 실행 권장

## 조작

- 좌클릭/터치 드래그: 현재 emitter material 생성
- 우클릭 또는 Shift+클릭: water 생성
- Alt+클릭: sand 생성
- `1`: fire emitter
- `2`: water emitter
- `3`: sand emitter
- `Space`: 현재 포인터 위치 폭발

## 구현 범위

- WebGPU compute pass로 material grid 업데이트
- WebGPU render pass로 grid를 전체 화면에 확대 렌더링
- material: empty, solid, sand, water, fire, smoke, spark
- UI, 적, 체력, 인벤토리, 게임 판정 없음

## 설계 의도

Matter.js 같은 rigid-body 엔진 대신 falling-sand/cellular automata 방식으로 Noita-inspired material effect를 검증합니다. 정식 v2에서는 이 레이어를 전투 판정과 분리된 비주얼/환경 이펙트 시스템으로 편입하는 방향을 검토합니다.
