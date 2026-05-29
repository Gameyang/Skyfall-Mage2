# src/render

화면 출력과 render snapshot 소비를 담당한다.

- gameplay state를 직접 수정하지 않는다.
- WebGPU combat field render path가 기본이다.
- DOM UI는 `src/ui`가 담당한다.
