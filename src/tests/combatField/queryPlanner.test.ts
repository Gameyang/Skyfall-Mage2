import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../../core/state/GameState";
import { createCombatFieldQueryRequest } from "../../features/combatField/queries/CombatFieldQueryPlanner";

describe("createCombatFieldQueryRequest", () => {
  it("registers player and enemy hitboxes", () => {
    const state = createInitialGameState();
    const request = createCombatFieldQueryRequest(state);

    expect(request.hitboxes.map((hitbox) => hitbox.id)).toEqual(["player", "enemy-1"]);
  });
});
