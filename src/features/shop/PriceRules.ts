// Responsibility: Calculate shop prices with memberships, season pass, and coupons.
// Owner: features/shop

import type { ShopOffer, ShopUserState } from "./ShopTypes";

export interface PriceQuote {
  readonly offerId: string;
  readonly basePrice: number;
  readonly finalPrice: number;
  readonly discount: number;
  readonly usesCoupon: boolean;
}

export function quoteShopPrice(offer: ShopOffer, user: ShopUserState, useCoupon: boolean): PriceQuote {
  const membershipDiscount = user.hasVipMembership ? 0.12 : 0;
  const seasonPassDiscount = user.hasSeasonPass ? 0.08 : 0;
  const couponDiscount = useCoupon && user.couponCount > 0 ? 0.25 : 0;
  const discount = Math.min(0.65, membershipDiscount + seasonPassDiscount + couponDiscount);
  const finalPrice = Math.max(0, Math.ceil(Number((offer.basePrice * (1 - discount)).toFixed(8))));

  return {
    offerId: offer.id,
    basePrice: offer.basePrice,
    finalPrice,
    discount,
    usesCoupon: couponDiscount > 0,
  };
}
