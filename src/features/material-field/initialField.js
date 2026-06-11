import { CELL_COUNT } from './config.js';
import { MATERIAL } from './materials.js';
import { pack } from './cellPacking.js';

export function seedInitialField() {
  const cells = new Uint32Array(CELL_COUNT);
  cells.fill(pack(MATERIAL.EMPTY, 0, 0));

  return cells;
}
