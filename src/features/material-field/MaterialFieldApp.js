import { createMaterialInputController } from './input/createMaterialInputController.js';
import { EMITTER_FLAG_EXPLOSION, GRID_HEIGHT, GRID_WIDTH } from './config.js';
import { MaterialEmitterState } from './MaterialEmitterState.js';
import { createMaterialFieldRenderer } from './MaterialFieldRenderer.js';
import { createMaterialHub } from './ui/createMaterialHub.js';
import { MATERIAL } from './materials.js';

const EFFECT_MATERIALS = Object.freeze({
  fire: MATERIAL.FIRE,
  smoke: MATERIAL.SMOKE,
  spark: MATERIAL.SPARK,
  steam: MATERIAL.STEAM,
  water: MATERIAL.WATER,
  sand: MATERIAL.SAND,
});

function showFatal(fatal, title, detail) {
  if (!fatal) return;
  fatal.classList.add('is-visible');
  fatal.querySelector('strong').textContent = title;
  fatal.querySelector('span').textContent = detail;
}

export function createMaterialFieldApp({ canvas, fatal = null, materialHub = null, enableDemoInput = false }) {
  const emitterState = new MaterialEmitterState();
  const hub = materialHub ? createMaterialHub({ container: materialHub, emitterState }) : null;
  const input = enableDemoInput ? createMaterialInputController({ canvas, emitterState }) : null;
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
          console.warn('WebGPU material field disabled:', error);
          showFatal(fatal, 'WebGPU material field failed', String(error.message || error));
        });

      return startPromise;
    },
    emitEffects(effects, viewport) {
      for (const effect of effects) {
        addEffectEmitter(emitterState, effect, viewport);
      }
    },
    destroy() {
      renderer?.destroy();
      input?.destroy();
      hub?.destroy();
    },
  };
}

function addEffectEmitter(emitterState, effect, viewport) {
  if (effect.type !== 'MaterialEmitter') return;

  const material = EFFECT_MATERIALS[effect.material];
  if (material === undefined) return;

  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const gridX = Math.round((effect.x / width) * (GRID_WIDTH - 1));
  const gridY = Math.round((effect.y / height) * (GRID_HEIGHT - 1));
  const radiusScale = Math.max(GRID_WIDTH / width, GRID_HEIGHT / height);

  emitterState.addEmitter({
    material,
    x: gridX,
    y: gridY,
    radius: Math.max(2, Math.round(effect.radius * radiusScale)),
    strength: effect.strength,
    frames: effect.frames,
    flags: effect.flags || (effect.explosion ? EMITTER_FLAG_EXPLOSION : 0),
  });
}
