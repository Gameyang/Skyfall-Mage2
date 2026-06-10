// Responsibility: Detect sprite-sheet grid metadata from local image pixels.
// Owner: tools/sheets

import type { SheetRect } from "../../content/sheets/sheetTypes";

export interface SpriteAutoMapResult {
  readonly rect: SheetRect;
  readonly columns: number;
  readonly rows: number;
  readonly frameCount: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly confidence: number;
}

export interface SpriteAutoMapImageData {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

export interface SpriteAutoMapOptions {
  readonly alphaThreshold?: number;
  readonly maxColumns?: number;
  readonly maxRows?: number;
  readonly maxFrames?: number;
}

interface AlphaBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface GridCandidate {
  readonly columns: number;
  readonly rows: number;
  readonly activeCells: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly score: number;
}

const defaultOptions = {
  alphaThreshold: 8,
  maxColumns: 64,
  maxRows: 16,
  maxFrames: 256,
} as const;

export async function analyzeSpriteSheetUrl(
  imageUrl: string,
  options: SpriteAutoMapOptions = {},
): Promise<SpriteAutoMapResult> {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.drawImage(image, 0, 0);
  return analyzeSpriteSheetPixels(context.getImageData(0, 0, canvas.width, canvas.height), options);
}

export function analyzeSpriteSheetPixels(
  image: SpriteAutoMapImageData,
  options: SpriteAutoMapOptions = {},
): SpriteAutoMapResult {
  const settings = { ...defaultOptions, ...options };
  const bounds = findAlphaBounds(image, settings.alphaThreshold);

  if (!bounds) {
    return {
      rect: { x: 0, y: 0, width: 1, height: 1 },
      columns: 1,
      rows: 1,
      frameCount: 1,
      frameWidth: image.width,
      frameHeight: image.height,
      imageWidth: image.width,
      imageHeight: image.height,
      confidence: 0,
    };
  }

  const projectionX = createProjection(image, bounds, "x", settings.alphaThreshold);
  const projectionY = createProjection(image, bounds, "y", settings.alphaThreshold);
  const candidate = findBestGridCandidate(image, bounds, projectionX, projectionY, settings);

  return {
    rect: {
      x: bounds.x / image.width,
      y: bounds.y / image.height,
      width: bounds.width / image.width,
      height: bounds.height / image.height,
    },
    columns: candidate.columns,
    rows: candidate.rows,
    frameCount: candidate.activeCells,
    frameWidth: candidate.frameWidth,
    frameHeight: candidate.frameHeight,
    imageWidth: image.width,
    imageHeight: image.height,
    confidence: clamp(candidate.score, 0, 1),
  };
}

function findBestGridCandidate(
  image: SpriteAutoMapImageData,
  bounds: AlphaBounds,
  projectionX: readonly number[],
  projectionY: readonly number[],
  settings: Required<SpriteAutoMapOptions>,
): GridCandidate {
  let best: GridCandidate | null = null;
  const maxColumns = Math.min(settings.maxColumns, bounds.width);
  const maxRows = Math.min(settings.maxRows, bounds.height);

  for (let columns = 1; columns <= maxColumns; columns += 1) {
    for (let rows = 1; rows <= maxRows; rows += 1) {
      const totalCells = columns * rows;

      if (totalCells > settings.maxFrames) {
        continue;
      }

      const frameWidth = bounds.width / columns;
      const frameHeight = bounds.height / rows;

      if (frameWidth < 2 || frameHeight < 2) {
        continue;
      }

      const aspect = frameWidth / frameHeight;
      const aspectPenalty = Math.abs(Math.log(clamp(aspect, 0.1, 10)));

      if (aspectPenalty > 1.55) {
        continue;
      }

      const cellStats = sampleGridCells(image, bounds, columns, rows, settings.alphaThreshold);
      const activeCells = cellStats.filter((count) => count > Math.max(1, frameWidth * frameHeight * 0.004)).length;

      if (activeCells <= 0) {
        continue;
      }

      const activeRatio = activeCells / totalCells;
      const balancePenalty = calculateBalancePenalty(cellStats.filter((count) => count > 0));
      const boundaryPenalty = calculateBoundaryPenalty(projectionX, projectionY, columns, rows, bounds);
      const correlationX = columns > 1 ? normalizedAutocorrelation(projectionX, frameWidth) : 0.5;
      const correlationY = rows > 1 ? normalizedAutocorrelation(projectionY, frameHeight) : 0.5;
      const squareScore = 1 - clamp(aspectPenalty / 1.55, 0, 1);
      const gridGapReward = columns > 1 || rows > 1 ? 1 - boundaryPenalty : 0;
      const score =
        correlationX * 0.45 +
        correlationY * 0.45 +
        squareScore * 1.1 +
        activeRatio * 0.45 +
        gridGapReward * 0.25 -
        boundaryPenalty * 0.45 -
        balancePenalty * 0.25;

      if (!best || score > best.score) {
        best = { columns, rows, activeCells, frameWidth, frameHeight, score };
      }
    }
  }

  return best ?? {
    columns: 1,
    rows: 1,
    activeCells: 1,
    frameWidth: bounds.width,
    frameHeight: bounds.height,
    score: 0,
  };
}

function findAlphaBounds(image: SpriteAutoMapImageData, alphaThreshold: number): AlphaBounds | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3] ?? 0;

      if (alpha <= alphaThreshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function createProjection(
  image: SpriteAutoMapImageData,
  bounds: AlphaBounds,
  axis: "x" | "y",
  alphaThreshold: number,
): readonly number[] {
  const length = axis === "x" ? bounds.width : bounds.height;
  const projection = new Array<number>(length).fill(0);

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3] ?? 0;

      if (alpha <= alphaThreshold) {
        continue;
      }

      projection[axis === "x" ? x - bounds.x : y - bounds.y] += 1;
    }
  }

  return projection;
}

function sampleGridCells(
  image: SpriteAutoMapImageData,
  bounds: AlphaBounds,
  columns: number,
  rows: number,
  alphaThreshold: number,
): readonly number[] {
  const counts = new Array<number>(columns * rows).fill(0);

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3] ?? 0;

      if (alpha <= alphaThreshold) {
        continue;
      }

      const column = Math.min(columns - 1, Math.floor(((x - bounds.x) / bounds.width) * columns));
      const row = Math.min(rows - 1, Math.floor(((y - bounds.y) / bounds.height) * rows));
      counts[row * columns + column] += 1;
    }
  }

  return counts;
}

function calculateBoundaryPenalty(
  projectionX: readonly number[],
  projectionY: readonly number[],
  columns: number,
  rows: number,
  bounds: AlphaBounds,
): number {
  const vertical = columns > 1 ? averageBoundaryDensity(projectionX, columns, bounds.height) : 0;
  const horizontal = rows > 1 ? averageBoundaryDensity(projectionY, rows, bounds.width) : 0;
  const divisor = (columns > 1 ? 1 : 0) + (rows > 1 ? 1 : 0);
  return divisor > 0 ? (vertical + horizontal) / divisor : 0;
}

function averageBoundaryDensity(projection: readonly number[], parts: number, maxLinePixels: number): number {
  let total = 0;

  for (let index = 1; index < parts; index += 1) {
    const boundary = Math.round((projection.length * index) / parts);
    let count = 0;
    let samples = 0;

    for (let offset = -1; offset <= 1; offset += 1) {
      const position = boundary + offset;

      if (position < 0 || position >= projection.length) {
        continue;
      }

      count += projection[position] ?? 0;
      samples += 1;
    }

    total += count / Math.max(1, samples) / Math.max(1, maxLinePixels);
  }

  return total / Math.max(1, parts - 1);
}

function normalizedAutocorrelation(projection: readonly number[], period: number): number {
  const shift = Math.max(1, Math.round(period));

  if (shift >= projection.length) {
    return 0;
  }

  const mean = projection.reduce((sum, value) => sum + value, 0) / projection.length;
  let numerator = 0;
  let left = 0;
  let right = 0;

  for (let index = 0; index < projection.length - shift; index += 1) {
    const a = projection[index] - mean;
    const b = projection[index + shift] - mean;
    numerator += a * b;
    left += a * a;
    right += b * b;
  }

  if (left <= 0 || right <= 0) {
    return 0.5;
  }

  return clamp((numerator / Math.sqrt(left * right) + 1) * 0.5, 0, 1);
}

function calculateBalancePenalty(values: readonly number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  if (mean <= 0) {
    return 0;
  }

  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return clamp(Math.sqrt(variance) / mean, 0, 1);
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolveImage, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolveImage(image);
    image.onerror = () => reject(new Error(`Could not load sprite sheet image: ${imageUrl}`));
    image.src = imageUrl;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
