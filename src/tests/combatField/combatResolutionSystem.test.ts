import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../../core/state/GameState";
import type { CombatFieldQueryResult } from "../../features/combatField/CombatFieldTypes";
import { resolveCombatFieldResults } from "../../features/combat/CombatResolutionSystem";
import { experienceForLevel } from "../../features/progression/ExperienceSystem";

describe("resolveCombatFieldResults", () => {
  it("applies query damage to enemies and emits death/drop state", () => {
    const state = createInitialGameState();
    const result = resolveCombatFieldResults(
      state,
      [
        createQueryResult({
          entityId: "enemy-1",
          fireCoverage: 1,
          forceCoverage: 1,
          waterCoverage: 0,
          damage: 500,
        }),
      ],
      1000,
    );

    expect(result.state.entities.enemies).toHaveLength(0);
    expect(result.state.entities.itemDrops.some((drop) => drop.id === "drop-enemy-1")).toBe(true);
    expect(result.events).toContainEqual({ type: "EnemyKilled", enemyId: "enemy-1" });
    expect(result.state.battleField.lastQueryResults).toHaveLength(1);
  });

  it("turns kill experience into pending level-up rewards", () => {
    const initial = createInitialGameState();
    const state = {
      ...initial,
      player: {
        ...initial.player,
        experience: experienceForLevel(initial.player.level) - 1,
      },
    };
    const result = resolveCombatFieldResults(
      state,
      [
        createQueryResult({
          entityId: "enemy-1",
          fireCoverage: 1,
          forceCoverage: 1,
          waterCoverage: 0,
          damage: 500,
        }),
      ],
      1000,
    );

    expect(result.state.player.level).toBe(2);
    expect(result.state.progression.pendingLevelUpRewards).toBe(1);
    expect(result.events).toContainEqual({ type: "PlayerLevelUp", level: 2 });
  });

  it("maps player field status query summaries into progression status ids", () => {
    const result = resolveCombatFieldResults(
      createInitialGameState(),
      [
        createQueryResult({
          entityId: "player",
          magicCoverage: 0.5,
          statusEffect: "magic",
        }),
      ],
      16,
    );

    expect(result.state.progression.activeBuffIds).toContain("magic-field");
  });

  it("accepts GPU query summaries for player damage and status resolution", () => {
    const result = resolveCombatFieldResults(
      createInitialGameState(),
      [
        createQueryResult({
          source: "gpu",
          entityId: "player",
          fireCoverage: 0.5,
          statusEffect: "burning",
          damage: 30,
        }),
      ],
      1000,
    );

    expect(result.state.player.hp.current).toBeLessThan(createInitialGameState().player.hp.current);
    expect(result.state.progression.activeDebuffIds).toContain("burning-field");
  });

  it("starts a revive quiz instead of ending the game on first lethal player damage", () => {
    const result = resolveCombatFieldResults(
      createInitialGameState(),
      [
        createQueryResult({
          entityId: "player",
          fireCoverage: 1,
          damage: 5_000,
        }),
      ],
      1000,
    );

    expect(result.state.session.gameOver).toBe(false);
    expect(result.state.session.reviveQuiz?.answer).toBe("4");
    expect(result.state.player.hp.current).toBe(1);
  });
});

function createQueryResult(overrides: Partial<CombatFieldQueryResult>): CombatFieldQueryResult {
  return {
    entityId: "entity",
    fireCoverage: 0,
    forceCoverage: 0,
    waterCoverage: 0,
    magicCoverage: 0,
    liquidCoverage: 0,
    solidCoverage: 0,
    movementScale: 1,
    statusEffect: null,
    damage: 0,
    ...overrides,
  };
}
