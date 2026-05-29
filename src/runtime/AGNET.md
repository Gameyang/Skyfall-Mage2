# src/runtime

게임 루프와 command/event 실행 순서를 관리한다.

- `GameClock`, `CommandBus`, `EventBus`, save scheduling 같은 orchestration을 둔다.
- feature system의 내부 규칙을 직접 구현하지 않는다.
- GPU simulation step과 CPU resolution step의 순서를 명시적으로 유지한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
