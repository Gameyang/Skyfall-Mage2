import { getAttackPatternDefinition } from '../content/attackPatterns.js';

const ELEMENT_VISUALS = Object.freeze({
  fire: Object.freeze({
    color: '#ff8a2a',
    coreColor: '#fff0a6',
    glowColor: 'rgba(255, 110, 28, 0.58)',
    material: 'fire',
    trailProfile: 'projectileFire',
  }),
  water: Object.freeze({
    color: '#4aa7ff',
    coreColor: '#effbff',
    glowColor: 'rgba(74, 167, 255, 0.5)',
    material: 'water',
  }),
  electric: Object.freeze({
    shape: 'bolt',
    color: '#8be8ff',
    coreColor: '#effcff',
    glowColor: 'rgba(111, 231, 255, 0.48)',
    material: 'electric',
  }),
  sand: Object.freeze({
    color: '#d9a84a',
    coreColor: '#fff0a6',
    glowColor: 'rgba(217, 168, 74, 0.44)',
    material: 'sand',
  }),
});

export function buildWeaponRuntimeSkill(instance, content = {}) {
  const definition = content.weapons?.[instance.definitionId];
  if (!definition) return null;

  const pattern = getAttackPatternDefinition(definition.attackPattern);
  const elementVisual = ELEMENT_VISUALS[definition.baseElement] || ELEMENT_VISUALS.fire;
  const stats = applyPatternMultipliers(
    applyAffixes(instance.rolledStats, instance.affixes || []),
    pattern,
  );
  const projectilePatch = pattern.projectile({ stats, definition, instance });
  const speed = Math.max(1, projectilePatch.speed ?? stats.projectileSpeed);
  const lifetimeMs = Math.max(320, Math.round((stats.attackRange / speed) * 1000));
  const impact = pattern.impact({ stats, definition, instance });

  return {
    id: instance.instanceId,
    weaponInstanceId: instance.instanceId,
    definitionId: definition.id,
    name: instance.displayName || definition.name,
    element: definition.baseElement,
    tags: [...definition.tags],
    gpuReactionRole: 'base-input-only',
    cooldownMs: stats.cooldownMs,
    targeting: { type: 'nearest' },
    projectile: {
      speed,
      damage: impact.damage ?? stats.damage,
      radius: pattern.projectileRadius,
      lifetimeMs,
      ...projectilePatch,
      energy: createProjectileEnergy(definition.baseElement, pattern.id, elementVisual),
      visual: {
        color: elementVisual.color,
        coreColor: elementVisual.coreColor,
        glowColor: elementVisual.glowColor,
        shape: elementVisual.shape,
      },
    },
    impact,
    materialEffects: createMaterialEffects(definition.baseElement, pattern.id, elementVisual),
    weaponStats: stats,
  };
}

export function createRuntimeSkillMapForWeapons(state, content = {}) {
  const skills = {};
  for (const instanceId of state.weapons?.equippedWeaponInstanceIds || []) {
    if (!instanceId) continue;
    const instance = state.weapons.weaponInstancesById?.[instanceId];
    if (!instance) continue;
    const skill = buildWeaponRuntimeSkill(instance, content);
    if (skill) skills[instanceId] = skill;
  }
  return skills;
}

function applyAffixes(baseStats = {}, affixes = []) {
  const stats = {
    damage: baseStats.damage ?? 1,
    projectileSpeed: baseStats.projectileSpeed ?? 320,
    cooldownMs: baseStats.cooldownMs ?? 1000,
    attackRange: baseStats.attackRange ?? 420,
    areaRadius: baseStats.areaRadius ?? 24,
    projectileCount: baseStats.projectileCount ?? 1,
    spreadRadians: baseStats.spreadRadians ?? 0,
  };

  for (const affix of affixes) {
    const modifiers = affix.modifiers || {};
    if (Number.isFinite(modifiers.damageMultiplier)) {
      stats.damage *= modifiers.damageMultiplier;
    }
    if (Number.isFinite(modifiers.projectileSpeedMultiplier)) {
      stats.projectileSpeed *= modifiers.projectileSpeedMultiplier;
    }
    if (Number.isFinite(modifiers.cooldownMultiplier)) {
      stats.cooldownMs *= modifiers.cooldownMultiplier;
    }
    if (Number.isFinite(modifiers.attackRangeMultiplier)) {
      stats.attackRange *= modifiers.attackRangeMultiplier;
    }
    if (Number.isFinite(modifiers.areaRadiusMultiplier)) {
      stats.areaRadius *= modifiers.areaRadiusMultiplier;
    }
    if (Number.isFinite(modifiers.projectileCountAdd)) {
      stats.projectileCount += modifiers.projectileCountAdd;
    }
  }

  return normalizeStats(stats);
}

function applyPatternMultipliers(stats, pattern) {
  return normalizeStats({
    ...stats,
    damage: stats.damage * (pattern.damageMultiplier ?? 1),
    cooldownMs: stats.cooldownMs * (pattern.cooldownMultiplier ?? 1),
    attackRange: stats.attackRange * (pattern.rangeMultiplier ?? 1),
  });
}

function normalizeStats(stats) {
  return {
    damage: Math.max(1, Math.round(stats.damage)),
    projectileSpeed: Math.max(80, Math.round(stats.projectileSpeed)),
    cooldownMs: Math.max(180, Math.round(stats.cooldownMs)),
    attackRange: Math.max(120, Math.round(stats.attackRange)),
    areaRadius: Math.max(0, Math.round(stats.areaRadius)),
    projectileCount: Math.max(1, Math.round(stats.projectileCount)),
    spreadRadians: Number((stats.spreadRadians || 0).toFixed(3)),
  };
}

function createProjectileEnergy(element, patternId, visual) {
  const material = visual.material;
  if (element === 'sand' && patternId === 'bolt') {
    return {
      initial: 32,
      max: 32,
      trailIntervalMs: 48,
      trailLeakPerSecond: 0,
      trailEffects: [],
    };
  }

  return {
    initial: element === 'electric' ? 32 : 44,
    max: element === 'electric' ? 32 : 44,
    trailIntervalMs: element === 'electric' ? 30 : 44,
    trailLeakPerSecond: 0,
    trailEffects: [
      {
        material,
        profile: visual.trailProfile,
        life: element === 'electric' ? 24 : 12,
        radius: element === 'electric' ? 5 : 4,
        strength: element === 'water' ? 195 : 180,
        frames: 1,
      },
    ],
  };
}

function createMaterialEffects(element, patternId, visual) {
  const material = visual.material;
  const hitRadius = patternId === 'meteor' ? 18 : 10;
  const hit = [
    {
      material,
      profile: patternId === 'meteor' && element === 'fire' ? 'skillExplosionFire' : undefined,
      life: element === 'electric' ? 28 : 12,
      radius: element === 'sand' ? 22 : hitRadius,
      strength: 225,
      frames: patternId === 'meteor' ? 4 : 2,
      radialForce: patternId === 'meteor' || element === 'sand' ? 1 : 0,
      expansionFrames: patternId === 'meteor' || element === 'sand' ? 3 : 0,
      explosion: patternId === 'meteor' || undefined,
    },
  ];

  return {
    cast: [],
    hit,
  };
}
