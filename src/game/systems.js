import { GAME_CONTENT } from './content/index.js';
import { circlesIntersect, clamp, distance, normalize } from './math.js';
import { createEnemyFromWave, hasEnemyReachedExit, updateEnemyPathPosition } from './enemyPaths.js';

const PROJECTILE_DESPAWN_MARGIN = 96;

export function updateGame(state, dtMs, content = GAME_CONTENT) {
  if (state.session.gameOver) return state;

  const dt = Math.max(dtMs, 0);
  state.frameEvents = [];
  state.frameEffects = [];
  state.session.elapsedMs += dt;
  state.session.contactFlashMs = Math.max(0, state.session.contactFlashMs - dt);

  syncRuntimeCollections(state, content);
  updatePlayer(state, dt);
  updateWaveSpawns(state, content);
  updateEnemies(state, dt);
  updateAutoAttack(state, dt, content);
  updateProjectiles(state, dt);
  resolveProjectileHits(state, content);
  resolvePlayerContacts(state);
  cleanupEntities(state);

  return state;
}

export function syncRuntimeCollections(state, content = GAME_CONTENT) {
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

export function updateViewport(state, width, height) {
  state.viewport.width = Math.max(1, width);
  state.viewport.height = Math.max(1, height);
  state.player.x = clamp(state.player.x, state.player.radius, state.viewport.width - state.player.radius);
  state.player.y = clamp(state.player.y, state.player.radius, state.viewport.height - state.player.radius);
}

export function updatePlayer(state, dtMs) {
  const inputX = Number(state.input.right) - Number(state.input.left);
  const inputY = Number(state.input.down) - Number(state.input.up);
  const moving = inputX !== 0 || inputY !== 0;
  if (!moving) return;

  const direction = normalize(inputX, inputY);
  const distance = state.player.speed * (dtMs / 1000);
  state.player.x = clamp(
    state.player.x + direction.x * distance,
    state.player.radius,
    state.viewport.width - state.player.radius,
  );
  state.player.y = clamp(
    state.player.y + direction.y * distance,
    state.player.radius,
    state.viewport.height - state.player.radius,
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
  const skill = content.skills?.fireball;
  if (!skill) return;

  const skillState = state.skills.fireball || { cooldownRemainingMs: 0 };
  state.skills.fireball = skillState;
  skillState.cooldownRemainingMs = Math.max(0, skillState.cooldownRemainingMs - dtMs);
  if (skillState.cooldownRemainingMs > 0) return;

  const target = selectProgressRiskTarget(state);
  if (!target) return;

  spawnProjectileFromSkill(state, skill, target);
  skillState.cooldownRemainingMs += skill.cooldownMs;
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

export function spawnProjectileFromSkill(state, skill, target) {
  const direction = normalize(target.x - state.player.x, target.y - state.player.y);
  const projectileDefinition = skill.projectile;
  const projectile = {
    id: state.session.nextProjectileId,
    skillId: skill.id,
    x: state.player.x,
    y: state.player.y,
    vx: direction.x * projectileDefinition.speed,
    vy: direction.y * projectileDefinition.speed,
    radius: projectileDefinition.radius,
    damage: projectileDefinition.damage,
    lifetimeMs: projectileDefinition.lifetimeMs,
    ageMs: 0,
    visual: projectileDefinition.visual,
  };
  state.session.nextProjectileId += 1;
  state.entities.projectiles.push(projectile);

  state.frameEvents.push({
    type: 'FireSkillCast',
    skillId: skill.id,
    projectileId: projectile.id,
    targetId: target.id,
  });
  pushSkillEffects(state, skill.effects?.cast, projectile);
}

export function updateProjectiles(state, dtMs) {
  const dt = dtMs / 1000;
  for (const projectile of state.entities.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.ageMs += dtMs;
  }
}

export function resolveProjectileHits(state, content = GAME_CONTENT) {
  const remainingProjectiles = [];
  const deadEnemyIds = new Set();

  for (const projectile of state.entities.projectiles) {
    let hitEnemy = null;
    for (const enemy of state.entities.enemies) {
      if (deadEnemyIds.has(enemy.id) || enemy.hp <= 0) continue;
      if (circlesIntersect(projectile, enemy)) {
        hitEnemy = enemy;
        break;
      }
    }

    if (!hitEnemy) {
      remainingProjectiles.push(projectile);
      continue;
    }

    hitEnemy.hp -= projectile.damage;
    state.frameEvents.push({
      type: 'ProjectileHit',
      skillId: projectile.skillId,
      projectileId: projectile.id,
      enemyId: hitEnemy.id,
      damage: projectile.damage,
    });
    pushSkillEffects(state, content.skills?.[projectile.skillId]?.effects?.hit, hitEnemy);

    if (hitEnemy.hp <= 0) {
      deadEnemyIds.add(hitEnemy.id);
      state.session.score += 1;
      state.frameEvents.push({
        type: 'EnemyKilled',
        enemyId: hitEnemy.id,
      });
    }
  }

  state.entities.projectiles = remainingProjectiles;
  if (deadEnemyIds.size > 0) {
    state.entities.enemies = state.entities.enemies.filter((enemy) => !deadEnemyIds.has(enemy.id));
  }
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

function pushSkillEffects(state, effects = [], source) {
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
  });
}
