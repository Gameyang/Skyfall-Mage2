import { describe, expect, it } from 'vitest';
import { getDominantTouchDirection } from './createGameInput.js';

describe('hidden mobile joystick input', () => {
  it('ignores tiny movements around the first touch position', () => {
    expect(getDominantTouchDirection({ deltaX: 8, deltaY: 6 })).toBeNull();
  });

  it('uses the dominant horizontal axis for left and right movement', () => {
    expect(getDominantTouchDirection({ deltaX: 32, deltaY: 12 })).toBe('right');
    expect(getDominantTouchDirection({ deltaX: -32, deltaY: 12 })).toBe('left');
  });

  it('uses the dominant vertical axis for up and down movement', () => {
    expect(getDominantTouchDirection({ deltaX: 10, deltaY: -34 })).toBe('up');
    expect(getDominantTouchDirection({ deltaX: 10, deltaY: 34 })).toBe('down');
  });
});
