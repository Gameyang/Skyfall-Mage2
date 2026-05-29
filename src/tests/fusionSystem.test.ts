import { describe, expect, it } from "vitest";

import { applyCommand } from "../core/state/commandReducer";
import { createInitialGameState } from "../core/state/GameState";
import { previewFusion } from "../features/fusion/FusionSystem";

describe("fusion system", () => {
  it("previews recipe result and cost from selected slots", () => {
    const preview = previewFusion(createInitialGameState(), [0, 1]);

    expect(preview).toEqual({
      resultItemId: "chain-lightning-staff",
      goldCost: 60,
      canAfford: true,
    });
  });

  it("applies FuseItems to consume inputs, charge gold, and place the result", () => {
    const fused = applyCommand(createInitialGameState(), { type: "FuseItems", slotIndexes: [0, 1] });

    expect(fused.inventory.gold).toBe(124);
    expect(fused.inventory.bag[0]?.itemId).toBe("chain-lightning-staff");
    expect(fused.inventory.bag[1]?.itemId).toBeNull();
    expect(fused.inventory.selectedSlotIndex).toBe(0);
  });
});
