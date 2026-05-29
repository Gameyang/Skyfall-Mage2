// Responsibility: Store serializable combat field configuration and query intent state.
// Owner: core/state

export interface ActiveEmitterState {
  readonly id: string;
  readonly material: import("../../features/combatField/CombatFieldTypes").CombatMaterialName;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
  readonly ttlMs: number;
}

export interface BattleFieldState {
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly seed: number;
  readonly terrainProfile: "ember-cavern" | "rain-shelf" | "ash-field";
  readonly emitterRateScale: number;
  readonly fluidLevel: number;
  readonly gasLevel: number;
  readonly activeEmitters: readonly ActiveEmitterState[];
  readonly lastQueryResults: readonly {
    readonly entityId: string;
    readonly fireCoverage: number;
    readonly forceCoverage: number;
    readonly waterCoverage: number;
    readonly magicCoverage?: number;
    readonly liquidCoverage?: number;
    readonly solidCoverage?: number;
    readonly movementScale?: number;
    readonly statusEffect?: "magic" | "burning" | "slowed" | null;
    readonly damage: number;
  }[];
  readonly queryFrame: number;
}

export function createInitialBattleFieldState(): BattleFieldState {
  return {
    gridWidth: 256,
    gridHeight: 144,
    seed: 271828,
    terrainProfile: "ember-cavern",
    emitterRateScale: 1,
    fluidLevel: 0.08,
    gasLevel: 0.64,
    activeEmitters: [],
    lastQueryResults: [],
    queryFrame: 0,
  };
}
