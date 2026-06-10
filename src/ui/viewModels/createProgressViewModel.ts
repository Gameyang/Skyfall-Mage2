// Responsibility: Derive player and progression display data.
// Owner: ui/viewModels

import type { GameState } from "../../core/state/GameState";
import { t } from "../../content/strings/GameStrings";

export interface ProgressViewModel {
  readonly playerName: string;
  readonly level: number;
  readonly hpCurrent: number;
  readonly hpMax: number;
  readonly manaCurrent: number;
  readonly manaMax: number;
  readonly skillPoints: number;
  readonly environment: string;
}

export function createProgressViewModel(state: GameState): ProgressViewModel {
  return {
    playerName: t(state.player.nameKey),
    level: state.player.level,
    hpCurrent: state.player.hp.current,
    hpMax: state.player.hp.max,
    manaCurrent: state.player.mana.current,
    manaMax: state.player.mana.max,
    skillPoints: state.progression.skillPoints,
    environment: t(`environment.${state.environment.kind}`),
  };
}
