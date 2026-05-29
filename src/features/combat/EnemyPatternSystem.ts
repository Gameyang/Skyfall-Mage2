// Responsibility: Convert boss and miniboss pattern schedules into material emitters.
// Owner: features/combat

import type { ActiveEmitterState } from "../../core/state/BattleFieldState";
import type { EnemyState } from "../../core/state/EntityState";
import type { GameState } from "../../core/state/GameState";

export function createEnemyPatternEmitters(
  state: GameState,
  nextElapsedMs: number,
  deltaMs: number,
): readonly ActiveEmitterState[] {
  return state.entities.enemies.flatMap((enemy) => createPatternEmittersForEnemy(enemy, nextElapsedMs, deltaMs));
}

function createPatternEmittersForEnemy(
  enemy: EnemyState,
  nextElapsedMs: number,
  deltaMs: number,
): readonly ActiveEmitterState[] {
  switch (enemy.patternId) {
    case "ember-ring":
      return didCrossInterval(nextElapsedMs, deltaMs, 1_200)
        ? [
            {
              id: `${enemy.id}-ember-${Math.floor(nextElapsedMs / 1_200)}`,
              material: "fire",
              x: enemy.position.x,
              y: enemy.position.y,
              radius: 0.1,
              strength: 0.72,
              ttlMs: 260,
            },
          ]
        : [];

    case "rain-pressure":
      return didCrossInterval(nextElapsedMs, deltaMs, 900)
        ? [
            {
              id: `${enemy.id}-rain-${Math.floor(nextElapsedMs / 900)}`,
              material: "water",
              x: enemy.position.x,
              y: enemy.position.y,
              radius: 0.12,
              strength: 0.68,
              ttlMs: 300,
            },
            {
              id: `${enemy.id}-pressure-${Math.floor(nextElapsedMs / 900)}`,
              material: "force",
              x: enemy.position.x,
              y: enemy.position.y,
              radius: 0.14,
              strength: 0.5,
              ttlMs: 220,
            },
          ]
        : [];

    case "none":
    default:
      return [];
  }
}

function didCrossInterval(nextElapsedMs: number, deltaMs: number, intervalMs: number): boolean {
  return Math.floor((nextElapsedMs - deltaMs) / intervalMs) < Math.floor(nextElapsedMs / intervalMs);
}
