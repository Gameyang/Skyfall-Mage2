// Responsibility: Drive requestAnimationFrame ticks with pause/resume/stop controls.
// Owner: runtime

export type GameClockTick = (deltaMs: number, timeMs: number) => void;

export class GameClock {
  private frameId: number | null = null;
  private lastTimeMs: number | null = null;

  constructor(private readonly onTick: GameClockTick) {}

  start(): void {
    if (this.frameId !== null) {
      return;
    }

    this.lastTimeMs = null;
    this.frameId = window.requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.lastTimeMs = null;
  }

  private readonly tick = (timeMs: number): void => {
    const deltaMs = this.lastTimeMs === null ? 0 : timeMs - this.lastTimeMs;
    this.lastTimeMs = timeMs;
    this.onTick(deltaMs, timeMs);
    this.frameId = window.requestAnimationFrame(this.tick);
  };
}
