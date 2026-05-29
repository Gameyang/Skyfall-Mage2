# src

애플리케이션 source root다.

- 실제 구현은 feature, runtime, render, ui, input, content, platform 경계를 지킨다.
- 순수 state와 browser/GPU resource를 섞지 않는다.
- WebGPU combat field가 전투 구현의 기본 방향이다.
- 파일 추가 위치와 이름은 `docs/code-file-tree.md`를 따른다.
- LLM 탐색성을 위해 큰 catch-all 파일 대신 도메인별 작은 파일을 만든다.
