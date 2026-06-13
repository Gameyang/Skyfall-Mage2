import { ENEMY_DIFFICULTY_CONFIG } from './enemyDifficulty.js';
import { ENEMY_PATH_PATTERN_DEFINITIONS } from './enemyPathPatterns.js';
import { ENEMY_SPAWN_PATTERN_DEFINITIONS } from './enemySpawnPatterns.js';
import { createBaseElementSkillLoadout, SKILL_DEFINITIONS } from './skills.js';
import { WAVE_DEFINITIONS } from './waves.js';
import { createSeededWaveSequence } from '../waveRandomizer.js';

export const HEADLESS_ENEMY_DEFINITIONS = Object.freeze({
  normalBat: Object.freeze({
    id: 'normalBat',
    hp: 30,
    speed: 86,
    radius: 16,
    spriteUrl: null,
    spriteSize: 32,
    contactDamage: 10,
    path: Object.freeze({
      amplitude: 58,
      frequency: 2.15,
      margin: 44,
    }),
  }),
  fastBat: Object.freeze({
    id: 'fastBat',
    hp: 18,
    speed: 126,
    radius: 16,
    spriteUrl: null,
    spriteSize: 32,
    contactDamage: 8,
    defaultPathPatternId: 'straight',
    tags: Object.freeze(['fast', 'small']),
    path: Object.freeze({
      amplitude: 42,
      frequency: 2.4,
      margin: 44,
    }),
  }),
  heavyBat: Object.freeze({
    id: 'heavyBat',
    hp: 70,
    speed: 62,
    radius: 16,
    spriteUrl: null,
    spriteSize: 32,
    contactDamage: 15,
    defaultPathPatternId: 'sCurve',
    tags: Object.freeze(['heavy']),
    path: Object.freeze({
      amplitude: 46,
      frequency: 1.65,
      margin: 48,
    }),
  }),
  eliteBat: Object.freeze({
    id: 'eliteBat',
    hp: 210,
    speed: 74,
    radius: 16,
    spriteUrl: null,
    spriteSize: 32,
    contactDamage: 22,
    scoreValue: 6,
    defaultPathPatternId: 'sCurve',
    tags: Object.freeze(['elite']),
    path: Object.freeze({
      amplitude: 72,
      frequency: 1.85,
      margin: 56,
    }),
  }),
});

export const HEADLESS_GAME_CONTENT = Object.freeze({
  enemies: HEADLESS_ENEMY_DEFINITIONS,
  player: Object.freeze({
    skinUrls: Object.freeze([]),
  }),
  skills: SKILL_DEFINITIONS,
  createSkillLoadout: createBaseElementSkillLoadout,
  waves: WAVE_DEFINITIONS,
  enemyDifficulty: ENEMY_DIFFICULTY_CONFIG,
  enemyPathPatterns: ENEMY_PATH_PATTERN_DEFINITIONS,
  enemySpawnPatterns: ENEMY_SPAWN_PATTERN_DEFINITIONS,
  createWaveSequence: Object.freeze(({ seed, waveCount = 8 } = {}) => createSeededWaveSequence({
    seed,
    waves: WAVE_DEFINITIONS,
    waveCount,
  })),
  items: Object.freeze({}),
  loot: Object.freeze({
    enemyDrops: Object.freeze([]),
  }),
});
