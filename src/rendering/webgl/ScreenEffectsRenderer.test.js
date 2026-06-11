import { describe, expect, it } from 'vitest';
import { computeScreenEffectIntensities } from './ScreenEffectsRenderer.js';

function createState({ hp, maxHp = 100, contactFlashMs = 0, gameOver = false }) {
  return {
    session: {
      contactFlashMs,
      gameOver,
    },
    player: {
      hp,
      maxHp,
    },
  };
}

describe('screen effect intensities', () => {
  it('normalizes player hit flash from the contact flash timer', () => {
    expect(computeScreenEffectIntensities(createState({ hp: 100, contactFlashMs: 180 })).hitFlash).toBe(1);
    expect(computeScreenEffectIntensities(createState({ hp: 100, contactFlashMs: 90 })).hitFlash).toBe(0.5);
    expect(computeScreenEffectIntensities(createState({ hp: 100, contactFlashMs: 0 })).hitFlash).toBe(0);
  });

  it('ramps low-health danger from 0 at 20% hp to 1 at 1% hp', () => {
    expect(computeScreenEffectIntensities(createState({ hp: 21 })).danger).toBe(0);
    expect(computeScreenEffectIntensities(createState({ hp: 20 })).danger).toBe(0);
    expect(computeScreenEffectIntensities(createState({ hp: 10 })).danger).toBeCloseTo(0.526, 3);
    expect(computeScreenEffectIntensities(createState({ hp: 1 })).danger).toBe(1);
    expect(computeScreenEffectIntensities(createState({ hp: 0 })).danger).toBe(1);
  });

  it('disables screen effects after game over', () => {
    expect(computeScreenEffectIntensities(createState({
      hp: 0,
      contactFlashMs: 180,
      gameOver: true,
    }))).toEqual({
      hitFlash: 0,
      danger: 0,
    });
  });
});
