// Responsibility: Define equipment-derived gameplay and simulation modifiers.
// Owner: features/equipment

export interface EquipmentRuntimeStats {
  readonly maxHpBonus: number;
  readonly maxManaBonus: number;
  readonly moveSpeedBonus: number;
  readonly manaRegenBonus: number;
}

export interface EquipmentSimulationModifiers {
  readonly emitterStrengthScale: number;
  readonly emitterRadiusScale: number;
  readonly heatScale: number;
  readonly forceScale: number;
  readonly fireResistance: number;
  readonly waterResistance: number;
}

export interface EquipmentModifierSummary {
  readonly stats: EquipmentRuntimeStats;
  readonly simulation: EquipmentSimulationModifiers;
}
