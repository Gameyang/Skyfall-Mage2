# src/ui/viewModels

GameState를 UI 표시용 데이터로 변환하는 code를 둔다.

- DOM node를 만들지 않는다.
- UI가 필요한 derived value를 여기서 계산한다.
- WebGPU query summary는 읽기 쉬운 표시 상태로 변환한다.
