import { GRID_HEIGHT, GRID_WIDTH } from '../config.js';
import { clamp } from '../cellPacking.js';
import { MATERIAL_BY_KEY } from '../materials.js';

function eventToGrid(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const nx = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const ny = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);

  return {
    x: clamp(Math.floor(nx * GRID_WIDTH), 0, GRID_WIDTH - 1),
    y: clamp(Math.floor(ny * GRID_HEIGHT), 0, GRID_HEIGHT - 1),
  };
}

export function createMaterialInputController({ canvas, emitterState }) {
  const disposers = [];
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    disposers.push(() => target.removeEventListener(type, handler));
  };

  listen(canvas, 'contextmenu', (event) => event.preventDefault());

  listen(canvas, 'pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    emitterState.beginPointer(event, eventToGrid(canvas, event));
  });

  listen(canvas, 'pointermove', (event) => {
    event.preventDefault();
    emitterState.movePointer(event, eventToGrid(canvas, event));
  });

  const endPointer = (event) => {
    event.preventDefault();
    emitterState.endPointer(event, eventToGrid(canvas, event));
  };

  listen(canvas, 'pointerup', endPointer);
  listen(canvas, 'pointercancel', endPointer);
  listen(window, 'blur', () => emitterState.clearPointers());

  listen(window, 'keydown', (event) => {
    const material = MATERIAL_BY_KEY[event.code];
    if (material !== undefined) {
      emitterState.setSelectedMaterial(material);
    }

    if (event.code === 'Space') {
      event.preventDefault();
      emitterState.addExplosion();
    }
  });

  return {
    destroy() {
      while (disposers.length) {
        disposers.pop()();
      }
    },
  };
}
