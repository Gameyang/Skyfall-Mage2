# src/app

앱 조립, bootstrap, top-level configuration을 둔다.

- runtime, renderer, UI shell을 연결만 한다.
- gameplay rule이나 shader 세부 구현을 넣지 않는다.
- 환경별 설정은 작은 config object로 유지한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
