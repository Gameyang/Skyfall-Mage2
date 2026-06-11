import { GAME_CONTENT } from './content/index.js';
import { circlesIntersect, clamp, distance, normalize } from './math.js';
import { createEnemyFromWave, hasEnemyReachedExit, updateEnemyPathPosition } from './enemyPaths.js';

const PROJECTILE_DESPAWN_MARGIN = 96;
const DEFAULT_SKILL_COOLDOWN_MS = 1000;
const DEFAULT_HAZARD_TICK_MS = 250;
const DEFAULT_HAZARD_LIFETIME_MS = 1000;
const DEFAULT_PROJECTILE_TRAIL_INTERVAL_MS = 50;
const PLAYER_RECENTER_DURATION_MS = 180;

export function updateGame(state, dtMs, content = GAME_CONTENT) {
  const dt = Math.max(dtMs, 0);
  state.frameEvents = [];
  state.frameEffects = [];
  if (state.session.gameOver) return state;

  state.session.elapsedMs += dt;
  state.session.contactFlashMs = Math.max(0, state.session.contactFlashMs - dt);

  syncRuntimeCollections(state, content);
  updatePlayer(state, dt);
  updateWaveSpawns(state, content);
  updateEnemies(state, dt);
  updateAutoSkills(state, dt, content);
  updateProjectiles(state, dt);
  resolveProjectileHits(state, content);
  updateHazards(state, dt);
  resolvePlayerContacts(state);
  cleanupEntities(state);

  return state;
}

export function syncRuntimeCollections(state, content = GAME_CONTENT) {
  if (!state.entities.hazards) {
    state.entities.hazards = [];
  }
  if (!state.session.nextHazardId) {
    state.session.nextHazardId = 1;
  }

  for (const skillId of Object.keys(content.skills || {})) {
    if (!state.skills[skillId]) {
      state.skills[skillId] = { cooldownRemainingMs: 0 };
    }
  }

  const waveDefinitions = content.waves || [];
  if (state.waves.length !== waveDefinitions.length) {
    state.waves = waveDefinitions.map((wave) => ({
      id: wave.id,
      nextAtMs: wave.startMs ?? 0,
      spawnedGroups: 0,
    }));
  }
}

export function updateViewport(state, width, height, visible) {
  const nextWidth = Math.max(1, width);
  const nextHeight = Math.max(1, height);
  const nextVisible = normalizeVisibleArea(visible, nextWidth, nextHeight);
  const layoutChanged = hasViewportLayoutChanged(state.viewport, nextWidth, nextHeight, nextVisible);

  state.viewport.width = nextWidth;
  state.viewport.height = nextHeight;
  state.viewport.visible = nextVisible;

  if (layoutChanged) {
    queuePlayerRecenter(state);
  } else {
    clampPlayerToVisibleArea(state);
  }
}

function normalizeVisibleArea(visible, width, height) {
  const visibleWidth = clamp(Math.floor(visible?.width ?? width), 1, width);
  const visibleHeight = clamp(Math.floor(visible?.height ?? height), 1, height);
  const x = clamp(Math.floor(visible?.x ?? 0), 0, Math.max(0, width - visibleWidth));
  const y = clamp(Math.floor(visible?.y ?? 0), 0, Math.max(0, height - visibleHeight));

  return {
    x,
    y,
    width: visibleWidth,
    height: visibleHeight,
  };
}

function hasViewportLayoutChanged(viewport, width, height, visible) {
  return (
    viewport.width !== width ||
    viewport.height !== height ||
    viewport.visible?.x !== visible.x ||
    viewport.visible?.y !== visible.y ||
    viewport.visible?.width !== visible.width ||
    viewport.visible?.height !== visible.height
  );
}

function getVisibleCenter(viewport) {
  const visible = viewport.visible || {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  };

  return {
    x: visible.x + visible.width * 0.5,
    y: visible.y + visible.height * 0.5,
  };
}

function queuePlayerRecenter(state) {
  const target = getVisibleCenter(state.viewport);
  state.player.recenter = {
    startX: state.player.x,
    startY: state.player.y,
    targetX: target.x,
    targetY: target.y,
    elapsedMs: 0,
    durationMs: PLAYER_RECENTER_DURATION_MS,
  };
}

function updatePlayerRecenter(state, dtMs) {
  const recenter = state.player.recenter;
  if (!recenter) return false;

  recenter.elapsedMs += dtMs;
  const ratio = clamp(recenter.elapsedMs / Math.max(1, recenter.durationMs), 0, 1);
  const eased = easeOutCubic(ratio);
  state.player.x = lerp(recenter.startX, recenter.targetX, eased);
  state.player.y = lerp(recenter.startY, recenter.targetY, eased);
  clampPlayerToVisibleArea(state);

  if (ratio >= 1) {
    state.player.recenter = null;
  }

  return true;
}

function clampPlayerToVisibleArea(state) {
  const bounds = getPlayerMovementBounds(state);
  state.player.x = clamp(state.player.x, bounds.minX, bounds.maxX);
  state.player.y = clamp(state.player.y, bounds.minY, bounds.maxY);
}

function getPlayerMovementBounds(state) {
  const visible = state.viewport.visible || {
    x: 0,
    y: 0,
    width: state.viewport.width,
    height: state.viewport.height,
  };

  return {
    minX: visible.x,
    maxX: visible.x + visible.width,
    minY: visible.y,
    maxY: visible.y + visible.height,
  };
}

function easeOutCubic(ratio) {
  return 1 - ((1 - ratio) ** 3);
}

export function updatePlayer(state, dtMs) {
  if (updatePlayerRecenter(state, dtMs)) return;

  const inputX = Number(state.input.right) - Number(state.input.left);
  const inputY = Number(state.input.down) - Number(state.input.up);
  const moving = inputX !== 0 || inputY !== 0;
  if (!moving) {
    clampPlayerToVisibleArea(state);
    return;
  }

  const direction = normalize(inputX, inputY);
  const distance = state.player.speed * (dtMs / 1000);
  const bounds = getPlayerMovementBounds(state);
  state.player.x = clamp(
    state.player.x + direction.x * distance,
    bounds.minX,
    bounds.maxX,
  );
  state.player.y = clamp(
    state.player.y + direction.y * distance,
    bounds.minY,
    bounds.maxY,
  );
}

export function updateWaveSpawns(state, content = GAME_CONTENT) {
  const waveDefinitions = content.waves || [];
  for (let index = 0; index < waveDefinitions.length; index += 1) {
    const wave = waveDefinitions[index];
    const waveState = state.waves[index];
    if (!waveState) continue;

    while (state.session.elapsedMs >= waveState.nextAtMs) {
      spawnWaveGroup(state, wave, content, waveState.spawnedGroups);
      waveState.spawnedGroups += 1;
      waveState.nextAtMs += wave.intervalMs || 1000;
    }
  }
}

export function spawnWaveGroup(state, wave, content = GAME_CONTENT, groupIndex = 0) {
  const enemyDefinition = content.enemies?.[wave.enemyType];
  if (!enemyDefinition) return;

  const count = Math.max(1, wave.count || 1);
  for (let index = 0; index < count; index += 1) {
    state.entities.enemies.push(createEnemyFromWave({
      state,
      wave,
      definition: enemyDefinition,
      index,
      groupIndex,
    }));
  }
}

export function updateEnemies(state, dtMs) {
  const dt = dtMs / 1000;
  for (const enemy of state.entities.enemies) {
    enemy.progress += (enemy.speed || 0) * dt;
    updateEnemyPathPosition(enemy);
  }
}

export function updateAutoAttack(state, dtMs, content = GAME_CONTENT) {
  return updateAutoSkills(state, dtMs, content);
}

export function updateAutoSkills(state, dtMs, content = GAME_CONTENT) {
  for (const [skillId, skill] of Object.entries(content.skills || {})) {
    const skillState = state.skills[skillId] || { cooldownRemainingMs: 0 };
    state.skills[skillId] = skillState;
    skillState.cooldownRemainingMs = Math.max(0, skillState.cooldownRemainingMs - dtMs);
    if (skillState.cooldownRemainingMs > 0) continue;

    const target = selectTargetForSkill(state, skill);
    if (!target) continue;

    const projectile = spawnProjectileFromSkill(state, skill, target, skillId);
    if (!projectile) continue;

    skillState.cooldownRemainingMs += skill.cooldownMs ?? DEFAULT_SKILL_COOLDOWN_MS;
  }
}

export function selectTargetForSkill(state, skill) {
  if (skill.targeting?.type === 'progress-risk') {
    return selectProgressRiskTarget(state);
  }
  return selectProgressRiskTarget(state);
}

export function selectProgressRiskTarget(state) {
  let bestTarget = null;
  let bestScore = -Infinity;

  for (const enemy of state.entities.enemies) {
    if (enemy.hp <= 0) continue;
    const score = scoreProgressRisk(enemy, state.player, state.viewport);
    if (score > bestScore) {
      bestScore = score;
      bestTarget = enemy;
    }
  }

  return bestTarget;
}

export function scoreProgressRisk(enemy, player, viewport) {
  const progressRisk = clamp(enemy.progress / Math.max(1, enemy.travelDistance), 0, 1);
  const collisionDistance = Math.max(0, distance(enemy, player) - enemy.radius - player.radius);
  const proximityRisk = 1 - clamp(collisionDistance / Math.max(viewport.width, viewport.height, 1), 0, 1);
  return progressRisk * 0.64 + proximityRisk * 0.36;
}

export function spawnProjectileFromSkill(state, skill, target, skillId = skill.id) {
  if (!skill.projectile) return null;

  const direction = normalize(target.x - state.player.x, target.y - state.player.y);
  const projectileDefinition = skill.projectile;
  const projectile = {
    id: state.session.nextProjectileId,
    skillId,
    definitionId: skill.id,
    x: state.player.x,
    y: state.player.y,
    vx: direction.x * projectileDefinition.speed,
    vy: direction.y * projectileDefinition.speed,
    radius: projectileDefinition.radius,
    damage: projectileDefinition.damage,
    lifetimeMs: projectileDefinition.lifetimeMs,
    ageMs: 0,
    energy: createProjectileEnergyState(projectileDefinition.energy),
    visual: projectileDefinition.visual,
  };
  state.session.nextProjectileId += 1;
  state.entities.projectiles.push(projectile);

  state.frameEvents.push({
    type: 'SkillCast',
    skillId: skill.id,
    projectileId: projectile.id,
    targetId: target.id,
  });
  pushSkillEffects(state, skill, 'cast', projectile);
  return projectile;
}

export function updateProjectiles(state, dtMs) {
  const dt = dtMs / 1000;
  for (const projectile of state.entities.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.ageMs += dtMs;
    updateProjectileEnergy(state, projectile, dtMs);
  }
}

export function resolveProjectileHits(state, content = GAME_CONTENT) {
  const remainingProjectiles = [];

  for (const projectile of state.entities.projectiles) {
    let hitEnemy = null;
    for (const enemy of state.entities.enemies) {
      if (enemy.hp <= 0) continue;
      if (circlesIntersect(projectile, enemy)) {
        hitEnemy = enemy;
        break;
      }
    }

    if (!hitEnemy) {
      remainingProjectiles.push(projectile);
      continue;
    }

    const skill = getSkillForProjectile(content, projectile);
    const impact = skill?.impact || {};
    const directDamage = impact.damage ?? projectile.damage ?? 0;
    if (directDamage > 0) {
      damageEnemy(state, hitEnemy, directDamage, {
        type: 'ProjectileHit',
        skillId: projectile.skillId,
        projectileId: projectile.id,
        enemyId: hitEnemy.id,
      });
    } else {
      state.frameEvents.push({
        type: 'ProjectileHit',
        skillId: projectile.skillId,
        projectileId: projectile.id,
        enemyId: hitEnemy.id,
        damage: 0,
      });
    }

    pushSkillEffects(state, skill, 'hit', hitEnemy);
    resolveEnergyExplosion(state, projectile, skill, hitEnemy);
    applyAreaDamage(state, hitEnemy, impact.areaDamage, {
      skillId: projectile.skillId,
      projectileId: projectile.id,
    });
    spawnHazardsFromImpact(state, skill, hitEnemy);
  }

  state.entities.projectiles = remainingProjectiles;
  state.entities.enemies = state.entities.enemies.filter((enemy) => enemy.hp > 0);
}

export function updateHazards(state, dtMs) {
  if (!state.entities.hazards?.length) return;

  const remainingHazards = [];
  for (const hazard of state.entities.hazards) {
    const lifetimeMs = hazard.lifetimeMs ?? DEFAULT_HAZARD_LIFETIME_MS;
    const previousAgeMs = hazard.ageMs || 0;
    const activeDtMs = Math.min(dtMs, Math.max(0, lifetimeMs - previousAgeMs));
    hazard.ageMs = previousAgeMs + dtMs;
    hazard.tickAccumulatorMs = (hazard.tickAccumulatorMs || 0) + activeDtMs;

    const tickMs = hazard.tickMs ?? DEFAULT_HAZARD_TICK_MS;
    while (tickMs > 0 && hazard.tickAccumulatorMs >= tickMs) {
      hazard.tickAccumulatorMs -= tickMs;
      applyHazardTick(state, hazard, tickMs);
    }

    if (hazard.ageMs < lifetimeMs) {
      remainingHazards.push(hazard);
    } else {
      state.frameEvents.push({
        type: 'HazardExpired',
        hazardId: hazard.id,
        skillId: hazard.skillId,
      });
    }
  }

  state.entities.hazards = remainingHazards;
  state.entities.enemies = state.entities.enemies.filter((enemy) => enemy.hp > 0);
}

export function resolvePlayerContacts(state) {
  const remainingEnemies = [];
  for (const enemy of state.entities.enemies) {
    if (!circlesIntersect(enemy, state.player)) {
      remainingEnemies.push(enemy);
      continue;
    }

    state.player.hp = Math.max(0, state.player.hp - enemy.contactDamage);
    state.session.contactFlashMs = 180;
    state.frameEvents.push({
      type: 'PlayerDamaged',
      enemyId: enemy.id,
      damage: enemy.contactDamage,
      playerHp: state.player.hp,
    });
    pushMaterialEffect(state, {
      material: 'smoke',
      x: state.player.x,
      y: state.player.y,
      radius: 10,
      strength: 150,
      frames: 3,
    });
  }

  state.entities.enemies = remainingEnemies;
  if (state.player.hp <= 0) {
    state.session.gameOver = true;
  }
}

export function cleanupEntities(state) {
  const remainingEnemies = [];
  for (const enemy of state.entities.enemies) {
    if (hasEnemyReachedExit(enemy)) {
      state.frameEvents.push({
        type: 'EnemyDespawned',
        enemyId: enemy.id,
      });
      continue;
    }
    remainingEnemies.push(enemy);
  }
  state.entities.enemies = remainingEnemies;

  const { width, height } = state.viewport;
  state.entities.projectiles = state.entities.projectiles.filter((projectile) => (
    projectile.ageMs < projectile.lifetimeMs &&
    projectile.x > -PROJECTILE_DESPAWN_MARGIN &&
    projectile.x < width + PROJECTILE_DESPAWN_MARGIN &&
    projectile.y > -PROJECTILE_DESPAWN_MARGIN &&
    projectile.y < height + PROJECTILE_DESPAWN_MARGIN
  ));
}

function applyAreaDamage(state, source, areaDamage, eventBase) {
  if (!areaDamage) return;

  const radius = areaDamage.radius ?? 0;
  const damage = areaDamage.damage ?? 0;
  if (radius <= 0 || damage <= 0) return;

  for (const enemy of state.entities.enemies) {
    if (enemy.hp <= 0) continue;
    if (distance(source, enemy) > radius + enemy.radius) continue;

    damageEnemy(state, enemy, damage, {
      type: 'AreaDamageHit',
      skillId: eventBase.skillId,
      projectileId: eventBase.projectileId,
      enemyId: enemy.id,
      radius,
    });
  }
}

function createProjectileEnergyState(energyDefinition) {
  if (!energyDefinition) return null;

  const initial = Math.max(0, energyDefinition.initial ?? energyDefinition.max ?? 0);
  const max = Math.max(initial, energyDefinition.max ?? initial, 1);
  return {
    current: initial,
    max,
    trailAccumulatorMs: 0,
    trailIntervalMs: energyDefinition.trailIntervalMs ?? DEFAULT_PROJECTILE_TRAIL_INTERVAL_MS,
    trailLeakPerSecond: energyDefinition.trailLeakPerSecond ?? 0,
    trailEffects: energyDefinition.trailEffects || [],
    explosion: energyDefinition.explosion || null,
  };
}

function updateProjectileEnergy(state, projectile, dtMs) {
  const energy = projectile.energy;
  if (!energy) return;

  energy.max = Math.max(1, energy.max ?? energy.current ?? 0);
  energy.current = Math.max(0, (energy.current ?? energy.max) - (energy.trailLeakPerSecond || 0) * (dtMs / 1000));
  energy.trailAccumulatorMs = (energy.trailAccumulatorMs || 0) + dtMs;

  const intervalMs = Math.max(1, energy.trailIntervalMs || DEFAULT_PROJECTILE_TRAIL_INTERVAL_MS);
  let emitted = 0;
  while (energy.trailAccumulatorMs >= intervalMs && emitted < 3) {
    energy.trailAccumulatorMs -= intervalMs;
    emitted += 1;
    pushMaterialEffects(state, energy.trailEffects || [], projectile);
  }
}

function resolveEnergyExplosion(state, projectile, skill, source) {
  const explosion = projectile.energy?.explosion;
  if (!explosion) return;

  const energy = projectile.energy;
  const ratio = clamp(energy.current / Math.max(1, energy.max), 0, 1);
  const radius = lerp(explosion.minRadius ?? 16, explosion.maxRadius ?? 48, ratio);
  const damage = lerp(explosion.minDamage ?? 0, explosion.maxDamage ?? 0, ratio);

  state.frameEvents.push({
    type: 'EnergyExplosion',
    skillId: projectile.skillId,
    projectileId: projectile.id,
    enemyId: source.id,
    energy: energy.current,
    radius,
    damage,
  });

  applyAreaDamage(state, source, { radius, damage }, {
    skillId: projectile.skillId,
    projectileId: projectile.id,
  });
  pushEnergyExplosionEffects(state, explosion.materialEffects || [], source, radius);
}

function pushEnergyExplosionEffects(state, effects = [], source, explosionRadius) {
  for (const effect of effects) {
    const radius = effect.radius ?? explosionRadius * (effect.radiusScale ?? 1);
    pushMaterialEffect(state, {
      ...effect,
      x: source.x,
      y: source.y,
      radius,
    });
  }
}

function spawnHazardsFromImpact(state, skill, source) {
  if (!skill) return;

  const hazards = [
    ...(skill.hazards?.hit || []),
    ...(skill.impact?.hazards || []),
  ];
  if (skill.impact?.hazard) {
    hazards.push(skill.impact.hazard);
  }

  for (const hazardDefinition of hazards) {
    const hazard = {
      id: state.session.nextHazardId,
      skillId: skill.id,
      type: hazardDefinition.type || 'generic',
      x: source.x,
      y: source.y,
      radius: hazardDefinition.radius ?? 24,
      damagePerSecond: hazardDefinition.damagePerSecond ?? 0,
      lifetimeMs: hazardDefinition.lifetimeMs ?? DEFAULT_HAZARD_LIFETIME_MS,
      tickMs: hazardDefinition.tickMs ?? DEFAULT_HAZARD_TICK_MS,
      ageMs: 0,
      tickAccumulatorMs: 0,
      affectsPlayer: Boolean(hazardDefinition.affectsPlayer),
      materialEffects: hazardDefinition.materialEffects || {},
    };
    state.session.nextHazardId += 1;
    state.entities.hazards.push(hazard);
    state.frameEvents.push({
      type: 'HazardSpawned',
      hazardId: hazard.id,
      skillId: skill.id,
      hazardType: hazard.type,
    });
    pushMaterialEffects(state, hazard.materialEffects.spawn, hazard);
  }
}

function applyHazardTick(state, hazard, tickMs) {
  const damage = (hazard.damagePerSecond || 0) * (tickMs / 1000);
  if (damage <= 0) {
    pushMaterialEffects(state, hazard.materialEffects.tick, hazard);
    return;
  }

  for (const enemy of state.entities.enemies) {
    if (enemy.hp <= 0) continue;
    if (distance(hazard, enemy) > hazard.radius + enemy.radius) continue;

    damageEnemy(state, enemy, damage, {
      type: 'HazardTick',
      skillId: hazard.skillId,
      hazardId: hazard.id,
      enemyId: enemy.id,
    });
  }

  if (hazard.affectsPlayer && circlesIntersect(hazard, state.player)) {
    state.player.hp = Math.max(0, state.player.hp - damage);
    state.session.contactFlashMs = 180;
    state.frameEvents.push({
      type: 'PlayerDamaged',
      hazardId: hazard.id,
      damage,
      playerHp: state.player.hp,
    });
    if (state.player.hp <= 0) {
      state.session.gameOver = true;
    }
  }

  pushMaterialEffects(state, hazard.materialEffects.tick, hazard);
}

function damageEnemy(state, enemy, damage, event) {
  if (!enemy || enemy.hp <= 0 || damage <= 0) return false;

  enemy.hp -= damage;
  state.frameEvents.push({
    ...event,
    enemyId: enemy.id,
    damage,
  });

  if (enemy.hp > 0) return false;

  state.session.score += 1;
  state.frameEvents.push({
    type: 'EnemyKilled',
    enemyId: enemy.id,
  });
  return true;
}

function pushSkillEffects(state, skill, phase, source) {
  pushMaterialEffects(state, getSkillMaterialEffects(skill, phase), source);
}

function getSkillMaterialEffects(skill, phase) {
  return skill?.materialEffects?.[phase] || skill?.effects?.[phase] || [];
}

function getSkillForProjectile(content, projectile) {
  const skills = content.skills || {};
  if (skills[projectile.skillId]) return skills[projectile.skillId];
  return Object.values(skills).find((skill) => skill.id === projectile.skillId) || null;
}

function lerp(min, max, ratio) {
  return min + (max - min) * ratio;
}

function pushMaterialEffects(state, effects = [], source) {
  for (const effect of effects) {
    pushMaterialEffect(state, {
      ...effect,
      x: source.x,
      y: source.y,
    });
  }
}

function pushMaterialEffect(state, effect) {
  state.frameEffects.push({
    type: 'MaterialEmitter',
    x: effect.x,
    y: effect.y,
    material: effect.material,
    radius: effect.radius,
    strength: effect.strength,
    frames: effect.frames,
    flags: effect.flags || 0,
    explosion: Boolean(effect.explosion),
    profile: effect.profile,
    life: effect.life || 0,
    radialForce: effect.radialForce || 0,
    expansionFrames: effect.expansionFrames || 0,
  });
}
