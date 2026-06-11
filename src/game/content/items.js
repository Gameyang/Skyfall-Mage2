import { ITEM_SPRITES } from './spriteAssets.js';

export const ITEM_DEFINITIONS = Object.freeze({
  coin: Object.freeze({
    id: 'coin',
    name: 'Coin',
    spriteUrl: ITEM_SPRITES.coin,
    radius: 11,
    pickupRadius: 26,
    spriteSize: 28,
    tailSize: 24,
    stackable: true,
    visual: Object.freeze({
      fill: '#f7c948',
      stroke: '#b7791f',
      shine: '#fff3a3',
    }),
  }),
});

export const LOOT_DEFINITIONS = Object.freeze({
  enemyDrops: Object.freeze([
    Object.freeze({
      itemId: 'coin',
      chance: 0.7,
      quantity: 1,
    }),
  ]),
});
