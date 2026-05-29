// Responsibility: Derive inventory panel slot data from serializable game state.
// Owner: ui/viewModels

import { starterItemById } from "../../content/items/starterItems";
import type { GameState } from "../../core/state/GameState";
import type { EquipmentSlotKind } from "../../core/state/InventoryState";
import type { SlotView } from "../components/SlotGrid";

export interface EquipmentSlotView extends SlotView {
  readonly slot: EquipmentSlotKind;
}

export interface InventoryViewModel {
  readonly gold: number;
  readonly gems: number;
  readonly equipment: readonly EquipmentSlotView[];
  readonly bag: readonly SlotView[];
}

const equipmentLabels: Record<EquipmentSlotKind, string> = {
  weapon: "Weapon",
  head: "Head",
  body: "Body",
  feet: "Feet",
};

export function createInventoryViewModel(state: GameState): InventoryViewModel {
  return {
    gold: state.inventory.gold,
    gems: state.inventory.gems,
    equipment: state.inventory.equipment.map((slot) => {
      const item = slot.itemId ? starterItemById.get(slot.itemId) : null;

      return {
        key: slot.slot,
        slot: slot.slot,
        label: item?.name ?? equipmentLabels[slot.slot],
        iconUrl: item?.iconUrl ?? null,
        empty: !item,
      };
    }),
    bag: state.inventory.bag.map((slot) => {
      const item = slot.itemId ? starterItemById.get(slot.itemId) : null;

      return {
        key: String(slot.index),
        label: item?.name ?? "Empty",
        iconUrl: item?.iconUrl ?? null,
        quantity: slot.quantity,
        selected: state.inventory.selectedSlotIndex === slot.index,
        empty: !item,
      };
    }),
  };
}
