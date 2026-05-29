// Responsibility: Define events emitted after systems resolve commands and simulation summaries.
// Owner: core/state

export type GameEvent =
  | { readonly type: "RuntimeStarted"; readonly atMs: number }
  | { readonly type: "RuntimePaused"; readonly atMs: number }
  | { readonly type: "RuntimeResumed"; readonly atMs: number }
  | { readonly type: "EnemyKilled"; readonly enemyId: string }
  | { readonly type: "ItemCollected"; readonly itemDropId: string; readonly itemId: string }
  | { readonly type: "InventoryChanged" }
  | { readonly type: "EquipmentChanged" }
  | { readonly type: "PlayerLevelUp"; readonly level: number }
  | { readonly type: "WaveStarted"; readonly waveIndex: number }
  | { readonly type: "EnvironmentChanged"; readonly environmentId: string }
  | { readonly type: "GameOver" };
