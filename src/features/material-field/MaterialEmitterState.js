import {
  BRUSH_RADIUS,
  EMITTER_FLAG_EXPLOSION,
  EMITTER_WORDS,
  EXPLOSION_FRAMES,
  EXPLOSION_RADIUS,
  GRID_HEIGHT,
  GRID_WIDTH,
  MAX_EMITTERS,
  TOUCH_WATER_RADIUS,
} from './config.js';
import { clamp, randomSeed } from './cellPacking.js';
import { MATERIAL } from './materials.js';

export class MaterialEmitterState {
  constructor() {
    this.selectedMaterial = MATERIAL.FIRE;
    this.activePointers = new Map();
    this.burstEmitters = [];
    this.selectionListeners = new Set();
    this.lastGrid = {
      x: Math.floor(GRID_WIDTH * 0.5),
      y: Math.floor(GRID_HEIGHT * 0.35),
    };
    this.lastTap = {
      time: 0,
      x: this.lastGrid.x,
      y: this.lastGrid.y,
    };
  }

  getSelectedMaterial() {
    return this.selectedMaterial;
  }

  setSelectedMaterial(material) {
    if (this.selectedMaterial === material) return;

    this.selectedMaterial = material;
    for (const listener of this.selectionListeners) {
      listener(material);
    }
  }

  onSelectionChange(listener) {
    this.selectionListeners.add(listener);
    listener(this.selectedMaterial);

    return () => {
      this.selectionListeners.delete(listener);
    };
  }

  beginPointer(event, grid) {
    this.lastGrid = grid;
    this.addDoubleTapExplosion(event, grid);

    const nextPointerCount = this.activePointers.size + 1;
    this.activePointers.set(event.pointerId, {
      x: grid.x,
      y: grid.y,
      material: this.pickPointerMaterial(event, nextPointerCount),
      pointerType: event.pointerType,
      seed: randomSeed(),
    });
  }

  movePointer(event, grid) {
    this.lastGrid = grid;
    const pointer = this.activePointers.get(event.pointerId);
    if (!pointer) return;

    pointer.x = grid.x;
    pointer.y = grid.y;
    pointer.material = this.pickPointerMaterial(event, this.activePointers.size);
  }

  endPointer(event, grid) {
    this.movePointer(event, grid);
    this.activePointers.delete(event.pointerId);
  }

  clearPointers() {
    this.activePointers.clear();
  }

  addExplosion(x = this.lastGrid.x, y = this.lastGrid.y) {
    this.burstEmitters.push({
      material: MATERIAL.FIRE,
      x,
      y,
      radius: EXPLOSION_RADIUS,
      strength: 255,
      seed: randomSeed(),
      flags: EMITTER_FLAG_EXPLOSION,
      frames: EXPLOSION_FRAMES,
    });

    while (this.burstEmitters.length > 12) {
      this.burstEmitters.shift();
    }
  }

  buildEmitterBuffer() {
    const words = new Uint32Array(MAX_EMITTERS * EMITTER_WORDS);
    let count = 0;
    const pointerCount = this.activePointers.size;

    for (const pointer of this.activePointers.values()) {
      const touchWater = pointer.pointerType === 'touch' && pointerCount > 1;
      const waterBrush = touchWater || pointer.material === MATERIAL.WATER;
      const hardBrush = pointer.material === MATERIAL.SOLID || pointer.material === MATERIAL.EMPTY;
      count = pushEmitter(words, count, {
        material: touchWater ? MATERIAL.WATER : pointer.material,
        x: pointer.x,
        y: pointer.y,
        radius: waterBrush ? TOUCH_WATER_RADIUS : BRUSH_RADIUS,
        strength: waterBrush || hardBrush ? 255 : 222,
        seed: pointer.seed,
        flags: 0,
      });
    }

    for (const burst of this.burstEmitters) {
      count = pushEmitter(words, count, {
        material: burst.material,
        x: burst.x,
        y: burst.y,
        radius: burst.radius,
        strength: burst.strength,
        seed: burst.seed,
        flags: burst.flags,
      });
    }

    return { words, count };
  }

  ageBurstEmitters() {
    for (let index = this.burstEmitters.length - 1; index >= 0; index -= 1) {
      this.burstEmitters[index].frames -= 1;
      this.burstEmitters[index].radius = Math.max(4, this.burstEmitters[index].radius - 1);
      if (this.burstEmitters[index].frames <= 0) {
        this.burstEmitters.splice(index, 1);
      }
    }
  }

  pickPointerMaterial(event, nextPointerCount) {
    if (event.pointerType === 'touch' && nextPointerCount > 1) return MATERIAL.WATER;
    if (event.button === 2 || event.shiftKey) return MATERIAL.WATER;
    if (event.altKey) return MATERIAL.SAND;
    return this.selectedMaterial;
  }

  addDoubleTapExplosion(event, grid) {
    if (event.pointerType !== 'touch') return;

    const now = performance.now();
    const dx = grid.x - this.lastTap.x;
    const dy = grid.y - this.lastTap.y;
    if (now - this.lastTap.time < 320 && dx * dx + dy * dy < 144) {
      this.addExplosion(grid.x, grid.y);
      this.lastTap.time = 0;
      return;
    }

    this.lastTap = {
      time: now,
      x: grid.x,
      y: grid.y,
    };
  }
}

function pushEmitter(words, count, emitter) {
  if (count >= MAX_EMITTERS) return count;

  const offset = count * EMITTER_WORDS;
  words[offset] = emitter.material >>> 0;
  words[offset + 1] = clamp(emitter.x, 0, GRID_WIDTH - 1) >>> 0;
  words[offset + 2] = clamp(emitter.y, 0, GRID_HEIGHT - 1) >>> 0;
  words[offset + 3] = clamp(emitter.radius, 1, 64) >>> 0;
  words[offset + 4] = clamp(emitter.strength, 0, 255) >>> 0;
  words[offset + 5] = emitter.seed >>> 0;
  words[offset + 6] = emitter.flags >>> 0;
  words[offset + 7] = 0;

  return count + 1;
}
