import { clamp, normalize } from '../math.js';

const DEFAULT_FACING = Object.freeze({ x: 0, y: -1 });
const FRONT_DISTANCE = 42;
const FLANK_FORWARD_DISTANCE = 18;
const FLANK_SIDE_DISTANCE = 38;

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

