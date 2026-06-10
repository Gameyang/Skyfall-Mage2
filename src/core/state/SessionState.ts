// Responsibility: Store serializable session-level runtime state.
// Owner: core/state

export type RuntimePhase = "booting" | "running" | "paused" | "stopped";

export interface ReviveQuizState {
  readonly id: string;
  readonly promptKey: string;
  readonly answerKey: string;
  readonly choiceKeys: readonly string[];
  readonly attemptsRemaining: number;
}

export interface SessionState {
  readonly phase: RuntimePhase;
  readonly elapsedMs: number;
  readonly waveElapsedMs: number;
  readonly waveIndex: number;
  readonly gameOver: boolean;
  readonly reviveUsed: boolean;
  readonly reviveQuiz: ReviveQuizState | null;
}

export function createInitialSessionState(): SessionState {
  return {
    phase: "booting",
    elapsedMs: 0,
    waveElapsedMs: 0,
    waveIndex: 1,
    gameOver: false,
    reviveUsed: false,
    reviveQuiz: null,
  };
}
