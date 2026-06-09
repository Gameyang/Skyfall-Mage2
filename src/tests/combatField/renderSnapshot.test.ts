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
    expect(snapshot.environment.waterStart).toBeCloseTo(0.8);
    expect(snapshot.environment.waterCoverage).toBeCloseTo(0.2);
    expect("inventory" in snapshot).toBe(false);
  });

  it("derives water visuals from rain and field fluid levels", () => {
    const initial = createInitialGameState();
    const snapshot = createRenderSnapshot({
      ...initial,
      environment: {
        ...initial.environment,
        kind: "rain-shelf",
        rainRate: 0.32,
        windX: -0.3,
      },
      battleField: {
        ...initial.battleField,
        fluidLevel: 0.32,
      },
    });

    expect(snapshot.environment.kind).toBe("rain-shelf");
    expect(snapshot.environment.waterCoverage).toBeCloseTo(0.32);
    expect(snapshot.environment.waterStart).toBeCloseTo(0.68);
    expect(snapshot.environment.waveActivity).toBeGreaterThan(0.65);
  });
});
