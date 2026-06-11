import { ENEMY_SPRITES } from './spriteAssets.js';

export const ENEMY_DEFINITIONS = Object.freeze({
  normalBat: Object.freeze({
    id: 'normalBat',
    hp: 30,
    speed: 86,
    radius: 18,
    spriteUrl: ENEMY_SPRITES.bat,
    spriteSize: 52,
    contactDamage: 12,
    path: Object.freeze({
      amplitude: 58,
      frequency: 2.15,
      margin: 44,
    }),
  }),
});
