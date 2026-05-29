// Responsibility: Hold bounded material emitters before render backend upload.
// Owner: features/combatField

import type { MaterialEmitter } from "./CombatFieldTypes";
import { materialEmitterStride, packMaterialEmitter } from "./MaterialEmitterPacking";

export class MaterialEmitterQueue {
  private readonly emitters: MaterialEmitter[] = [];

  constructor(private readonly maxEmitters: number) {}

  get size(): number {
    return this.emitters.length;
  }

  enqueue(emitter: MaterialEmitter): boolean {
    if (this.emitters.length >= this.maxEmitters) {
      return false;
    }

    this.emitters.push(emitter);
    return true;
  }

  clear(): void {
    this.emitters.length = 0;
  }

  pack(): Float32Array {
    const packed = new Float32Array(this.maxEmitters * materialEmitterStride);

    this.emitters.forEach((emitter, index) => {
      packMaterialEmitter(packed, index * materialEmitterStride, emitter);
    });

    return packed;
  }
}
