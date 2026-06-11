import { describe, expect, it } from 'vitest';
import { CELL_COUNT } from './config.js';
import { seedInitialField } from './initialField.js';
import { MATERIAL } from './materials.js';

describe('seedInitialField', () => {
  it('starts combat in an empty sky field without terrain or obstacles', () => {
    const cells = seedInitialField();

    expect(cells).toHaveLength(CELL_COUNT);
    expect(Array.from(cells).every((cell) => (cell & 0xff) === MATERIAL.EMPTY)).toBe(true);
  });
});
