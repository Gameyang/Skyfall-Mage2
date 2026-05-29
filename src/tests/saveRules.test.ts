import { describe, expect, it } from "vitest";

import { hydrateGameState, migrateSaveData, serializeGameState } from "../core/rules/saveRules";
import { createInitialGameState } from "../core/state/GameState";
import { currentSaveVersion } from "../core/state/SaveData";
import { SaveRuntime } from "../runtime/SaveRuntime";

describe("save rules", () => {
  it("serializes and hydrates gameplay save data without runtime resources", () => {
    const state = createInitialGameState();
    const save = serializeGameState(state, "2026-05-29T00:00:00.000Z");
    const hydrated = hydrateGameState(save);

    expect(save.version).toBe(currentSaveVersion);
    expect(save.inventory.bag).toHaveLength(20);
    expect("battleField" in save).toBe(false);
    expect(hydrated.inventory.gold).toBe(state.inventory.gold);
    expect(hydrated.player.level).toBe(state.player.level);
    expect(hydrated.shop.offerIds).toEqual(state.shop.offerIds);
  });

  it("migrates old flat saves into current schema", () => {
    const migrated = migrateSaveData({ version: 0, level: 3, experience: 240, gold: 99, gems: 2 });

    expect(migrated.version).toBe(currentSaveVersion);
    expect(migrated.player.level).toBe(3);
    expect(migrated.inventory.gold).toBe(99);
  });

  it("loads and clears localStorage-backed state through the save runtime", () => {
    const values = new Map<string, string>();
    const runtime = new SaveRuntime({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    });

    runtime.save(createInitialGameState());

    expect(runtime.load()?.inventory.bag).toHaveLength(20);
    runtime.clear();
    expect(runtime.load()).toBeNull();
  });
});
