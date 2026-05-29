// Responsibility: Generate equipment item instances from named starter generators.
// Owner: features/equipment

import { starterItems } from "../../content/items/starterItems";
import type { EquipmentSlotId, ItemRarity } from "../../content/items/ItemDefinition";
import { createItemInstance, type ItemInstance } from "../inventory/ItemFactory";

export type EquipmentGeneratorId = "starter-fire-weapon" | "starter-force-armor" | "starter-mobility-boots";

export interface EquipmentGenerator {
  readonly id: EquipmentGeneratorId;
  readonly itemDefinitionId: string;
  readonly slot: EquipmentSlotId;
  readonly rarity: ItemRarity;
}

export const equipmentGenerators: readonly EquipmentGenerator[] = [
  { id: "starter-fire-weapon", itemDefinitionId: "fire-staff", slot: "weapon", rarity: "common" },
  { id: "starter-force-armor", itemDefinitionId: "mana-pulse-armor", slot: "body", rarity: "rare" },
  { id: "starter-mobility-boots", itemDefinitionId: "blinkstep-boots", slot: "feet", rarity: "uncommon" },
];

export const equipmentGeneratorById = new Map(equipmentGenerators.map((generator) => [generator.id, generator]));

export function generateEquipment(generatorId: EquipmentGeneratorId, sequence: number): ItemInstance {
  const generator = equipmentGeneratorById.get(generatorId);

  if (!generator) {
    throw new Error(`Unknown equipment generator: ${generatorId}`);
  }

  return createItemInstance(generator.itemDefinitionId, sequence);
}

export function generateEquipmentForDrop(
  slot: EquipmentSlotId,
  rarity: ItemRarity,
  seed: number,
  sequence: number,
): ItemInstance {
  const candidates = starterItems.filter((item) => item.equipmentSlot === slot && item.rarity === rarity);

  if (candidates.length === 0) {
    throw new Error(`No equipment candidates for ${slot}/${rarity}`);
  }

  const candidate = candidates[Math.abs(seed) % candidates.length]!;

  return createItemInstance(candidate.id, sequence);
}
