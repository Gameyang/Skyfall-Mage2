import { WEAPON_SPRITES } from './spriteAssets.js';

const WEAPON_ELEMENT_FALLBACK_SPRITE_IDS = Object.freeze({
  fire: 'fire_staff',
  water: 'blizzard_staff',
  electric: 'lightning_strike_staff',
});

function weapon(definition) {
  return Object.freeze({
    ...definition,
    spriteUrl: getWeaponSpriteUrl(definition),
    spriteSize: definition.spriteSize ?? 30,
    tags: Object.freeze(definition.tags || []),
    allowedAffixTags: Object.freeze(definition.allowedAffixTags || []),
    baseStats: freezeRanges(definition.baseStats),
  });
}

function getWeaponSpriteUrl(definition) {
  const directSprite = WEAPON_SPRITES[definition.spriteId];
  const fallbackSpriteId = WEAPON_ELEMENT_FALLBACK_SPRITE_IDS[definition.baseElement];
  return definition.spriteUrl ?? directSprite ?? WEAPON_SPRITES[fallbackSpriteId] ?? null;
}

function freezeRanges(ranges) {
  const frozen = {};
  for (const [key, range] of Object.entries(ranges || {})) {
    frozen[key] = Object.freeze([...range]);
  }
  return Object.freeze(frozen);
}

export const WEAPON_DEFINITIONS = Object.freeze({
  fire_bolt_staff: weapon({
    id: 'fire_bolt_staff',
    name: 'Fire Bolt Staff',
    baseElement: 'fire',
    attackPattern: 'bolt',
    tags: ['weapon', 'fire', 'projectile'],
    minWave: 1,
    minRarity: 'Common',
    baseStats: {
      damage: [11, 17],
      projectileSpeed: [390, 520],
      cooldownMs: [620, 820],
      attackRange: [360, 520],
      areaRadius: [24, 36],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'fire', 'element'],
    spriteId: 'fire_staff',
  }),
  fire_fan_staff: weapon({
    id: 'fire_fan_staff',
    name: 'Fire Fan Staff',
    baseElement: 'fire',
    attackPattern: 'fan',
    tags: ['weapon', 'fire', 'projectile', 'multi'],
    minWave: 3,
    minRarity: 'Uncommon',
    baseStats: {
      damage: [8, 13],
      projectileSpeed: [340, 470],
      cooldownMs: [760, 980],
      attackRange: [300, 430],
      areaRadius: [20, 32],
      projectileCount: [3, 5],
      spreadRadians: [0.42, 0.68],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'multi', 'fire', 'element'],
    spriteId: 'fire_fan_staff',
  }),
  fire_missile_staff: weapon({
    id: 'fire_missile_staff',
    name: 'Fire Missile Staff',
    baseElement: 'fire',
    attackPattern: 'missile',
    tags: ['weapon', 'fire', 'projectile', 'homing', 'explosion'],
    minWave: 3,
    minRarity: 'Uncommon',
    baseStats: {
      damage: [14, 22],
      projectileSpeed: [250, 380],
      cooldownMs: [950, 1350],
      attackRange: [360, 540],
      areaRadius: [24, 48],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'area', 'fire', 'element'],
    spriteId: 'fire_missile_staff',
  }),
  fire_meteor_staff: weapon({
    id: 'fire_meteor_staff',
    name: 'Fire Meteor Staff',
    baseElement: 'fire',
    attackPattern: 'meteor',
    tags: ['weapon', 'fire', 'area', 'explosion'],
    minWave: 6,
    minRarity: 'Rare',
    baseStats: {
      damage: [23, 34],
      projectileSpeed: [460, 620],
      cooldownMs: [1400, 1900],
      attackRange: [430, 620],
      areaRadius: [56, 92],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'area', 'fire', 'element'],
    spriteId: 'fire_meteor_staff',
  }),
  water_bolt_staff: weapon({
    id: 'water_bolt_staff',
    name: 'Water Bolt Staff',
    baseElement: 'water',
    attackPattern: 'bolt',
    tags: ['weapon', 'water', 'projectile'],
    minWave: 1,
    minRarity: 'Common',
    baseStats: {
      damage: [9, 15],
      projectileSpeed: [440, 560],
      cooldownMs: [690, 880],
      attackRange: [360, 520],
      areaRadius: [20, 34],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'water', 'element'],
    spriteId: 'water_bolt_staff',
  }),
  water_burst_staff: weapon({
    id: 'water_burst_staff',
    name: 'Water Burst Staff',
    baseElement: 'water',
    attackPattern: 'meteor',
    tags: ['weapon', 'water', 'area'],
    minWave: 3,
    minRarity: 'Uncommon',
    baseStats: {
      damage: [13, 20],
      projectileSpeed: [340, 480],
      cooldownMs: [980, 1380],
      attackRange: [300, 470],
      areaRadius: [44, 74],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'area', 'water', 'element'],
    spriteId: 'water_burst_staff',
  }),
  rain_fall_staff: weapon({
    id: 'rain_fall_staff',
    name: 'Rain Fall Staff',
    baseElement: 'water',
    attackPattern: 'rain',
    tags: ['weapon', 'water', 'falling-liquid', 'multi', 'area'],
    minWave: 6,
    minRarity: 'Rare',
    baseStats: {
      damage: [5, 8],
      projectileSpeed: [440, 610],
      cooldownMs: [1280, 1720],
      attackRange: [430, 620],
      areaRadius: [32, 56],
      projectileCount: [7, 10],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'area', 'multi', 'water', 'element'],
    spriteId: 'rain_fall_staff',
  }),
  electric_bolt_staff: weapon({
    id: 'electric_bolt_staff',
    name: 'Electric Bolt Staff',
    baseElement: 'electric',
    attackPattern: 'bolt',
    tags: ['weapon', 'electric', 'projectile', 'fast'],
    minWave: 1,
    minRarity: 'Common',
    baseStats: {
      damage: [12, 18],
      projectileSpeed: [560, 720],
      cooldownMs: [720, 930],
      attackRange: [370, 550],
      areaRadius: [18, 30],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'electric', 'element'],
    spriteId: 'electric_bolt_staff',
  }),
  chain_lightning_staff: weapon({
    id: 'chain_lightning_staff',
    name: 'Chain Lightning Staff',
    baseElement: 'electric',
    attackPattern: 'missile',
    tags: ['weapon', 'electric', 'projectile', 'homing'],
    minWave: 6,
    minRarity: 'Rare',
    baseStats: {
      damage: [18, 28],
      projectileSpeed: [430, 620],
      cooldownMs: [940, 1280],
      attackRange: [420, 640],
      areaRadius: [20, 36],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'electric', 'element'],
    spriteId: 'chain_lightning_staff',
  }),
  sand_bolt_staff: weapon({
    id: 'sand_bolt_staff',
    name: 'Sand Bolt Staff',
    baseElement: 'sand',
    attackPattern: 'bolt',
    tags: ['weapon', 'sand', 'projectile'],
    minWave: 1,
    minRarity: 'Common',
    baseStats: {
      damage: [10, 16],
      projectileSpeed: [390, 520],
      cooldownMs: [700, 910],
      attackRange: [360, 520],
      areaRadius: [20, 34],
      projectileCount: [1, 1],
      spreadRadians: [0, 0],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'sand', 'element'],
    spriteId: 'sand_bolt_staff',
  }),
  sand_barrage_staff: weapon({
    id: 'sand_barrage_staff',
    name: 'Sand Barrage Staff',
    baseElement: 'sand',
    attackPattern: 'fan',
    tags: ['weapon', 'sand', 'projectile', 'multi'],
    minWave: 3,
    minRarity: 'Uncommon',
    baseStats: {
      damage: [7, 12],
      projectileSpeed: [360, 500],
      cooldownMs: [780, 1040],
      attackRange: [310, 460],
      areaRadius: [18, 32],
      projectileCount: [4, 6],
      spreadRadians: [0.5, 0.78],
    },
    allowedAffixTags: ['damage', 'cooldown', 'projectile', 'range', 'multi', 'sand', 'element'],
    spriteId: 'sand_barrage_staff',
  }),
});

export const STARTER_WEAPON_LOADOUT_SIZE = 3;

export const STARTER_WEAPON_DEFINITION_IDS = Object.freeze([
  'fire_bolt_staff',
  'water_bolt_staff',
  'electric_bolt_staff',
  'sand_bolt_staff',
]);

export function createStarterWeaponLoadout({
  seed = 'default',
  weaponIds = STARTER_WEAPON_DEFINITION_IDS,
  weapons = WEAPON_DEFINITIONS,
  count = STARTER_WEAPON_LOADOUT_SIZE,
} = {}) {
  const candidates = [];
  const seenElements = new Set();
  for (const weaponId of weaponIds || []) {
    const definition = weapons?.[weaponId];
    const element = definition?.baseElement || weaponId;
    if (!definition || seenElements.has(element)) continue;

    seenElements.add(element);
    candidates.push(weaponId);
  }

  const rng = createSeededRandom(`${seed}:starter-weapons`);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  return Object.freeze(candidates.slice(0, Math.max(0, Math.min(count, candidates.length))));
}

function createSeededRandom(seed) {
  let value = hashString(String(seed)) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 100000) / 100000;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
