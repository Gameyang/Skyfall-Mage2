import { claimRevealPanelWeapon, isPanelClaimable } from '../weapons/weaponInventory.js';
import {
  finishRevealShop,
  getPlayerItemQuantity,
  spendPlayerItemQuantity,
} from './revealShopEncounter.js';

const COIN_ITEM_ID = 'coin';
const MOVEMENT_EPSILON = 0.04;

export function updateRevealShop(state, dtMs, content = {}) {
  const shop = state.revealShop;
  if (!shop || shop.status !== 'revealing') return false;

  const activePanel = getActiveRevealPanel(state);
  updateActivePanel(state, shop, activePanel);

  if (state.input?.confirmPressed) {
    tryClaimActivePanel(state, activePanel);
    state.input.confirmPressed = false;
    return true;
  }

  if (!activePanel) {
    shop.statusMessage = 'Enter a panel';
    shop.stationaryMs = 0;
    return true;
  }

  if (isPlayerMoving(state)) {
    resetActiveRowProgress(activePanel);
    shop.stationaryMs = 0;
    shop.coinSpendAccumulatorMs = 0;
    shop.statusMessage = 'Stand still to reveal';
    return true;
  }

  shop.stationaryMs += dtMs;
  if (shop.stationaryMs < shop.minStationaryMs) {
    shop.statusMessage = 'Holding...';
    return true;
  }

  const row = getActiveRevealRow(activePanel);
  if (!row) {
    shop.statusMessage = activePanel.claimState === 'claimed'
      ? 'Claimed'
      : 'Press Enter to claim';
    return true;
  }

  if (getPlayerItemQuantity(state, COIN_ITEM_ID) <= 0) {
    shop.statusMessage = 'Need coin';
    return true;
  }

  shop.coinSpendAccumulatorMs += dtMs;
  while (shop.coinSpendAccumulatorMs >= shop.coinSpendIntervalMs && !row.revealed) {
    shop.coinSpendAccumulatorMs -= shop.coinSpendIntervalMs;
    if (!spendPlayerItemQuantity(state, COIN_ITEM_ID, 1)) {
      shop.statusMessage = 'Need coin';
      break;
    }

    row.revealProgress += 1;
    state.frameEvents.push({
      type: 'RevealProgressSpent',
      panelId: activePanel.panelId,
      rowId: row.rowId,
      revealProgress: row.revealProgress,
      revealCost: row.revealCost,
    });

    if (row.revealProgress >= row.revealCost) {
      row.revealProgress = row.revealCost;
      row.revealed = true;
      activePanel.activeRowIndex = getNextHiddenRowIndex(activePanel);
      updatePanelClaimState(activePanel);
      shop.coinSpendAccumulatorMs = 0;
      shop.statusMessage = row.type === 'affix' ? 'Affix revealed' : 'Stat revealed';
      state.frameEvents.push({
        type: 'RevealRowRevealed',
        panelId: activePanel.panelId,
        rowId: row.rowId,
        rowType: row.type,
        claimState: activePanel.claimState,
      });
      break;
    }
  }

  return true;
}

export function getActiveRevealPanel(state) {
  const shop = state.revealShop;
  if (!shop?.panels?.length) return null;

  const visible = getVisibleRect(state.viewport);
  const midX = visible.x + visible.width * 0.5;
  const midY = visible.y + visible.height * 0.5;
  const horizontal = state.player.x < midX ? 'Left' : 'Right';
  const vertical = state.player.y < midY ? 'top' : 'bottom';
  const quadrant = `${vertical}${horizontal}`;
  return shop.panels.find((panel) => panel.quadrant === quadrant) || null;
}

function tryClaimActivePanel(state, panel) {
  if (!panel || !isPanelClaimable(panel)) {
    if (state.revealShop) state.revealShop.statusMessage = 'Reveal basic stats first';
    return false;
  }

  const claim = claimRevealPanelWeapon(state, panel);
  if (!claim) return false;
  finishRevealShop(state);
  return true;
}

function updateActivePanel(state, shop, activePanel) {
  shop.activePanelId = activePanel?.panelId || null;
  if (shop.activePanelId === shop.lastActivePanelId) return;

  const previous = shop.panels.find((panel) => panel.panelId === shop.lastActivePanelId);
  if (previous) resetActiveRowProgress(previous);
  shop.lastActivePanelId = shop.activePanelId;
  shop.stationaryMs = 0;
  shop.coinSpendAccumulatorMs = 0;
}

function updatePanelClaimState(panel) {
  if (panel.claimState === 'claimed') return;
  panel.claimState = isPanelClaimable(panel) ? 'claimable' : 'locked';
}

function getActiveRevealRow(panel) {
  if (!panel) return null;
  const row = panel.rows[panel.activeRowIndex];
  if (row && !row.revealed) return row;

  const nextIndex = getNextHiddenRowIndex(panel);
  panel.activeRowIndex = nextIndex;
  return panel.rows[nextIndex] || null;
}

function getNextHiddenRowIndex(panel) {
  const index = panel.rows.findIndex((row) => !row.revealed);
  return index >= 0 ? index : panel.rows.length;
}

function resetActiveRowProgress(panel) {
  const row = getActiveRevealRow(panel);
  if (!row || row.revealed) return;
  row.revealProgress = 0;
}

function isPlayerMoving(state) {
  const input = state.input || {};
  const vectorMagnitude = Math.hypot(input.vectorX || 0, input.vectorY || 0);
  return (
    vectorMagnitude > MOVEMENT_EPSILON ||
    Boolean(input.up || input.down || input.left || input.right) ||
    Boolean(state.player.recenter)
  );
}

function getVisibleRect(viewport = {}) {
  return viewport.visible || {
    x: 0,
    y: 0,
    width: viewport.width || 1,
    height: viewport.height || 1,
  };
}
