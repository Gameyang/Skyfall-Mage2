import { CELL_COUNT, GRID_HEIGHT, GRID_WIDTH } from './config.js';
import { MATERIAL } from './materials.js';
import { pack, randomSeed } from './cellPacking.js';

export function seedInitialField() {
  const cells = new Uint32Array(CELL_COUNT);

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const index = y * GRID_WIDTH + x;
      const terrain =
        GRID_HEIGHT -
        10 -
        Math.floor(Math.sin(x * 0.055) * 4) -
        Math.floor(Math.sin(x * 0.017) * 5);

      if (y >= terrain) {
        cells[index] = pack(MATERIAL.SOLID, 255, 0);
      } else if (y > terrain - 8 && Math.random() < 0.18) {
        cells[index] = pack(MATERIAL.SAND, 0, 0);
      } else {
        cells[index] = pack(MATERIAL.EMPTY, 0, 0);
      }
    }
  }

  for (let y = GRID_HEIGHT - 24; y < GRID_HEIGHT - 12; y += 1) {
    for (let x = 32; x < 76; x += 1) {
      if (Math.random() < 0.78) {
        cells[y * GRID_WIDTH + x] = pack(MATERIAL.WATER, 0, 0);
      }
    }
  }

  for (let y = 32; y < 90; y += 1) {
    for (let x = 132; x < 138; x += 1) {
      cells[y * GRID_WIDTH + x] = pack(MATERIAL.SOLID, 255, 0);
    }
  }

  const basin = {
    left: 164,
    right: 224,
    top: GRID_HEIGHT - 82,
    bottom: GRID_HEIGHT - 16,
    wall: 4,
    waterTop: GRID_HEIGHT - 44,
  };

  for (let y = basin.top; y <= basin.bottom; y += 1) {
    for (let x = basin.left; x <= basin.right; x += 1) {
      const isLeftWall = x < basin.left + basin.wall;
      const isRightWall = x > basin.right - basin.wall;
      const isBottom = y > basin.bottom - basin.wall;
      const index = y * GRID_WIDTH + x;

      if (isLeftWall || isRightWall || isBottom) {
        cells[index] = pack(MATERIAL.SOLID, 255, 0);
      } else if (y >= basin.waterTop && Math.random() < 0.9) {
        cells[index] = pack(MATERIAL.WATER, 0, randomSeed() & 255);
      } else {
        cells[index] = pack(MATERIAL.EMPTY, 0, 0);
      }
    }
  }

  for (let y = basin.top - 14; y < basin.top - 4; y += 1) {
    for (let x = basin.left + 14; x < basin.left + 36; x += 1) {
      if (Math.random() < 0.62) {
        cells[y * GRID_WIDTH + x] = pack(MATERIAL.SAND, 0, randomSeed() & 255);
      }
    }
  }

  return cells;
}
