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

export function createKeyboardInput({ state }) {
  const onKeyDown = (event) => setKeyState(event, state, true);
  const onKeyUp = (event) => setKeyState(event, state, false);
  const onBlur = () => {
    for (const key of Object.values(KEY_TO_INPUT)) {
      state.input[key] = false;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}

function setKeyState(event, state, isPressed) {
  const inputKey = KEY_TO_INPUT[event.code];
  if (!inputKey) return;

  event.preventDefault();
  state.input[inputKey] = isPressed;
}
