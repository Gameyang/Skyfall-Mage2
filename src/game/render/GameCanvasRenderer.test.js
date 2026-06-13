import { describe, expect, it } from 'vitest';
import { getContainedImageRect, getVisibleCanvasArea, getVisibleScreenRect } from './GameCanvasRenderer.js';

describe('game canvas screen art layout', () => {
  it('maps a scaled fixed battlefield crop back into logical combat coordinates', () => {
    const canvas = {
      parentElement: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          right: 640,
          bottom: 960,
        }),
      },
    };

    expect(getVisibleCanvasArea(canvas, {
      left: -160,
      top: 0,
      width: 960,
      height: 960,
    }, 1920, 1920)).toEqual({
      x: 320,
      y: 0,
      width: 1280,
      height: 1920,
    });
  });

  it('uses the cropped visible area instead of the full square combat canvas', () => {
    expect(getVisibleScreenRect({
      visible: {
        x: 0,
        y: 280,
        width: 1280,
        height: 720,
      },
    }, 1280, 1280)).toEqual({
      x: 0,
      y: 280,
      width: 1280,
      height: 720,
    });
  });

  it('fits square game-over art as large as possible while reserving status text space', () => {
    const rect = getContainedImageRect(
      { naturalWidth: 256, naturalHeight: 256 },
      { x: 0, y: 280, width: 1280, height: 720 },
      { margin: 24, reserveBottom: 40 },
    );

    expect(rect).toEqual({
      x: 324,
      y: 304,
      width: 632,
      height: 632,
    });
  });

  it('preserves non-square image ratios when fitting screen art', () => {
    const rect = getContainedImageRect(
      { naturalWidth: 512, naturalHeight: 256 },
      { x: 0, y: 0, width: 800, height: 600 },
      { margin: 20, reserveBottom: 60 },
    );

    expect(rect).toEqual({
      x: 20,
      y: 80,
      width: 760,
      height: 380,
    });
  });
});
