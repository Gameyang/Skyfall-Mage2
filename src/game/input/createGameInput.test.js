import { describe, expect, it } from 'vitest';
import { getTouchMovementSnapshot } from './createGameInput.js';

const NO_MOVEMENT = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
});

describe('hidden mobile joystick input', () => {
  it('ignores tiny movements around the first touch position', () => {
    expect(getTouchMovementSnapshot({ deltaX: 8, deltaY: 6 })).toEqual(NO_MOVEMENT);
  });

  it('keeps shallow horizontal drags on the horizontal axis', () => {
    expect(getTouchMovementSnapshot({ deltaX: 48, deltaY: 12 })).toEqual({
      ...NO_MOVEMENT,
      right: true,
    });
    expect(getTouchMovementSnapshot({ deltaX: -48, deltaY: 12 })).toEqual({
      ...NO_MOVEMENT,
      left: true,
    });
  });

  it('keeps shallow vertical drags on the vertical axis', () => {
    expect(getTouchMovementSnapshot({ deltaX: 10, deltaY: -44 })).toEqual({
      ...NO_MOVEMENT,
      up: true,
    });
    expect(getTouchMovementSnapshot({ deltaX: 10, deltaY: 44 })).toEqual({
      ...NO_MOVEMENT,
      down: true,
    });
  });

  it('supports diagonal movement when both axes are intentional', () => {
    expect(getTouchMovementSnapshot({ deltaX: 34, deltaY: -34 })).toEqual({
      ...NO_MOVEMENT,
      up: true,
      right: true,
    });
    expect(getTouchMovementSnapshot({ deltaX: -34, deltaY: 34 })).toEqual({
      ...NO_MOVEMENT,
      down: true,
      left: true,
    });
  });
});
