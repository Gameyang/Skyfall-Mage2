export const ATTACK_PATTERN_DEFINITIONS = Object.freeze({
  bolt: freezePattern({
    id: 'bolt',
    name: 'Bolt',
    basicStatLabel: 'Projectile speed',
    projectileRadius: 6,
    cooldownMultiplier: 1,
    damageMultiplier: 1,
    rangeMultiplier: 1,
    projectile: ({ stats }) => ({
      speed: stats.projectileSpeed,
    }),
    impact: ({ stats }) => ({
      damage: stats.damage,
    }),
  }),
  fan: freezePattern({
    id: 'fan',
    name: 'Fan',
    basicStatLabel: 'Projectiles',
    projectileRadius: 5,
    cooldownMultiplier: 1.08,
    damageMultiplier: 0.74,
    rangeMultiplier: 0.82,
    projectile: ({ stats }) => ({
      speed: stats.projectileSpeed,
      pattern: {
        type: 'fan',
        count: Math.max(3, stats.projectileCount ?? 5),
        spreadRadians: stats.spreadRadians ?? 0.5,
      },
    }),
    impact: ({ stats }) => ({
      damage: stats.damage,
    }),
  }),
  missile: freezePattern({
    id: 'missile',
    name: 'Missile',
    basicStatLabel: 'Homing',
    projectileRadius: 7,
    cooldownMultiplier: 1.16,
    damageMultiplier: 1.18,
    rangeMultiplier: 1.08,
    projectile: ({ stats }) => ({
      speed: stats.projectileSpeed,
      homing: {
        strengthPerSecond: 4.2,
        turnRateRadiansPerSecond: 7,
      },
    }),
    impact: ({ stats }) => ({
      damage: stats.damage,
      areaDamage: {
        radius: Math.max(18, stats.areaRadius * 0.8),
        damage: Math.round(stats.damage * 0.45),
      },
    }),
  }),
  meteor: freezePattern({
    id: 'meteor',
    name: 'Meteor',
    basicStatLabel: 'Area radius',
    projectileRadius: 9,
    cooldownMultiplier: 1.42,
    damageMultiplier: 1.28,
    rangeMultiplier: 0.9,
    projectile: ({ stats }) => ({
      speed: stats.projectileSpeed,
      pattern: {
        type: 'fallingRain',
        count: 1,
        width: 0,
        offsetY: -180,
        jitterY: 0,
      },
    }),
    impact: ({ stats }) => ({
      areaDamage: {
        radius: stats.areaRadius,
        damage: stats.damage,
      },
    }),
  }),
  rain: freezePattern({
    id: 'rain',
    name: 'Rain',
    basicStatLabel: 'Drops',
    projectileRadius: 4,
    cooldownMultiplier: 1.34,
    damageMultiplier: 0.44,
    rangeMultiplier: 0.95,
    projectile: ({ stats }) => ({
      speed: stats.projectileSpeed,
      pattern: {
        type: 'fallingRain',
        count: Math.max(5, stats.projectileCount ?? 9),
        width: stats.attackRange * 0.32,
        offsetY: -Math.max(120, stats.attackRange * 0.32),
        jitterY: Math.max(24, stats.areaRadius * 0.7),
      },
    }),
    impact: ({ stats }) => ({
      damage: stats.damage,
      areaDamage: {
        radius: Math.max(16, stats.areaRadius * 0.42),
        damage: Math.max(1, Math.round(stats.damage * 0.5)),
      },
    }),
  }),
});

export function getAttackPatternDefinition(patternId) {
  return ATTACK_PATTERN_DEFINITIONS[patternId] || ATTACK_PATTERN_DEFINITIONS.bolt;
}

function freezePattern(pattern) {
  return Object.freeze({
    ...pattern,
  });
}
