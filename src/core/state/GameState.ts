// Responsibility: Compose serializable state groups for the runtime.
// Owner: core/state

import { createInitialBattleFieldState, type BattleFieldState } from "./BattleFieldState";
import { createInitialEntityState, type EntityState } from "./EntityState";
import { createInitialEnvironmentState, type EnvironmentState } from "./EnvironmentState";
import { createInitialInventoryState, type InventoryState } from "./InventoryState";
import { createInitialPlayerState, type PlayerState } from "./PlayerState";
import { createInitialProgressionState, type ProgressionState } from "./ProgressionState";
import { createInitialSessionState, type SessionState } from "./SessionState";
import { createInitialShopState, type ShopState } from "./ShopState";

export interface GameState {
  readonly session: SessionState;
  readonly player: PlayerState;
  readonly entities: EntityState;
  readonly inventory: InventoryState;
  readonly progression: ProgressionState;
  readonly shop: ShopState;
  readonly environment: EnvironmentState;
  readonly battleField: BattleFieldState;
}

export function createInitialGameState(): GameState {
  return {
    session: createInitialSessionState(),
    player: createInitialPlayerState(),
    entities: createInitialEntityState(),
    inventory: createInitialInventoryState(),
    progression: createInitialProgressionState(),
    shop: createInitialShopState(),
    environment: createInitialEnvironmentState(),
    battleField: createInitialBattleFieldState(),
  };
}
