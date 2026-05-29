// Responsibility: Store combat field simulation defaults.
// Owner: features/combatField

export interface CombatFieldConfig {
  readonly width: number;
  readonly height: number;
  readonly maxEmitters: number;
}

export const starterCombatFieldConfig: CombatFieldConfig = {
  width: 256,
  height: 144,
  maxEmitters: 32,
};
