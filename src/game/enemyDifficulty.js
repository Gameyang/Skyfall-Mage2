import { ENEMY_DIFFICULTY_CONFIG } from './content/enemyDifficulty.js';
import { clamp } from './math.js';

export function createDifficultyContext({ waveIndex = 1, elapsedMs = 0, config = ENEMY_DIFFICULTY_CONFIG } = {}) {
  const normalizedWaveIndex = Math.max(1, Math.floor(waveIndex || 1));
  const progression = Math.max(0, normalizedWaveIndex - 1);

  return {
    waveIndex: normalizedWaveIndex,
    elapsedMs: Math.max(0, elapsedMs || 0),
    tier: getDifficultyTier(normalizedWaveIndex),
    hpMultiplier: clamp(1 + progression * (config.hpPerWave ?? 0), 1, config.maxHpMultiplier ?? 8),
    speedMultiplier: clamp(1 + progression * (config.speedPerWave ?? 0), 1, config.maxSpeedMultiplier ?? 2),
    contactDamageMultiplier: clamp(
      1 + progression * (config.damagePerWave ?? 0),
      1,
      config.maxContactDamageMultiplier ?? 4,
    ),
    countMultiplier: 1 + Math.floor(progression / Math.max(1, config.countBonusEveryWaves ?? 4)) * (config.countBonusRatio ?? 0),
    maxActiveEnemies: Math.max(1, config.maxActiveEnemies ?? 100),
    fieldPressureEnemyLimit: Math.max(1, config.fieldPressureEnemyLimit ?? 72),
    maxWaveDelayMs: Math.max(0, config.maxWaveDelayMs ?? 5000),
  };
}

export function getDifficultyTier(waveIndex) {
  if (waveIndex <= 3) return 'intro';
  if (waveIndex <= 7) return 'early';
  if (waveIndex <= 12) return 'mid';
  if (waveIndex <= 18) return 'late';
  return 'endless';
}

export function scaleEnemyDefinition(definition, difficulty, scaling = {}) {
  const hpMultiplier = (difficulty?.hpMultiplier ?? 1) * (scaling.hpMultiplier ?? 1);
  const speedMultiplier = (difficulty?.speedMultiplier ?? 1) * (scaling.speedMultiplier ?? 1);
  const contactDamageMultiplier = (difficulty?.contactDamageMultiplier ?? 1) * (scaling.contactDamageMultiplier ?? 1);

  return {
    ...definition,
    hp: Math.max(1, Math.round((definition.hp ?? 1) * hpMultiplier)),
    speed: Math.max(1, (definition.speed ?? 1) * speedMultiplier),
    contactDamage: Math.max(0, Math.round((definition.contactDamage ?? 1) * contactDamageMultiplier)),
  };
}

export function scaleSpawnCount(count, difficulty, scaling = {}) {
  const baseCount = Math.max(1, Math.floor(count || 1));
  const multiplier = (difficulty?.countMultiplier ?? 1) * (scaling.countMultiplier ?? 1);
  return Math.max(1, Math.round(baseCount * multiplier));
}
