import { clamp, normalize } from '../math.js';

const DEFAULT_FACING = Object.freeze({ x: 0, y: -1 });
const FRONT_DISTANCE = 42;
const FLANK_FORWARD_DISTANCE = 18;
const FLANK_SIDE_DISTANCE = 38;
const FOLLOW_SETTLE_MS = 260;
const IDLE_DRIFT_RADIUS = 7;

const SLOT_OFFSETS = Object.freeze([
  Object.freeze({ role: 'front', forward: FRONT_DISTANCE, side: 0 }),
  Object.freeze({ role: 'upper', forward: FLANK_FORWARD_DISTANCE, side: 1 }),
  Object.freeze({ role: 'lower', forward: FLANK_FORWARD_DISTANCE, side: -1 }),
]);

export function getPlayerFacing(player = {}) {
  const x = Number.isFinite(player.facing?.x) ? player.facing.x : DEFAULT_FACING.x;
  const y = Number.isFinite(player.facing?.y) ? player.facing.y : DEFAULT_FACING.y;
  return normalize(x, y);
}

export function getEquippedWeaponSlotAnchors(state) {
  const player = state.player || {};
  const facing = getPlayerFacing(player);
  const upper = {
    x: facing.y,
    y: -facing.x,
  };

  return SLOT_OFFSETS.map((slot, slotIndex) => ({
    slotIndex,
    role: slot.role,
    x: (player.x || 0) + facing.x * slot.forward + upper.x * slot.side * FLANK_SIDE_DISTANCE,
    y: (player.y || 0) + facing.y * slot.forward + upper.y * slot.side * FLANK_SIDE_DISTANCE,
  }));
}

export function getWeaponSlotAnchor(state, slotIndex = 0) {
  const anchors = getEquippedWeaponSlotAnchors(state);
  const safeIndex = clamp(Math.floor(slotIndex) || 0, 0, anchors.length - 1);
  return anchors[safeIndex];
}

export function updateWeaponFollowerPositions(state, dtMs = 0) {
  if (!state.weapons?.equippedRuntime) return;

  const anchors = getEquippedWeaponSlotAnchors(state);
  const safeDtMs = Math.max(0, dtMs);
  const followRatio = safeDtMs <= 0
    ? 1
    : 1 - Math.exp(-safeDtMs / FOLLOW_SETTLE_MS);

  for (const runtime of state.weapons.equippedRuntime) {
    if (!runtime?.weaponInstanceId) {
      runtime.follower = null;
      continue;
    }

    const slotIndex = clamp(runtime.slotIndex ?? 0, 0, anchors.length - 1);
    const anchor = anchors[slotIndex];
    const follower = normalizeWeaponFollower(runtime.follower, anchor, slotIndex);
    const phaseMs = follower.phaseMs + safeDtMs;
    const drift = getFollowerDrift(phaseMs, slotIndex);
    const desired = {
      x: anchor.x + drift.x,
      y: anchor.y + drift.y,
    };

    if (distanceSq(follower, anchor) > 90000) {
      follower.x = desired.x;
      follower.y = desired.y;
    } else {
      follower.x += (desired.x - follower.x) * followRatio;
      follower.y += (desired.y - follower.y) * followRatio;
    }

    follower.phaseMs = phaseMs;
    follower.attackPulseMs = Math.max(0, (follower.attackPulseMs || 0) - safeDtMs);
    runtime.follower = follower;
  }
}

export function getEquippedWeaponSlotPositions(state) {
  const anchors = getEquippedWeaponSlotAnchors(state);
  return anchors.map((anchor, slotIndex) => {
    const runtime = state.weapons?.equippedRuntime?.[slotIndex];
    const follower = runtime?.follower;
    if (!Number.isFinite(follower?.x) || !Number.isFinite(follower?.y)) {
      return anchor;
    }

    return {
      ...anchor,
      x: follower.x,
      y: follower.y,
    };
  });
}

export function getWeaponSlotPosition(state, slotIndex = 0) {
  const positions = getEquippedWeaponSlotPositions(state);
  const safeIndex = clamp(Math.floor(slotIndex) || 0, 0, positions.length - 1);
  return positions[safeIndex];
}

function normalizeWeaponFollower(follower, anchor, slotIndex) {
  if (Number.isFinite(follower?.x) && Number.isFinite(follower?.y)) {
    return {
      x: follower.x,
      y: follower.y,
      phaseMs: Number.isFinite(follower.phaseMs) ? follower.phaseMs : slotIndex * 431,
      attackPulseMs: Number.isFinite(follower.attackPulseMs) ? follower.attackPulseMs : 0,
    };
  }

  return {
    x: anchor.x,
    y: anchor.y,
    phaseMs: slotIndex * 431,
    attackPulseMs: 0,
  };
}

function getFollowerDrift(phaseMs, slotIndex) {
  const phase = phaseMs / 1000 + slotIndex * 1.73;
  return {
    x: Math.cos(phase * 1.7) * IDLE_DRIFT_RADIUS,
    y: Math.sin(phase * 2.1) * IDLE_DRIFT_RADIUS * 0.72,
  };
}

function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
