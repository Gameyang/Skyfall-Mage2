// Responsibility: Build shop offers and resolve purchase affordability.
// Owner: features/shop

import type { InventoryState } from "../../core/state/InventoryState";
import type { ShopOffer, ShopUserState } from "./ShopTypes";
import { quoteShopPrice } from "./PriceRules";

export const starterShopOffers: readonly ShopOffer[] = [
  { id: "offer-fire-staff", itemId: "fire-staff", basePrice: 80, stock: 1 },
  { id: "offer-hp-potion", itemId: "hp-potion", basePrice: 18, stock: 3 },
  { id: "offer-skill-book", itemId: "skill-book", basePrice: 140, stock: 1 },
];

export const starterShopOfferById = new Map(starterShopOffers.map((offer) => [offer.id, offer]));

export function canBuyShopOffer(
  inventory: InventoryState,
  offer: ShopOffer,
  user: ShopUserState,
  useCoupon: boolean,
): boolean {
  return inventory.gold >= quoteShopPrice(offer, user, useCoupon).finalPrice && offer.stock > 0;
}

export function rerollShopOffers(seed: number): readonly ShopOffer[] {
  const offset = Math.abs(seed) % starterShopOffers.length;
  return [...starterShopOffers.slice(offset), ...starterShopOffers.slice(0, offset)];
}

export function getShopRerollCost(rerollCount: number): number {
  return 24 + Math.max(0, rerollCount) * 6;
}
