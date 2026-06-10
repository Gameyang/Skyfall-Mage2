// Responsibility: Advance serializable state during a runtime tick.
// Owner: core/state

import { addVec2, clamp, normalizeVec2, scaleVec2, subtractVec2 } from "../math/vector";
import {
  resolveEquippedWeaponAttack,
  resolveEquippedAttackMaterial,
  resolveEquippedWeaponTargeting,
  selectNearestAttackTarget,
} from "../../features/combat/CombatSystem";
import { createEnemyPatternEmitters } from "../../features/combat/EnemyPatternSystem";
import { createSkillEmitters } from "../../features/combat/SkillEmitterSystem";
import { resolveEquipmentModifiers } from "../../features/equipment/EquipmentModifierResolver";
import type { FireballWeaponAttackBlock } from "../../content/items/ItemDefinition";
import type { ActiveEmitterState } from "./BattleFieldState";
import type { EnemyState, FireDamageAreaState, ProjectileState } from "./EntityState";
import type { GameState } from "./GameState";
import {
  basePlayerHpMax,
  basePlayerManaMax,
  basePlayerManaRegenPerSecond,
  basePlayerMoveSpeedPerSecond,
} from "./PlayerState";

const enemyDespawnMargin = 0.12;
const enemyHitboxRadius = 0.045;

export const playerMovementBounds = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
} as const;

export function stepGameState(state: GameState, deltaMs: number): GameState {
  const deltaSeconds = Math.min(deltaMs, 100) / 1000;
  const equipmentModifiers = resolveEquipmentModifiers(state.inventory);
  const hpMax = basePlayerHpMax + equipmentModifiers.stats.maxHpBonus;
  const manaMax = basePlayerManaMax + equipmentModifiers.stats.maxManaBonus;
  const fieldMovementScale =
    state.battleField.lastQueryResults.find((result) => result.entityId === state.player.id)?.movementScale ?? 1;
  const moveSpeedPerSecond = (basePlayerMoveSpeedPerSecond + equipmentModifiers.stats.moveSpeedBonus) * fieldMovementScale;
  const manaRegenPerSecond = basePlayerManaRegenPerSecond + equipmentModifiers.stats.manaRegenBonus;
  const nextPosition = addVec2(
    state.player.position,
    scaleVec2(state.player.movement, moveSpeedPerSecond * deltaSeconds),
  );
  const nextPlayerPosition = {
    x: clamp(nextPosition.x, playerMovementBounds.minX, playerMovementBounds.maxX),
    y: clamp(nextPosition.y, playerMovementBounds.minY, playerMovementBounds.maxY),
  };
  const enemies = advanceEnemies(state.entities.enemies, deltaSeconds);
  const projectileAdvance = advanceProjectiles(
    state.entities.projectiles,
    enemies,
    deltaSeconds,
    deltaMs,
    state.battleField.queryFrame,
  );
  const projectiles = [...projectileAdvance.projectiles];
  const fireDamageAreas = [
    ...state.entities.fireDamageAreas
      .map((area) => ({ ...area, remainingMs: area.remainingMs - deltaMs }))
      .filter((area) => area.remainingMs > 0),
    ...projectileAdvance.fireDamageAreas,
  ];
  let attackCooldownRemainingMs = Math.max(0, state.player.attackCooldownRemainingMs - deltaMs);
  const weaponTargeting = resolveEquippedWeaponTargeting(state.inventory);
  const weaponAttack = resolveEquippedWeaponAttack(state.inventory);
  const attackTarget = selectNearestAttackTarget(
    nextPlayerPosition,
    enemies,
    weaponTargeting.detectionRange,
  );
  const autoAttacking = attackTarget !== null && state.player.mana.current > 1;
  const nextAim = attackTarget?.position ?? nextPlayerPosition;
  let sustainedAttack: ReturnType<typeof createSustainedAttack> | null = null;

  if (autoAttacking && attackCooldownRemainingMs <= 0) {
    if (weaponAttack?.kind === "fireball") {
      projectiles.push(createFireballAttack(state, weaponAttack, projectiles.length, nextPlayerPosition, nextAim));
      attackCooldownRemainingMs = weaponAttack.cooldownMs;
    } else {
      sustainedAttack = createSustainedAttack(state, projectiles.length, nextPlayerPosition, nextAim);
      projectiles.push(sustainedAttack.projectile);
      attackCooldownRemainingMs = 180;
    }
  }

  const projectileEmitters = projectiles.flatMap((projectile) =>
    createProjectileTraceEmitters(projectile, state.battleField.queryFrame),
  );
  const nextElapsedMs = state.session.elapsedMs + deltaMs;
  const enemyPatternEmitters = createEnemyPatternEmitters(
    {
      ...state,
      entities: {
        ...state.entities,
        enemies,
      },
    },
    nextElapsedMs,
    deltaMs,
  );

  return {
    ...state,
    session: {
      ...state.session,
      elapsedMs: nextElapsedMs,
      waveElapsedMs: state.session.waveElapsedMs + deltaMs,
      phase: state.session.phase === "booting" ? "running" : state.session.phase,
    },
    player: {
      ...state.player,
      moveSpeedPerSecond,
      position: nextPlayerPosition,
      aim: nextAim,
      hp: {
        ...state.player.hp,
        current: clamp(state.player.hp.current, 0, hpMax),
        max: hpMax,
      },
      mana: autoAttacking
        ? {
            ...state.player.mana,
            current: clamp(state.player.mana.current - deltaSeconds * 4, 0, manaMax),
            max: manaMax,
          }
        : {
            ...state.player.mana,
            current: clamp(state.player.mana.current + deltaSeconds * manaRegenPerSecond, 0, manaMax),
            max: manaMax,
          },
      attacking: autoAttacking,
      attackCooldownRemainingMs,
    },
    entities: {
      ...state.entities,
      enemies,
      projectiles,
      fireDamageAreas,
    },
    battleField: {
      ...state.battleField,
      queryFrame: state.battleField.queryFrame + 1,
      activeEmitters: [
        ...state.battleField.activeEmitters,
        ...(sustainedAttack ? sustainedAttack.emitters : []),
        ...projectileEmitters,
        ...enemyPatternEmitters,
      ]
        .map((emitter) => ({ ...emitter, ttlMs: emitter.ttlMs - deltaMs }))
        .filter((emitter) => emitter.ttlMs > 0),
    },
  };
}

function advanceProjectiles(
  projectiles: readonly ProjectileState[],
  enemies: readonly EnemyState[],
  deltaSeconds: number,
  deltaMs: number,
  queryFrame: number,
): { readonly projectiles: readonly ProjectileState[]; readonly fireDamageAreas: readonly FireDamageAreaState[] } {
  const nextProjectiles: ProjectileState[] = [];
  const fireDamageAreas: FireDamageAreaState[] = [];

  for (const projectile of projectiles) {
    const nextPosition = addVec2(projectile.position, scaleVec2(projectile.direction, projectile.speedPerSecond * deltaSeconds));
    const nextAgeMs = projectile.ageMs + deltaMs;

    if (projectile.kind === "fireball" && projectile.impact) {
      const impact = findFirstProjectileImpact(projectile.position, nextPosition, projectile.collisionRadius, enemies);

      if (impact) {
        fireDamageAreas.push(createFireDamageArea(projectile, impact.position, queryFrame));
        continue;
      }
    }

    if (
      nextAgeMs > projectile.maxAgeMs ||
      nextPosition.x < 0 ||
      nextPosition.x > 1 ||
      nextPosition.y < 0 ||
      nextPosition.y > 1
    ) {
      continue;
    }

    nextProjectiles.push({
      ...projectile,
      position: nextPosition,
      ageMs: nextAgeMs,
    });
  }

  return { projectiles: nextProjectiles, fireDamageAreas };
}

function findFirstProjectileImpact(
  start: GameState["player"]["position"],
  end: GameState["player"]["position"],
  projectileRadius: number,
  enemies: readonly EnemyState[],
): { readonly position: GameState["player"]["position"] } | null {
  let firstImpact: { readonly position: GameState["player"]["position"]; readonly travelT: number } | null = null;
  const segment = subtractVec2(end, start);
  const segmentLengthSquared = segment.x * segment.x + segment.y * segment.y;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const offset = subtractVec2(enemy.position, start);
    const travelT =
      segmentLengthSquared <= Number.EPSILON
        ? 0
        : clamp((offset.x * segment.x + offset.y * segment.y) / segmentLengthSquared, 0, 1);
    const closestPoint = addVec2(start, scaleVec2(segment, travelT));
    const distance = Math.hypot(enemy.position.x - closestPoint.x, enemy.position.y - closestPoint.y);

    if (distance > projectileRadius + enemyHitboxRadius) {
      continue;
    }

    if (!firstImpact || travelT < firstImpact.travelT) {
      firstImpact = { position: enemy.position, travelT };
    }
  }

  return firstImpact ? { position: firstImpact.position } : null;
}

function createFireDamageArea(
  projectile: ProjectileState,
  position: GameState["player"]["position"],
  queryFrame: number,
): FireDamageAreaState {
  const impact = projectile.impact;

  if (!impact) {
    throw new Error(`Projectile ${projectile.id} has no fireball impact config`);
  }

  return {
    id: `${projectile.id}-fire-area-${queryFrame}`,
    ownerId: projectile.ownerId,
    materialEmitterId: `${projectile.materialEmitterId}-impact-${queryFrame}`,
    position,
    radius: impact.explosionRadius,
    remainingMs: impact.fireAreaDurationMs,
    damagePerSecond: impact.fireAreaDamagePerSecond,
    burnDurationMs: impact.burnDurationMs,
    burnDamagePerSecond: impact.burnDamagePerSecond,
  };
}

function createProjectileTraceEmitters(projectile: ProjectileState, queryFrame: number): readonly ActiveEmitterState[] {
  if (projectile.kind === "fireball" && projectile.ownerId === "player") {
    return [];
  }

  return [
    {
      id: `${projectile.materialEmitterId}-trace-${queryFrame}`,
      material: projectile.material,
      x: projectile.position.x,
      y: projectile.position.y,
      radius: 0.034,
      strength: 0.7,
      ttlMs: 120,
    },
  ];
}

function advanceEnemies(enemies: GameState["entities"]["enemies"], deltaSeconds: number): GameState["entities"]["enemies"] {
  return enemies
    .map((enemy) => {
      if (!enemy.velocity) {
        return enemy;
      }

      return {
        ...enemy,
        position: addVec2(enemy.position, scaleVec2(enemy.velocity, deltaSeconds)),
      };
    })
    .filter((enemy) => !enemy.despawnWhenOffscreen || !isEnemyOffscreen(enemy.position));
}

function isEnemyOffscreen(position: GameState["player"]["position"]): boolean {
  return (
    position.x < -enemyDespawnMargin ||
    position.x > 1 + enemyDespawnMargin ||
    position.y < -enemyDespawnMargin ||
    position.y > 1 + enemyDespawnMargin
  );
}

function createFireballAttack(
  state: GameState,
  weaponAttack: FireballWeaponAttackBlock,
  projectileCount: number,
  playerPosition: GameState["player"]["position"],
  targetPosition: GameState["player"]["aim"],
): ProjectileState {
  const equipmentModifiers = resolveEquipmentModifiers(state.inventory);
  const direction = normalizeVec2(subtractVec2(targetPosition, playerPosition));
  const attackMaterial = resolveEquippedAttackMaterial(state.inventory);
  const emitterId = `emitter-${state.battleField.queryFrame}-${projectileCount}-fireball`;

  return {
    id: `projectile-${state.battleField.queryFrame}-${projectileCount}-fireball`,
    kind: "fireball",
    ownerId: state.player.id,
    materialEmitterId: emitterId,
    material: attackMaterial,
    position: playerPosition,
    direction,
    speedPerSecond: weaponAttack.projectileSpeedPerSecond,
    collisionRadius: weaponAttack.projectileCollisionRadius,
    ageMs: 0,
    maxAgeMs: weaponAttack.maxAgeMs,
    impact: {
      explosionRadius: weaponAttack.explosionRadius * equipmentModifiers.simulation.emitterRadiusScale,
      fireAreaDurationMs: weaponAttack.fireAreaDurationMs,
      fireAreaDamagePerSecond:
        weaponAttack.fireAreaDamagePerSecond *
        equipmentModifiers.simulation.emitterStrengthScale *
        equipmentModifiers.simulation.heatScale,
      burnDurationMs: weaponAttack.burnDurationMs,
      burnDamagePerSecond:
        weaponAttack.burnDamagePerSecond *
        equipmentModifiers.simulation.emitterStrengthScale *
        equipmentModifiers.simulation.heatScale,
    },
  };
}

function createSustainedAttack(
  state: GameState,
  projectileCount: number,
  playerPosition: GameState["player"]["position"],
  targetPosition: GameState["player"]["aim"],
) {
  const direction = normalizeVec2(subtractVec2(targetPosition, playerPosition));
  const equipmentModifiers = resolveEquipmentModifiers(state.inventory);
  const attackMaterial = resolveEquippedAttackMaterial(state.inventory);
  const emitterId = `emitter-${state.battleField.queryFrame}-${projectileCount}-sustain`;
  const projectile = {
    id: `projectile-${state.battleField.queryFrame}-${projectileCount}-sustain`,
    kind: "legacy" as const,
    ownerId: state.player.id,
    materialEmitterId: emitterId,
    material: attackMaterial,
    position: playerPosition,
    direction,
    speedPerSecond: 0.72,
    collisionRadius: 0,
    ageMs: 0,
    maxAgeMs: 700,
  };

  return {
    projectile,
    emitters: [
      {
        id: emitterId,
        material: attackMaterial,
        x: targetPosition.x,
        y: targetPosition.y,
        radius: 0.06 * equipmentModifiers.simulation.emitterRadiusScale,
        strength: 1 * equipmentModifiers.simulation.emitterStrengthScale * equipmentModifiers.simulation.heatScale,
        ttlMs: 220,
      },
      {
        id: `${emitterId}-force`,
        material: "force" as const,
        x: targetPosition.x,
        y: targetPosition.y,
        radius: 0.08 * equipmentModifiers.simulation.emitterRadiusScale,
        strength: 0.45 * equipmentModifiers.simulation.forceScale,
        ttlMs: 180,
      },
      ...createSkillEmitters(state, emitterId, targetPosition, playerPosition),
    ],
  };
}
