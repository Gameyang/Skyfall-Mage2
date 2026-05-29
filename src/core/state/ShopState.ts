// Responsibility: Store serializable shop offer order and purchase counts.
// Owner: core/state

export interface ShopState {
  readonly offerIds: readonly string[];
  readonly rerollCount: number;
  readonly purchaseCounts: Readonly<Record<string, number>>;
}

export function createInitialShopState(): ShopState {
  return {
    offerIds: ["offer-fire-staff", "offer-hp-potion", "offer-skill-book"],
    rerollCount: 0,
    purchaseCounts: {},
  };
}
