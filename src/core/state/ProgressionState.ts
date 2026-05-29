// Responsibility: Store serializable long-term progression state.
// Owner: core/state

export interface ProgressionState {
  readonly skillPoints: number;
  readonly unlockedSkillIds: readonly string[];
  readonly activeBuffIds: readonly string[];
  readonly activeDebuffIds: readonly string[];
  readonly pendingLevelUpRewards: number;
}

export function createInitialProgressionState(): ProgressionState {
  return {
    skillPoints: 2,
    unlockedSkillIds: ["ember-root"],
    activeBuffIds: ["starter-focus"],
    activeDebuffIds: [],
    pendingLevelUpRewards: 0,
  };
}
