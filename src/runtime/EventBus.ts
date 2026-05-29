// Responsibility: Queue events emitted by systems for UI and follow-up services.
// Owner: runtime

import type { GameEvent } from "../core/state/Event";

export class EventBus {
  private readonly queue: GameEvent[] = [];

  emit(event: GameEvent): void {
    this.queue.push(event);
  }

  drain(): GameEvent[] {
    return this.queue.splice(0, this.queue.length);
  }

  clear(): void {
    this.queue.length = 0;
  }
}
