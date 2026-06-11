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
      visual: Object.freeze({
        color: '#ff8a2a',
        coreColor: '#fff0a6',
        glowColor: 'rgba(255, 110, 28, 0.58)',
      }),
    }),
    effects: Object.freeze({
      cast: Object.freeze([
        Object.freeze({ material: 'fire', radius: 5, strength: 185, frames: 2 }),
        Object.freeze({ material: 'spark', radius: 3, strength: 150, frames: 2 }),
      ]),
      hit: Object.freeze([
        Object.freeze({ material: 'fire', radius: 10, strength: 245, frames: 4 }),
        Object.freeze({ material: 'spark', radius: 8, strength: 230, frames: 3 }),
        Object.freeze({ material: 'smoke', radius: 13, strength: 165, frames: 5 }),
      ]),
    }),
  }),
});
