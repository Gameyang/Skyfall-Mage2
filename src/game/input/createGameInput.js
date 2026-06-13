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

const KEY_TO_ACTION = Object.freeze({
  Enter: 'confirm',
  Space: 'confirm',
  KeyQ: 'rotateLoadoutLeft',
  KeyE: 'rotateLoadoutRight',
});

export function createGameInput({ canvas, state }) {
  const keyboardInput = createInputSnapshot();
  const touchInput = createInputSnapshot();
  const touchJoystick = createTouchJoystick(canvas);
  let activeTouchId = null;
  let touchOrigin = null;

  const syncInput = () => {
    const keyboardVector = getDigitalMovementVector(keyboardInput);
    keyboardInput.vectorX = keyboardVector.x;
    keyboardInput.vectorY = keyboardVector.y;

    const inputVector = clampMovementVector({
      x: keyboardInput.vectorX + touchInput.vectorX,
      y: keyboardInput.vectorY + touchInput.vectorY,
    });

    for (const input of MOVEMENT_INPUTS) {
      state.input[input] = keyboardInput[input] || touchInput[input];
    }
    state.input.vectorX = inputVector.x;
    state.input.vectorY = inputVector.y;
  };

  const setKeyboardInput = (event, isPressed) => {
    const input = KEY_TO_INPUT[event.code];
    const action = KEY_TO_ACTION[event.code];
    if (!input && !action) return;

    event.preventDefault();
    if (input) {
      keyboardInput[input] = isPressed;
    }
    if (action) {
      state.input[action] = isPressed;
      if (isPressed && !event.repeat) {
        if (action === 'confirm') state.input.confirmPressed = true;
        if (action === 'rotateLoadoutLeft') state.input.rotateLoadoutLeftPressed = true;
        if (action === 'rotateLoadoutRight') state.input.rotateLoadoutRightPressed = true;
      }
    }
    syncInput();
  };

  const resetTouchInput = () => {
    activeTouchId = null;
    touchOrigin = null;
    clearInputSnapshot(touchInput);
    touchJoystick.hide();
    syncInput();
  };

  const updateTouchInput = (event) => {
    if (!touchOrigin) return;

    const touchDelta = getTouchDelta(event);
    copyInputSnapshot(touchInput, getTouchMovementSnapshot(touchDelta));
    touchJoystick.update(touchOrigin, touchDelta);
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
    state.input.confirm = false;
    state.input.confirmPressed = false;
    state.input.rotateLoadoutLeft = false;
    state.input.rotateLoadoutLeftPressed = false;
    state.input.rotateLoadoutRight = false;
    state.input.rotateLoadoutRightPressed = false;
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
      touchJoystick.destroy();
    },
  };
}

export function getTouchMovementSnapshot(
  { deltaX, deltaY },
  {
    deadzonePx = TOUCH_DEADZONE_PX,
    axisThreshold = TOUCH_AXIS_THRESHOLD,
    radiusPx = TOUCH_FOLLOW_RADIUS_PX,
  } = {},
) {
  const movement = createInputSnapshot();
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < deadzonePx) return movement;

  const normalizedX = deltaX / distance;
  const normalizedY = deltaY / distance;
  const effectiveRadiusPx = Math.max(deadzonePx + 1, radiusPx);
  const magnitude = clamp(
    (Math.min(distance, effectiveRadiusPx) - deadzonePx) / (effectiveRadiusPx - deadzonePx),
    0,
    1,
  );

  movement.vectorX = normalizedX * magnitude;
  movement.vectorY = normalizedY * magnitude;

  if (movement.vectorX <= -axisThreshold) {
    movement.left = true;
  } else if (movement.vectorX >= axisThreshold) {
    movement.right = true;
  }

  if (movement.vectorY <= -axisThreshold) {
    movement.up = true;
  } else if (movement.vectorY >= axisThreshold) {
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
    vectorX: 0,
    vectorY: 0,
  };
}

function clearInputSnapshot(input) {
  for (const key of MOVEMENT_INPUTS) {
    input[key] = false;
  }
  input.vectorX = 0;
  input.vectorY = 0;
}

function copyInputSnapshot(target, source) {
  for (const key of MOVEMENT_INPUTS) {
    target[key] = Boolean(source[key]);
  }
  target.vectorX = Number.isFinite(source.vectorX) ? source.vectorX : 0;
  target.vectorY = Number.isFinite(source.vectorY) ? source.vectorY : 0;
}

function getDigitalMovementVector(input) {
  const vector = {
    x: Number(input.right) - Number(input.left),
    y: Number(input.down) - Number(input.up),
  };

  return clampMovementVector(vector);
}

function clampMovementVector({ x, y }) {
  const vectorX = Number.isFinite(x) ? x : 0;
  const vectorY = Number.isFinite(y) ? y : 0;
  const magnitude = Math.hypot(vectorX, vectorY);

  if (magnitude <= 1) {
    return { x: vectorX, y: vectorY };
  }

  return {
    x: vectorX / magnitude,
    y: vectorY / magnitude,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createTouchJoystick(canvas) {
  const parent = canvas.parentElement;
  const element = document.createElement('div');
  const thumb = document.createElement('span');

  element.className = 'virtual-joystick';
  thumb.className = 'virtual-joystick-thumb';
  element.setAttribute('aria-hidden', 'true');
  element.append(thumb);
  parent?.append(element);

  return {
    update(origin, { deltaX, deltaY }) {
      element.classList.add('is-active');
      element.style.setProperty('--joystick-x', `${origin.x}px`);
      element.style.setProperty('--joystick-y', `${origin.y}px`);
      element.style.setProperty('--joystick-thumb-x', `${deltaX}px`);
      element.style.setProperty('--joystick-thumb-y', `${deltaY}px`);
    },
    hide() {
      element.classList.remove('is-active');
      element.style.setProperty('--joystick-thumb-x', '0px');
      element.style.setProperty('--joystick-thumb-y', '0px');
    },
    destroy() {
      element.remove();
    },
  };
}
