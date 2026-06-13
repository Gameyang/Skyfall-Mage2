import batSpriteUrl from '../../assets/imported/enemy/bat.webp?url';
import blizzardStaffSpriteUrl from '../../assets/imported/items/blizzard_staff.webp?url';
import chainLightningStaffSpriteUrl from '../../assets/imported/items/chain_lightning_staff.webp?url';
import coinSpriteUrl from '../../assets/imported/items/coin.webp?url';
import fireFanStaffSpriteUrl from '../../assets/imported/items/fire_fan_staff.webp?url';
import fireMeteorStaffSpriteUrl from '../../assets/imported/items/fire_meteor_staff.webp?url';
import fireMissileStaffSpriteUrl from '../../assets/imported/items/fire_missile_staff.webp?url';
import fireStaffSpriteUrl from '../../assets/imported/items/fire_staff.webp?url';
import hpPotionSpriteUrl from '../../assets/imported/items/hp_potion_1.webp?url';
import lightningStrikeStaffSpriteUrl from '../../assets/imported/items/lightning_strike_staff.webp?url';
import thunderDashStaffSpriteUrl from '../../assets/imported/items/thunder_dash_staff.webp?url';

const playerSkinModules = import.meta.glob('../../assets/imported/skins/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

export const PLAYER_SKIN_URLS = Object.freeze(
  Object.entries(playerSkinModules)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, url]) => url),
);

export const ENEMY_SPRITES = Object.freeze({
  bat: batSpriteUrl,
});

export const ITEM_SPRITES = Object.freeze({
  coin: coinSpriteUrl,
  hpPotion: hpPotionSpriteUrl,
});

export const WEAPON_SPRITES = Object.freeze({
  blizzard_staff: blizzardStaffSpriteUrl,
  chain_lightning_staff: chainLightningStaffSpriteUrl,
  fire_fan_staff: fireFanStaffSpriteUrl,
  fire_meteor_staff: fireMeteorStaffSpriteUrl,
  fire_missile_staff: fireMissileStaffSpriteUrl,
  fire_staff: fireStaffSpriteUrl,
  lightning_strike_staff: lightningStrikeStaffSpriteUrl,
  thunder_dash_staff: thunderDashStaffSpriteUrl,
});
