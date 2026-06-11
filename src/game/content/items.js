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
  hpPotion: Object.freeze({
    id: 'hpPotion',
    name: 'HP Potion',
    spriteUrl: ITEM_SPRITES.hpPotion,
    radius: 11,
    pickupRadius: 26,
    spriteSize: 30,
    tailSize: 25,
    stackable: true,
    consumable: Object.freeze({
      type: 'heal',
      healFraction: 0.3,
      autoUseHpRatio: 0.5,
    }),
    visual: Object.freeze({
      fill: '#e84d5b',
      stroke: '#8f1f36',
      shine: '#ffd1d6',
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
    Object.freeze({
      itemId: 'hpPotion',
      chance: 0.05,
      quantity: 1,
    }),
  ]),
});
