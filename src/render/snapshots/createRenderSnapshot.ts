// Responsibility: Convert serializable game state into renderer-facing data.
// Owner: render/snapshots

import type { GameState } from "../../core/state/GameState";
import { activeEmitterToMaterialEmitter } from "../../features/combat/CombatSystem";
import { createRenderableSprites } from "./createRenderableSprites";
import type { RenderSnapshot } from "./RenderSnapshot";

export function createRenderSnapshot(state: GameState): RenderSnapshot {
  return {
    playerPosition: state.player.position,
    aim: state.player.aim,
    enemyPositions: state.entities.enemies.map((enemy) => enemy.position),
    itemDropPositions: state.entities.itemDrops.filter((drop) => !drop.collected).map((drop) => drop.position),
    sprites: createRenderableSprites(state),
    materialEmitters: state.battleField.activeEmitters.map(activeEmitterToMaterialEmitter),
    activeEmitterCount: state.battleField.activeEmitters.length,
    elapsedMs: state.session.elapsedMs,
  };
}
