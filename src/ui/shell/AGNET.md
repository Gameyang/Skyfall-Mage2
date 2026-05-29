# src/ui/shell

전체 화면 layout과 top-level panel 배치를 담당한다.

- landing page가 아니라 실제 게임 화면을 첫 화면으로 구성한다.
- PC/mobile/portrait/landscape 배치 정책을 여기서 관리한다.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
