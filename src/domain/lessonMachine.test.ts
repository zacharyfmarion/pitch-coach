import { describe, expect, it } from "vitest";
import type { AttemptScore } from "./contracts";
import { DEFAULT_SETTINGS, MAJOR_TRIAD_EXERCISE } from "./exercise";
import {
  advanceAfterPass,
  beginListening,
  beginScoring,
  createLessonState,
  resolveAttempt,
  startPrompt
} from "./lessonMachine";

describe("lesson machine", () => {
  it("moves through prompt, listening, scoring, and retry", () => {
    let state = createLessonState(MAJOR_TRIAD_EXERCISE, DEFAULT_SETTINGS.range);
    state = startPrompt(state);
    expect(state.status).toBe("promptPlaying");
    state = beginListening(state);
    expect(state.status).toBe("listening");
    state = beginScoring(state);
    expect(state.status).toBe("scoring");
    state = resolveAttempt(state, attemptScore(false, "Try again."));
    expect(state.status).toBe("retry");
    expect(state.rootIndex).toBe(0);
  });

  it("advances after a passing attempt and completes at the end", () => {
    let state = createLessonState(MAJOR_TRIAD_EXERCISE, DEFAULT_SETTINGS.range);
    state = resolveAttempt(beginScoring(beginListening(startPrompt(state))), attemptScore(true, "Nice triad."));

    const advanced = advanceAfterPass(state);
    expect(advanced.status).toBe("idle");
    expect(advanced.rootIndex).toBe(1);

    const finalState = {
      ...state,
      rootIndex: state.rootSequence.length - 1,
      status: "passed" as const
    };
    expect(advanceAfterPass(finalState).status).toBe("complete");
  });
});

function attemptScore(passed: boolean, summary: string): AttemptScore {
  return {
    passed,
    notes: [],
    events: [],
    alignment: [],
    ignoredEventIndices: [],
    durationMs: 0,
    summary
  };
}
