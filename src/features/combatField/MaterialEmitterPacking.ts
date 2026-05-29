// Responsibility: Pack material emitters into typed arrays for GPU upload.
// Owner: features/combatField

import { combatMaterialIds, type MaterialEmitter } from "./CombatFieldTypes";

export const materialEmitterStride = 8;

export function packMaterialEmitter(target: Float32Array, offset: number, emitter: MaterialEmitter): void {
  target[offset] = combatMaterialIds[emitter.material];
  target[offset + 1] = emitter.x;
  target[offset + 2] = emitter.y;
  target[offset + 3] = emitter.radius;
  target[offset + 4] = emitter.strength;
  target[offset + 5] = emitter.ttlMs;
  target[offset + 6] = 0;
  target[offset + 7] = 0;
}
