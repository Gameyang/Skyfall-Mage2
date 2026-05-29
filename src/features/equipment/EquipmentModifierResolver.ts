// Responsibility: Resolve equipped item definitions into stat and field simulation modifiers.
// Owner: features/equipment

import { starterItemById } from "../../content/items/starterItems";
import type { InventoryState } from "../../core/state/InventoryState";
import type { EquipmentModifierSummary } from "./EquipmentTypes";

export function resolveEquipmentModifiers(inventory: InventoryState): EquipmentModifierSummary {
  const stats = {
    maxHpBonus: 0,
    maxManaBonus: 0,
    moveSpeedBonus: 0,
    manaRegenBonus: 0,
  };
  const simulation = {
    emitterStrengthScale: 1,
    emitterRadiusScale: 1,
    heatScale: 1,
    forceScale: 1,
    fireResistance: 0,
    waterResistance: 0,
  };

  for (const slot of inventory.equipment) {
    if (!slot.itemId) {
      continue;
    }

    const definition = starterItemById.get(slot.itemId);

    if (!definition) {
      continue;
    }

    stats.maxHpBonus += definition.stats?.maxHp ?? 0;
    stats.maxManaBonus += definition.stats?.maxMana ?? 0;
    stats.moveSpeedBonus += definition.stats?.moveSpeed ?? 0;
    stats.manaRegenBonus += definition.stats?.manaRegen ?? 0;
    simulation.emitterStrengthScale *= definition.fieldModifiers?.emitterStrength ?? 1;
    simulation.emitterRadiusScale *= definition.fieldModifiers?.emitterRadius ?? 1;
    simulation.heatScale *= definition.fieldModifiers?.heatScale ?? 1;
    simulation.forceScale *= definition.fieldModifiers?.forceScale ?? 1;
    simulation.fireResistance += definition.fieldModifiers?.fireResistance ?? 0;
    simulation.waterResistance += definition.fieldModifiers?.waterResistance ?? 0;
  }

  return {
    stats,
    simulation: {
      ...simulation,
      fireResistance: Math.min(simulation.fireResistance, 0.8),
      waterResistance: Math.min(simulation.waterResistance, 0.8),
    },
  };
}
