import { ENEMY_DEFINITIONS } from './enemies.js';
import { ENEMY_DIFFICULTY_CONFIG } from './enemyDifficulty.js';
import { ENEMY_PATH_PATTERN_DEFINITIONS } from './enemyPathPatterns.js';
import { ENEMY_SPAWN_PATTERN_DEFINITIONS } from './enemySpawnPatterns.js';
import { ITEM_DEFINITIONS, LOOT_DEFINITIONS } from './items.js';
import { SKILL_DEFINITIONS } from './skills.js';
import { PLAYER_SKIN_URLS } from './spriteAssets.js';
import { WAVE_DEFINITIONS } from './waves.js';
import { createSeededWaveSequence } from '../waveRandomizer.js';

export const GAME_CONTENT = Object.freeze({
  enemies: ENEMY_DEFINITIONS,
  player: Object.freeze({
    skinUrls: PLAYER_SKIN_URLS,
  }),
  skills: SKILL_DEFINITIONS,
  waves: WAVE_DEFINITIONS,
  enemyDifficulty: ENEMY_DIFFICULTY_CONFIG,
  enemyPathPatterns: ENEMY_PATH_PATTERN_DEFINITIONS,
  enemySpawnPatterns: ENEMY_SPAWN_PATTERN_DEFINITIONS,
  createWaveSequence: Object.freeze(({ seed, waveCount = 8 } = {}) => createSeededWaveSequence({
    seed,
    waves: WAVE_DEFINITIONS,
    waveCount,
  })),
  items: ITEM_DEFINITIONS,
  loot: LOOT_DEFINITIONS,
});
