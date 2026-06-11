const MOVEMENT_INPUTS = Object.freeze(['up', 'down', 'left', 'right']);
const TOUCH_DEADZONE_PX = 18;

const KEY_TO_INPUT = Object.freeze({
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
});

export function createGameInput({ canvas, state }) {
  const keyboardInput = createInputSnapshot();
  const touchInput = createInputSnapshot();
  let activeTouchId = null;
  let touchOrigin = null;

  const syncInput = () => {
    for (const input of MOVEMENT_INPUTS) {
      state.input[input] = keyboardInput[input] || touchInput[input];
    }
  };

  const setKeyboardInput = (event, isPressed) => {
    const input = KEY_TO_INPUT[event.code];
    if (!input) return;

    event.preventDefault();
    keyboardInput[input] = isPressed;
    syncInput();
  };

  const resetTouchInput = () => {
    activeTouchId = null;
    touchOrigin = null;
    clearInputSnapshot(touchInput);
    syncInput();
  };

  const setTouchDirection = (event) => {
    if (!touchOrigin) return;

    const direction = getDominantTouchDirection({
      deltaX: event.clientX - touchOrigin.x,
      deltaY: event.clientY - touchOrigin.y,
    });
    clearInputSnapshot(touchInput);
    if (direction) {
      touchInput[direction] = true;
    }
    syncInput();
  };

  const onKeyDown = (event) => setKeyboardInput(event, true);
  const onKeyUp = (event) => setKeyboardInput(event, false);
  const onPointerDown = (event) => {
    if (event.pointerType !== 'touch') return;

    event.preventDefault();
    if (activeTouchId !== null) return;

    activeTouchId = event.pointerId;
    touchOrigin = {
      x: event.clientX,
      y: event.clientY,
    };
    canvas.setPointerCapture?.(event.pointerId);
    setTouchDirection(event);
  };

  const onPointerMove = (event) => {
    if (event.pointerId !== activeTouchId) return;

    event.preventDefault();
    setTouchDirection(event);
  };

  const onPointerEnd = (event) => {
    if (event.pointerId !== activeTouchId) return;

    event.preventDefault();
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    resetTouchInput();
  };

  const onBlur = () => {
    clearInputSnapshot(keyboardInput);
    resetTouchInput();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);

  return {
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('lostpointercapture', onPointerEnd);
      clearInputSnapshot(keyboardInput);
      resetTouchInput();
    },
  };
}

export function getDominantTouchDirection({ deltaX, deltaY }, deadzonePx = TOUCH_DEADZONE_PX) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (Math.hypot(absX, absY) < deadzonePx) return null;

  if (absX >= absY) {
    return deltaX >= 0 ? 'right' : 'left';
  }
  return deltaY >= 0 ? 'down' : 'up';
}

function createInputSnapshot() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
  };
}

function clearInputSnapshot(input) {
  for (const key of MOVEMENT_INPUTS) {
    input[key] = false;
  }
}
