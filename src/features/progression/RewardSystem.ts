// Responsibility: Define and apply level reward selections.
// Owner: features/progression

import type { GameState } from "../../core/state/GameState";

export type LevelRewardId = "field-heat" | "force-radius" | "skill-point";

export interface LevelReward {
  readonly id: LevelRewardId;
  readonly label: string;
  readonly fieldModifier?: {
    readonly heatDelta?: number;
    readonly forceDelta?: number;
  };
  readonly skillPoints?: number;
}

export const levelRewards: readonly LevelReward[] = [
  { id: "field-heat", label: "Field Heat", fieldModifier: { heatDelta: 0.08 } },
  { id: "force-radius", label: "Force Radius", fieldModifier: { forceDelta: 0.08 } },
  { id: "skill-point", label: "Skill Point", skillPoints: 1 },
];

export function selectLevelUpReward(state: GameState, rewardId: string): GameState {
  const reward = levelRewards.find((entry) => entry.id === rewardId);

  if (!reward) {
    return state;
  }

  return {
    ...state,
    progression: {
      ...state.progression,
      skillPoints: state.progression.skillPoints + (reward.skillPoints ?? 0),
      pendingLevelUpRewards: Math.max(0, state.progression.pendingLevelUpRewards - 1),
    },
    environment: {
      ...state.environment,
      heat: state.environment.heat + (reward.fieldModifier?.heatDelta ?? 0),
      windX: state.environment.windX + (reward.fieldModifier?.forceDelta ?? 0),
    },
  };
}
