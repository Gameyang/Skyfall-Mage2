// Responsibility: Queue commands from input adapters and UI before runtime update.
// Owner: runtime

import type { GameCommand } from "../core/state/Command";

export class CommandBus {
  private readonly queue: GameCommand[] = [];

  enqueue(command: GameCommand): void {
    this.queue.push(command);
  }

  drain(): GameCommand[] {
    return this.queue.splice(0, this.queue.length);
  }

  clear(): void {
    this.queue.length = 0;
  }
}
