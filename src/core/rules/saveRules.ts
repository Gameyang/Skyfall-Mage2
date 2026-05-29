// Responsibility: Convert between GameState and versioned save data.
// Owner: core/rules

import { createInitialGameState, type GameState } from "../state/GameState";
import { currentSaveVersion, type SaveData, type SaveDataV0, type UnknownSaveData } from "../state/SaveData";

export function serializeGameState(state: GameState, savedAt = new Date().toISOString()): SaveData {
  return {
    version: currentSaveVersion,
    savedAt,
    session: {
      elapsedMs: state.session.elapsedMs,
      waveElapsedMs: state.session.waveElapsedMs,
      waveIndex: state.session.waveIndex,
      reviveUsed: state.session.reviveUsed,
    },
    player: {
      level: state.player.level,
      experience: state.player.experience,
      hpCurrent: state.player.hp.current,
      manaCurrent: state.player.mana.current,
    },
    inventory: {
      gold: state.inventory.gold,
      gems: state.inventory.gems,
      equipment: state.inventory.equipment.map((slot) => ({ slot: slot.slot, itemId: slot.itemId })),
      bag: state.inventory.bag.map((slot) => ({ index: slot.index, itemId: slot.itemId, quantity: slot.quantity })),
    },
    progression: {
      skillPoints: state.progression.skillPoints,
      unlockedSkillIds: state.progression.unlockedSkillIds,
      pendingLevelUpRewards: state.progression.pendingLevelUpRewards,
    },
    shop: {
      offerIds: state.shop.offerIds,
      rerollCount: state.shop.rerollCount,
      purchaseCounts: state.shop.purchaseCounts,
    },
    environment: {
      kind: state.environment.kind,
      seed: state.environment.seed,
    },
  };
}

export function hydrateGameState(save: SaveData): GameState {
  const initial = createInitialGameState();

  return {
    ...initial,
    session: {
      ...initial.session,
      elapsedMs: save.session.elapsedMs,
      waveElapsedMs: save.session.waveElapsedMs ?? initial.session.waveElapsedMs,
      waveIndex: save.session.waveIndex,
      reviveUsed: save.session.reviveUsed ?? initial.session.reviveUsed,
    },
    player: {
      ...initial.player,
      level: save.player.level,
      experience: save.player.experience,
      hp: {
        ...initial.player.hp,
        current: Math.min(save.player.hpCurrent, initial.player.hp.max),
      },
      mana: {
        ...initial.player.mana,
        current: Math.min(save.player.manaCurrent, initial.player.mana.max),
      },
    },
    inventory: {
      ...initial.inventory,
      gold: save.inventory.gold,
      gems: save.inventory.gems,
      equipment: initial.inventory.equipment.map((slot) => {
        const savedSlot = save.inventory.equipment.find((entry) => entry.slot === slot.slot);
        return savedSlot ? { ...slot, itemId: savedSlot.itemId } : slot;
      }),
      bag: initial.inventory.bag.map((slot) => {
        const savedSlot = save.inventory.bag.find((entry) => entry.index === slot.index);
        return savedSlot ? { ...slot, itemId: savedSlot.itemId, quantity: savedSlot.quantity } : slot;
      }),
    },
    progression: {
      ...initial.progression,
      skillPoints: save.progression.skillPoints,
      unlockedSkillIds: save.progression.unlockedSkillIds,
      pendingLevelUpRewards: save.progression.pendingLevelUpRewards ?? initial.progression.pendingLevelUpRewards,
    },
    shop: save.shop
      ? {
          ...initial.shop,
          offerIds: save.shop.offerIds,
          rerollCount: save.shop.rerollCount,
          purchaseCounts: save.shop.purchaseCounts,
        }
      : initial.shop,
    environment: {
      ...initial.environment,
      kind: save.environment.kind,
      seed: save.environment.seed,
    },
  };
}

export function migrateSaveData(raw: UnknownSaveData): SaveData {
  if (isSaveDataV1(raw)) {
    return raw;
  }

  return migrateV0(raw as SaveDataV0);
}

function migrateV0(raw: SaveDataV0): SaveData {
  const initial = createInitialGameState();

  return serializeGameState(
    {
      ...initial,
      player: {
        ...initial.player,
        level: raw.level ?? initial.player.level,
        experience: raw.experience ?? initial.player.experience,
      },
      inventory: {
        ...initial.inventory,
        gold: raw.gold ?? initial.inventory.gold,
        gems: raw.gems ?? initial.inventory.gems,
      },
    },
    "1970-01-01T00:00:00.000Z",
  );
}

function isSaveDataV1(raw: UnknownSaveData): raw is SaveData {
  return raw.version === currentSaveVersion;
}
