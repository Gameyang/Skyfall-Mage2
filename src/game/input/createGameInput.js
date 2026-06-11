const MOVEMENT_INPUTS = Object.freeze(['up', 'down', 'left', 'right']);
const TOUCH_DEADZONE_PX = 16;
const TOUCH_AXIS_THRESHOLD = 0.38;
const TOUCH_FOLLOW_RADIUS_PX = 56;

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

  const updateTouchInput = (event) => {
    if (!touchOrigin) return;

    copyInputSnapshot(touchInput, getTouchMovementSnapshot(getTouchDelta(event)));
    syncInput();
  };

  const getTouchDelta = (event) => {
    let deltaX = event.clientX - touchOrigin.x;
    let deltaY = event.clientY - touchOrigin.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > TOUCH_FOLLOW_RADIUS_PX) {
      const normalX = deltaX / distance;
      const normalY = deltaY / distance;
      const overflow = distance - TOUCH_FOLLOW_RADIUS_PX;
      touchOrigin = {
        x: touchOrigin.x + normalX * overflow,
        y: touchOrigin.y + normalY * overflow,
      };
      deltaX = normalX * TOUCH_FOLLOW_RADIUS_PX;
      deltaY = normalY * TOUCH_FOLLOW_RADIUS_PX;
    }

    return { deltaX, deltaY };
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
    updateTouchInput(event);
  };

  const onPointerMove = (event) => {
    if (event.pointerId !== activeTouchId) return;

    event.preventDefault();
    updateTouchInput(event);
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

export function getTouchMovementSnapshot(
  { deltaX, deltaY },
  { deadzonePx = TOUCH_DEADZONE_PX, axisThreshold = TOUCH_AXIS_THRESHOLD } = {},
) {
  const movement = createInputSnapshot();
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < deadzonePx) return movement;

  const normalizedX = deltaX / distance;
  const normalizedY = deltaY / distance;

  if (normalizedX <= -axisThreshold) {
    movement.left = true;
  } else if (normalizedX >= axisThreshold) {
    movement.right = true;
  }

  if (normalizedY <= -axisThreshold) {
    movement.up = true;
  } else if (normalizedY >= axisThreshold) {
    movement.down = true;
  }

  return movement;
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

function copyInputSnapshot(target, source) {
  for (const key of MOVEMENT_INPUTS) {
    target[key] = Boolean(source[key]);
  }
}
