# Repository Contract

이 저장소는 WebGPU 전투 필드 시뮬레이션을 중심으로 `Skyfall Mage2`를 재구현한다.

- 코드 작성 전에는 `docs/todo.md`의 방향을 우선 확인한다.
- v1식 수치 전투를 그대로 옮기지 않고, material/heat/force/field query 기반 전투로 재설계한다.
- 원작 Noita 데이터 원문은 커밋하지 않는다.
- GPU resource, DOM node, renderer instance는 serializable game state에 넣지 않는다.
- `AGNET.md`는 사용자 요청에 맞춘 폴더 책임 문서다.
- 코드 파일을 추가하기 전에는 `docs/code-file-tree.md`의 예정 위치와 네이밍 규칙을 확인한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
