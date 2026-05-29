# src/render/snapshots

렌더러가 소비할 immutable snapshot type을 둔다.

- renderer instance나 GPU resource를 넣지 않는다.
- UI view model과 구분한다.
- combat field snapshot은 config, camera, query visualization 같은 표현 데이터만 가진다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
