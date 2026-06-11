import { createMaterialInputController } from './input/createMaterialInputController.js';
import { MaterialEmitterState } from './MaterialEmitterState.js';
import { createMaterialFieldRenderer } from './MaterialFieldRenderer.js';
import { createMaterialHub } from './ui/createMaterialHub.js';

function showFatal(fatal, title, detail) {
  fatal.classList.add('is-visible');
  fatal.querySelector('strong').textContent = title;
  fatal.querySelector('span').textContent = detail;
}

export function createMaterialFieldApp({ canvas, fatal, materialHub }) {
  const emitterState = new MaterialEmitterState();
  const hub = createMaterialHub({ container: materialHub, emitterState });
  const input = createMaterialInputController({ canvas, emitterState });
  let renderer = null;
  let startPromise = null;

  return {
    start() {
      if (startPromise) return startPromise;

      startPromise = createMaterialFieldRenderer({
        canvas,
        onDeviceLost(info) {
          showFatal(fatal, 'WebGPU device lost', info.message || 'The browser released the GPU device.');
        },
      })
        .then((nextRenderer) => {
          renderer = nextRenderer;
          renderer.start({ emitterState });
        })
        .catch((error) => {
          console.error(error);
          showFatal(fatal, 'WebGPU material field failed', String(error.message || error));
        });

      return startPromise;
    },
    destroy() {
      renderer?.destroy();
      input.destroy();
      hub.destroy();
    },
  };
}
