// Responsibility: Reinterpret unlocked skills as material field emitters.
// Owner: features/combat

import type { ActiveEmitterState } from "../../core/state/BattleFieldState";
import type { Vec2 } from "../../core/math/vector";
import type { GameState } from "../../core/state/GameState";

export function createSkillEmitters(
  state: GameState,
  emitterId: string,
  targetPosition: Vec2 = state.player.aim,
  playerPosition: Vec2 = state.player.position,
): readonly ActiveEmitterState[] {
  const emitters: ActiveEmitterState[] = [];

  if (state.progression.unlockedSkillIds.includes("steam-veil")) {
    emitters.push({
      id: `${emitterId}-steam-veil`,
      material: "steam",
      x: targetPosition.x,
      y: targetPosition.y,
      radius: 0.075,
      strength: 0.42,
      ttlMs: 260,
    });
  }

  if (state.progression.unlockedSkillIds.includes("force-ring")) {
    emitters.push({
      id: `${emitterId}-force-ring`,
      material: "force",
      x: playerPosition.x,
      y: playerPosition.y,
      radius: 0.13,
      strength: 0.36,
      ttlMs: 220,
    });
  }

  return emitters;
}
