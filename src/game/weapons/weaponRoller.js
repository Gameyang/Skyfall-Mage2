import { ATTACK_PATTERN_DEFINITIONS, getAttackPatternDefinition } from '../content/attackPatterns.js';
import { WEAPON_AFFIX_DEFINITIONS, RARITY_ORDER, getRarityConfig, getRarityRank, isRarityAtLeast } from '../content/weaponAffixes.js';
import { STARTER_WEAPON_DEFINITION_IDS, WEAPON_DEFINITIONS } from '../content/weapons.js';

const BASIC_REVEAL_COSTS = Object.freeze([4, 5, 6, 7, 8]);
const AFFIX_REVEAL_COSTS = Object.freeze([10, 16, 24, 36, 52, 74]);
const PANEL_QUADRANTS = Object.freeze(['topLeft', 'topRight', 'bottomLeft', 'bottomRight']);
const MVP_MAX_RARITY = 'Epic';

export function createStarterWeaponState({ content = {}, seed = 'starter' } = {}) {
  const definitions = content.weapons || WEAPON_DEFINITIONS;
  const ids = (content.starterWeaponDefinitionIds || STARTER_WEAPON_DEFINITION_IDS)
    .filter((definitionId) => definitions[definitionId])
    .slice(0, 3);
  const weaponInstancesById = {};
  const equippedWeaponInstanceIds = [null, null, null];

  ids.forEach((definitionId, slotIndex) => {
    const definition = definitions[definitionId];
    const instance = createStarterWeaponInstance(definition, {
      seed: `${seed}:starter:${definitionId}:${slotIndex}`,
      slotIndex,
    });
    weaponInstancesById[instance.instanceId] = instance;
    equippedWeaponInstanceIds[slotIndex] = instance.instanceId;
  });

  return {
    equippedWeaponInstanceIds,
    inventoryWeaponInstanceIds: [],
    weaponInstancesById,
    equippedRuntime: equippedWeaponInstanceIds.map((instanceId, slotIndex) => ({
      slotIndex,
      weaponInstanceId: instanceId,
      cooldownRemainingMs: 0,
      cooldownStarted: false,
    })),
    attackSequenceIndex: 0,
  };
}

export function createRevealPanels({ waveIndex = 1, seed = 'reveal', content = {} } = {}) {
  const rng = createSeededRandom(`${seed}:wave:${waveIndex}`);
  const definitions = content.weapons || WEAPON_DEFINITIONS;
  const usedDefinitionIds = new Set();
  const usedElements = new Map();
  const panels = [];

  for (let panelIndex = 0; panelIndex < 4; panelIndex += 1) {
    const rarity = rollRarity(waveIndex, rng, panelIndex);
    const definition = chooseWeaponDefinition({
      definitions,
      rarity,
      waveIndex,
      rng,
      usedDefinitionIds,
      usedElements,
    });
    const instance = rollWeaponInstance({
      definition,
      rarity,
      level: waveIndex,
      waveIndex,
      seed: `${seed}:wave:${waveIndex}:panel:${panelIndex}`,
      rng,
      content,
    });
    const rows = createRevealRows({
      instance,
      definition,
      waveIndex,
      rarity,
      content,
      rng,
    });

    usedDefinitionIds.add(definition.id);
    usedElements.set(definition.baseElement, (usedElements.get(definition.baseElement) || 0) + 1);
    panels.push({
      panelId: `reveal-${waveIndex}-${panelIndex}-${hashString(instance.seed).toString(36)}`,
      weaponInstanceId: instance.instanceId,
      weaponInstance: instance,
      quadrant: PANEL_QUADRANTS[panelIndex],
      rows,
      activeRowIndex: 0,
      claimState: 'locked',
    });
  }

  return panels;
}

export function rollWeaponInstance({
  definition,
  rarity = 'Common',
  level = 1,
  waveIndex = 1,
  seed = 'weapon',
  rng = createSeededRandom(seed),
  content = {},
  source = 'revealPanel',
} = {}) {
  const rarityConfig = getRarityConfig(rarity);
  const waveMultiplier = 1 + Math.max(0, waveIndex - 1) * 0.045;
  const rolledStats = {};
  for (const [key, range] of Object.entries(definition.baseStats || {})) {
    const value = rollRange(range, rng) * rarityConfig.statMultiplier * waveMultiplier;
    rolledStats[key] = normalizeStatValue(key, value);
  }

  const hiddenAffixes = rollAffixes({
    definition,
    rarity,
    waveIndex,
    rng,
    affixes: content.weaponAffixes || WEAPON_AFFIX_DEFINITIONS,
  });

  return {
    instanceId: `${definition.id}-${hashString(`${seed}:${definition.id}`).toString(36)}`,
    definitionId: definition.id,
    displayName: definition.name,
    spriteUrl: definition.spriteUrl ?? null,
    spriteSize: definition.spriteSize ?? 30,
    rarity,
    level,
    rolledStats,
    affixes: [],
    hiddenAffixes,
    uniqueEffectId: null,
    revealCostBudget: 0,
    seed,
    createdAtWave: waveIndex,
    source,
    powerScore: calculatePowerScore(rolledStats, hiddenAffixes),
  };
}

export function cloneWeaponInstance(instance) {
  return {
    ...instance,
    rolledStats: { ...instance.rolledStats },
    affixes: (instance.affixes || []).map(cloneAffix),
    hiddenAffixes: (instance.hiddenAffixes || []).map(cloneAffix),
  };
}

export function getBasicRevealRowCount(panel) {
  return (panel?.rows || []).filter((row) => row.type === 'basicStat').length;
}

function createStarterWeaponInstance(definition, { seed, slotIndex }) {
  const rng = createSeededRandom(seed);
  const rolledStats = {};
  for (const [key, range] of Object.entries(definition.baseStats || {})) {
    rolledStats[key] = normalizeStatValue(key, rollRange(range, rng));
  }

  return {
    instanceId: `starter-${slotIndex}-${definition.id}`,
    definitionId: definition.id,
    displayName: `Novice ${definition.name}`,
    spriteUrl: definition.spriteUrl ?? null,
    spriteSize: definition.spriteSize ?? 30,
    rarity: 'Common',
    level: 1,
    rolledStats,
    affixes: [],
    hiddenAffixes: [],
    uniqueEffectId: null,
    revealCostBudget: 0,
    seed,
    createdAtWave: 0,
    source: 'debug',
    powerScore: calculatePowerScore(rolledStats, []),
  };
}

function createRevealRows({ instance, definition, waveIndex, rarity, content, rng }) {
  const pattern = getAttackPatternDefinition(definition.attackPattern);
  const basicCosts = BASIC_REVEAL_COSTS.map((cost) => scaleRevealCost(cost, waveIndex, rarity, false));
  const rows = [
    createRevealRow({
      rowId: 'basic-identity',
      type: 'basicStat',
      label: 'Base',
      revealCost: basicCosts[0],
      valueText: `${titleCase(definition.baseElement)} / ${pattern.name}`,
    }),
    createRevealRow({
      rowId: 'basic-damage',
      type: 'basicStat',
      label: 'Damage',
      revealCost: basicCosts[1],
      statKey: 'damage',
      valueText: String(instance.rolledStats.damage),
    }),
    createRevealRow({
      rowId: 'basic-cooldown',
      type: 'basicStat',
      label: 'Cooldown',
      revealCost: basicCosts[2],
      statKey: 'cooldownMs',
      valueText: `${(instance.rolledStats.cooldownMs / 1000).toFixed(2)}s`,
    }),
    createRevealRow({
      rowId: 'basic-range',
      type: 'basicStat',
      label: 'Range',
      revealCost: basicCosts[3],
      statKey: 'attackRange',
      valueText: String(instance.rolledStats.attackRange),
    }),
    createRevealRow({
      rowId: 'basic-pattern',
      type: 'basicStat',
      label: pattern.basicStatLabel,
      revealCost: basicCosts[4],
      statKey: getPatternStatKey(definition.attackPattern),
      valueText: formatPatternStat(definition.attackPattern, instance.rolledStats),
    }),
  ];

  instance.revealCostBudget = basicCosts.reduce((total, cost) => total + cost, 0);

  const affixCosts = AFFIX_REVEAL_COSTS.map((cost) => scaleRevealCost(cost, waveIndex, rarity, true));
  for (let index = 0; index < instance.hiddenAffixes.length; index += 1) {
    const affix = instance.hiddenAffixes[index];
    const cost = affixCosts[Math.min(index, affixCosts.length - 1)];
    rows.push(createRevealRow({
      rowId: `affix-${index + 1}`,
      type: 'affix',
      label: `Affix ${index + 1}`,
      revealCost: cost,
      affixId: affix.affixId,
      valueText: affix.summary,
    }));
  }

  if (content.forceRevealForTests) {
    rows.forEach((row) => {
      if (rng() >= 2) row.revealed = true;
    });
  }

  return rows;
}

function createRevealRow({ rowId, type, label, revealCost, valueText, statKey, affixId }) {
  return {
    rowId,
    type,
    label,
    labelWhenLocked: '???',
    revealCost,
    revealProgress: 0,
    revealed: false,
    valueText,
    statKey,
    affixId,
  };
}

function rollRarity(waveIndex, rng, panelIndex) {
  const maxRank = Math.min(getRarityRank(MVP_MAX_RARITY), getMaxRarityRankForWave(waveIndex));
  const candidates = RARITY_ORDER
    .filter((rarity) => getRarityRank(rarity) <= maxRank)
    .filter((rarity) => waveIndex >= getRarityConfig(rarity).minWave);
  const weights = candidates.map((rarity) => {
    const rank = getRarityRank(rarity);
    const baseWeight = [68, 24, 8, 2, 0][rank] ?? 0;
    const wavePush = Math.max(0, waveIndex - getRarityConfig(rarity).minWave) * (rank + 1) * 0.35;
    const panelBias = panelIndex === 3 && rank > 0 ? 1.5 : 1;
    return Math.max(0.1, (baseWeight + wavePush) * panelBias);
  });
  return chooseWeighted(candidates, weights, rng) || 'Common';
}

function getMaxRarityRankForWave(waveIndex) {
  if (waveIndex >= 10) return getRarityRank('Epic');
  if (waveIndex >= 6) return getRarityRank('Rare');
  if (waveIndex >= 3) return getRarityRank('Uncommon');
  return getRarityRank('Common');
}

function chooseWeaponDefinition({ definitions, rarity, waveIndex, rng, usedDefinitionIds, usedElements }) {
  const candidates = Object.values(definitions).filter((definition) => (
    definition.minWave <= waveIndex &&
    isRarityAtLeast(rarity, definition.minRarity || 'Common')
  ));
  const selectable = candidates.length ? candidates : Object.values(definitions);
  const weights = selectable.map((definition) => {
    let weight = 1;
    if (usedDefinitionIds.has(definition.id)) weight *= 0.18;
    const elementCount = usedElements.get(definition.baseElement) || 0;
    if (elementCount > 0) weight *= 1 / (1 + elementCount * 1.4);
    if (definition.minWave >= waveIndex - 1) weight *= 1.2;
    return weight;
  });
  return chooseWeighted(selectable, weights, rng) || selectable[0];
}

function rollAffixes({ definition, rarity, rng, affixes }) {
  const rarityConfig = getRarityConfig(rarity);
  const [minCount, maxCount] = rarityConfig.affixCount;
  const count = Math.max(4, Math.min(6, minCount + Math.floor(rng() * (maxCount - minCount + 1))));
  const allowedTags = new Set(definition.allowedAffixTags || []);
  const candidates = Object.values(affixes).filter((affix) => (
    isRarityAtLeast(rarity, affix.minRarity || 'Common') &&
    affix.tags.some((tag) => allowedTags.has(tag))
  ));
  const pool = [...candidates];
  const rolled = [];

  while (rolled.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    const [affixDefinition] = pool.splice(index, 1);
    rolled.push(rollAffix(affixDefinition, rarity, rng));
  }

  return rolled;
}

function rollAffix(definition, rarity, rng) {
  const modifiers = {};
  for (const [key, range] of Object.entries(definition.modifiers || {})) {
    const rolled = rollRange(range, rng);
    modifiers[key] = key.endsWith('Add') ? Math.round(rolled) : Number(rolled.toFixed(3));
  }
  const affix = {
    affixId: definition.id,
    name: definition.name,
    kind: definition.kind,
    rarity,
    tags: [...definition.tags],
    modifiers,
  };
  affix.summary = typeof definition.summary === 'function'
    ? definition.summary(affix)
    : definition.name;
  return affix;
}

function cloneAffix(affix) {
  return {
    ...affix,
    tags: [...(affix.tags || [])],
    modifiers: { ...(affix.modifiers || {}) },
  };
}

function rollRange(range, rng) {
  if (!Array.isArray(range)) return Number(range) || 0;
  const [min, max] = range;
  if (min === max) return min;
  return min + (max - min) * rng();
}

function normalizeStatValue(key, value) {
  if (key === 'spreadRadians') return Number(value.toFixed(3));
  return Math.max(0, Math.round(value));
}

function scaleRevealCost(baseCost, waveIndex, rarity, isAffix) {
  const rarityMultiplier = getRarityConfig(rarity).costMultiplier;
  const waveMultiplier = 1 + Math.max(0, waveIndex - 1) * (isAffix ? 0.08 : 0.045);
  return Math.max(1, Math.round(baseCost * rarityMultiplier * waveMultiplier));
}

function getPatternStatKey(patternId) {
  if (patternId === 'fan' || patternId === 'rain') return 'projectileCount';
  if (patternId === 'meteor') return 'areaRadius';
  if (patternId === 'missile') return 'projectileSpeed';
  return 'projectileSpeed';
}

function formatPatternStat(patternId, stats) {
  if (patternId === 'fan') return `${stats.projectileCount} shots`;
  if (patternId === 'rain') return `${stats.projectileCount} drops`;
  if (patternId === 'meteor') return String(stats.areaRadius);
  if (patternId === 'missile') return `Speed ${stats.projectileSpeed}`;
  return String(stats.projectileSpeed);
}

function calculatePowerScore(stats, affixes) {
  const cooldownScore = 120000 / Math.max(250, stats.cooldownMs || 1000);
  const directScore = (stats.damage || 0) * (stats.projectileCount || 1);
  const rangeScore = (stats.attackRange || 0) * 0.03;
  const areaScore = (stats.areaRadius || 0) * 0.12;
  return Math.round(directScore + cooldownScore + rangeScore + areaScore + (affixes?.length || 0) * 7);
}

function chooseWeighted(items, weights, rng) {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return items[0] || null;
  let roll = rng() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= Math.max(0, weights[index]);
    if (roll > 0) continue;
    return items[index];
  }
  return items[items.length - 1] || null;
}

function titleCase(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function createSeededRandom(seed) {
  let value = hashString(String(seed)) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 100000) / 100000;
  };
}

export function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
