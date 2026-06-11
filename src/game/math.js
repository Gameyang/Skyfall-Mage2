export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a, b) {
  return Math.sqrt(distanceSq(a, b));
}

export function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length <= 0.0001) {
    return { x: 0, y: -1 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

export function circlesIntersect(a, b) {
  const radius = a.radius + b.radius;
  return distanceSq(a, b) <= radius * radius;
}

export function hash01(seed) {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) % 10000) / 10000;
}
