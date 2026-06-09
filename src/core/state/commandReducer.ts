// Responsibility: Apply queued commands to serializable game state.
// Owner: core/state

import { normalizeVec2 } from "../math/vector";
import { starterItemById } from "../../content/items/starterItems";
import { fuseItems } from "../../features/fusion/FusionSystem";
import { addItemToInventoryBag, useInventorySlotItem } from "../../features/inventory/InventoryMutations";
import { selectLevelUpReward } from "../../features/progression/RewardSystem";
import { unlockSkill } from "../../features/progression/SkillTreeSystem";
import { answerReviveQuiz } from "../../features/progression/QuizReviveSystem";
import { quoteShopPrice } from "../../features/shop/PriceRules";
import { getShopRerollCost, rerollShopOffers, starterShopOfferById } from "../../features/shop/ShopSystem";
import type { GameCommand } from "./Command";
import type { GameState } from "./GameState";

const defaultShopUser = {
  hasVipMembership: false,
  hasSeasonPass: false,
  couponCount: 0,
};

export function applyCommand(state: GameState, command: GameCommand): GameState {
  switch (command.type) {
    case "MovePlayer":
      return {
        ...state,
        player: {
          ...state.player,
          movement: normalizeVec2({ x: command.x, y: command.y }),
        },
      };

    case "UseInventorySlot": {
      const usedState = useInventorySlotItem(state, command.slotIndex);

      if (usedState) {
        return usedState;
      }

      return {
        ...state,
        inventory: {
          ...state.inventory,
          selectedSlotIndex: command.slotIndex,
        },
      };
    }

    case "EquipItem": {
      const item = state.inventory.bag[command.slotIndex];

      if (!item?.itemId) {
        return state;
      }

      return {
        ...state,
        inventory: {
          ...state.inventory,
          equipment: state.inventory.equipment.map((slot) =>
            slot.slot === command.equipmentSlot ? { ...slot, itemId: item.itemId } : slot,
          ),
          selectedSlotIndex: command.slotIndex,
        },
      };
    }

    case "MoveInventoryItem": {
      if (command.fromIndex === command.toIndex) {
        return state;
      }

      const bag = [...state.inventory.bag];
      const from = bag[command.fromIndex];
      const to = bag[command.toIndex];

      if (!from || !to) {
        return state;
      }

      bag[command.fromIndex] = { ...to, index: command.fromIndex };
      bag[command.toIndex] = { ...from, index: command.toIndex };

      return {
        ...state,
        inventory: {
          ...state.inventory,
          bag,
          selectedSlotIndex: command.toIndex,
        },
      };
    }

    case "PauseRuntime":
      return {
        ...state,
        session: {
          ...state.session,
          phase: "paused",
        },
      };

    case "ResumeRuntime":
      return {
        ...state,
        session: {
          ...state.session,
          phase: "running",
        },
      };

    case "SelectLevelUpReward":
      return selectLevelUpReward(state, command.rewardId);

    case "UnlockSkill":
      return unlockSkill(state, command.skillId);

    case "BuyShopItem": {
      const offer = starterShopOfferById.get(command.offerId);

      if (!offer || !state.shop.offerIds.includes(offer.id) || !starterItemById.has(offer.itemId)) {
        return state;
      }

      const purchasedCount = state.shop.purchaseCounts[offer.id] ?? 0;

      if (purchasedCount >= offer.stock) {
        return state;
      }

      const price = quoteShopPrice(offer, defaultShopUser, false).finalPrice;

      if (state.inventory.gold < price) {
        return state;
      }

      const inventory = addItemToInventoryBag(state.inventory, offer.itemId, 1);

      if (!inventory) {
        return state;
      }

      return {
        ...state,
        inventory: {
          ...inventory,
          gold: inventory.gold - price,
        },
        shop: {
          ...state.shop,
          purchaseCounts: {
            ...state.shop.purchaseCounts,
            [offer.id]: purchasedCount + 1,
          },
        },
      };
    }

    case "RerollShopOffers": {
      const price = getShopRerollCost(state.shop.rerollCount);

      if (state.inventory.gold < price) {
        return state;
      }

      return {
        ...state,
        inventory: {
          ...state.inventory,
          gold: state.inventory.gold - price,
        },
        shop: {
          ...state.shop,
          offerIds: rerollShopOffers(state.session.elapsedMs + state.shop.rerollCount + 1).map((offer) => offer.id),
          rerollCount: state.shop.rerollCount + 1,
        },
      };
    }

    case "FuseItems":
      return fuseItems(state, command.slotIndexes);

    case "DismissModal":
      if (command.modalId !== "level-up") {
        return state;
      }

      return {
        ...state,
        progression: {
          ...state.progression,
          pendingLevelUpRewards: 0,
        },
      };
    case "AnswerReviveQuiz":
      return answerReviveQuiz(state, command.answer);
    default:
      return state;
  }
}
