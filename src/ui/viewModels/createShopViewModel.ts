// Responsibility: Provide initial shop offer view data.
// Owner: ui/viewModels

import { starterItemById } from "../../content/items/starterItems";
import { t } from "../../content/strings/GameStrings";
import type { GameState } from "../../core/state/GameState";
import { quoteShopPrice } from "../../features/shop/PriceRules";
import { getShopRerollCost, starterShopOfferById } from "../../features/shop/ShopSystem";

export interface ShopOfferView {
  readonly id: string;
  readonly label: string;
  readonly price: number;
  readonly remainingStock: number;
  readonly disabled: boolean;
}

export interface ShopViewModel {
  readonly rerollCost: number;
  readonly rerollDisabled: boolean;
  readonly offers: readonly ShopOfferView[];
}

export function createShopViewModel(state: GameState): ShopViewModel {
  const rerollCost = getShopRerollCost(state.shop.rerollCount);

  return {
    rerollCost,
    rerollDisabled: state.inventory.gold < rerollCost,
    offers: state.shop.offerIds.flatMap((offerId) => {
      const offer = starterShopOfferById.get(offerId);

      if (!offer) {
        return [];
      }

      const item = starterItemById.get(offer.itemId);
      const price = quoteShopPrice(
        offer,
        { hasVipMembership: false, hasSeasonPass: false, couponCount: 0 },
        false,
      ).finalPrice;
      const remainingStock = Math.max(0, offer.stock - (state.shop.purchaseCounts[offer.id] ?? 0));

      return [
        {
          id: offer.id,
          label: item ? t(item.nameKey) : offer.itemId,
          price,
          remainingStock,
          disabled: remainingStock <= 0 || state.inventory.gold < price,
        },
      ];
    }),
  };
}
