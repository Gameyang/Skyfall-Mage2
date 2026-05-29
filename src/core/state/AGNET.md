# src/core/state

직렬화 가능한 game state type과 초기 상태를 둔다.

- GPU buffer, renderer, DOM reference는 금지한다.
- save schema와 migration을 고려해 versioned shape를 유지한다.
- combat field는 seed/config/query request 같은 데이터만 가진다.
