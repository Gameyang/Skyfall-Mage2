// Responsibility: Define material registry records used by simulation rules.
// Owner: features/combatField/materials

import type { CombatMaterialName } from "../CombatFieldTypes";

export type MaterialMotionClass = "none" | "powder" | "liquid" | "gas" | "energy";

export interface MaterialDefinition {
  readonly id: CombatMaterialName;
  readonly density: number;
  readonly motion: MaterialMotionClass;
  readonly heatCapacity: number;
  readonly color: readonly [number, number, number, number];
}
