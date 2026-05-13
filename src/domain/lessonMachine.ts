import type { AttemptScore, ExerciseDefinition, LessonState, VocalRange } from "./contracts";
import { createRootSequence } from "./exercise";

export function createLessonState(exercise: ExerciseDefinition, range: VocalRange): LessonState {
  return {
    status: "idle",
    rootSequence: createRootSequence(exercise, range),
    rootIndex: 0,
    attemptNumber: 0
  };
}

export function getCurrentRootMidi(state: LessonState) {
  return state.rootSequence[state.rootIndex] ?? null;
}

export function startPrompt(state: LessonState): LessonState {
  if (state.status === "complete") {
    return state;
  }

  return {
    ...state,
    status: "promptPlaying",
    attemptNumber: state.attemptNumber + 1,
    lastScore: undefined
  };
}

export function beginListening(state: LessonState): LessonState {
  return {
    ...state,
    status: "listening"
  };
}

export function beginAwaitingVoice(state: LessonState): LessonState {
  return {
    ...state,
    status: "awaitingVoice"
  };
}

export function beginScoring(state: LessonState): LessonState {
  return {
    ...state,
    status: "scoring"
  };
}

export function resolveAttempt(state: LessonState, score: AttemptScore): LessonState {
  return {
    ...state,
    status: score.passed ? "passed" : "retry",
    lastScore: score
  };
}

export function advanceAfterPass(state: LessonState): LessonState {
  if (state.status !== "passed") {
    return state;
  }

  if (state.rootIndex + 1 >= state.rootSequence.length) {
    return {
      ...state,
      status: "complete"
    };
  }

  return {
    ...state,
    status: "idle",
    rootIndex: state.rootIndex + 1,
    lastScore: undefined
  };
}
