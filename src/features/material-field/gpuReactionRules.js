export const PRIMARY_GPU_REACTION_RULES = Object.freeze([
  Object.freeze({
    inputA: 'fire',
    inputB: 'water',
    output: 'steam',
    profile: 'risingGas',
    priority: 10,
  }),
  Object.freeze({
    inputA: 'fire',
    inputB: 'electric',
    output: 'spark',
    profile: 'hotFragment',
    priority: 10,
  }),
  Object.freeze({
    inputA: 'fire',
    inputB: 'sand',
    output: 'rock',
    profile: 'heavyFalling',
    priority: 10,
  }),
  Object.freeze({
    inputA: 'water',
    inputB: 'electric',
    output: 'ice',
    profile: 'coldShard',
    priority: 10,
  }),
  Object.freeze({
    inputA: 'water',
    inputB: 'sand',
    output: 'dust',
    profile: 'fallingCloud',
    priority: 10,
  }),
  Object.freeze({
    inputA: 'electric',
    inputB: 'sand',
    output: 'fixedZone',
    profile: 'temporaryField',
    priority: 10,
  }),
]);

export const SECONDARY_GPU_REACTION_RULES = Object.freeze([
  Object.freeze({
    inputA: 'steam',
    inputB: 'electric',
    output: 'chainArc',
    profile: 'visualChainLightning',
    priority: 30,
    feedback: Object.freeze({
      enabled: true,
      damageType: 'chainArc',
      radius: 34,
      damage: 4,
      intensityScale: 0.32,
      maxRecordsPerFrame: 32,
    }),
  }),
  Object.freeze({
    inputA: 'spark',
    inputB: 'sand',
    output: 'chainExplosion',
    profile: 'surfaceBurst',
    priority: 28,
    feedback: Object.freeze({
      enabled: true,
      damageType: 'chainExplosion',
      radius: 30,
      damage: 5,
      intensityScale: 0.3,
      maxRecordsPerFrame: 24,
    }),
  }),
  Object.freeze({
    inputA: 'spark',
    inputB: 'water',
    output: 'laserArc',
    profile: 'angledLaser',
    priority: 27,
    feedback: Object.freeze({
      enabled: true,
      damageType: 'laserArc',
      radius: 24,
      damage: 4,
      intensityScale: 0.26,
      maxRecordsPerFrame: 24,
    }),
  }),
  Object.freeze({
    inputA: 'rock',
    inputB: 'water',
    output: 'pinballRock',
    profile: 'bouncingHeavy',
    priority: 24,
    feedback: Object.freeze({
      enabled: true,
      damageType: 'pinballRock',
      radius: 22,
      damage: 6,
      intensityScale: 0.24,
      maxRecordsPerFrame: 18,
    }),
  }),
  Object.freeze({
    inputA: 'rock',
    inputB: 'electric',
    output: 'lightningRock',
    profile: 'chargedHeavy',
    priority: 23,
    feedback: Object.freeze({
      enabled: true,
      damageType: 'lightningRock',
      radius: 26,
      damage: 5,
      intensityScale: 0.24,
      maxRecordsPerFrame: 18,
    }),
  }),
  Object.freeze({
    inputA: 'ice',
    inputB: 'fire',
    output: 'iceBurst',
    profile: 'shatteringShard',
    priority: 22,
    feedback: Object.freeze({
      enabled: true,
      damageType: 'iceBurst',
      radius: 28,
      damage: 5,
      intensityScale: 0.22,
      maxRecordsPerFrame: 18,
    }),
  }),
  Object.freeze({
    inputA: 'ice',
    inputB: 'sand',
    output: 'blizzard',
    profile: 'fallingStorm',
    priority: 18,
    feedback: Object.freeze({
      enabled: false,
    }),
  }),
  Object.freeze({
    inputA: 'dust',
    inputB: 'fire',
    output: 'fireDust',
    profile: 'heatedDust',
    priority: 16,
    feedback: Object.freeze({
      enabled: false,
    }),
  }),
  Object.freeze({
    inputA: 'dust',
    inputB: 'electric',
    output: 'chargedDust',
    profile: 'chargedDust',
    priority: 16,
    feedback: Object.freeze({
      enabled: false,
    }),
  }),
  Object.freeze({
    inputA: 'fixedZone',
    inputB: 'fire',
    output: 'amplifyZone',
    profile: 'attackAmplifier',
    priority: 14,
    feedback: Object.freeze({
      enabled: false,
    }),
  }),
  Object.freeze({
    inputA: 'fixedZone',
    inputB: 'water',
    output: 'slowZone',
    profile: 'slowField',
    priority: 14,
    feedback: Object.freeze({
      enabled: false,
    }),
  }),
  Object.freeze({
    inputA: 'fixedZone',
    inputB: 'sand',
    output: 'gravityZone',
    profile: 'heavyField',
    priority: 14,
    feedback: Object.freeze({
      enabled: false,
    }),
  }),
]);

export const GPU_REACTION_RULES = Object.freeze([
  ...PRIMARY_GPU_REACTION_RULES,
  ...SECONDARY_GPU_REACTION_RULES,
]);

export function getReactionOutput(inputA, inputB, rules = GPU_REACTION_RULES) {
  const normalizedA = normalizeMaterialId(inputA);
  const normalizedB = normalizeMaterialId(inputB);
  return rules.find((rule) => (
    (rule.inputA === normalizedA && rule.inputB === normalizedB) ||
    (rule.inputA === normalizedB && rule.inputB === normalizedA)
  )) || null;
}

export function compileGpuReactionRules(rules = GPU_REACTION_RULES, materialIds = {}) {
  return rules.map((rule) => Object.freeze({
    inputA: materialIds[rule.inputA] ?? -1,
    inputB: materialIds[rule.inputB] ?? -1,
    output: materialIds[rule.output] ?? -1,
    priority: rule.priority ?? 0,
    feedbackEnabled: Boolean(rule.feedback?.enabled),
    feedbackDamage: rule.feedback?.damage ?? 0,
    feedbackRadius: rule.feedback?.radius ?? 0,
  }));
}

function normalizeMaterialId(materialId) {
  return String(materialId || '').trim();
}
