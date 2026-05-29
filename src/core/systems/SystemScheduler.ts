// Responsibility: Name the runtime system order without owning feature internals.
// Owner: core/systems

export const runtimeSystemOrder = [
  "command-reducer",
  "player-movement",
  "combat-field-step",
  "event-flush",
  "view-model-publish",
] as const;

export type RuntimeSystemName = (typeof runtimeSystemOrder)[number];
