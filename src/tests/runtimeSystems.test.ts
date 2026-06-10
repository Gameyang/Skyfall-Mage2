import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../core/state/GameState";
import { stepGameState } from "../core/state/stateStep";
import { createEnemyPatternEmitters } from "../features/combat/EnemyPatternSystem";
import { advanceItemDropPhysics } from "../features/inventory/ItemDropPhysicsSystem";
import { resolveItemPickups } from "../features/inventory/PickupSystem";
import { advanceWaveRuntime } from "../features/progression/WaveRuntimeSystem";

describe("runtime systems", () => {
  it("applies equipment stat modifiers during state steps", () => {
    const stepped = stepGameState(createInitialGameState(), 16);

    expect(stepped.player.hp.max).toBe(128);
    expect(stepped.player.mana.max).toBe(126);
    expect(stepped.player.moveSpeedPerSecond).toBeCloseTo(0.36);
  });

  it("advances completed waves into the next wave with environment and spawn changes", () => {
    const initial = createInitialGameState();
    const result = advanceWaveRuntime(
      {
        ...initial,
        session: {
          ...initial.session,
          waveElapsedMs: 45_000,
        },
      },
      1_000,
    );

    expect(result.state.session.waveIndex).toBe(2);
    expect(result.state.environment.kind).toBe("rain-shelf");
    expect(result.state.battleField.terrainProfile).toBe("rain-shelf");
    expect(result.state.battleField.fluidLevel).toBeGreaterThan(initial.battleField.fluidLevel);
    expect(result.state.battleField.gasLevel).toBeGreaterThan(0);
    expect(result.state.entities.enemies.length).toBeGreaterThanOrEqual(3);
    expect(result.events.map((event) => event.type)).toContain("WaveStarted");
    expect(result.events.map((event) => event.type)).toContain("EnvironmentChanged");
  });

  it("spawns randomized test enemies after authored waves", () => {
    const initial = createInitialGameState();
    const result = advanceWaveRuntime(
      {
        ...initial,
        session: {
          ...initial.session,
          waveIndex: 4,
          waveElapsedMs: 12_000,
        },
      },
      12_000,
    );

    expect(result.state.session.waveIndex).toBe(4);
    expect(result.state.entities.enemies.length).toBeGreaterThan(initial.entities.enemies.length);
  });

  it("collects nearby drops into inventory resources", () => {
    const initial = createInitialGameState();
    const result = resolveItemPickups({
      ...initial,
      player: {
        ...initial.player,
        position: initial.entities.itemDrops[0]!.position,
      },
    });

    expect(result.state.inventory.gold).toBe(185);
    expect(result.state.entities.itemDrops).toHaveLength(0);
    expect(result.events[0]).toMatchObject({ type: "ItemCollected", itemId: "coin" });
  });

  it("advances item drop physics independently from pickup collection", () => {
    const initial = createInitialGameState();
    const result = advanceItemDropPhysics(initial, 100);

    expect(result.entities.itemDrops[0]?.ageMs).toBe(100);
    expect(result.entities.itemDrops[0]?.position).not.toEqual(initial.entities.itemDrops[0]?.position);
  });

  it("creates boss and miniboss pattern emitters on scheduled intervals", () => {
    const initial = createInitialGameState();
    const result = createEnemyPatternEmitters(
      {
        ...initial,
        entities: {
          ...initial.entities,
          enemies: [
            {
              id: "boss-1",
              definitionId: "rain-boss",
              kind: "boss",
              patternId: "rain-pressure",
              position: { x: 0.5, y: 0.5 },
              hp: 100,
              maxHp: 100,
            },
          ],
        },
      },
      900,
      16,
    );

    expect(result.map((emitter) => emitter.material)).toEqual(["water", "force"]);
  });
});
