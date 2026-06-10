import { describe, expect, it } from "vitest";

import { applyCommand } from "../core/state/commandReducer";
import { createInitialGameState } from "../core/state/GameState";

describe("applyCommand", () => {
  it("maps movement commands into player intent", () => {
    const moved = applyCommand(createInitialGameState(), { type: "MovePlayer", x: 2, y: 0, source: "keyboard" });

    expect(moved.player.movement).toEqual({ x: 1, y: 0 });
  });

  it("selects and moves inventory slots without mutating the previous state", () => {
    const initial = createInitialGameState();
    const selected = applyCommand(initial, { type: "UseInventorySlot", slotIndex: 0 });
    const moved = applyCommand(selected, { type: "MoveInventoryItem", fromIndex: 0, toIndex: 1 });

    expect(initial.inventory.selectedSlotIndex).toBeNull();
    expect(selected.inventory.selectedSlotIndex).toBe(0);
    expect(moved.inventory.bag[1]?.itemId).toBe(initial.inventory.bag[0]?.itemId);
  });

  it("uses consumable hotbar items when the selected slot has an immediate effect", () => {
    const initial = createInitialGameState();
    const damaged = {
      ...initial,
      player: {
        ...initial.player,
        hp: { ...initial.player.hp, current: 60 },
      },
    };
    const used = applyCommand(damaged, { type: "UseInventorySlot", slotIndex: 3 });

    expect(used.player.hp.current).toBe(90);
    expect(used.inventory.bag[3]?.itemId).toBeNull();
  });

  it("applies level rewards and shop purchases through commands", () => {
    const rewarded = applyCommand(createInitialGameState(), {
      type: "SelectLevelUpReward",
      rewardId: "skill-point",
    });
    const purchased = applyCommand(rewarded, { type: "BuyShopItem", offerId: "offer-hp-potion" });

    expect(rewarded.progression.skillPoints).toBe(3);
    expect(purchased.inventory.gold).toBe(166);
    expect(purchased.inventory.bag.find((slot) => slot.index === 8)?.itemId).toBe("hp-potion");
    expect(purchased.shop.purchaseCounts["offer-hp-potion"]).toBe(1);
  });

  it("rerolls shop offers through state and charges the reroll cost", () => {
    const rerolled = applyCommand(createInitialGameState(), { type: "RerollShopOffers" });

    expect(rerolled.inventory.gold).toBe(160);
    expect(rerolled.shop.rerollCount).toBe(1);
    expect(rerolled.shop.offerIds[0]).not.toBe("offer-fire-staff");
  });

  it("unlocks skills and dismisses level-up modals through commands", () => {
    const initial = {
      ...createInitialGameState(),
      progression: {
        ...createInitialGameState().progression,
        pendingLevelUpRewards: 1,
      },
    };
    const unlocked = applyCommand(initial, { type: "UnlockSkill", skillId: "steam-veil" });
    const dismissed = applyCommand(unlocked, { type: "DismissModal", modalId: "level-up" });

    expect(unlocked.progression.unlockedSkillIds).toContain("steam-veil");
    expect(unlocked.progression.skillPoints).toBe(1);
    expect(dismissed.progression.pendingLevelUpRewards).toBe(0);
  });

  it("answers revive quiz commands into revive buffs or game over", () => {
    const initial = {
      ...createInitialGameState(),
      player: {
        ...createInitialGameState().player,
        hp: { ...createInitialGameState().player.hp, current: 1 },
      },
      session: {
        ...createInitialGameState().session,
        reviveQuiz: {
          id: "revive-arcana-1",
          promptKey: "revive.quiz.basic.prompt",
          answerKey: "revive.quiz.basic.choice.correct",
          choiceKeys: ["revive.quiz.basic.choice.correct", "revive.quiz.basic.choice.wrong"],
          attemptsRemaining: 1,
        },
      },
    };

    const revived = applyCommand(initial, {
      type: "AnswerReviveQuiz",
      answerKey: "revive.quiz.basic.choice.correct",
    });
    const failed = applyCommand(initial, {
      type: "AnswerReviveQuiz",
      answerKey: "revive.quiz.basic.choice.wrong",
    });

    expect(revived.player.hp.current).toBeGreaterThan(1);
    expect(revived.progression.activeBuffIds).toContain("revive-focus");
    expect(failed.session.gameOver).toBe(true);
    expect(failed.progression.activeDebuffIds).toContain("failed-revive");
  });
});
