# src/input

keyboard, pointer, touch 입력을 command로 변환한다.

- 입력 adapter는 GameState를 직접 수정하지 않는다.
- WebGPU canvas와 DOM panel의 pointer ownership을 명확히 나눈다.
- 좌표 변환은 공통 mapper를 사용한다.
