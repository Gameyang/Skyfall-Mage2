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

export interface WeaponTargetingBlock {
  readonly detectionRange?: number;
}

export interface FireballWeaponAttackBlock {
  readonly kind: "fireball";
  readonly cooldownMs: number;
  readonly projectileSpeedPerSecond: number;
  readonly projectileCollisionRadius: number;
  readonly maxAgeMs: number;
  readonly explosionRadius: number;
  readonly fireAreaDurationMs: number;
  readonly fireAreaDamagePerSecond: number;
  readonly burnDurationMs: number;
  readonly burnDamagePerSecond: number;
}

export type WeaponAttackBlock = FireballWeaponAttackBlock;

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: ItemKind;
  readonly rarity: ItemRarity;
  readonly iconUrl: string;
  readonly equipmentSlot?: EquipmentSlotId;
  readonly stats?: StatBlock;
  readonly fieldModifiers?: FieldModifierBlock;
  readonly weaponTargeting?: WeaponTargetingBlock;
  readonly weaponAttack?: WeaponAttackBlock;
  readonly materialAffinity?: "fire" | "water" | "ice" | "spark" | "force";
}
