// Responsibility: Define skill unlock costs and apply unlock decisions.
// Owner: features/progression

import type { GameState } from "../../core/state/GameState";

export interface SkillDefinition {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
  readonly requiredSkillIds: readonly string[];
}

export const starterSkills: readonly SkillDefinition[] = [
  { id: "ember-root", label: "Ember", cost: 0, requiredSkillIds: [] },
  { id: "steam-veil", label: "Steam", cost: 1, requiredSkillIds: ["ember-root"] },
  { id: "force-ring", label: "Force", cost: 2, requiredSkillIds: ["ember-root"] },
];

export function canUnlockSkill(state: GameState, skillId: string): boolean {
  const skill = starterSkills.find((entry) => entry.id === skillId);

  if (!skill || state.progression.unlockedSkillIds.includes(skill.id)) {
    return false;
  }

  return (
    state.progression.skillPoints >= skill.cost &&
    skill.requiredSkillIds.every((requiredSkillId) => state.progression.unlockedSkillIds.includes(requiredSkillId))
  );
}

export function unlockSkill(state: GameState, skillId: string): GameState {
  const skill = starterSkills.find((entry) => entry.id === skillId);

  if (!skill || !canUnlockSkill(state, skillId)) {
    return state;
  }

  return {
    ...state,
    progression: {
      ...state.progression,
      skillPoints: state.progression.skillPoints - skill.cost,
      unlockedSkillIds: [...state.progression.unlockedSkillIds, skill.id],
    },
  };
}
