// Responsibility: Derive battle panel view data from serializable game state.
// Owner: ui/viewModels

import type { GameState } from "../../core/state/GameState";

export interface BattleViewModel {
  readonly elapsedSeconds: number;
  readonly waveLabel: string;
  readonly fieldLabel: string;
  readonly playerXPercent: number;
  readonly playerYPercent: number;
  readonly aimXPercent: number;
  readonly aimYPercent: number;
  readonly hasAttackTarget: boolean;
  readonly enemies: readonly {
    readonly id: string;
    readonly xPercent: number;
    readonly yPercent: number;
    readonly hpPercent: number;
  }[];
  readonly itemDrops: readonly {
    readonly id: string;
    readonly itemId: string;
    readonly xPercent: number;
    readonly yPercent: number;
  }[];
  readonly emitterCount: number;
}

export function createBattleViewModel(state: GameState): BattleViewModel {
  return {
    elapsedSeconds: Math.floor(state.session.elapsedMs / 1000),
    waveLabel: `Wave ${state.session.waveIndex}`,
    fieldLabel: `${state.battleField.gridWidth} x ${state.battleField.gridHeight}`,
    playerXPercent: state.player.position.x * 100,
    playerYPercent: state.player.position.y * 100,
    aimXPercent: state.player.aim.x * 100,
    aimYPercent: state.player.aim.y * 100,
    hasAttackTarget: state.player.attacking,
    enemies: state.entities.enemies.map((enemy) => ({
      id: enemy.id,
      xPercent: enemy.position.x * 100,
      yPercent: enemy.position.y * 100,
      hpPercent: enemy.maxHp <= 0 ? 0 : enemy.hp / enemy.maxHp,
    })),
    itemDrops: state.entities.itemDrops
      .filter((drop) => !drop.collected)
      .map((drop) => ({
        id: drop.id,
        itemId: drop.itemId,
        xPercent: drop.position.x * 100,
        yPercent: drop.position.y * 100,
      })),
    emitterCount: state.battleField.activeEmitters.length,
  };
}
