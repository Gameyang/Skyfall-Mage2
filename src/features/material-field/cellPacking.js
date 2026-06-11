export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function pack(material, life = 0, aux = 0) {
  return (material & 0xff) | ((life & 0xff) << 8) | ((aux & 0xff) << 16);
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
