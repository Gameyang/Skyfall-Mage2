import { describe, expect, it } from "vitest";

import { analyzeSpriteSheetPixels } from "../tools/sheets/spriteAutoMapper";

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
