// Responsibility: Persist and restore save data through platform storage.
// Owner: runtime

import { hydrateGameState } from "../core/rules/saveRules";
import { migrateSaveData, serializeGameState } from "../core/rules/saveRules";
import type { GameState } from "../core/state/GameState";
import type { KeyValueStorage } from "../platform/storage";

export class SaveRuntime {
  private lastSavedAtMs = 0;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key = "skyfall-mage2:save:v1",
    private readonly minSaveIntervalMs = 750,
  ) {}

  save(state: GameState): void {
    this.storage.setItem(this.key, JSON.stringify(serializeGameState(state)));
  }

  load(): GameState | null {
    const value = this.storage.getItem(this.key);

    if (!value) {
      return null;
    }

    return hydrateGameState(migrateSaveData(JSON.parse(value) as Record<string, unknown>));
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }

  saveIfDue(state: GameState, nowMs = performance.now()): void {
    if (nowMs - this.lastSavedAtMs < this.minSaveIntervalMs) {
      return;
    }

    this.save(state);
    this.lastSavedAtMs = nowMs;
  }
}
