// Responsibility: Store serializable inventory and equipment slot contents.
// Owner: core/state

export type EquipmentSlotKind = "weapon" | "head" | "body" | "feet";

export interface EquipmentSlotState {
  readonly slot: EquipmentSlotKind;
  readonly itemId: string | null;
}

export interface InventorySlotState {
  readonly index: number;
  readonly itemId: string | null;
  readonly quantity: number;
}

export interface InventoryState {
  readonly equipment: readonly EquipmentSlotState[];
  readonly bag: readonly InventorySlotState[];
  readonly gold: number;
  readonly gems: number;
  readonly selectedSlotIndex: number | null;
}

const starterBagItems = [
  "fire-staff",
  "blizzard-staff",
  "chain-lightning-staff",
  "hp-potion",
  "mp-potion",
  "coin",
  "gem",
  "blinkstep-boots",
];

export function createInitialInventoryState(): InventoryState {
  return {
    equipment: [
      { slot: "weapon", itemId: "fire-staff" },
      { slot: "head", itemId: "mana-regen-cap" },
      { slot: "body", itemId: "mana-pulse-armor" },
      { slot: "feet", itemId: "blinkstep-boots" },
    ],
    bag: Array.from({ length: 20 }, (_, index) => ({
      index,
      itemId: starterBagItems[index] ?? null,
      quantity: starterBagItems[index] === "coin" ? 24 : 1,
    })),
    gold: 184,
    gems: 7,
    selectedSlotIndex: null,
  };
}
