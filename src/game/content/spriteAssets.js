import batSpriteUrl from '../../assets/imported/enemy/bat.webp?url';

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
