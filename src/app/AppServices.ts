// Responsibility: Define app-level service handles that are not serializable game state.
// Owner: app

import type { CommandBus } from "../runtime/CommandBus";
import type { EventBus } from "../runtime/EventBus";

export interface AppServices {
  readonly commandBus: CommandBus;
  readonly eventBus: EventBus;
}
