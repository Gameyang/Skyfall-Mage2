// Responsibility: Provide small immutable vector helpers for gameplay state.
// Owner: core/math

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const zeroVec2: Vec2 = { x: 0, y: 0 };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeVec2(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);

  if (length <= Number.EPSILON) {
    return zeroVec2;
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function scaleVec2(vector: Vec2, scalar: number): Vec2 {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
  };
}

export function addVec2(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function subtractVec2(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}
