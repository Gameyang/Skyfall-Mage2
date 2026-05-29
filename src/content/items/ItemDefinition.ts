// Responsibility: Define static item metadata used by inventory UI and systems.
// Owner: content/items

export type ItemRarity = "common" | "uncommon" | "rare" | "epic";
export type ItemKind = "weapon" | "armor" | "consumable" | "currency" | "material";
export type EquipmentSlotId = "weapon" | "head" | "body" | "feet";

export interface StatBlock {
  readonly maxHp?: number;
  readonly maxMana?: number;
  readonly moveSpeed?: number;
  readonly manaRegen?: number;
}

export interface FieldModifierBlock {
  readonly emitterStrength?: number;
  readonly emitterRadius?: number;
  readonly heatScale?: number;
  readonly forceScale?: number;
  readonly fireResistance?: number;
  readonly waterResistance?: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: ItemKind;
  readonly rarity: ItemRarity;
  readonly iconUrl: string;
  readonly equipmentSlot?: EquipmentSlotId;
  readonly stats?: StatBlock;
  readonly fieldModifiers?: FieldModifierBlock;
  readonly materialAffinity?: "fire" | "water" | "ice" | "spark" | "force";
}
