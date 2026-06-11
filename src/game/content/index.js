import { ENEMY_DEFINITIONS } from './enemies.js';
import { SKILL_DEFINITIONS } from './skills.js';
import { PLAYER_SKIN_URLS } from './spriteAssets.js';
import { WAVE_DEFINITIONS } from './waves.js';

export const GAME_CONTENT = Object.freeze({
  enemies: ENEMY_DEFINITIONS,
  player: Object.freeze({
    skinUrls: PLAYER_SKIN_URLS,
  }),
  skills: SKILL_DEFINITIONS,
  waves: WAVE_DEFINITIONS,
});
