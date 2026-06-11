import { describe, expect, it } from 'vitest';
import { computeScreenShakeOffset } from './GameRuntime.js';

function createState({ contactFlashMs = 0, elapsedMs = 120, gameOver = false } = {}) {
  return {
    session: {
      contactFlashMs,
      elapsedMs,
      gameOver,
    },
  };
}

describe('game runtime screen shake', () => {
  it('scales hit shake from the contact flash timer', () => {
    const full = computeScreenShakeOffset(createState({ contactFlashMs: 180 }));
    const half = computeScreenShakeOffset(createState({ contactFlashMs: 90 }));

    expect(Math.abs(full.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(full.y)).toBeLessThanOrEqual(10);
    expect(half.x).toBeCloseTo(full.x * 0.5);
    expect(half.y).toBeCloseTo(full.y * 0.5);
  });

  it('disables hit shake when inactive or after game over', () => {
    expect(computeScreenShakeOffset(createState({ contactFlashMs: 0 }))).toEqual({ x: 0, y: 0 });
    expect(computeScreenShakeOffset(createState({ contactFlashMs: 180, gameOver: true }))).toEqual({ x: 0, y: 0 });
  });
});
