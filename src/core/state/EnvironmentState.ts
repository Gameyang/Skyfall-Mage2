// Responsibility: Store serializable environment state that can feed field simulation.
// Owner: core/state

export type EnvironmentKind = "ember-cavern" | "rain-shelf" | "ash-field";

export interface EnvironmentState {
  readonly kind: EnvironmentKind;
  readonly seed: number;
  readonly windX: number;
  readonly heat: number;
  readonly rainRate: number;
}

export function createInitialEnvironmentState(): EnvironmentState {
  return {
    kind: "ember-cavern",
    seed: 1337,
    windX: 0.18,
    heat: 0.64,
    rainRate: 0.08,
  };
}
