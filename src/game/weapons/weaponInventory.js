import { cloneWeaponInstance, getBasicRevealRowCount } from './weaponRoller.js';

const MAX_EQUIPPED_WEAPONS = 3;
const DEFAULT_INVENTORY_LIMIT = 12;

export function syncWeaponRuntimeState(state) {
  if (!state.weapons) return;
  const equipped = normalizeEquippedIds(state.weapons.equippedWeaponInstanceIds);
  state.weapons.equippedWeaponInstanceIds = equipped;
  const existingRuntime = state.weapons.equippedRuntime || [];
  state.weapons.equippedRuntime = equipped.map((instanceId, slotIndex) => {
    const previous = existingRuntime.find((runtime) => runtime.slotIndex === slotIndex);
    const previousFollower = previous?.weaponInstanceId === instanceId
      ? previous.follower
      : existingRuntime.find((runtime) => runtime.weaponInstanceId === instanceId)?.follower;
    return {
      slotIndex,
      weaponInstanceId: instanceId,
      cooldownRemainingMs: previous?.weaponInstanceId === instanceId
        ? Math.max(0, previous.cooldownRemainingMs || 0)
        : 0,
      follower: previousFollower ? { ...previousFollower } : null,
    };
  });
  state.weapons.inventoryWeaponInstanceIds = uniqueIds(
    state.weapons.inventoryWeaponInstanceIds || [],
  ).filter((instanceId) => (
    !equipped.includes(instanceId) &&
    Boolean(state.weapons.weaponInstancesById?.[instanceId])
  ));
}

export function claimRevealPanelWeapon(state, panel, { replaceStrategy = 'weakest' } = {}) {
  if (!state.weapons || !panel || panel.claimState === 'claimed') return null;
  if (!isPanelClaimable(panel)) return null;

  const hidden = panel.weaponInstance;
  const finalWeapon = cloneWeaponInstance(hidden);
  const revealedAffixIds = new Set(
    panel.rows
      .filter((row) => row.type === 'affix' && row.revealed && row.affixId)
      .map((row) => row.affixId),
  );
  finalWeapon.affixes = (hidden.hiddenAffixes || [])
    .filter((affix) => revealedAffixIds.has(affix.affixId))
    .map((affix) => ({ ...affix, modifiers: { ...(affix.modifiers || {}) }, tags: [...(affix.tags || [])] }));
  finalWeapon.hiddenAffixes = [];
  finalWeapon.displayName = createFinalWeaponName(finalWeapon, panel);

  state.weapons.weaponInstancesById[finalWeapon.instanceId] = finalWeapon;
  addWeaponToInventory(state, finalWeapon.instanceId);
  const equippedSlotIndex = equipClaimedWeapon(state, finalWeapon.instanceId, { replaceStrategy });
  panel.claimState = 'claimed';

  state.frameEvents.push({
    type: 'WeaponClaimed',
    weaponInstanceId: finalWeapon.instanceId,
    definitionId: finalWeapon.definitionId,
    rarity: finalWeapon.rarity,
    affixCount: finalWeapon.affixes.length,
    equippedSlotIndex,
  });

  return {
    weapon: finalWeapon,
    equippedSlotIndex,
  };
}

export function rotateEquippedWeapons(state, direction = 1) {
  if (!state.weapons?.equippedWeaponInstanceIds) return false;
  const equipped = normalizeEquippedIds(state.weapons.equippedWeaponInstanceIds);
  const normalizedDirection = direction < 0 ? -1 : 1;
  if (normalizedDirection > 0) {
    equipped.unshift(equipped.pop());
  } else {
    equipped.push(equipped.shift());
  }
  state.weapons.equippedWeaponInstanceIds = equipped;
  state.weapons.attackSequenceIndex = 0;
  syncWeaponRuntimeState(state);
  state.frameEvents.push({
    type: 'WeaponLoadoutRotated',
    direction: normalizedDirection,
    equippedWeaponInstanceIds: [...equipped],
  });
  return true;
}

export function consumeWeaponCommandInput(state) {
  if (!state.input) return;
  if (state.input.rotateLoadoutLeftPressed) {
    rotateEquippedWeapons(state, -1);
  } else if (state.input.rotateLoadoutRightPressed) {
    rotateEquippedWeapons(state, 1);
  }
  state.input.rotateLoadoutLeftPressed = false;
  state.input.rotateLoadoutRightPressed = false;
}

export function isPanelClaimable(panel) {
  if (!panel || panel.claimState === 'claimed') return false;
  const basicCount = getBasicRevealRowCount(panel);
  return panel.rows
    .slice(0, basicCount)
    .every((row) => row.revealed);
}

export function addWeaponToInventory(state, instanceId) {
  const inventory = state.weapons.inventoryWeaponInstanceIds || [];
  state.weapons.inventoryWeaponInstanceIds = inventory;
  if (!inventory.includes(instanceId)) inventory.push(instanceId);

  while (inventory.length > DEFAULT_INVENTORY_LIMIT) {
    const removed = inventory.shift();
    state.frameEvents.push({
      type: 'WeaponInventoryOverflowDiscarded',
      weaponInstanceId: removed,
    });
  }
}

export function equipWeaponInSlot(state, instanceId, slotIndex) {
  if (!state.weapons?.weaponInstancesById?.[instanceId]) return false;
  const safeSlotIndex = Math.max(0, Math.min(MAX_EQUIPPED_WEAPONS - 1, Math.floor(slotIndex)));
  const equipped = normalizeEquippedIds(state.weapons.equippedWeaponInstanceIds);
  if (equipped.includes(instanceId)) return false;

  const previous = equipped[safeSlotIndex];
  equipped[safeSlotIndex] = instanceId;
  state.weapons.equippedWeaponInstanceIds = equipped;
  removeInventoryId(state, instanceId);
  if (previous) addWeaponToInventory(state, previous);
  state.weapons.attackSequenceIndex = 0;
  syncWeaponRuntimeState(state);
  return true;
}

function equipClaimedWeapon(state, instanceId, { replaceStrategy }) {
  const equipped = normalizeEquippedIds(state.weapons.equippedWeaponInstanceIds);
  const emptyIndex = equipped.findIndex((id) => !id);
  if (emptyIndex >= 0) {
    equipWeaponInSlot(state, instanceId, emptyIndex);
    return emptyIndex;
  }

  const replaceIndex = replaceStrategy === 'weakest'
    ? findWeakestEquippedSlot(state)
    : 0;
  equipWeaponInSlot(state, instanceId, replaceIndex);
  return replaceIndex;
}

function findWeakestEquippedSlot(state) {
  let weakestIndex = 0;
  let weakestScore = Infinity;
  const equipped = normalizeEquippedIds(state.weapons.equippedWeaponInstanceIds);
  equipped.forEach((instanceId, index) => {
    const weapon = state.weapons.weaponInstancesById?.[instanceId];
    const score = weapon?.powerScore ?? 0;
    if (score < weakestScore) {
      weakestScore = score;
      weakestIndex = index;
    }
  });
  return weakestIndex;
}

function createFinalWeaponName(instance, panel) {
  const prefix = instance.affixes.find((affix) => affix.kind === 'prefix')?.name;
  const suffix = instance.affixes.find((affix) => affix.kind === 'suffix')?.name;
  const baseName = panel.weaponInstance?.displayName || instance.displayName;
  return [prefix, baseName, suffix].filter(Boolean).join(' ');
}

function removeInventoryId(state, instanceId) {
  state.weapons.inventoryWeaponInstanceIds = (state.weapons.inventoryWeaponInstanceIds || [])
    .filter((id) => id !== instanceId);
}

function normalizeEquippedIds(ids) {
  const normalized = uniqueIds(ids || []).slice(0, MAX_EQUIPPED_WEAPONS);
  while (normalized.length < MAX_EQUIPPED_WEAPONS) normalized.push(null);
  return normalized;
}

function uniqueIds(ids) {
  const seen = new Set();
  const unique = [];
  for (const id of ids) {
    if (!id || seen.has(id)) {
      if (id === null && unique.length < MAX_EQUIPPED_WEAPONS) unique.push(null);
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}
