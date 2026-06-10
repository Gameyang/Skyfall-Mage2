// Responsibility: Convert combat intent already stored in state into field-facing requests.
// Owner: features/combat

import type { Vec2 } from "../../core/math/vector";
import type { ActiveEmitterState } from "../../core/state/BattleFieldState";
import type { EnemyState } from "../../core/state/EntityState";
import type { InventoryState } from "../../core/state/InventoryState";
import { starterItemById } from "../../content/items/starterItems";
import type { WeaponAttackBlock } from "../../content/items/ItemDefinition";
import type { MaterialEmitter } from "../combatField/CombatFieldTypes";

export const fallbackWeaponTargetDetectionRange = 0.36;

export interface WeaponTargetingConfig {
  readonly detectionRange: number;
}

export interface AttackTarget {
  readonly enemyId: string;
  readonly position: Vec2;
}

export function activeEmitterToMaterialEmitter(emitter: ActiveEmitterState): MaterialEmitter {
  return {
    material: emitter.material,
    x: emitter.x,
    y: emitter.y,
    radius: emitter.radius,
    strength: emitter.strength,
    ttlMs: emitter.ttlMs,
  };
}

export function resolveEquippedWeaponTargeting(inventory: InventoryState): WeaponTargetingConfig {
  const weaponItemId = inventory.equipment.find((slot) => slot.slot === "weapon")?.itemId;
  const weapon = weaponItemId ? starterItemById.get(weaponItemId) : null;

  return {
    detectionRange: weapon?.weaponTargeting?.detectionRange ?? fallbackWeaponTargetDetectionRange,
  };
}

export function resolveEquippedWeaponAttack(inventory: InventoryState): WeaponAttackBlock | null {
  const weaponItemId = inventory.equipment.find((slot) => slot.slot === "weapon")?.itemId;
  const weapon = weaponItemId ? starterItemById.get(weaponItemId) : null;

  return weapon?.weaponAttack ?? null;
}

export function selectNearestAttackTarget(
  playerPosition: Vec2,
  enemies: readonly EnemyState[],
  detectionRange: number,
): AttackTarget | null {
  const rangeSquared = detectionRange * detectionRange;
  let nearest: { readonly enemy: EnemyState; readonly distanceSquared: number } | null = null;

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const distanceSquared =
      (enemy.position.x - playerPosition.x) * (enemy.position.x - playerPosition.x) +
      (enemy.position.y - playerPosition.y) * (enemy.position.y - playerPosition.y);

    if (distanceSquared > rangeSquared) {
      continue;
    }

    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { enemy, distanceSquared };
    }
  }

  return nearest ? { enemyId: nearest.enemy.id, position: nearest.enemy.position } : null;
}

export function resolveEquippedAttackMaterial(inventory: InventoryState): ActiveEmitterState["material"] {
  const weaponItemId = inventory.equipment.find((slot) => slot.slot === "weapon")?.itemId;
  const weapon = weaponItemId ? starterItemById.get(weaponItemId) : null;

  switch (weapon?.materialAffinity) {
    case "fire":
      return "fire";
    case "water":
    case "ice":
      return "water";
    case "force":
      return "force";
    case "spark":
    default:
      return "spark";
  }
}
