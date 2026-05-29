// Responsibility: Define shop offer and user discount data.
// Owner: features/shop

export interface ShopOffer {
  readonly id: string;
  readonly itemId: string;
  readonly basePrice: number;
  readonly stock: number;
}

export interface ShopUserState {
  readonly hasVipMembership: boolean;
  readonly hasSeasonPass: boolean;
  readonly couponCount: number;
}
