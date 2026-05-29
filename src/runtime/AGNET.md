# src/runtime

게임 루프와 command/event 실행 순서를 관리한다.

- `GameClock`, `CommandBus`, `EventBus`, save scheduling 같은 orchestration을 둔다.
- feature system의 내부 규칙을 직접 구현하지 않는다.
- GPU simulation step과 CPU resolution step의 순서를 명시적으로 유지한다.
