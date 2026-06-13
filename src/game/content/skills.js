const BASE_TARGETING = Object.freeze({
  type: 'nearest',
});

const BASE_SKILL_TAGS = Object.freeze(['base-element', 'gpu-reaction-input']);

function freezeSkill(definition) {
  return Object.freeze(definition);
}

function tagsFor(element, extraTags = []) {
  return Object.freeze([element, ...BASE_SKILL_TAGS, ...extraTags]);
}

function effect(definition) {
  return Object.freeze(definition);
}

function materialTrail(material, { radius = 4, strength = 120, frames = 1, life = 12, profile } = {}) {
  return Object.freeze([
    effect({ material, radius, strength, frames, life, profile }),
  ]);
}

const FIREBALL_SKILL = freezeSkill({
  id: 'fireball',
  name: 'Fireball',
  element: 'fire',
  tags: tagsFor('fire', ['weapon', 'area', 'projectile', 'explosion']),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    tier: 1,
    role: 'area-burst',
    directDamage: 12,
    peakAreaDamage: 32,
  }),
  cooldownMs: 700,
  targeting: BASE_TARGETING,
  projectile: Object.freeze({
    speed: 430,
    damage: 20,
    radius: 7,
    lifetimeMs: 2600,
    homing: 'none',
    energy: Object.freeze({
      initial: 96,
      max: 96,
      trailIntervalMs: 48,
      trailLeakPerSecond: 0,
      trailEffects: Object.freeze([
        effect({ material: 'fire', profile: 'projectileFire', life: 10, radius: 4, strength: 100, frames: 1 }),
      ]),
      explosion: Object.freeze({
        minRadius: 28,
        maxRadius: 68,
        minDamage: 10,
        maxDamage: 32,
        materialEffects: Object.freeze([
          effect({
            material: 'fire',
            profile: 'skillExplosionFire',
            life: 14,
            radiusScale: 0.92,
            strength: 255,
            frames: 5,
            radialForce: 1,
            expansionFrames: 5,
            explosion: true,
          }),
        ]),
      }),
    }),
    visual: Object.freeze({
      color: '#ff8a2a',
      coreColor: '#fff0a6',
      glowColor: 'rgba(255, 110, 28, 0.58)',
    }),
  }),
  impact: Object.freeze({
    damage: 12,
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      effect({ material: 'fire', profile: 'projectileFire', life: 18, radius: 5, strength: 210, frames: 2 }),
    ]),
    hit: Object.freeze([]),
  }),
});

const WATER_BOLT_SKILL = freezeSkill({
  id: 'water_bolt',
  name: 'Water Bolt',
  element: 'water',
  tags: tagsFor('water', ['weapon', 'projectile', 'single-target', 'liquid']),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    tier: 1,
    role: 'single-target',
    directDamage: 10,
  }),
  cooldownMs: 760,
  targeting: BASE_TARGETING,
  projectile: Object.freeze({
    speed: 500,
    damage: 10,
    radius: 6,
    lifetimeMs: 1900,
    energy: Object.freeze({
      initial: 40,
      max: 40,
      trailIntervalMs: 42,
      trailLeakPerSecond: 0,
      trailEffects: materialTrail('water', { radius: 4, strength: 195, frames: 1 }),
    }),
    visual: Object.freeze({
      color: '#4aa7ff',
      coreColor: '#effbff',
      glowColor: 'rgba(74, 167, 255, 0.5)',
    }),
  }),
  impact: Object.freeze({
    damage: 10,
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      effect({ material: 'water', radius: 5, strength: 210, frames: 2 }),
    ]),
    hit: Object.freeze([
      effect({ material: 'water', radius: 9, strength: 220, frames: 2 }),
    ]),
  }),
});

const WATER_BURST_SKILL = freezeSkill({
  id: 'water_burst',
  name: 'Water Burst',
  element: 'water',
  tags: tagsFor('water', ['area', 'liquid']),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    tier: 1,
    role: 'short-area',
    areaDamage: 6,
  }),
  cooldownMs: 1200,
  targeting: BASE_TARGETING,
  projectile: Object.freeze({
    speed: 360,
    damage: 0,
    radius: 8,
    lifetimeMs: 1500,
    energy: Object.freeze({
      initial: 48,
      max: 48,
      trailIntervalMs: 45,
      trailLeakPerSecond: 0,
      trailEffects: materialTrail('water', { radius: 5, strength: 205, frames: 2 }),
    }),
    visual: Object.freeze({
      color: '#2f88ff',
      coreColor: '#e4f6ff',
      glowColor: 'rgba(47, 136, 255, 0.54)',
    }),
  }),
  impact: Object.freeze({
    areaDamage: Object.freeze({
      radius: 58,
      damage: 6,
    }),
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      effect({ material: 'water', radius: 7, strength: 220, frames: 2 }),
    ]),
    hit: Object.freeze([
      effect({ material: 'water', radius: 14, strength: 240, frames: 4, radialForce: 0.4, expansionFrames: 3 }),
    ]),
  }),
});

const ELECTRIC_BOLT_SKILL = freezeSkill({
  id: 'electric_bolt',
  name: 'Electric Bolt',
  element: 'electric',
  tags: tagsFor('electric', ['weapon', 'projectile', 'single-target', 'fast']),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    tier: 1,
    role: 'single-target',
    directDamage: 14,
  }),
  cooldownMs: 850,
  targeting: BASE_TARGETING,
  projectile: Object.freeze({
    speed: 640,
    damage: 14,
    radius: 5,
    lifetimeMs: 1400,
    energy: Object.freeze({
      initial: 32,
      max: 32,
      trailIntervalMs: 30,
      trailLeakPerSecond: 0,
      trailEffects: materialTrail('electric', { radius: 5, strength: 235, frames: 1, life: 24 }),
    }),
    visual: Object.freeze({
      shape: 'bolt',
      color: '#8be8ff',
      coreColor: '#effcff',
      glowColor: 'rgba(111, 231, 255, 0.48)',
    }),
  }),
  impact: Object.freeze({
    damage: 14,
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      effect({ material: 'electric', radius: 6, strength: 235, frames: 2, life: 24 }),
    ]),
    hit: Object.freeze([
      effect({ material: 'electric', radius: 11, strength: 250, frames: 3, life: 28 }),
    ]),
  }),
});

const SAND_BOLT_SKILL = freezeSkill({
  id: 'sand_bolt',
  name: 'Sand Bolt',
  element: 'sand',
  tags: tagsFor('sand', ['weapon', 'projectile', 'single-target', 'powder']),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    tier: 1,
    role: 'single-target',
    directDamage: 11,
  }),
  cooldownMs: 780,
  targeting: BASE_TARGETING,
  projectile: Object.freeze({
    speed: 470,
    damage: 11,
    radius: 6,
    lifetimeMs: 1900,
    energy: Object.freeze({
      initial: 38,
      max: 38,
      trailIntervalMs: 44,
      trailLeakPerSecond: 0,
      trailEffects: Object.freeze([]),
    }),
    visual: Object.freeze({
      color: '#d9a84a',
      coreColor: '#fff0a6',
      glowColor: 'rgba(217, 168, 74, 0.44)',
    }),
  }),
  impact: Object.freeze({
    damage: 11,
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      effect({ material: 'sand', radius: 5, strength: 190, frames: 2 }),
    ]),
    hit: Object.freeze([
      effect({
        material: 'sand',
        radius: 22,
        strength: 255,
        frames: 3,
        radialForce: 1,
        expansionFrames: 2,
      }),
    ]),
  }),
});

const SAND_BARRAGE_SKILL = freezeSkill({
  id: 'sand_barrage',
  name: 'Sand Barrage',
  element: 'sand',
  tags: tagsFor('sand', ['multi', 'powder']),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    tier: 1,
    role: 'multi-shot',
    projectileCount: 5,
    damageEach: 7,
  }),
  cooldownMs: 850,
  targeting: BASE_TARGETING,
  projectile: Object.freeze({
    speed: 440,
    damage: 7,
    radius: 5,
    lifetimeMs: 1800,
    pattern: Object.freeze({
      type: 'fan',
      count: 5,
      spreadRadians: 0.42,
    }),
    energy: Object.freeze({
      initial: 36,
      max: 36,
      trailIntervalMs: 50,
      trailLeakPerSecond: 0,
      trailEffects: materialTrail('sand', { radius: 4, strength: 180, frames: 1 }),
    }),
    visual: Object.freeze({
      color: '#d9a84a',
      coreColor: '#fff0a6',
      glowColor: 'rgba(217, 168, 74, 0.46)',
    }),
  }),
  impact: Object.freeze({
    damage: 7,
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      effect({ material: 'sand', radius: 6, strength: 190, frames: 2 }),
    ]),
    hit: Object.freeze([
      effect({ material: 'sand', radius: 10, strength: 210, frames: 3 }),
    ]),
  }),
});

const RAIN_FALL_SKILL = freezeSkill({
  id: 'rain_fall',
  name: 'Rain Fall',
  element: 'water',
  tags: tagsFor('water', ['falling-liquid', 'multi']),
  gpuReactionRole: 'base-input-only',
  balance: Object.freeze({
    tier: 2,
    role: 'falling-area',
    projectileCount: 9,
    damageEach: 3,
  }),
  cooldownMs: 1500,
  targeting: BASE_TARGETING,
  projectile: Object.freeze({
    speed: 520,
    damage: 3,
    radius: 4,
    lifetimeMs: 1200,
    pattern: Object.freeze({
      type: 'fallingRain',
      count: 9,
      width: 160,
      offsetY: -120,
      jitterY: 36,
    }),
    energy: Object.freeze({
      initial: 28,
      max: 28,
      trailIntervalMs: 42,
      trailLeakPerSecond: 0,
      trailEffects: materialTrail('water', { radius: 4, strength: 180, frames: 1 }),
    }),
    visual: Object.freeze({
      color: '#5bb7ff',
      coreColor: '#effbff',
      glowColor: 'rgba(79, 172, 255, 0.45)',
    }),
  }),
  impact: Object.freeze({
    areaDamage: Object.freeze({
      radius: 22,
      damage: 2,
    }),
  }),
  materialEffects: Object.freeze({
    cast: Object.freeze([
      effect({ material: 'water', radius: 6, strength: 180, frames: 6 }),
    ]),
    hit: Object.freeze([
      effect({ material: 'water', radius: 8, strength: 205, frames: 2 }),
    ]),
  }),
});

export const SKILL_DEFINITIONS = Object.freeze({
  fireball: FIREBALL_SKILL,
  water_bolt: WATER_BOLT_SKILL,
  water_burst: WATER_BURST_SKILL,
  electric_bolt: ELECTRIC_BOLT_SKILL,
  sand_bolt: SAND_BOLT_SKILL,
  sand_barrage: SAND_BARRAGE_SKILL,
  rain_fall: RAIN_FALL_SKILL,
});

export const BASE_ELEMENT_WEAPON_IDS = Object.freeze([
  'fireball',
  'water_bolt',
  'electric_bolt',
  'sand_bolt',
]);

export function createBaseElementSkillLoadout({ seed = 'default' } = {}) {
  const ids = [...BASE_ELEMENT_WEAPON_IDS];
  const rng = createSeededRandom(seed);

  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }

  return Object.freeze(ids);
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
