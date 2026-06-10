// Responsibility: Derive inventory panel slot data from serializable game state.
// Owner: ui/viewModels

import { starterItemById } from "../../content/items/starterItems";
import { t } from "../../content/strings/GameStrings";
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

const equipmentLabelKeys: Record<EquipmentSlotKind, string> = {
  weapon: "inventory.slot.weapon",
  head: "inventory.slot.head",
  body: "inventory.slot.body",
  feet: "inventory.slot.feet",
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
        label: item ? t(item.nameKey) : t(equipmentLabelKeys[slot.slot]),
        iconUrl: item?.iconUrl ?? null,
        empty: !item,
      };
    }),
    bag: state.inventory.bag.map((slot) => {
      const item = slot.itemId ? starterItemById.get(slot.itemId) : null;

      return {
        key: String(slot.index),
        label: item ? t(item.nameKey) : t("common.empty"),
        iconUrl: item?.iconUrl ?? null,
        quantity: slot.quantity,
        selected: state.inventory.selectedSlotIndex === slot.index,
        empty: !item,
      };
    }),
  };
}
