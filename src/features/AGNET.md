# src/features

도메인별 gameplay 구현을 둔다.

- feature는 core state와 command/event를 통해 runtime에 연결된다.
- rendering backend나 DOM node를 직접 소유하지 않는다.
- WebGPU combat field와 연결되는 feature는 query/emitter 경계를 명확히 둔다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
