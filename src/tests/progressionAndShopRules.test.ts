import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../core/state/GameState";
import { createInitialInventoryState } from "../core/state/InventoryState";
import { addExperience, experienceForLevel } from "../features/progression/ExperienceSystem";
import { calculateEnemyScaling } from "../features/progression/EnemyScalingSystem";
import { selectLevelUpReward } from "../features/progression/RewardSystem";
import { planWaveStep } from "../features/progression/WaveDirector";
import { quoteShopPrice } from "../features/shop/PriceRules";
import { canBuyShopOffer, rerollShopOffers, starterShopOffers } from "../features/shop/ShopSystem";

describe("progression rules", () => {
  it("levels up when experience crosses threshold", () => {
    const player = createInitialGameState().player;
    const updated = addExperience(player, experienceForLevel(player.level) + 10);

    expect(updated.level).toBe(2);
    expect(updated.experience).toBe(10);
  });

  it("applies level reward selections to progression and field condition inputs", () => {
    const state = selectLevelUpReward(createInitialGameState(), "skill-point");

    expect(state.progression.skillPoints).toBe(3);
  });

  it("plans wave spawns and environment field condition changes", () => {
    const initial = createInitialGameState();
    const plan = planWaveStep(2, 20_000, 1_000, initial.environment);

    expect(plan?.dueSpawns).toEqual(
      expect.arrayContaining([expect.objectContaining({ atMs: 18_000, enemyId: "bat", count: 2 })]),
    );
    expect(plan?.environment.kind).toBe("rain-shelf");
    expect(plan?.environment.rainRate).toBeGreaterThan(initial.environment.rainRate);
  });

  it("plans randomized test spawns and continues after authored waves", () => {
    const initial = createInitialGameState();
    const starterPlan = planWaveStep(1, 12_000, 0, initial.environment);
    const proceduralPlan = planWaveStep(4, 12_000, 0, initial.environment);

    expect(starterPlan?.dueSpawns.length).toBeGreaterThan(0);
    expect(proceduralPlan?.wave.id).toBe("test-wave-4");
    expect(proceduralPlan?.dueSpawns.length).toBeGreaterThan(0);
    expect(proceduralPlan?.dueSpawns.every((spawn) => spawn.count >= 1)).toBe(true);
  });

  it("scales enemies by wave and player level", () => {
    const scaling = calculateEnemyScaling(3, 4);

    expect(scaling.hpScale).toBeGreaterThan(1);
    expect(scaling.speedScale).toBeGreaterThan(1);
  });
});

describe("shop rules", () => {
  it("calculates price discounts from memberships and coupons", () => {
    const quote = quoteShopPrice(
      { id: "offer", itemId: "fire-staff", basePrice: 100, stock: 1 },
      { hasVipMembership: true, hasSeasonPass: true, couponCount: 1 },
      true,
    );

    expect(quote.finalPrice).toBe(55);
    expect(quote.usesCoupon).toBe(true);
  });

  it("checks purchase affordability and reroll order", () => {
    const inventory = createInitialInventoryState();
    const offer = starterShopOffers[0]!;

    expect(canBuyShopOffer(inventory, offer, { hasVipMembership: false, hasSeasonPass: false, couponCount: 0 }, false)).toBe(
      true,
    );
    expect(rerollShopOffers(1)[0]?.id).toBe(starterShopOffers[1]?.id);
  });
});
