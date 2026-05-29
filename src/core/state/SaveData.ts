// Responsibility: Define the versioned save payload stored outside runtime state.
// Owner: core/state

import type { EnvironmentKind } from "./EnvironmentState";
import type { EquipmentSlotKind } from "./InventoryState";

export const currentSaveVersion = 1;

export interface SaveInventorySlotData {
  readonly index: number;
  readonly itemId: string | null;
  readonly quantity: number;
}

export interface SaveEquipmentSlotData {
  readonly slot: EquipmentSlotKind;
  readonly itemId: string | null;
}

export interface SaveDataV1 {
  readonly version: 1;
  readonly savedAt: string;
  readonly session: {
    readonly elapsedMs: number;
    readonly waveElapsedMs?: number;
    readonly waveIndex: number;
    readonly reviveUsed?: boolean;
  };
  readonly player: {
    readonly level: number;
    readonly experience: number;
    readonly hpCurrent: number;
    readonly manaCurrent: number;
  };
  readonly inventory: {
    readonly gold: number;
    readonly gems: number;
    readonly equipment: readonly SaveEquipmentSlotData[];
    readonly bag: readonly SaveInventorySlotData[];
  };
  readonly progression: {
    readonly skillPoints: number;
    readonly unlockedSkillIds: readonly string[];
    readonly pendingLevelUpRewards?: number;
  };
  readonly shop?: {
    readonly offerIds: readonly string[];
    readonly rerollCount: number;
    readonly purchaseCounts: Readonly<Record<string, number>>;
  };
  readonly environment: {
    readonly kind: EnvironmentKind;
    readonly seed: number;
  };
}

export type SaveData = SaveDataV1;

export interface SaveDataV0 {
  readonly version?: 0;
  readonly level?: number;
  readonly experience?: number;
  readonly gold?: number;
  readonly gems?: number;
}

export type UnknownSaveData = SaveData | SaveDataV0 | Record<string, unknown>;
