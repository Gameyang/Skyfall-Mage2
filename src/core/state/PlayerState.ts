// Responsibility: Store serializable player combat and progression state.
// Owner: core/state

import type { Vec2 } from "../math/vector";
import { zeroVec2 } from "../math/vector";

export interface ResourceMeterState {
  readonly current: number;
  readonly max: number;
}

export interface PlayerState {
  readonly id: string;
  readonly name: string;
  readonly position: Vec2;
  readonly aim: Vec2;
  readonly movement: Vec2;
  readonly hp: ResourceMeterState;
  readonly mana: ResourceMeterState;
  readonly level: number;
  readonly experience: number;
  readonly moveSpeedPerSecond: number;
  readonly attacking: boolean;
  readonly attackCooldownRemainingMs: number;
}

export const basePlayerHpMax = 120;
export const basePlayerManaMax = 100;
export const basePlayerMoveSpeedPerSecond = 0.32;
export const basePlayerManaRegenPerSecond = 2;

export function createInitialPlayerState(): PlayerState {
  return {
    id: "player",
    name: "Skyfall Mage",
    position: { x: 0.5, y: 0.58 },
    aim: { x: 0.72, y: 0.42 },
    movement: zeroVec2,
    hp: { current: basePlayerHpMax, max: basePlayerHpMax },
    mana: { current: 80, max: basePlayerManaMax },
    level: 1,
    experience: 0,
    moveSpeedPerSecond: basePlayerMoveSpeedPerSecond,
    attacking: false,
    attackCooldownRemainingMs: 0,
  };
}
