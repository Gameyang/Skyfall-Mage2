import { describe, expect, it } from 'vitest';
import { getTouchMovementSnapshot } from './createGameInput.js';

const NO_MOVEMENT = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  vectorX: 0,
  vectorY: 0,
});

describe('hidden mobile joystick input', () => {
  it('ignores tiny movements around the first touch position', () => {
    expect(getTouchMovementSnapshot({ deltaX: 8, deltaY: 6 })).toEqual(NO_MOVEMENT);
  });

  it('keeps shallow horizontal drags on the horizontal axis', () => {
    const right = getTouchMovementSnapshot({ deltaX: 48, deltaY: 12 });
    expect(right).toEqual({
      ...NO_MOVEMENT,
      right: true,
      vectorX: expect.any(Number),
      vectorY: expect.any(Number),
    });
    expect(right.vectorX).toBeGreaterThan(0);
    expect(right.vectorY).toBeGreaterThan(0);

    expect(getTouchMovementSnapshot({ deltaX: -48, deltaY: 12 })).toEqual({
      ...NO_MOVEMENT,
      left: true,
      vectorX: expect.any(Number),
      vectorY: expect.any(Number),
    });
  });

  it('keeps shallow vertical drags on the vertical axis', () => {
    expect(getTouchMovementSnapshot({ deltaX: 10, deltaY: -44 })).toEqual({
      ...NO_MOVEMENT,
      up: true,
      vectorX: expect.any(Number),
      vectorY: expect.any(Number),
    });
    expect(getTouchMovementSnapshot({ deltaX: 10, deltaY: 44 })).toEqual({
      ...NO_MOVEMENT,
      down: true,
      vectorX: expect.any(Number),
      vectorY: expect.any(Number),
    });
  });

  it('supports diagonal movement when both axes are intentional', () => {
    expect(getTouchMovementSnapshot({ deltaX: 34, deltaY: -34 })).toEqual({
      ...NO_MOVEMENT,
      up: true,
      right: true,
      vectorX: expect.any(Number),
      vectorY: expect.any(Number),
    });
    expect(getTouchMovementSnapshot({ deltaX: -34, deltaY: 34 })).toEqual({
      ...NO_MOVEMENT,
      down: true,
      left: true,
      vectorX: expect.any(Number),
      vectorY: expect.any(Number),
    });
  });

  it('scales stick strength by distance from the touch origin', () => {
    const partial = getTouchMovementSnapshot({ deltaX: 36, deltaY: 0 });
    const full = getTouchMovementSnapshot({ deltaX: 56, deltaY: 0 });

    expect(partial.vectorX).toBeCloseTo(0.5);
    expect(partial.vectorY).toBe(0);
    expect(full.vectorX).toBe(1);
    expect(full.vectorY).toBe(0);
  });
});
