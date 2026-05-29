// Responsibility: Calculate experience thresholds and level-up state transitions.
// Owner: features/progression

import type { PlayerState } from "../../core/state/PlayerState";

export function experienceForLevel(level: number): number {
  return Math.floor(80 + (level - 1) * 55 + (level - 1) * (level - 1) * 12);
}

export function addExperience(player: PlayerState, gainedExperience: number): PlayerState {
  let level = player.level;
  let experience = player.experience + gainedExperience;

  while (experience >= experienceForLevel(level)) {
    experience -= experienceForLevel(level);
    level += 1;
  }

  return {
    ...player,
    level,
    experience,
  };
}
