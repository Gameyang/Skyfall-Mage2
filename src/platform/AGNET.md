# src/platform

브라우저, storage, asset path, WebGPU support 같은 platform adapter를 둔다.

- gameplay rule을 넣지 않는다.
- GitHub Pages base path와 local path 차이를 여기서 흡수한다.
- WebGPU availability와 device lost 처리를 명확히 제공한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
