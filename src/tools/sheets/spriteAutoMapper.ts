// Responsibility: Detect sprite-sheet grid metadata from local image pixels.
// Owner: tools/sheets

import type { SheetAnimationClip, SheetFrameDefinition, SheetRect } from "../../content/sheets/sheetTypes";

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
  readonly frames: readonly SheetFrameDefinition[];
  readonly clips: readonly SheetAnimationClip[];
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
  readonly minSpritePixels?: number;
  readonly spriteMergeRadius?: number;
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

interface SpriteComponent {
  readonly bounds: AlphaBounds;
  readonly pixels: number;
}

interface SpriteComponentRow {
  readonly centerY: number;
  readonly height: number;
  readonly components: readonly SpriteComponent[];
}

const defaultOptions = {
  alphaThreshold: 8,
  maxColumns: 64,
  maxRows: 16,
  maxFrames: 256,
  minSpritePixels: 4,
  spriteMergeRadius: 2,
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

export async function analyzeSpriteSheetSpritesUrl(
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
  return analyzeSpriteSheetSpritesPixels(context.getImageData(0, 0, canvas.width, canvas.height), options);
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
      frames: [
        {
          id: "frame-001",
          label: "Frame 1",
          rect: { x: 0, y: 0, width: 1, height: 1 },
          cellRect: { x: 0, y: 0, width: 1, height: 1 },
          placement: { x: 0, y: 0, width: 1, height: 1 },
          pivot: { x: 0.5, y: 0.5 },
        },
      ],
      clips: [
        {
          id: "all",
          label: "All Frames",
          frameIds: ["frame-001"],
        },
      ],
    };
  }

  const projectionX = createProjection(image, bounds, "x", settings.alphaThreshold);
  const projectionY = createProjection(image, bounds, "y", settings.alphaThreshold);
  const candidate = findBestGridCandidate(image, bounds, projectionX, projectionY, settings);
  const frames = createFrameDefinitions(image, bounds, candidate.columns, candidate.rows, settings.alphaThreshold);

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
    frames,
    clips: [
      {
        id: "all",
        label: "All Frames",
        frameIds: frames.map((frame) => frame.id),
      },
    ],
  };
}

export function analyzeSpriteSheetSpritesPixels(
  image: SpriteAutoMapImageData,
  options: SpriteAutoMapOptions = {},
): SpriteAutoMapResult {
  const settings = { ...defaultOptions, ...options };
  const bounds = findAlphaBounds(image, settings.alphaThreshold);

  if (!bounds) {
    return createEmptyAutoMapResult(image);
  }

  const components = findSpriteComponents(image, bounds, settings);
  const rows = groupSpriteComponentRows(components);
  const frames = rows
    .flatMap((row) => row.components)
    .slice(0, settings.maxFrames)
    .map((component, index) => {
      const rect = normalizePixelRect(component.bounds, image.width, image.height);
      return {
        id: formatFrameId(index),
        label: `Sprite ${index + 1}`,
        rect,
        cellRect: rect,
        placement: { x: 0, y: 0, width: 1, height: 1 },
        pivot: { x: 0.5, y: 0.5 },
      };
    });
  const fallbackFrames =
    frames.length > 0
      ? frames
      : createGridFrameDefinitions(normalizePixelRect(bounds, image.width, image.height), 1, 1, 1);
  const columns = Math.max(1, rows.reduce((max, row) => Math.max(max, row.components.length), 0));
  const activeRows = Math.max(1, rows.length);
  const averageWidth =
    components.length > 0 ? components.reduce((sum, component) => sum + component.bounds.width, 0) / components.length : bounds.width;
  const averageHeight =
    components.length > 0 ? components.reduce((sum, component) => sum + component.bounds.height, 0) / components.length : bounds.height;

  return {
    rect: normalizePixelRect(bounds, image.width, image.height),
    columns,
    rows: activeRows,
    frameCount: fallbackFrames.length,
    frameWidth: averageWidth,
    frameHeight: averageHeight,
    imageWidth: image.width,
    imageHeight: image.height,
    confidence: calculateSpriteComponentConfidence(components, bounds),
    frames: fallbackFrames,
    clips: [
      {
        id: "all",
        label: "All Frames",
        frameIds: fallbackFrames.map((frame) => frame.id),
      },
    ],
  };
}

export function createGridFrameDefinitions(
  rect: SheetRect,
  columns: number,
  rows: number,
  frameCount: number,
): readonly SheetFrameDefinition[] {
  const safeColumns = Math.max(1, Math.floor(columns));
  const safeRows = Math.max(1, Math.floor(rows));
  const safeFrameCount = Math.max(1, Math.floor(frameCount));
  const frames: SheetFrameDefinition[] = [];

  for (let index = 0; index < Math.min(safeFrameCount, safeColumns * safeRows); index += 1) {
    const column = index % safeColumns;
    const row = Math.floor(index / safeColumns);
    const cellRect = {
      x: rect.x + (rect.width * column) / safeColumns,
      y: rect.y + (rect.height * row) / safeRows,
      width: rect.width / safeColumns,
      height: rect.height / safeRows,
    };

    frames.push({
      id: formatFrameId(index),
      label: `Frame ${index + 1}`,
      rect: cellRect,
      cellRect,
      placement: { x: 0, y: 0, width: 1, height: 1 },
      pivot: { x: 0.5, y: 0.5 },
    });
  }

  return frames;
}

function createEmptyAutoMapResult(image: SpriteAutoMapImageData): SpriteAutoMapResult {
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
    frames: [
      {
        id: "frame-001",
        label: "Frame 1",
        rect: { x: 0, y: 0, width: 1, height: 1 },
        cellRect: { x: 0, y: 0, width: 1, height: 1 },
        placement: { x: 0, y: 0, width: 1, height: 1 },
        pivot: { x: 0.5, y: 0.5 },
      },
    ],
    clips: [
      {
        id: "all",
        label: "All Frames",
        frameIds: ["frame-001"],
      },
    ],
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

function createFrameDefinitions(
  image: SpriteAutoMapImageData,
  bounds: AlphaBounds,
  columns: number,
  rows: number,
  alphaThreshold: number,
): readonly SheetFrameDefinition[] {
  const frames: SheetFrameDefinition[] = [];
  const cellWidth = bounds.width / columns;
  const cellHeight = bounds.height / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellBounds = {
        x: Math.floor(bounds.x + column * cellWidth),
        y: Math.floor(bounds.y + row * cellHeight),
        width: Math.max(1, Math.ceil((column + 1) * cellWidth) - Math.floor(column * cellWidth)),
        height: Math.max(1, Math.ceil((row + 1) * cellHeight) - Math.floor(row * cellHeight)),
      };
      const trimmedBounds = findAlphaBoundsInRect(image, cellBounds, alphaThreshold);

      if (!trimmedBounds) {
        continue;
      }

      const index = frames.length;
      frames.push({
        id: formatFrameId(index),
        label: `Frame ${index + 1}`,
        rect: normalizePixelRect(trimmedBounds, image.width, image.height),
        cellRect: normalizePixelRect(cellBounds, image.width, image.height),
        placement: {
          x: (trimmedBounds.x - cellBounds.x) / cellBounds.width,
          y: (trimmedBounds.y - cellBounds.y) / cellBounds.height,
          width: trimmedBounds.width / cellBounds.width,
          height: trimmedBounds.height / cellBounds.height,
        },
        pivot: { x: 0.5, y: 0.5 },
      });
    }
  }

  return frames.length > 0
    ? frames
    : createGridFrameDefinitions(normalizePixelRect(bounds, image.width, image.height), columns, rows, columns * rows);
}

function findAlphaBoundsInRect(
  image: SpriteAutoMapImageData,
  rect: AlphaBounds,
  alphaThreshold: number,
): AlphaBounds | null {
  let minX = rect.x + rect.width;
  let minY = rect.y + rect.height;
  let maxX = rect.x - 1;
  let maxY = rect.y - 1;
  const maxScanX = Math.min(image.width, rect.x + rect.width);
  const maxScanY = Math.min(image.height, rect.y + rect.height);

  for (let y = rect.y; y < maxScanY; y += 1) {
    for (let x = rect.x; x < maxScanX; x += 1) {
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

function normalizePixelRect(rect: AlphaBounds, imageWidth: number, imageHeight: number): SheetRect {
  return {
    x: rect.x / imageWidth,
    y: rect.y / imageHeight,
    width: rect.width / imageWidth,
    height: rect.height / imageHeight,
  };
}

function formatFrameId(index: number): string {
  return `frame-${String(index + 1).padStart(3, "0")}`;
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

function findSpriteComponents(
  image: SpriteAutoMapImageData,
  bounds: AlphaBounds,
  settings: Required<SpriteAutoMapOptions>,
): readonly SpriteComponent[] {
  const width = bounds.width;
  const height = bounds.height;
  const active = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = bounds.x + x;
      const sourceY = bounds.y + y;
      const alpha = image.data[(sourceY * image.width + sourceX) * 4 + 3] ?? 0;

      if (alpha > settings.alphaThreshold) {
        active[y * width + x] = 1;
      }
    }
  }

  const mask = dilateMask(active, width, height, Math.max(0, Math.floor(settings.spriteMergeRadius)));
  const visited = new Uint8Array(mask.length);
  const components: SpriteComponent[] = [];
  const minPixels = Math.max(
    settings.minSpritePixels,
    Math.floor(bounds.width * bounds.height * 0.00002),
  );

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start] === 1) {
      continue;
    }

    const component = floodFillSpriteComponent(start, active, mask, visited, width, bounds);

    if (component && component.pixels >= minPixels) {
      components.push(component);
    }
  }

  return components
    .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)
    .slice(0, settings.maxFrames);
}

function dilateMask(source: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) {
    return source.slice();
  }

  const target = new Uint8Array(source.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (source[y * width + x] === 0) {
        continue;
      }

      for (let dy = -radius; dy <= radius; dy += 1) {
        const nextY = y + dy;

        if (nextY < 0 || nextY >= height) {
          continue;
        }

        for (let dx = -radius; dx <= radius; dx += 1) {
          const nextX = x + dx;

          if (nextX < 0 || nextX >= width) {
            continue;
          }

          target[nextY * width + nextX] = 1;
        }
      }
    }
  }

  return target;
}

function floodFillSpriteComponent(
  start: number,
  active: Uint8Array,
  mask: Uint8Array,
  visited: Uint8Array,
  width: number,
  sourceBounds: AlphaBounds,
): SpriteComponent | null {
  const stack = [start];
  visited[start] = 1;
  let minX = sourceBounds.width;
  let minY = sourceBounds.height;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;

  while (stack.length > 0) {
    const index = stack.pop() ?? 0;
    const localX = index % width;
    const localY = Math.floor(index / width);

    if (active[index] === 1) {
      minX = Math.min(minX, localX);
      minY = Math.min(minY, localY);
      maxX = Math.max(maxX, localX);
      maxY = Math.max(maxY, localY);
      pixels += 1;
    }

    for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
      if (
        neighbor < 0 ||
        neighbor >= mask.length ||
        visited[neighbor] === 1 ||
        mask[neighbor] === 0 ||
        (neighbor === index - 1 && localX === 0) ||
        (neighbor === index + 1 && localX === width - 1)
      ) {
        continue;
      }

      visited[neighbor] = 1;
      stack.push(neighbor);
    }
  }

  if (maxX < minX || maxY < minY || pixels <= 0) {
    return null;
  }

  return {
    bounds: {
      x: sourceBounds.x + minX,
      y: sourceBounds.y + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    pixels,
  };
}

function groupSpriteComponentRows(components: readonly SpriteComponent[]): readonly SpriteComponentRow[] {
  const rows: { centerY: number; height: number; components: SpriteComponent[] }[] = [];

  for (const component of components) {
    const centerY = component.bounds.y + component.bounds.height / 2;
    const row = rows.find(
      (candidate) => Math.abs(candidate.centerY - centerY) <= Math.max(4, candidate.height, component.bounds.height) * 0.6,
    );

    if (row) {
      row.components.push(component);
      const total = row.components.length;
      row.centerY = (row.centerY * (total - 1) + centerY) / total;
      row.height = Math.max(row.height, component.bounds.height);
      continue;
    }

    rows.push({
      centerY,
      height: component.bounds.height,
      components: [component],
    });
  }

  return rows
    .sort((a, b) => a.centerY - b.centerY)
    .map((row) => ({
      centerY: row.centerY,
      height: row.height,
      components: row.components.sort((a, b) => a.bounds.x - b.bounds.x),
    }));
}

function calculateSpriteComponentConfidence(
  components: readonly SpriteComponent[],
  bounds: AlphaBounds,
): number {
  if (components.length === 0) {
    return 0;
  }

  const componentArea = components.reduce(
    (sum, component) => sum + component.bounds.width * component.bounds.height,
    0,
  );
  const boundsArea = Math.max(1, bounds.width * bounds.height);
  const packing = clamp(componentArea / boundsArea, 0, 1);
  const countScore = components.length > 1 ? 0.9 : 0.62;
  return clamp(countScore * 0.75 + packing * 0.25, 0, 1);
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
