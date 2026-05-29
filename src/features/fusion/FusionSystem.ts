// Responsibility: Calculate and apply deterministic item fusion recipes.
// Owner: features/fusion

import type { GameState } from "../../core/state/GameState";
import type { InventorySlotState } from "../../core/state/InventoryState";

export interface FusionRecipe {
  readonly inputItemIds: readonly string[];
  readonly resultItemId: string;
  readonly goldCost: number;
}

export interface FusionPreview {
  readonly resultItemId: string;
  readonly goldCost: number;
  readonly canAfford: boolean;
}

export const starterFusionRecipes: readonly FusionRecipe[] = [
  { inputItemIds: ["blizzard-staff", "fire-staff"], resultItemId: "chain-lightning-staff", goldCost: 60 },
  { inputItemIds: ["hp-potion", "mp-potion"], resultItemId: "skill-book", goldCost: 25 },
];

export function previewFusion(state: GameState, slotIndexes: readonly number[]): FusionPreview | null {
  const inputItemIds = collectFusionInputs(state.inventory.bag, slotIndexes);

  if (!inputItemIds) {
    return null;
  }

  const recipe = starterFusionRecipes.find((entry) => isSameRecipeInput(entry.inputItemIds, inputItemIds));

  if (!recipe) {
    return null;
  }

  return {
    resultItemId: recipe.resultItemId,
    goldCost: recipe.goldCost,
    canAfford: state.inventory.gold >= recipe.goldCost,
  };
}

export function fuseItems(state: GameState, slotIndexes: readonly number[]): GameState {
  const preview = previewFusion(state, slotIndexes);

  if (!preview?.canAfford || slotIndexes.length < 2) {
    return state;
  }

  const resultSlotIndex = Math.min(...slotIndexes);
  const consumedSlotIndexes = new Set(slotIndexes);

  return {
    ...state,
    inventory: {
      ...state.inventory,
      gold: state.inventory.gold - preview.goldCost,
      selectedSlotIndex: resultSlotIndex,
      bag: state.inventory.bag.map((slot) => {
        if (slot.index === resultSlotIndex) {
          return { ...slot, itemId: preview.resultItemId, quantity: 1 };
        }

        if (consumedSlotIndexes.has(slot.index)) {
          return { ...slot, itemId: null, quantity: 0 };
        }

        return slot;
      }),
    },
  };
}

function collectFusionInputs(
  bag: readonly InventorySlotState[],
  slotIndexes: readonly number[],
): readonly string[] | null {
  const uniqueSlotIndexes = [...new Set(slotIndexes)];

  if (uniqueSlotIndexes.length < 2) {
    return null;
  }

  const inputItemIds = uniqueSlotIndexes
    .map((slotIndex) => bag[slotIndex]?.itemId ?? null)
    .filter((itemId): itemId is string => Boolean(itemId))
    .sort();

  return inputItemIds.length === uniqueSlotIndexes.length ? inputItemIds : null;
}

function isSameRecipeInput(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((itemId, index) => itemId === b[index]);
}
