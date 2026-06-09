// Responsibility: Advance serializable state during a runtime tick.
// Owner: core/state

import { addVec2, clamp, normalizeVec2, scaleVec2, subtractVec2 } from "../math/vector";
import {
  resolveEquippedAttackMaterial,
  resolveEquippedWeaponTargeting,
  selectNearestAttackTarget,
} from "../../features/combat/CombatSystem";
import { createEnemyPatternEmitters } from "../../features/combat/EnemyPatternSystem";
import { createSkillEmitters } from "../../features/combat/SkillEmitterSystem";
import { resolveEquipmentModifiers } from "../../features/equipment/EquipmentModifierResolver";
import type { GameState } from "./GameState";
import {
  basePlayerHpMax,
  basePlayerManaMax,
  basePlayerManaRegenPerSecond,
  basePlayerMoveSpeedPerSecond,
} from "./PlayerState";

const enemyDespawnMargin = 0.12;

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
    x: clamp(nextPosition.x, 0.08, 0.92),
    y: clamp(nextPosition.y, 0.16, 0.86),
  };
  const enemies = advanceEnemies(state.entities.enemies, deltaSeconds);
  const projectiles = state.entities.projectiles
    .map((projectile) => ({
      ...projectile,
      position: addVec2(projectile.position, scaleVec2(projectile.direction, projectile.speedPerSecond * deltaSeconds)),
      ageMs: projectile.ageMs + deltaMs,
    }))
    .filter(
      (projectile) =>
        projectile.ageMs <= projectile.maxAgeMs &&
        projectile.position.x >= 0 &&
        projectile.position.x <= 1 &&
        projectile.position.y >= 0 &&
        projectile.position.y <= 1,
    );
  let attackCooldownRemainingMs = Math.max(0, state.player.attackCooldownRemainingMs - deltaMs);
  const weaponTargeting = resolveEquippedWeaponTargeting(state.inventory);
  const attackTarget = selectNearestAttackTarget(
    nextPlayerPosition,
    enemies,
    weaponTargeting.detectionRange,
  );
  const autoAttacking = attackTarget !== null && state.player.mana.current > 1;
  const nextAim = attackTarget?.position ?? nextPlayerPosition;
  const sustainedAttack =
    autoAttacking && attackCooldownRemainingMs <= 0
      ? createSustainedAttack(state, projectiles.length, nextPlayerPosition, nextAim)
      : null;

  if (sustainedAttack) {
    projectiles.push(sustainedAttack.projectile);
    attackCooldownRemainingMs = 180;
  }

  const projectileEmitters = projectiles.map((projectile) => ({
    id: `${projectile.materialEmitterId}-trace-${state.battleField.queryFrame}`,
    material: projectile.material,
    x: projectile.position.x,
    y: projectile.position.y,
    radius: 0.034,
    strength: 0.7,
    ttlMs: 120,
  }));
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
    materialEmitterId: emitterId,
    material: attackMaterial,
    position: playerPosition,
    direction,
    speedPerSecond: 0.72,
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
