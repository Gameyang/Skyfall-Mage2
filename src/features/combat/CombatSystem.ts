// Responsibility: Convert combat intent already stored in state into field-facing requests.
// Owner: features/combat

import type { ActiveEmitterState } from "../../core/state/BattleFieldState";
import type { InventoryState } from "../../core/state/InventoryState";
import { starterItemById } from "../../content/items/starterItems";
import type { MaterialEmitter } from "../combatField/CombatFieldTypes";

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
