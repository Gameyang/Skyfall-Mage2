// Responsibility: Apply inventory item additions and hotbar item use to serializable state.
// Owner: features/inventory

import type { GameState } from "../../core/state/GameState";
import type { InventorySlotState, InventoryState } from "../../core/state/InventoryState";

export function addItemToInventoryBag(
  inventory: InventoryState,
  itemId: string,
  quantity: number,
): InventoryState | null {
  const emptySlot = inventory.bag.find((slot) => !slot.itemId);

  if (!emptySlot) {
    return null;
  }

  return {
    ...inventory,
    bag: inventory.bag.map((slot) => (slot.index === emptySlot.index ? { ...slot, itemId, quantity } : slot)),
  };
}

export function useInventorySlotItem(state: GameState, slotIndex: number): GameState | null {
  const slot = state.inventory.bag[slotIndex];

  if (!slot?.itemId || slot.quantity <= 0) {
    return null;
  }

  switch (slot.itemId) {
    case "hp-potion":
      if (state.player.hp.current >= state.player.hp.max) {
        return null;
      }

      return {
        ...state,
        player: {
          ...state.player,
          hp: {
            ...state.player.hp,
            current: Math.min(state.player.hp.max, state.player.hp.current + 30),
          },
        },
        inventory: consumeSlotQuantity(state.inventory, slotIndex, 1),
      };

    case "mp-potion":
      if (state.player.mana.current >= state.player.mana.max) {
        return null;
      }

      return {
        ...state,
        player: {
          ...state.player,
          mana: {
            ...state.player.mana,
            current: Math.min(state.player.mana.max, state.player.mana.current + 30),
          },
        },
        inventory: consumeSlotQuantity(state.inventory, slotIndex, 1),
      };

    case "coin":
      return {
        ...state,
        inventory: {
          ...consumeSlotQuantity(state.inventory, slotIndex, slot.quantity),
          gold: state.inventory.gold + slot.quantity,
        },
      };

    case "gem":
      return {
        ...state,
        inventory: {
          ...consumeSlotQuantity(state.inventory, slotIndex, slot.quantity),
          gems: state.inventory.gems + slot.quantity,
        },
      };

    case "skill-book":
      return {
        ...state,
        progression: {
          ...state.progression,
          skillPoints: state.progression.skillPoints + 1,
        },
        inventory: consumeSlotQuantity(state.inventory, slotIndex, 1),
      };

    default:
      return null;
  }
}

function consumeSlotQuantity(inventory: InventoryState, slotIndex: number, quantity: number): InventoryState {
  return {
    ...inventory,
    bag: inventory.bag.map((slot) => (slot.index === slotIndex ? consumeSlot(slot, quantity) : slot)),
    selectedSlotIndex: null,
  };
}

function consumeSlot(slot: InventorySlotState, quantity: number): InventorySlotState {
  const nextQuantity = slot.quantity - quantity;

  if (nextQuantity > 0) {
    return { ...slot, quantity: nextQuantity };
  }

  return {
    ...slot,
    itemId: null,
    quantity: 0,
  };
}
