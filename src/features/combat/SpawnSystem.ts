// Responsibility: Convert enemy definitions into serializable enemy state.
// Owner: features/combat

import { starterEnemyById } from "../../content/enemies/starterEnemies";
import type { Vec2 } from "../../core/math/vector";
import type { EnemyState } from "../../core/state/EntityState";
import type { GameState } from "../../core/state/GameState";
import { calculateEnemyScaling } from "../progression/EnemyScalingSystem";

export function createEnemySpawn(definitionId: string, position: Vec2, sequence: number, hpScale = 1): EnemyState {
  const definition = starterEnemyById.get(definitionId);

  if (!definition) {
    throw new Error(`Unknown enemy definition: ${definitionId}`);
  }

  return {
    id: `${definition.id}-${sequence}`,
    definitionId: definition.id,
    kind: definition.kind,
    patternId: definition.patternId,
    position,
    hp: Math.ceil(definition.maxHp * hpScale),
    maxHp: Math.ceil(definition.maxHp * hpScale),
  };
}

export function spawnEnemy(state: GameState, definitionId: string, position: Vec2): GameState {
  const scaling = calculateEnemyScaling(state.session.waveIndex, state.player.level);

  return {
    ...state,
    entities: {
      ...state.entities,
      enemies: [
        ...state.entities.enemies,
        createEnemySpawn(definitionId, position, state.entities.enemies.length + 1, scaling.hpScale),
      ],
    },
  };
}

export function createSingleSpawnTestState(state: GameState): GameState {
  if (state.entities.enemies.length > 0) {
    return state;
  }

  return spawnEnemy(state, "bat", { x: 0.72, y: 0.52 });
}
