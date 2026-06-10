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

  it("includes fireball projectiles and fire areas as renderable sprites", () => {
    const initial = createInitialGameState();
    const snapshot = createRenderSnapshot({
      ...initial,
      entities: {
        ...initial.entities,
        projectiles: [
          {
            id: "fireball",
            kind: "fireball",
            ownerId: initial.player.id,
            materialEmitterId: "fireball-emitter",
            material: "fire",
            position: { x: 0.56, y: 0.58 },
            direction: { x: 1, y: 0 },
            speedPerSecond: 0.72,
            collisionRadius: 0.035,
            ageMs: 0,
            maxAgeMs: 1_200,
            impact: {
              explosionRadius: 0.075,
              fireAreaDurationMs: 2_000,
              fireAreaDamagePerSecond: 8,
              burnDurationMs: 2_000,
              burnDamagePerSecond: 6,
            },
          },
        ],
        fireDamageAreas: [
          {
            id: "fire-area",
            ownerId: initial.player.id,
            materialEmitterId: "fire-area-emitter",
            position: { x: 0.62, y: 0.58 },
            radius: 0.075,
            remainingMs: 1_800,
            damagePerSecond: 8,
            burnDurationMs: 2_000,
            burnDamagePerSecond: 6,
          },
        ],
      },
    });

    expect(snapshot.sprites.map((sprite) => sprite.kind)).toContain("projectile");
    expect(snapshot.sprites.map((sprite) => sprite.kind)).toContain("effect");
    expect(snapshot.sprites.find((sprite) => sprite.id === "fire-area")?.statusEffects).toContain("burning-field");
  });
});
