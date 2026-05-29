// Responsibility: Create and resolve quiz revive state transitions.
// Owner: features/progression

import type { GameState } from "../../core/state/GameState";
import type { ReviveQuizState } from "../../core/state/SessionState";

export function createReviveQuiz(): ReviveQuizState {
  return {
    id: "revive-arcana-1",
    prompt: "2 + 2",
    answer: "4",
    choices: ["4", "5"],
    attemptsRemaining: 1,
  };
}

export function startReviveQuiz(state: GameState): GameState {
  if (state.session.reviveUsed || state.session.reviveQuiz) {
    return state;
  }

  return {
    ...state,
    player: {
      ...state.player,
      hp: {
        ...state.player.hp,
        current: 1,
      },
    },
    session: {
      ...state.session,
      reviveQuiz: createReviveQuiz(),
      gameOver: false,
    },
  };
}

export function answerReviveQuiz(state: GameState, answer: string): GameState {
  const quiz = state.session.reviveQuiz;

  if (!quiz) {
    return state;
  }

  if (answer.trim() === quiz.answer) {
    return {
      ...state,
      player: {
        ...state.player,
        hp: {
          ...state.player.hp,
          current: Math.max(1, Math.ceil(state.player.hp.max * 0.5)),
        },
      },
      progression: {
        ...state.progression,
        activeBuffIds: state.progression.activeBuffIds.includes("revive-focus")
          ? state.progression.activeBuffIds
          : [...state.progression.activeBuffIds, "revive-focus"],
      },
      session: {
        ...state.session,
        reviveUsed: true,
        reviveQuiz: null,
        gameOver: false,
      },
    };
  }

  return {
    ...state,
    progression: {
      ...state.progression,
      activeDebuffIds: state.progression.activeDebuffIds.includes("failed-revive")
        ? state.progression.activeDebuffIds
        : [...state.progression.activeDebuffIds, "failed-revive"],
    },
    session: {
      ...state.session,
      reviveUsed: true,
      reviveQuiz: null,
      gameOver: true,
    },
  };
}
