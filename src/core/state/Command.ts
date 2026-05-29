// Responsibility: Define commands emitted by input and UI before systems update state.
// Owner: core/state

import type { EquipmentSlotKind } from "./InventoryState";

export type GameCommand =
  | { readonly type: "MovePlayer"; readonly x: number; readonly y: number; readonly source: "keyboard" | "touch" }
  | { readonly type: "AimAt"; readonly x: number; readonly y: number; readonly source: "pointer" | "touch" }
  | { readonly type: "StartAttack"; readonly source: "keyboard" | "pointer" | "touch" }
  | { readonly type: "StopAttack"; readonly source: "keyboard" | "pointer" | "touch" }
  | { readonly type: "UseInventorySlot"; readonly slotIndex: number }
  | { readonly type: "EquipItem"; readonly slotIndex: number; readonly equipmentSlot: EquipmentSlotKind }
  | { readonly type: "MoveInventoryItem"; readonly fromIndex: number; readonly toIndex: number }
  | { readonly type: "FuseItems"; readonly slotIndexes: readonly number[] }
  | { readonly type: "SelectLevelUpReward"; readonly rewardId: string }
  | { readonly type: "UnlockSkill"; readonly skillId: string }
  | { readonly type: "RerollShopOffers" }
  | { readonly type: "BuyShopItem"; readonly offerId: string }
  | { readonly type: "DismissModal"; readonly modalId: string }
  | { readonly type: "AnswerReviveQuiz"; readonly answer: string }
  | { readonly type: "PauseRuntime" }
  | { readonly type: "ResumeRuntime" };
