// Responsibility: Describe data available to pure gameplay systems.
// Owner: core/systems

import type { GameEvent } from "../state/Event";
import type { GameState } from "../state/GameState";

export interface SystemContext {
  readonly deltaMs: number;
  readonly state: GameState;
  emit(event: GameEvent): void;
}
