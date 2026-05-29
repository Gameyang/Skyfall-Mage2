# src/render/snapshots

렌더러가 소비할 immutable snapshot type을 둔다.

- renderer instance나 GPU resource를 넣지 않는다.
- UI view model과 구분한다.
- combat field snapshot은 config, camera, query visualization 같은 표현 데이터만 가진다.
