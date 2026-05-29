# Skyfall Mage2 V2 Responsive Layout Test

Standalone layout sandbox for the v2 game shell.

Open `index.html` directly in a browser. It does not depend on the future app runtime, Vite, WebGPU, or game state modules.

Viewport targets:

- Desktop landscape: combat field plus a right panel rebuilt around the original v1 `ui-panel` hierarchy, with no top bar or command bar chrome.
- Mobile landscape: combat field gets priority, left joystick controls movement, and the v1-style right panel stays available with a left status rail plus a larger tab panel for item/UI manipulation.
- Portrait: intentionally unsupported. The page shows a rotate-device notice instead of maintaining a separate portrait layout.

Input contract:

- PC: left hand uses keyboard direction keys plus `Space` for in-game combat only. Right hand uses the mouse for UI panel and item manipulation.
- Mobile: left hand uses the virtual joystick for in-game movement. Right hand uses the UI panel for item manipulation.
- Right panel: `celestial-panel` player status plus `tab-panel` tabs for inventory, skill tree, shop, and locked content, matching the original v1 layout pattern.
- Inventory: 4 equipment slots and a compact 5 x 4 bag grid, keeping the original 20-slot count while fitting mobile landscape.

The prototype intentionally tests layout, touch zones, safe-area padding, tab density, and text fitting only. It does not implement gameplay.

## V2 responsive layout reference

UI/layout 구현 전에는 `sandbox/v2-responsive-layout-test/README.md`와 `sandbox/v2-responsive-layout-test/index.html`을 확인한다. 이 샌드박스가 desktop landscape, mobile landscape, portrait rotate notice, 입력 소유권, v1식 오른쪽 패널, 4 equipment slots + 5 x 4 bag grid의 현재 기준이다.
