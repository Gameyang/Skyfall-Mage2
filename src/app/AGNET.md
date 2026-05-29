# src/app

앱 조립, bootstrap, top-level configuration을 둔다.

- runtime, renderer, UI shell을 연결만 한다.
- gameplay rule이나 shader 세부 구현을 넣지 않는다.
- 환경별 설정은 작은 config object로 유지한다.
