// Responsibility: Reinterpret unlocked skills as material field emitters.
// Owner: features/combat

import type { ActiveEmitterState } from "../../core/state/BattleFieldState";
import type { GameState } from "../../core/state/GameState";

export function createSkillEmitters(state: GameState, emitterId: string): readonly ActiveEmitterState[] {
  const emitters: ActiveEmitterState[] = [];

  if (state.progression.unlockedSkillIds.includes("steam-veil")) {
    emitters.push({
      id: `${emitterId}-steam-veil`,
      material: "steam",
      x: state.player.aim.x,
      y: state.player.aim.y,
      radius: 0.075,
      strength: 0.42,
      ttlMs: 260,
    });
  }

  if (state.progression.unlockedSkillIds.includes("force-ring")) {
    emitters.push({
      id: `${emitterId}-force-ring`,
      material: "force",
      x: state.player.position.x,
      y: state.player.position.y,
      radius: 0.13,
      strength: 0.36,
      ttlMs: 220,
    });
  }

  return emitters;
}
