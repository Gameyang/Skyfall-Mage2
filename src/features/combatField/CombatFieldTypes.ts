// Responsibility: Define gameplay-facing combat field data contracts.
// Owner: features/combatField

export const combatMaterialIds = {
  air: 0,
  staticTerrain: 1,
  sand: 2,
  water: 3,
  fire: 4,
  smoke: 5,
  steam: 6,
  spark: 7,
  force: 8,
  magicEnergy: 9,
  lava: 10,
  rock: 11,
  acid: 12,
  corrodibleTerrain: 13,
  burnableTerrain: 14,
  toxicSludge: 15,
  magicLiquid: 16,
  ice: 17,
} as const;

export type CombatMaterialName = keyof typeof combatMaterialIds;
export type CombatMaterialId = (typeof combatMaterialIds)[CombatMaterialName];

export const combatMaterialNamesById = Object.fromEntries(
  Object.entries(combatMaterialIds).map(([name, id]) => [id, name]),
) as Record<CombatMaterialId, CombatMaterialName>;

export interface PackedFieldCell {
  readonly material: CombatMaterialId;
  readonly life: number;
  readonly aux: number;
  readonly heat: number;
}

export interface MaterialEmitter {
  readonly material: CombatMaterialName;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
  readonly ttlMs: number;
}

export interface EntityHitbox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface CombatFieldQueryRequest {
  readonly frame: number;
  readonly hitboxes: readonly EntityHitbox[];
}

export interface CombatFieldQueryResult {
  readonly entityId: string;
  readonly source?: "cpu" | "gpu";
  readonly fireCoverage: number;
  readonly forceCoverage: number;
  readonly waterCoverage: number;
  readonly magicCoverage: number;
  readonly liquidCoverage: number;
  readonly solidCoverage: number;
  readonly movementScale: number;
  readonly statusEffect: "magic" | "burning" | "slowed" | null;
  readonly damage: number;
}
