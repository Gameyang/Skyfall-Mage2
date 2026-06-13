import { describe, expect, it } from 'vitest';
import {
  getCameraPanOffset,
  getContainedImageRect,
  getDistantBackgroundPanOffset,
  getVisibleCanvasArea,
  getVisibleScreenRect,
} from './GameCanvasRenderer.js';

describe('game canvas screen art layout', () => {
  it('maps a scaled fixed battlefield crop back into logical combat coordinates', () => {
    const canvas = {
      parentElement: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          right: 512,
          bottom: 1024,
        }),
      },
    };

    expect(getVisibleCanvasArea(canvas, {
      left: -256,
      top: 0,
      width: 1024,
      height: 1024,
    }, 512, 512)).toEqual({
      x: 128,
      y: 0,
      width: 256,
      height: 512,
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

  it('converts camera movement into a shared CSS pan offset', () => {
    expect(getCameraPanOffset(
      { x: 0, y: 112, width: 512, height: 288 },
      { x: 0, y: 224, width: 512, height: 288 },
      { x: 2.5, y: 2.5 },
    )).toEqual({
      x: 0,
      y: -280,
    });
  });

  it('uses a slower parallax offset for the distant background', () => {
    const pan = getDistantBackgroundPanOffset({ x: 80, y: -280 });

    expect(pan.x).toBeCloseTo(14.4);
    expect(pan.y).toBeCloseTo(-50.4);
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
