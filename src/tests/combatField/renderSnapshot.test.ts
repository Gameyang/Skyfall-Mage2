import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../../core/state/GameState";
import { createRenderSnapshot } from "../../render/snapshots/createRenderSnapshot";

describe("createRenderSnapshot", () => {
  it("creates renderer-facing data without exposing full game state", () => {
    const snapshot = createRenderSnapshot(createInitialGameState());

    expect(snapshot.enemyPositions).toHaveLength(1);
    expect(snapshot.itemDropPositions).toHaveLength(1);
    expect(snapshot.sprites.map((sprite) => sprite.kind)).toEqual(["player", "enemy", "item"]);
    expect(snapshot.sprites.every((sprite) => sprite.textureUrl.includes(".webp"))).toBe(true);
    expect(snapshot.sprites.find((sprite) => sprite.kind === "player")?.statusEffects).toContain("buff");
    expect(snapshot.activeEmitterCount).toBe(0);
    expect("inventory" in snapshot).toBe(false);
  });
});
