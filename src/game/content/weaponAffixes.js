export const RARITY_ORDER = Object.freeze(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']);

export const RARITY_CONFIG = Object.freeze({
  Common: Object.freeze({
    statMultiplier: 1,
    costMultiplier: 1,
    affixCount: [4, 4],
    minWave: 1,
  }),
  Uncommon: Object.freeze({
    statMultiplier: 1.18,
    costMultiplier: 1.14,
    affixCount: [4, 5],
    minWave: 3,
  }),
  Rare: Object.freeze({
    statMultiplier: 1.42,
    costMultiplier: 1.32,
    affixCount: [5, 5],
    minWave: 6,
  }),
  Epic: Object.freeze({
    statMultiplier: 1.75,
    costMultiplier: 1.58,
    affixCount: [5, 6],
    minWave: 10,
  }),
  Legendary: Object.freeze({
    statMultiplier: 2.15,
    costMultiplier: 1.9,
    affixCount: [6, 6],
    minWave: 14,
  }),
});

export const WEAPON_AFFIX_DEFINITIONS = Object.freeze({
  prefix_sharp: freezeAffix({
    id: 'prefix_sharp',
    name: 'Sharp',
    kind: 'prefix',
    minRarity: 'Common',
    tags: ['damage'],
    modifiers: {
      damageMultiplier: [1.1, 1.18],
    },
    summary: ({ modifiers }) => `Damage +${formatPercent(modifiers.damageMultiplier - 1)}`,
  }),
  prefix_quick: freezeAffix({
    id: 'prefix_quick',
    name: 'Quick',
    kind: 'prefix',
    minRarity: 'Uncommon',
    tags: ['cooldown'],
    modifiers: {
      cooldownMultiplier: [0.88, 0.94],
    },
    summary: ({ modifiers }) => `Cooldown -${formatPercent(1 - modifiers.cooldownMultiplier)}`,
  }),
  prefix_longshot: freezeAffix({
    id: 'prefix_longshot',
    name: 'Longshot',
    kind: 'prefix',
    minRarity: 'Common',
    tags: ['range'],
    modifiers: {
      attackRangeMultiplier: [1.1, 1.18],
    },
    summary: ({ modifiers }) => `Range +${formatPercent(modifiers.attackRangeMultiplier - 1)}`,
  }),
  suffix_steady: freezeAffix({
    id: 'suffix_steady',
    name: 'of Rhythm',
    kind: 'suffix',
    minRarity: 'Common',
    tags: ['cooldown'],
    modifiers: {
      cooldownMultiplier: [0.94, 0.97],
    },
    summary: ({ modifiers }) => `Cooldown -${formatPercent(1 - modifiers.cooldownMultiplier)}`,
  }),
  prefix_blooming: freezeAffix({
    id: 'prefix_blooming',
    name: 'Blooming',
    kind: 'prefix',
    minRarity: 'Rare',
    tags: ['area'],
    modifiers: {
      areaRadiusMultiplier: [1.12, 1.25],
    },
    summary: ({ modifiers }) => `Area +${formatPercent(modifiers.areaRadiusMultiplier - 1)}`,
  }),
  suffix_swift: freezeAffix({
    id: 'suffix_swift',
    name: 'of Swiftness',
    kind: 'suffix',
    minRarity: 'Common',
    tags: ['projectile'],
    modifiers: {
      projectileSpeedMultiplier: [1.08, 1.2],
    },
    summary: ({ modifiers }) => `Projectile speed +${formatPercent(modifiers.projectileSpeedMultiplier - 1)}`,
  }),
  suffix_split: freezeAffix({
    id: 'suffix_split',
    name: 'of Splitting',
    kind: 'suffix',
    minRarity: 'Rare',
    tags: ['projectile', 'multi'],
    modifiers: {
      projectileCountAdd: [1, 1],
      damageMultiplier: [0.92, 0.92],
    },
    summary: () => 'Projectiles +1, damage -8%',
  }),
  suffix_bursting: freezeAffix({
    id: 'suffix_bursting',
    name: 'of Bursting',
    kind: 'suffix',
    minRarity: 'Rare',
    tags: ['area', 'damage'],
    modifiers: {
      areaRadiusMultiplier: [1.15, 1.24],
      damageMultiplier: [1.04, 1.08],
    },
    summary: ({ modifiers }) => `Area +${formatPercent(modifiers.areaRadiusMultiplier - 1)}`,
  }),
  suffix_focus: freezeAffix({
    id: 'suffix_focus',
    name: 'of Focus',
    kind: 'suffix',
    minRarity: 'Rare',
    tags: ['damage', 'element'],
    modifiers: {
      damageMultiplier: [1.08, 1.16],
    },
    summary: ({ modifiers }) => `Element damage +${formatPercent(modifiers.damageMultiplier - 1)}`,
  }),
});

export function getRarityRank(rarity) {
  return Math.max(0, RARITY_ORDER.indexOf(rarity));
}

export function isRarityAtLeast(rarity, minimum) {
  return getRarityRank(rarity) >= getRarityRank(minimum);
}

export function getRarityConfig(rarity) {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG.Common;
}

function freezeAffix(affix) {
  return Object.freeze({
    ...affix,
    tags: Object.freeze(affix.tags || []),
    modifiers: Object.freeze(affix.modifiers || {}),
  });
}

function formatPercent(ratio) {
  return `${Math.round(ratio * 100)}%`;
}
