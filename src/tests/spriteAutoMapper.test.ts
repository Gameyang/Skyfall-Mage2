import { describe, expect, it } from "vitest";

import {
  analyzeSpriteSheetPixels,
  analyzeSpriteSheetSpritesPixels,
  createGridFrameDefinitions,
} from "../tools/sheets/spriteAutoMapper";

describe("sprite auto mapper", () => {
  it("detects a horizontal sprite strip", () => {
    const image = createAlphaImage(16, 4);

    for (let frame = 0; frame < 4; frame += 1) {
      fillAlpha(image, frame * 4, 0, 4, 4);
    }

    const result = analyzeSpriteSheetPixels(image);

    expect(result.columns).toBe(4);
    expect(result.rows).toBe(1);
    expect(result.frameCount).toBe(4);
    expect(result.rect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(result.frames).toHaveLength(4);
    expect(result.frames[0].id).toBe("frame-001");
    expect(result.frames[0].cellRect).toEqual({ x: 0, y: 0, width: 0.25, height: 1 });
    expect(result.clips[0]).toMatchObject({
      id: "all",
      label: "All Frames",
      frameIds: ["frame-001", "frame-002", "frame-003", "frame-004"],
    });
  });

  it("detects a separated 2x2 sprite grid", () => {
    const image = createAlphaImage(9, 9);

    fillAlpha(image, 0, 0, 4, 4);
    fillAlpha(image, 5, 0, 4, 4);
    fillAlpha(image, 0, 5, 4, 4);
    fillAlpha(image, 5, 5, 4, 4);

    const result = analyzeSpriteSheetPixels(image);

    expect(result.columns).toBe(2);
    expect(result.rows).toBe(2);
    expect(result.frameCount).toBe(4);
  });

  it("trims each frame while preserving placement inside the grid cell", () => {
    const image = createAlphaImage(13, 6);

    fillAlpha(image, 0, 1, 6, 4);
    fillAlpha(image, 7, 0, 6, 6);

    const result = analyzeSpriteSheetPixels(image, { maxColumns: 2, maxRows: 1 });

    expect(result.columns).toBe(2);
    expect(result.rows).toBe(1);
    expect(result.frames[0].rect).toEqual({ x: 0, y: 1 / 6, width: 6 / 13, height: 4 / 6 });
    expect(result.frames[0].cellRect).toEqual({ x: 0, y: 0, width: 7 / 13, height: 1 });
    expect(result.frames[0].placement).toEqual({ x: 0, y: 1 / 6, width: 6 / 7, height: 4 / 6 });
  });

  it("creates deterministic grid frame definitions", () => {
    const frames = createGridFrameDefinitions({ x: 0.1, y: 0.2, width: 0.8, height: 0.4 }, 2, 2, 3);

    expect(frames).toHaveLength(3);
    expect(frames.map((frame) => frame.id)).toEqual(["frame-001", "frame-002", "frame-003"]);
    expect(frames[2].cellRect).toEqual({ x: 0.1, y: 0.4, width: 0.4, height: 0.2 });
    expect(frames[2].placement).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("detects partial effect sprites as alpha components in row-major order", () => {
    const image = createAlphaImage(20, 12);

    fillAlpha(image, 1, 1, 3, 3);
    fillAlpha(image, 9, 1, 4, 2);
    fillAlpha(image, 2, 8, 5, 3);

    const result = analyzeSpriteSheetSpritesPixels(image, { spriteMergeRadius: 0 });

    expect(result.frameCount).toBe(3);
    expect(result.columns).toBe(2);
    expect(result.rows).toBe(2);
    expect(result.frames.map((frame) => frame.id)).toEqual(["frame-001", "frame-002", "frame-003"]);
    expect(result.frames[0].rect).toEqual({ x: 1 / 20, y: 1 / 12, width: 3 / 20, height: 3 / 12 });
    expect(result.frames[1].rect).toEqual({ x: 9 / 20, y: 1 / 12, width: 4 / 20, height: 2 / 12 });
    expect(result.frames[2].rect).toEqual({ x: 2 / 20, y: 8 / 12, width: 5 / 20, height: 3 / 12 });
  });

  it("merges nearby effect particles into one sprite component", () => {
    const image = createAlphaImage(12, 6);

    fillAlpha(image, 1, 1, 2, 2);
    fillAlpha(image, 5, 1, 2, 2);

    const result = analyzeSpriteSheetSpritesPixels(image, { spriteMergeRadius: 1 });

    expect(result.frameCount).toBe(1);
    expect(result.frames[0].rect).toEqual({ x: 1 / 12, y: 1 / 6, width: 6 / 12, height: 2 / 6 });
  });
});

function createAlphaImage(width: number, height: number): { width: number; height: number; data: Uint8ClampedArray } {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

function fillAlpha(
  image: { width: number; height: number; data: Uint8ClampedArray },
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      image.data[(py * image.width + px) * 4 + 3] = 255;
    }
  }
}
