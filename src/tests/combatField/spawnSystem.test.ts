import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../../core/state/GameState";
import { createEnemySpawn, createSingleSpawnTestState, spawnEnemy } from "../../features/combat/SpawnSystem";

describe("SpawnSystem", () => {
  it("creates enemy state from starter enemy definitions", () => {
    const enemy = createEnemySpawn("bat", { x: 0.5, y: 0.4 }, 1);

    expect(enemy.definitionId).toBe("bat");
    expect(enemy.kind).toBe("normal");
    expect(enemy.patternId).toBe("none");
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.maxHp).toBeGreaterThan(0);
  });

  it("creates miniboss and boss enemies with pattern metadata", () => {
    const miniboss = createEnemySpawn("ember-miniboss", { x: 0.5, y: 0.4 }, 1);
    const boss = createEnemySpawn("rain-boss", { x: 0.5, y: 0.4 }, 2);

    expect(miniboss.kind).toBe("miniboss");
    expect(miniboss.patternId).toBe("ember-ring");
    expect(boss.kind).toBe("boss");
    expect(boss.patternId).toBe("rain-pressure");
  });

  it("supports a wave-less single spawn test mode", () => {
    const emptyState = {
      ...createInitialGameState(),
      entities: {
        enemies: [],
        projectiles: [],
        itemDrops: [],
      },
    };
    const state = createSingleSpawnTestState(emptyState);

    expect(state.entities.enemies).toHaveLength(1);
    expect(spawnEnemy(emptyState, "bat", { x: 0.2, y: 0.3 }).entities.enemies).toHaveLength(1);
  });
});
