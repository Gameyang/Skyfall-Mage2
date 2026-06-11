import { describe, expect, it } from 'vitest';
import { CELL_COUNT } from './config.js';
import { seedInitialField } from './initialField.js';
import { MATERIAL } from './materials.js';
import { mapEffectToGrid } from './ViewportMapper.js';

describe('seedInitialField', () => {
  it('starts combat in an empty sky field without terrain or obstacles', () => {
    const cells = seedInitialField();

    expect(cells).toHaveLength(CELL_COUNT);
    expect(Array.from(cells).every((cell) => (cell & 0xff) === MATERIAL.EMPTY)).toBe(true);
  });
});

describe('mapEffectToGrid', () => {
  it('maps viewport combat effects into bounded material grid coordinates', () => {
    const mapped = mapEffectToGrid(
      { x: 400, y: 300, radius: 40 },
      { width: 800, height: 600 },
      { width: 80, height: 60 },
    );

    expect(mapped).toEqual({ x: 40, y: 30, radius: 4 });
  });

  it('clamps effects that land outside the viewport', () => {
    const mapped = mapEffectToGrid(
      { x: 900, y: -50, radius: 10 },
      { width: 800, height: 600 },
      { width: 80, height: 60 },
    );

    expect(mapped.x).toBe(79);
    expect(mapped.y).toBe(0);
  });
});
