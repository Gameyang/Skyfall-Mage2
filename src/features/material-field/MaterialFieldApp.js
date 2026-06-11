import { createMaterialInputController } from './input/createMaterialInputController.js';
import { EMITTER_FLAG_EXPLOSION } from './config.js';
import { MaterialEmitterState } from './MaterialEmitterState.js';
import { createMaterialFieldRenderer } from './MaterialFieldRenderer.js';
import { mapEffectToGrid } from './ViewportMapper.js';
import { createMaterialHub } from './ui/createMaterialHub.js';
import { MATERIAL } from './materials.js';

const EFFECT_MATERIALS = Object.freeze({
  fire: MATERIAL.FIRE,
  smoke: MATERIAL.SMOKE,
  spark: MATERIAL.SPARK,
  steam: MATERIAL.STEAM,
  water: MATERIAL.WATER,
  sand: MATERIAL.SAND,
  wetSand: MATERIAL.WET_SAND,
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
  let disabled = false;

  return {
    start() {
      if (startPromise) return startPromise;

      startPromise = createMaterialFieldRenderer({
        canvas,
        onDeviceLost(info) {
          disabled = true;
          canvas.hidden = true;
          showFatal(fatal, 'WebGPU device lost', info.message || 'The browser released the GPU device.');
        },
      })
        .then((nextRenderer) => {
          renderer = nextRenderer;
          disabled = false;
          canvas.hidden = false;
          renderer.start({ emitterState });
        })
        .catch((error) => {
          disabled = true;
          canvas.hidden = true;
          console.warn('WebGPU material field disabled:', error);
          showFatal(fatal, 'WebGPU material field failed', String(error.message || error));
        });

      return startPromise;
    },
    emitEffects(effects, viewport) {
      if (disabled) return;
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
  const gridEffect = mapEffectToGrid(effect, { width, height });

  emitterState.addEmitter({
    material,
    x: gridEffect.x,
    y: gridEffect.y,
    radius: gridEffect.radius,
    strength: effect.strength,
    frames: effect.frames,
    flags: effect.flags || (effect.explosion ? EMITTER_FLAG_EXPLOSION : 0),
  });
}
