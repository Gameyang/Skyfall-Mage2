export const SKILL_DEFINITIONS = Object.freeze({
  fireball: Object.freeze({
    id: 'fireball',
    cooldownMs: 1000,
    targeting: Object.freeze({
      type: 'progress-risk',
    }),
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
          Object.freeze({ material: 'fire', profile: 'projectileFire', life: 16, radius: 4, strength: 600, frames: 1 }),
        ]),
        explosion: Object.freeze({
          minRadius: 24,
          maxRadius: 58,
          minDamage: 8,
          maxDamage: 22,
          materialEffects: Object.freeze([
            Object.freeze({ material: 'fire', radiusScale: 0.58, strength: 255, frames: 6, explosion: true }),
            Object.freeze({ material: 'spark', radiusScale: 0.42, strength: 235, frames: 4, explosion: true }),
            Object.freeze({ material: 'smoke', life: 10, radiusScale: 0.62, strength: 145, frames: 2, explosion: true }),
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
      damage: 8,
    }),
    materialEffects: Object.freeze({
      cast: Object.freeze([
        Object.freeze({ material: 'fire', profile: 'projectileFire', life: 18, radius: 5, strength: 210, frames: 2 }),
      ]),
      hit: Object.freeze([]),
    }),
  }),
});
