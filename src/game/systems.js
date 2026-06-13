import { GAS_FLOW_CONFIG } from '../features/material-field/config.js';
import { circlesIntersect, clamp, distance, distanceSq, hash01, normalize } from './math.js';
import { hasEnemyReachedExit, updateEnemyPathPosition } from './enemyPaths.js';
import { getSkillSequenceDelayMs } from './skillSequence.js';
import { updateRevealShop } from './shop/revealProgressSystem.js';
import { startRevealShopAfterWave } from './shop/revealShopEncounter.js';
import { consumeWeaponCommandInput, syncWeaponRuntimeState } from './weapons/weaponInventory.js';
import { createRuntimeSkillMapForWeapons } from './weapons/weaponRuntimeBuilder.js';
import {
  createWaveRuntimeState,
  isWaveRuntimeStateCurrent,
  spawnWaveGroup as spawnWaveGroupRuntime,
  updateWaveSpawns as updateWaveSpawnsRuntime,
} from './waveDirector.js';

const PROJECTILE_DESPAWN_MARGIN = 96;
const DEFAULT_SKILL_COOLDOWN_MS = 1000;
const DEFAULT_HAZARD_TICK_MS = 250;
const DEFAULT_HAZARD_LIFETIME_MS = 1000;
const DEFAULT_PROJECTILE_TRAIL_INTERVAL_MS = 50;
const ITEM_MAX_WIND_SPEED = 18;
const ITEM_MAX_NOISE_SPEED = 10;
const ITEM_TRAIL_HISTORY_SPACING = 4;
const ITEM_TRAIL_HISTORY_LIMIT = 180;
const ITEM_LOSS_MIN_RATIO = 0.05;
const ITEM_LOSS_MAX_RATIO = 0.1;
const LOST_ITEM_GRAVITY = 1520;
const LOST_ITEM_VISUAL_LIMIT = 6;
const LOST_ITEM_HORIZONTAL_SPEED_MIN = 180;
const LOST_ITEM_HORIZONTAL_SPEED_RANGE = 180;
const LOST_ITEM_LIFT_SPEED_MIN = 420;
const LOST_ITEM_LIFT_SPEED_RANGE = 180;
const LOST_ITEM_DESPAWN_MARGIN = 96;
const LOST_ITEM_MAX_LIFETIME_MS = 4000;
const DEFAULT_SYSTEM_CONTENT = Object.freeze({
  enemies: Object.freeze({}),
  skills: Object.freeze({}),
  waves: Object.freeze([]),
  items: Object.freeze({}),
  weapons: null,
  loot: Object.freeze({
    enemyDrops: Object.freeze([]),
  }),
});

export function updateGame(state, dtMs, content = DEFAULT_SYSTEM_CONTENT) {
  const dt = Math.max(dtMs, 0);
  state.frameEvents = [];
  state.frameEffects = [];
  if (state.session.gameOver) return state;

  state.session.elapsedMs += dt;
  state.session.contactFlashMs = Math.max(0, state.session.contactFlashMs - dt);

  syncRuntimeCollections(state, content);
  consumeWeaponCommandInput(state);
  updatePlayer(state, dt);
  updateCameraToPlayer(state);
  updatePlayerTrailHistory(state);

  if (state.revealShop?.status === 'revealing') {
    updateItemDrops(state, dt, content);
    updateLostItems(state, dt);
    resolveItemPickups(state, content);
    updateRevealShop(state, dt, content);
    autoUsePlayerConsumables(state, content);
    cleanupEntities(state);
    clearCommandInput(state);
    return state;
  }

  updateWaveSpawns(state, content);
  const completedWaveEvent = state.frameEvents.find((event) => event.type === 'WaveCompleted');
  if (completedWaveEvent && content.weapons && state.weapons) {
    startRevealShopAfterWave(state, content, completedWaveEvent);
    updateItemDrops(state, dt, content);
    updateLostItems(state, dt);
    resolveItemPickups(state, content);
    autoUsePlayerConsumables(state, content);
    clearCommandInput(state);
    return state;
  }

  updateEnemies(state, dt);
  updateItemDrops(state, dt, content);
  updateLostItems(state, dt);
  updateAutoSkills(state, dt, content);
  updateProjectiles(state, dt);
  resolveProjectileHits(state, content);
  updateHazards(state, dt, content);
  resolveItemPickups(state, content);
  resolvePlayerContacts(state, content);
  autoUsePlayerConsumables(state, content);
  cleanupEntities(state);
  clearCommandInput(state);

  return state;
}

export function syncRuntimeCollections(state, content = DEFAULT_SYSTEM_CONTENT) {
  if (!state.entities.hazards) {
    state.entities.hazards = [];
  }
  if (!state.entities.itemDrops) {
    state.entities.itemDrops = [];
  }
  if (!state.entities.lostItems) {
    state.entities.lostItems = [];
  }
  if (!state.session.nextHazardId) {
    state.session.nextHazardId = 1;
  }
  if (!state.session.nextItemDropId) {
    state.session.nextItemDropId = 1;
  }
  if (!state.session.nextLostItemId) {
    state.session.nextLostItemId = 1;
  }
  if (!state.player.trailHistory) {
    state.player.trailHistory = [];
  }
  if (!state.player.collectedItems) {
    state.player.collectedItems = [];
  }
  if (state.weapons) {
    syncWeaponRuntimeState(state);
  }

  for (const skillId of Object.keys(content.skills || {})) {
    if (!state.skills[skillId]) {
      state.skills[skillId] = { cooldownRemainingMs: 0 };
    }
  }

  const waveDefinitions = content.waves || [];
  if (!isWaveRuntimeStateCurrent(state.waves, waveDefinitions)) {
    state.waves = createWaveRuntimeState(waveDefinitions, state.session.elapsedMs);
  }
}

export function updateViewport(state, width, height, visible) {
  const nextWidth = Math.max(1, width);
  const nextHeight = Math.max(1, height);
  const nextVisible = normalizeVisibleArea(visible, nextWidth, nextHeight, state.viewport?.visible);

  state.viewport.width = nextWidth;
  state.viewport.height = nextHeight;
  state.viewport.visible = nextVisible;
  state.player.recenter = null;
  clampPlayerToField(state);
  updateCameraToPlayer(state);
}

function normalizeVisibleArea(visible, width, height, currentVisible = null) {
  const visibleWidth = clamp(Math.floor(visible?.width ?? currentVisible?.width ?? width), 1, width);
  const visibleHeight = clamp(Math.floor(visible?.height ?? currentVisible?.height ?? height), 1, height);
  const x = clamp(currentVisible?.x ?? visible?.x ?? 0, 0, Math.max(0, width - visibleWidth));
  const y = clamp(currentVisible?.y ?? visible?.y ?? 0, 0, Math.max(0, height - visibleHeight));

  return {
    x,
    y,
    width: visibleWidth,
    height: visibleHeight,
  };
}

export function updateCameraToPlayer(state) {
  const viewport = state.viewport;
  if (!viewport || !state.player) return;

  const width = Math.max(1, viewport.width || 1);
  const height = Math.max(1, viewport.height || 1);
  const currentVisible = viewport.visible || {};
  const visibleWidth = clamp(Math.floor(currentVisible.width ?? width), 1, width);
  const visibleHeight = clamp(Math.floor(currentVisible.height ?? height), 1, height);

  viewport.visible = {
    x: clamp(state.player.x - visibleWidth * 0.5, 0, Math.max(0, width - visibleWidth)),
    y: clamp(state.player.y - visibleHeight * 0.5, 0, Math.max(0, height - visibleHeight)),
    width: visibleWidth,
    height: visibleHeight,
  };
}

function clampPlayerToField(state) {
  const bounds = getPlayerMovementBounds(state);
  state.player.x = clamp(state.player.x, bounds.minX, bounds.maxX);
  state.player.y = clamp(state.player.y, bounds.minY, bounds.maxY);
}

function getPlayerMovementBounds(state) {
  const radius = Math.max(0, state.player?.radius ?? 0);
  const width = Math.max(radius * 2, state.viewport.width || 1);
  const height = Math.max(radius * 2, state.viewport.height || 1);

  return {
    minX: radius,
    maxX: width - radius,
    minY: radius,
    maxY: height - radius,
  };
}

export function updatePlayer(state, dtMs) {
  const { x: inputX, y: inputY } = getMovementInputVector(state.input);
  const moving = inputX !== 0 || inputY !== 0;
  if (!moving) {
    clampPlayerToField(state);
    return;
  }

  const distance = state.player.speed * (dtMs / 1000);
  const bounds = getPlayerMovementBounds(state);
  state.player.x = clamp(
    state.player.x + inputX * distance,
    bounds.minX,
    bounds.maxX,
  );
  state.player.y = clamp(
    state.player.y + inputY * distance,
    bounds.minY,
    bounds.maxY,
  );
}

function getMovementInputVector(input) {
  const vectorX = Number.isFinite(input.vectorX) ? input.vectorX : 0;
  const vectorY = Number.isFinite(input.vectorY) ? input.vectorY : 0;
  const vectorMagnitude = Math.hypot(vectorX, vectorY);

  if (vectorMagnitude > 0) {
    if (vectorMagnitude <= 1) {
      return { x: vectorX, y: vectorY };
    }

    return {
      x: vectorX / vectorMagnitude,
      y: vectorY / vectorMagnitude,
    };
  }

  const digitalX = Number(input.right) - Number(input.left);
  const digitalY = Number(input.down) - Number(input.up);
  if (digitalX === 0 && digitalY === 0) {
    return { x: 0, y: 0 };
  }

  return normalize(digitalX, digitalY);
}

export function updatePlayerTrailHistory(state) {
  const player = state.player;
  const history = player.trailHistory || [];
  player.trailHistory = history;

  const current = {
    x: player.x,
    y: player.y,
  };
  const newest = history[0];
  if (!newest || distance(current, newest) >= ITEM_TRAIL_HISTORY_SPACING) {
    history.unshift(current);
  }

  while (history.length > ITEM_TRAIL_HISTORY_LIMIT) {
    history.pop();
  }
}

export function updateWaveSpawns(state, content = DEFAULT_SYSTEM_CONTENT) {
  updateWaveSpawnsRuntime(state, content);
}

export function spawnWaveGroup(state, wave, content = DEFAULT_SYSTEM_CONTENT, groupIndex = 0) {
  return spawnWaveGroupRuntime(state, wave, content, groupIndex);
}

export function updateEnemies(state, dtMs) {
  const dt = dtMs / 1000;
  for (const enemy of state.entities.enemies) {
    enemy.progress += (enemy.speed || 0) * dt;
    updateEnemyPathPosition(enemy, state, dtMs);
  }
}

export function updateAutoAttack(state, dtMs, content = DEFAULT_SYSTEM_CONTENT) {
  return updateAutoSkills(state, dtMs, content);
}

export function updateAutoSkills(state, dtMs, content = DEFAULT_SYSTEM_CONTENT) {
  if (content.weapons && state.weapons) {
    updateAutoWeapons(state, dtMs, content);
    return;
  }

  const skills = content.skills || {};
  updateSkillCooldowns(state, dtMs, skills);

  const sequencedSkillIds = getSequencedSkillIds(content, skills);
  if (sequencedSkillIds.length > 1) {
    updateSequencedAutoSkill(state, dtMs, skills, sequencedSkillIds);
    return;
  }

  for (const [skillId, skill] of Object.entries(skills)) {
    const skillState = state.skills[skillId];
    if (skillState.cooldownRemainingMs > 0) continue;

    const target = selectTargetForSkill(state, skill);
    if (!target) continue;

    const projectiles = spawnProjectilesFromSkill(state, skill, target, skillId);
    if (!projectiles.length) continue;

    skillState.cooldownRemainingMs += skill.cooldownMs ?? DEFAULT_SKILL_COOLDOWN_MS;
  }
}

function updateAutoWeapons(state, dtMs, content = DEFAULT_SYSTEM_CONTENT) {
  syncWeaponRuntimeState(state);
  const runtimeSkills = createRuntimeSkillMapForWeapons(state, content);
  updateWeaponCooldowns(state, dtMs);

  const equipped = state.weapons.equippedWeaponInstanceIds || [];
  if (!equipped.some(Boolean)) return;

  let sequenceIndex = normalizeSequenceIndex(state.weapons.attackSequenceIndex, equipped.length);
  let attempts = 0;
  while (attempts < equipped.length) {
    const instanceId = equipped[sequenceIndex];
    if (!instanceId) {
      sequenceIndex = (sequenceIndex + 1) % equipped.length;
      attempts += 1;
      continue;
    }

    const runtime = state.weapons.equippedRuntime[sequenceIndex];
    if (!runtime || runtime.cooldownRemainingMs > 0) {
      state.weapons.attackSequenceIndex = sequenceIndex;
      return;
    }

    const skill = runtimeSkills[instanceId];
    if (!skill) {
      sequenceIndex = (sequenceIndex + 1) % equipped.length;
      attempts += 1;
      continue;
    }

    const target = selectTargetForSkill(state, skill);
    if (!target) {
      state.weapons.attackSequenceIndex = sequenceIndex;
      return;
    }

    const projectiles = spawnProjectilesFromSkill(state, skill, target, instanceId);
    if (!projectiles.length) {
      state.weapons.attackSequenceIndex = sequenceIndex;
      return;
    }

    runtime.cooldownRemainingMs += skill.cooldownMs ?? DEFAULT_SKILL_COOLDOWN_MS;
    state.weapons.attackSequenceIndex = (sequenceIndex + 1) % equipped.length;
    return;
  }

  state.weapons.attackSequenceIndex = sequenceIndex;
}

function updateWeaponCooldowns(state, dtMs) {
  for (const runtime of state.weapons?.equippedRuntime || []) {
    runtime.cooldownRemainingMs = Math.max(0, (runtime.cooldownRemainingMs || 0) - dtMs);
  }
}

function updateSkillCooldowns(state, dtMs, skills) {
  for (const skillId of Object.keys(skills)) {
    const skillState = state.skills[skillId] || { cooldownRemainingMs: 0 };
    state.skills[skillId] = skillState;
    skillState.cooldownRemainingMs = Math.max(0, skillState.cooldownRemainingMs - dtMs);
  }
}

function getSequencedSkillIds(content, skills) {
  if (!Array.isArray(content.equippedSkillIds) || content.equippedSkillIds.length <= 1) return [];
  return content.equippedSkillIds.filter((skillId) => skills[skillId]);
}

function updateSequencedAutoSkill(state, dtMs, skills, sequencedSkillIds) {
  state.session.autoSkillSequenceCooldownMs = Math.max(
    0,
    (state.session.autoSkillSequenceCooldownMs ?? 0) - dtMs,
  );
  if (state.session.autoSkillSequenceCooldownMs > 0) return;

  const sequenceIndex = normalizeSequenceIndex(state.session.autoSkillSequenceIndex, sequencedSkillIds.length);
  const skillId = sequencedSkillIds[sequenceIndex];
  const skill = skills[skillId];
  const skillState = state.skills[skillId] || { cooldownRemainingMs: 0 };
  state.skills[skillId] = skillState;
  if (skillState.cooldownRemainingMs > 0) return;

  const target = selectTargetForSkill(state, skill);
  if (!target) return;

  const projectiles = spawnProjectilesFromSkill(state, skill, target, skillId);
  if (!projectiles.length) return;

  skillState.cooldownRemainingMs += skill.cooldownMs ?? DEFAULT_SKILL_COOLDOWN_MS;
  state.session.autoSkillSequenceIndex = (sequenceIndex + 1) % sequencedSkillIds.length;
  state.session.autoSkillSequenceCooldownMs = getSkillSequenceDelayMs(skill);
}

function normalizeSequenceIndex(index, sequenceLength) {
  if (!Number.isFinite(index) || sequenceLength <= 0) return 0;
  return Math.max(0, Math.floor(index)) % sequenceLength;
}

export function selectTargetForSkill(state, skill) {
  if (skill.targeting?.type === 'nearest') {
    return selectNearestTarget(state);
  }
  return selectNearestTarget(state);
}

export function selectNearestTarget(state) {
  let bestTarget = null;
  let bestDistanceSq = Infinity;

  for (const enemy of state.entities.enemies) {
    if (enemy.hp <= 0) continue;
    const currentDistanceSq = distanceSq(enemy, state.player);
    if (currentDistanceSq < bestDistanceSq) {
      bestDistanceSq = currentDistanceSq;
      bestTarget = enemy;
    }
  }

  return bestTarget;
}

export function selectProgressRiskTarget(state) {
  return selectNearestTarget(state);
}

export function spawnProjectileFromSkill(state, skill, target, skillId = skill.id) {
  return spawnProjectilesFromSkill(state, skill, target, skillId)[0] || null;
}

export function spawnProjectilesFromSkill(state, skill, target, skillId = skill.id) {
  if (!skill.projectile) return [];

  const projectileDefinition = skill.projectile;
  const pattern = projectileDefinition.pattern || {};
  if (pattern.type === 'fallingRain') {
    return spawnFallingRainProjectiles(state, skill, target, skillId, projectileDefinition, pattern);
  }

  const baseDirection = normalize(target.x - state.player.x, target.y - state.player.y);
  const count = Math.max(1, Math.round(pattern.count ?? 1));
  const spreadRadians = Math.max(0, Number(pattern.spreadRadians) || 0);
  const projectiles = [];

  for (let index = 0; index < count; index += 1) {
    const ratio = count <= 1 ? 0 : index / (count - 1) - 0.5;
    const angle = ratio * spreadRadians;
    const direction = rotateVector(baseDirection, angle);
    projectiles.push(spawnProjectileEntity(state, skill, target, skillId, projectileDefinition, {
      x: state.player.x,
      y: state.player.y,
      direction,
      patternIndex: index,
    }));
  }

  return projectiles;
}

function spawnFallingRainProjectiles(state, skill, target, skillId, projectileDefinition, pattern) {
  const count = Math.max(1, Math.round(pattern.count ?? 1));
  const width = Math.max(0, Number(pattern.width) || 0);
  const offsetY = Number(pattern.offsetY) || 0;
  const jitterY = Math.max(0, Number(pattern.jitterY) || 0);
  const projectiles = [];
  const direction = { x: 0, y: 1 };

  for (let index = 0; index < count; index += 1) {
    const ratio = count <= 1 ? 0.5 : index / (count - 1);
    const x = target.x - width * 0.5 + width * ratio;
    const jitter = (hash01((state.session.nextProjectileId + index + 1) * 2654435761) - 0.5) * jitterY;
    const y = target.y + offsetY + jitter;
    projectiles.push(spawnProjectileEntity(state, skill, target, skillId, projectileDefinition, {
      x,
      y,
      direction,
      patternIndex: index,
    }));
  }

  return projectiles;
}

function spawnProjectileEntity(state, skill, target, skillId, projectileDefinition, spawn) {
  const direction = spawn.direction || normalize(target.x - spawn.x, target.y - spawn.y);
  const projectile = {
    id: state.session.nextProjectileId,
    skillId,
    definitionId: skill.id,
    skillSnapshot: skill,
    x: spawn.x,
    y: spawn.y,
    vx: direction.x * projectileDefinition.speed,
    vy: direction.y * projectileDefinition.speed,
    radius: projectileDefinition.radius,
    damage: projectileDefinition.damage,
    lifetimeMs: projectileDefinition.lifetimeMs,
    ageMs: 0,
    homing: projectileDefinition.homing,
    energy: createProjectileEnergyState(projectileDefinition.energy),
    visual: projectileDefinition.visual,
    patternIndex: spawn.patternIndex ?? 0,
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

function rotateVector(vector, angle) {
  if (angle === 0) return vector;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

export function updateProjectiles(state, dtMs) {
  const dt = dtMs / 1000;
  for (const projectile of state.entities.projectiles) {
    updateProjectileHoming(state, projectile, dtMs);
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.ageMs += dtMs;
    updateProjectileEnergy(state, projectile, dtMs);
  }
}

function updateProjectileHoming(state, projectile, dtMs) {
  const homing = projectile.homing;
  if (!homing) return;

  const target = selectNearestProjectileTarget(state, projectile);
  if (!target) return;

  const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
  const currentAngle = Math.atan2(projectile.vy, projectile.vx);
  const targetAngle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
  const maxTurn = (homing.turnRateRadiansPerSecond ?? 6) * (dtMs / 1000);
  const delta = clamp(normalizeAngle(targetAngle - currentAngle), -maxTurn, maxTurn);
  const strength = clamp((homing.strengthPerSecond ?? 4) * (dtMs / 1000), 0, 1);
  const nextAngle = currentAngle + delta * strength;
  projectile.vx = Math.cos(nextAngle) * speed;
  projectile.vy = Math.sin(nextAngle) * speed;
}

function selectNearestProjectileTarget(state, projectile) {
  let bestTarget = null;
  let bestDistanceSq = Infinity;
  for (const enemy of state.entities.enemies) {
    if (enemy.hp <= 0) continue;
    const currentDistanceSq = distanceSq(projectile, enemy);
    if (currentDistanceSq < bestDistanceSq) {
      bestDistanceSq = currentDistanceSq;
      bestTarget = enemy;
    }
  }
  return bestTarget;
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function updateItemDrops(state, dtMs, content = DEFAULT_SYSTEM_CONTENT) {
  if (!state.entities.itemDrops?.length) return;

  const dt = dtMs / 1000;
  const flow = getItemFlowConfig(content);
  const elapsedSeconds = state.session.elapsedMs / 1000;
  const remainingDrops = [];

  for (const drop of state.entities.itemDrops) {
    drop.ageMs = (drop.ageMs || 0) + dtMs;
    const drift = sampleItemDropDrift(drop, flow, elapsedSeconds);
    drop.x += drift.x * dt;
    drop.y += drift.y * dt;

    if (isItemDropOutsideField(state, drop)) {
      state.frameEvents.push({
        type: 'ItemDropExpired',
        itemDropId: drop.id,
        itemId: drop.itemId,
      });
      continue;
    }

    remainingDrops.push(drop);
  }

  state.entities.itemDrops = remainingDrops;
}

export function updateLostItems(state, dtMs) {
  if (!state.entities.lostItems?.length) return;

  const dt = dtMs / 1000;
  const remainingLostItems = [];
  for (const item of state.entities.lostItems) {
    item.ageMs = (item.ageMs || 0) + dtMs;
    item.vy += (item.gravity ?? LOST_ITEM_GRAVITY) * dt;
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.rotation = (item.rotation || 0) + (item.rotationSpeed || 0) * dt;

    if (item.ageMs > (item.lifetimeMs ?? LOST_ITEM_MAX_LIFETIME_MS) || isLostItemOutsideField(state, item)) {
      state.frameEvents.push({
        type: 'LostItemExpired',
        lostItemId: item.id,
        itemId: item.itemId,
      });
      continue;
    }

    remainingLostItems.push(item);
  }

  state.entities.lostItems = remainingLostItems;
}

export function resolveProjectileHits(state, content = DEFAULT_SYSTEM_CONTENT) {
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
      }, content);
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
    resolveEnergyExplosion(state, projectile, skill, hitEnemy, content);
    applyAreaDamage(state, hitEnemy, impact.areaDamage, {
      skillId: projectile.skillId,
      projectileId: projectile.id,
    }, content);
    spawnHazardsFromImpact(state, skill, hitEnemy);
  }

  state.entities.projectiles = remainingProjectiles;
  state.entities.enemies = state.entities.enemies.filter((enemy) => enemy.hp > 0);
}

export function updateHazards(state, dtMs, content = DEFAULT_SYSTEM_CONTENT) {
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
      applyHazardTick(state, hazard, tickMs, content);
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

export function resolveItemPickups(state, content = DEFAULT_SYSTEM_CONTENT) {
  if (!state.entities.itemDrops?.length) return;

  const remainingDrops = [];
  for (const drop of state.entities.itemDrops) {
    const pickupCircle = {
      x: drop.x,
      y: drop.y,
      radius: drop.pickupRadius ?? drop.radius ?? 0,
    };

    if (!circlesIntersect(pickupCircle, state.player)) {
      remainingDrops.push(drop);
      continue;
    }

    const collectResult = collectPlayerItem(state, drop, content);
    state.frameEvents.push({
      type: 'ItemCollected',
      itemDropId: drop.id,
      itemId: drop.itemId,
      quantity: drop.quantity ?? 1,
      consumed: collectResult.consumed,
    });
  }

  state.entities.itemDrops = remainingDrops;
}

export function resolvePlayerContacts(state, content = DEFAULT_SYSTEM_CONTENT) {
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
      enemyType: enemy.type,
      waveIndex: enemy.waveIndex,
      waveId: enemy.waveId,
      groupId: enemy.groupId,
      damage: enemy.contactDamage,
      playerHp: state.player.hp,
    });
    losePlayerRibbonItems(state, content, {
      source: 'enemyContact',
      enemyId: enemy.id,
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
        enemyType: enemy.type,
        waveIndex: enemy.waveIndex,
        waveId: enemy.waveId,
        groupId: enemy.groupId,
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

  if (state.entities.itemDrops?.length) {
    state.entities.itemDrops = state.entities.itemDrops.filter((drop) => {
      const keepDrop = !isItemDropOutsideField(state, drop);
      if (!keepDrop) {
        state.frameEvents.push({
          type: 'ItemDropExpired',
          itemDropId: drop.id,
          itemId: drop.itemId,
        });
      }
      return keepDrop;
    });
  }
}

function applyAreaDamage(state, source, areaDamage, eventBase, content = DEFAULT_SYSTEM_CONTENT) {
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
    }, content);
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

function resolveEnergyExplosion(state, projectile, skill, source, content = DEFAULT_SYSTEM_CONTENT) {
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
  }, content);
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

function applyHazardTick(state, hazard, tickMs, content = DEFAULT_SYSTEM_CONTENT) {
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
    }, content);
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
    losePlayerRibbonItems(state, content, {
      source: 'hazard',
      hazardId: hazard.id,
    });
    if (state.player.hp <= 0) {
      state.session.gameOver = true;
    }
  }

  pushMaterialEffects(state, hazard.materialEffects.tick, hazard);
}

export function applyGpuDamageFeedback(state, feedbackRecords = [], content = DEFAULT_SYSTEM_CONTENT) {
  let hitCount = 0;

  for (const record of feedbackRecords || []) {
    if (!record || !Number.isFinite(record.x) || !Number.isFinite(record.y)) continue;

    const radius = Math.max(0, Number(record.radius) || 0);
    const damage = Math.max(0, Number(record.damage) || 0);
    if (radius <= 0 || damage <= 0) continue;

    state.frameEvents.push({
      type: 'GpuDamageFeedback',
      feedbackType: record.type || record.damageType || 'gpuReaction',
      sourceMaterial: record.sourceMaterial || null,
      x: record.x,
      y: record.y,
      radius,
      damage,
    });

    for (const enemy of state.entities.enemies) {
      if (enemy.hp <= 0) continue;
      if (distance(record, enemy) > radius + enemy.radius) continue;

      damageEnemy(state, enemy, damage, {
        type: 'GpuDamageFeedbackHit',
        feedbackType: record.type || record.damageType || 'gpuReaction',
        enemyId: enemy.id,
        radius,
      }, content);
      hitCount += 1;
    }
  }

  state.entities.enemies = state.entities.enemies.filter((enemy) => enemy.hp > 0);
  return hitCount;
}

function damageEnemy(state, enemy, damage, event, content = DEFAULT_SYSTEM_CONTENT) {
  if (!enemy || enemy.hp <= 0 || damage <= 0) return false;

  enemy.hp -= damage;
  state.frameEvents.push({
    ...event,
    enemyId: enemy.id,
    damage,
  });

  if (enemy.hp > 0) return false;

  state.session.score += Math.max(1, enemy.scoreValue ?? 1);
  state.frameEvents.push({
    type: 'EnemyKilled',
    enemyId: enemy.id,
    enemyType: enemy.type,
    waveIndex: enemy.waveIndex,
    waveId: enemy.waveId,
    groupId: enemy.groupId,
    x: enemy.x,
    y: enemy.y,
  });
  rollEnemyLootDrops(state, enemy, content);
  return true;
}

export function spawnItemDrop(state, itemId, source, content = DEFAULT_SYSTEM_CONTENT, options = {}) {
  const item = content.items?.[itemId];
  if (!item) return null;

  const drop = {
    id: state.session.nextItemDropId,
    itemId,
    quantity: Math.max(1, options.quantity ?? 1),
    x: source.x,
    y: source.y,
    radius: item.radius ?? 10,
    pickupRadius: item.pickupRadius ?? item.radius ?? 10,
    spriteUrl: item.spriteUrl,
    spriteSize: item.spriteSize ?? 24,
    visual: item.visual,
    ageMs: 0,
    driftSeed: hash01((state.session.nextItemDropId + 1) * 2654435761) * 1000,
  };
  state.session.nextItemDropId += 1;
  state.entities.itemDrops.push(drop);
  state.frameEvents.push({
    type: 'ItemDropped',
    enemyId: options.enemyId,
    itemDropId: drop.id,
    itemId,
    quantity: drop.quantity,
    x: drop.x,
    y: drop.y,
  });
  return drop;
}

function rollEnemyLootDrops(state, enemy, content = DEFAULT_SYSTEM_CONTENT) {
  const drops = content.loot?.enemyDrops || [];
  for (const dropDefinition of drops) {
    const chance = clamp(dropDefinition.chance ?? 0, 0, 1);
    if (chance <= 0) continue;
    if (chance < 1 && Math.random() >= chance) continue;

    spawnItemDrop(state, dropDefinition.itemId, enemy, content, {
      enemyId: enemy.id,
      quantity: dropDefinition.quantity ?? 1,
    });
  }
}

function collectPlayerItem(state, drop, content = DEFAULT_SYSTEM_CONTENT) {
  const item = content.items?.[drop.itemId] || {};
  const quantity = Math.max(1, drop.quantity ?? 1);
  let remainingQuantity = quantity;
  if (shouldConsumeItemOnPickup(state, item)) {
    const consumedQuantity = consumeHealingItem(state, item, {
      itemId: drop.itemId,
      quantity,
      source: 'pickup',
      itemDropId: drop.id,
    });
    remainingQuantity = Math.max(0, quantity - consumedQuantity);
    if (remainingQuantity <= 0) {
      return {
        consumed: true,
        quantity: consumedQuantity,
      };
    }
  }

  const existing = state.player.collectedItems.find((entry) => entry.itemId === drop.itemId);
  if (existing) {
    existing.quantity += remainingQuantity;
    return {
      consumed: remainingQuantity < quantity,
      entry: existing,
    };
  }

  const entry = {
    itemId: drop.itemId,
    quantity: remainingQuantity,
    name: item.name ?? drop.itemId,
    spriteUrl: item.spriteUrl ?? drop.spriteUrl,
    spriteSize: item.tailSize ?? item.spriteSize ?? drop.spriteSize ?? 24,
    visual: item.visual ?? drop.visual,
  };
  state.player.collectedItems.push(entry);
  return {
    consumed: remainingQuantity < quantity,
    entry,
  };
}

function shouldConsumeItemOnPickup(state, item) {
  return item.consumable?.type === 'heal' && state.player.hp < state.player.maxHp;
}

export function autoUsePlayerConsumables(state, content = DEFAULT_SYSTEM_CONTENT) {
  const items = state.player.collectedItems || [];
  for (let index = 0; index < items.length; index += 1) {
    const entry = items[index];
    const item = content.items?.[entry.itemId];
    if (!shouldAutoUseHealingItem(state, item)) continue;

    consumeHealingItem(state, item, {
      itemId: entry.itemId,
      quantity: 1,
      source: 'auto',
    });
    entry.quantity -= 1;
    if (entry.quantity <= 0) {
      items.splice(index, 1);
    }
    return true;
  }

  return false;
}

function shouldAutoUseHealingItem(state, item) {
  if (item?.consumable?.type !== 'heal') return false;
  const maxHp = Math.max(1, state.player.maxHp || 1);
  const hpRatio = state.player.hp / maxHp;
  return hpRatio <= (item.consumable.autoUseHpRatio ?? 0);
}

function consumeHealingItem(state, item, { itemId, quantity = 1, source, itemDropId } = {}) {
  if (item?.consumable?.type !== 'heal') return 0;

  let consumed = 0;
  for (let index = 0; index < quantity; index += 1) {
    if (state.player.hp >= state.player.maxHp) break;

    const healAmount = Math.max(0, state.player.maxHp * (item.consumable.healFraction ?? 0));
    if (healAmount <= 0) break;

    const previousHp = state.player.hp;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
    consumed += 1;
    state.frameEvents.push({
      type: 'PlayerHealed',
      itemId,
      itemDropId,
      source,
      healAmount: state.player.hp - previousHp,
      playerHp: state.player.hp,
    });
  }

  return consumed;
}

export function losePlayerRibbonItems(state, content = DEFAULT_SYSTEM_CONTENT, eventBase = {}) {
  const totalQuantity = getCollectedItemQuantity(state);
  if (totalQuantity <= 0) return 0;

  const lossRatio = lerp(ITEM_LOSS_MIN_RATIO, ITEM_LOSS_MAX_RATIO, Math.random());
  const lossCount = clamp(Math.ceil(totalQuantity * lossRatio), 1, totalQuantity);
  const lostItems = [];

  for (let index = 0; index < lossCount; index += 1) {
    const lostItem = removeRandomCollectedItemUnit(state, content);
    if (!lostItem) break;
    lostItems.push(lostItem);
  }

  if (!lostItems.length) return 0;

  const visualItems = lostItems.slice(0, LOST_ITEM_VISUAL_LIMIT);
  for (let index = 0; index < visualItems.length; index += 1) {
    spawnLostItemVisual(state, visualItems[index], content, index, visualItems.length);
  }

  const lostByItemId = {};
  for (const lostItem of lostItems) {
    lostByItemId[lostItem.itemId] = (lostByItemId[lostItem.itemId] || 0) + 1;
  }

  state.frameEvents.push({
    type: 'RibbonItemsLost',
    ...eventBase,
    lossRatio,
    lostQuantity: lostItems.length,
    totalQuantityBefore: totalQuantity,
    items: lostByItemId,
  });
  return lostItems.length;
}

function getCollectedItemQuantity(state) {
  return (state.player.collectedItems || []).reduce((total, item) => total + Math.max(0, item.quantity || 0), 0);
}

function removeRandomCollectedItemUnit(state, content = DEFAULT_SYSTEM_CONTENT) {
  const items = state.player.collectedItems || [];
  let totalQuantity = getCollectedItemQuantity(state);
  if (totalQuantity <= 0) return null;

  let roll = Math.random() * totalQuantity;
  for (let index = 0; index < items.length; index += 1) {
    const entry = items[index];
    const quantity = Math.max(0, entry.quantity || 0);
    if (roll >= quantity) {
      roll -= quantity;
      continue;
    }

    entry.quantity -= 1;
    if (entry.quantity <= 0) {
      items.splice(index, 1);
    }

    const item = content.items?.[entry.itemId] || {};
    return {
      itemId: entry.itemId,
      spriteUrl: entry.spriteUrl ?? item.spriteUrl,
      spriteSize: entry.spriteSize ?? item.tailSize ?? item.spriteSize ?? 24,
      visual: entry.visual ?? item.visual,
    };
  }

  return null;
}

function spawnLostItemVisual(state, lostItem, content = DEFAULT_SYSTEM_CONTENT, index = 0, total = 1) {
  const item = content.items?.[lostItem.itemId] || {};
  const randomAngle = -Math.PI * 0.9 + Math.random() * Math.PI * 0.8;
  const fanOffset = total > 1 ? (index / Math.max(1, total - 1) - 0.5) * Math.PI * 0.7 : 0;
  const angle = randomAngle + fanOffset;
  const horizontalSpeed = LOST_ITEM_HORIZONTAL_SPEED_MIN + Math.random() * LOST_ITEM_HORIZONTAL_SPEED_RANGE;
  const liftSpeed = LOST_ITEM_LIFT_SPEED_MIN + Math.random() * LOST_ITEM_LIFT_SPEED_RANGE;
  const lostVisual = {
    id: state.session.nextLostItemId,
    itemId: lostItem.itemId,
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(angle) * horizontalSpeed,
    vy: -liftSpeed + Math.sin(angle) * 70,
    gravity: LOST_ITEM_GRAVITY,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 9,
    radius: item.radius ?? 10,
    spriteUrl: lostItem.spriteUrl ?? item.spriteUrl,
    spriteSize: lostItem.spriteSize ?? item.tailSize ?? item.spriteSize ?? 24,
    visual: lostItem.visual ?? item.visual,
    ageMs: 0,
    lifetimeMs: LOST_ITEM_MAX_LIFETIME_MS,
  };
  state.session.nextLostItemId += 1;
  state.entities.lostItems.push(lostVisual);
  return lostVisual;
}

function isLostItemOutsideField(state, item) {
  const radius = item.radius ?? 0;
  return (
    item.x < -LOST_ITEM_DESPAWN_MARGIN - radius ||
    item.x > state.viewport.width + LOST_ITEM_DESPAWN_MARGIN + radius ||
    item.y > state.viewport.height + LOST_ITEM_DESPAWN_MARGIN + radius
  );
}

function getItemFlowConfig(content = DEFAULT_SYSTEM_CONTENT) {
  const flow = content.environment?.gasFlow || content.gasFlow || GAS_FLOW_CONFIG;
  return {
    windX: clamp(flow.windX ?? GAS_FLOW_CONFIG.windX, -1, 1),
    windY: clamp(flow.windY ?? GAS_FLOW_CONFIG.windY, -1, 1),
    windStrength: clamp(flow.windStrength ?? GAS_FLOW_CONFIG.windStrength, 0, 255),
    noiseStrength: clamp(flow.noiseStrength ?? GAS_FLOW_CONFIG.noiseStrength, 0, 255),
    noiseScale: clamp(flow.noiseScale ?? GAS_FLOW_CONFIG.noiseScale, 1, 255),
    noiseSpeed: clamp(flow.noiseSpeed ?? GAS_FLOW_CONFIG.noiseSpeed, 1, 255),
  };
}

function sampleItemDropDrift(drop, flow, elapsedSeconds) {
  const windRatio = flow.windStrength / 255;
  const noiseRatio = flow.noiseStrength / 255;
  const noiseTime = elapsedSeconds * flow.noiseSpeed * 0.22;
  const seed = drop.driftSeed ?? drop.id ?? 1;
  const angle = (
    Math.sin((drop.x + seed * 17) / flow.noiseScale + noiseTime) +
    Math.cos((drop.y - seed * 13) / flow.noiseScale - noiseTime * 0.8)
  ) * Math.PI;

  return {
    x: flow.windX * ITEM_MAX_WIND_SPEED * windRatio + Math.cos(angle) * ITEM_MAX_NOISE_SPEED * noiseRatio,
    y: flow.windY * ITEM_MAX_WIND_SPEED * windRatio + Math.sin(angle) * ITEM_MAX_NOISE_SPEED * noiseRatio,
  };
}

function isItemDropOutsideField(state, drop) {
  const radius = drop.radius ?? 0;
  return (
    drop.x < -radius ||
    drop.x > state.viewport.width + radius ||
    drop.y < -radius ||
    drop.y > state.viewport.height + radius
  );
}

function pushSkillEffects(state, skill, phase, source) {
  pushMaterialEffects(state, getSkillMaterialEffects(skill, phase), source);
}

function getSkillMaterialEffects(skill, phase) {
  return skill?.materialEffects?.[phase] || skill?.effects?.[phase] || [];
}

function getSkillForProjectile(content, projectile) {
  if (projectile.skillSnapshot) return projectile.skillSnapshot;
  const skills = content.skills || {};
  if (skills[projectile.skillId]) return skills[projectile.skillId];
  return Object.values(skills).find((skill) => skill.id === projectile.skillId) || null;
}

function clearCommandInput(state) {
  if (!state.input) return;
  state.input.confirmPressed = false;
  state.input.rotateLoadoutLeftPressed = false;
  state.input.rotateLoadoutRightPressed = false;
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
