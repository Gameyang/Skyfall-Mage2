import { createRevealPanels } from '../weapons/weaponRoller.js';

const COIN_ITEM_ID = 'coin';

export function startRevealShopAfterWave(state, content = {}, waveEvent = {}) {
  if (state.revealShop?.status === 'revealing') return state.revealShop;

  const waveIndex = Math.max(1, Math.floor(waveEvent.waveIndex || state.waves?.currentWaveNumber || 1));
  const rewardCoin = getWaveRewardCoin(waveIndex);
  addPlayerItemQuantity(state, content, COIN_ITEM_ID, rewardCoin);

  const seed = `${state.session.runSeed || 'run'}:${waveEvent.waveId || 'wave'}:${waveIndex}`;
  const panels = createRevealPanels({
    waveIndex,
    seed,
    content,
  });

  state.entities.enemies = [];
  state.entities.projectiles = [];
  state.entities.hazards = [];
  state.waves.spawnBacklog = [];
  state.session.autoSkillSequenceCooldownMs = 0;

  state.revealShop = {
    waveIndex,
    panels,
    activePanelId: null,
    lastActivePanelId: null,
    coinAtStart: getPlayerItemQuantity(state, COIN_ITEM_ID),
    rewardCoin,
    status: 'revealing',
    stationaryMs: 0,
    coinSpendAccumulatorMs: 0,
    coinSpendIntervalMs: 150,
    minStationaryMs: 180,
    statusMessage: `Wave reward +${rewardCoin} coin`,
  };

  state.frameEvents.push({
    type: 'RevealShopStarted',
    waveIndex,
    rewardCoin,
    panelCount: panels.length,
  });

  return state.revealShop;
}

export function finishRevealShop(state) {
  if (!state.revealShop) return;

  const waveIndex = state.revealShop.waveIndex;
  state.revealShop.status = 'complete';
  if (state.waves?.mode === 'sequence') {
    state.waves.waveStartedAtMs = state.session.elapsedMs;
    state.waves.delayedMs = 0;
    state.waves.started = false;
  }
  state.revealShop = null;
  state.session.autoSkillSequenceIndex = 0;
  state.session.autoSkillSequenceCooldownMs = 0;
  state.frameEvents.push({
    type: 'RevealShopCompleted',
    waveIndex,
  });
}

export function getWaveRewardCoin(waveIndex) {
  if (waveIndex <= 5) return 24 + waveIndex * 6;
  if (waveIndex <= 10) return 38 + waveIndex * 4;
  return Math.min(120, 58 + waveIndex * 5);
}

export function getPlayerItemQuantity(state, itemId) {
  return (state.player.collectedItems || [])
    .filter((entry) => entry.itemId === itemId)
    .reduce((total, entry) => total + Math.max(0, entry.quantity || 0), 0);
}

export function addPlayerItemQuantity(state, content, itemId, quantity) {
  const safeQuantity = Math.max(0, Math.floor(quantity || 0));
  if (safeQuantity <= 0) return null;

  const item = content.items?.[itemId] || {};
  const existing = state.player.collectedItems.find((entry) => entry.itemId === itemId);
  if (existing) {
    existing.quantity += safeQuantity;
    return existing;
  }

  const entry = {
    itemId,
    quantity: safeQuantity,
    name: item.name ?? itemId,
    spriteUrl: item.spriteUrl,
    spriteSize: item.tailSize ?? item.spriteSize ?? 24,
    visual: item.visual,
  };
  state.player.collectedItems.push(entry);
  return entry;
}

export function spendPlayerItemQuantity(state, itemId, quantity) {
  let remaining = Math.max(0, Math.floor(quantity || 0));
  if (remaining <= 0) return true;

  for (let index = 0; index < state.player.collectedItems.length && remaining > 0; index += 1) {
    const entry = state.player.collectedItems[index];
    if (entry.itemId !== itemId) continue;

    const spent = Math.min(entry.quantity || 0, remaining);
    entry.quantity -= spent;
    remaining -= spent;
    if (entry.quantity <= 0) {
      state.player.collectedItems.splice(index, 1);
      index -= 1;
    }
  }

  return remaining <= 0;
}
