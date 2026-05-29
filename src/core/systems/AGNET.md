# src/core/systems

공통 update system을 둔다.

- feature 전용 system은 `src/features`에 둔다.
- system은 command/event/state를 입력으로 받고 side effect를 최소화한다.
- GPU resource에 직접 접근하지 않는다.
