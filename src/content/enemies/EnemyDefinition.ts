// Responsibility: Define static enemy metadata for early combat slices.
// Owner: content/enemies

export type EnemyKind = "normal" | "miniboss" | "boss";
export type EnemyPatternId = "none" | "ember-ring" | "rain-pressure";

export interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly iconUrl: string;
  readonly maxHp: number;
  readonly kind: EnemyKind;
  readonly patternId: EnemyPatternId;
}
