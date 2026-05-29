// Responsibility: Define data-driven material reaction metadata.
// Owner: features/combatField/materials

import type { CombatMaterialName } from "../CombatFieldTypes";

export interface MaterialReactionDefinition {
  readonly id: string;
  readonly inputA: CombatMaterialName;
  readonly inputB: CombatMaterialName;
  readonly resultA: CombatMaterialName;
  readonly resultB: CombatMaterialName;
  readonly heatDelta: number;
  readonly life: number;
}

export interface MaterialRegistryDefinition {
  readonly materials: readonly import("./MaterialDefinition").MaterialDefinition[];
  readonly reactions: readonly MaterialReactionDefinition[];
}
