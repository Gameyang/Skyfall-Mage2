export const MATERIAL = Object.freeze({
  EMPTY: 0,
  SOLID: 1,
  SAND: 2,
  WATER: 3,
  FIRE: 4,
  SMOKE: 5,
  SPARK: 6,
  STEAM: 7,
  WET_SAND: 8,
});

export const MATERIAL_OPTIONS = Object.freeze([
  {
    label: 'Fire',
    key: '1',
    material: MATERIAL.FIRE,
    color: '#ff6a1a',
    glow: 'rgba(255, 106, 26, 0.72)',
  },
  {
    label: 'Water',
    key: '2',
    material: MATERIAL.WATER,
    color: '#2f88ff',
    glow: 'rgba(47, 136, 255, 0.56)',
  },
  {
    label: 'Sand',
    key: '3',
    material: MATERIAL.SAND,
    color: '#d9a84a',
    glow: 'rgba(217, 168, 74, 0.42)',
  },
  {
    label: 'Smoke',
    key: '4',
    material: MATERIAL.SMOKE,
    color: '#9da3aa',
    glow: 'rgba(157, 163, 170, 0.38)',
  },
  {
    label: 'Steam',
    key: '5',
    material: MATERIAL.STEAM,
    color: '#c9e5f7',
    glow: 'rgba(201, 229, 247, 0.46)',
  },
  {
    label: 'Spark',
    key: '6',
    material: MATERIAL.SPARK,
    color: '#ffd76a',
    glow: 'rgba(255, 215, 106, 0.7)',
  },
  {
    label: 'Rock',
    key: '7',
    material: MATERIAL.SOLID,
    color: '#6f6870',
    glow: 'rgba(111, 104, 112, 0.28)',
  },
  {
    label: 'Wet Sand',
    key: '8',
    material: MATERIAL.WET_SAND,
    color: '#9b7849',
    glow: 'rgba(155, 120, 73, 0.36)',
  },
  {
    label: 'Erase',
    key: '0',
    material: MATERIAL.EMPTY,
    color: '#111827',
    glow: 'rgba(215, 228, 255, 0.18)',
  },
]);

export const MATERIAL_BY_KEY = Object.freeze(
  MATERIAL_OPTIONS.reduce((mapping, option) => {
    mapping[`Digit${option.key}`] = option.material;
    return mapping;
  }, {}),
);
