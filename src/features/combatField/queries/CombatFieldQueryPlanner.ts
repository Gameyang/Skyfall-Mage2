// Responsibility: Build field query requests from serializable gameplay state.
// Owner: features/combatField/queries

import type { GameState } from "../../../core/state/GameState";
import type { CombatFieldQueryRequest, EntityHitbox } from "../CombatFieldTypes";

export function createCombatFieldQueryRequest(state: GameState): CombatFieldQueryRequest {
  return {
    frame: state.battleField.queryFrame,
    hitboxes: [
      createPlayerHitbox(state),
      ...state.entities.enemies.map((enemy): EntityHitbox => ({
        id: enemy.id,
        x: enemy.position.x,
        y: enemy.position.y,
        radius: 0.045,
      })),
    ],
  };
}

function createPlayerHitbox(state: GameState): EntityHitbox {
  return {
    id: state.player.id,
    x: state.player.position.x,
    y: state.player.position.y,
    radius: 0.04,
  };
}
