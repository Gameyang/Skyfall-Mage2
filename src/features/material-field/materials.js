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
  ELECTRIC: 9,
  ROCK: 10,
  ICE: 11,
  DUST: 12,
  FIXED_ZONE: 13,
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
    label: 'Electric',
    key: '4',
    material: MATERIAL.ELECTRIC,
    color: '#8be8ff',
    glow: 'rgba(139, 232, 255, 0.64)',
  },
  {
    label: 'Smoke',
    key: '5',
    material: MATERIAL.SMOKE,
    color: '#9da3aa',
    glow: 'rgba(157, 163, 170, 0.38)',
  },
  {
    label: 'Steam',
    key: '6',
    material: MATERIAL.STEAM,
    color: '#c9e5f7',
    glow: 'rgba(201, 229, 247, 0.46)',
  },
  {
    label: 'Spark',
    key: '7',
    material: MATERIAL.SPARK,
    color: '#ffd76a',
    glow: 'rgba(255, 215, 106, 0.7)',
  },
  {
    label: 'Rock',
    key: '8',
    material: MATERIAL.ROCK,
    color: '#786f76',
    glow: 'rgba(120, 111, 118, 0.3)',
  },
  {
    label: 'Ice',
    key: '9',
    material: MATERIAL.ICE,
    color: '#bdefff',
    glow: 'rgba(189, 239, 255, 0.5)',
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
