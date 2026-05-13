import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioCaptureConfig, AudioInputEngine, PitchDetectorAdapter, PromptPlayer } from "../audio/types";
import type { CoachSettings, PitchFrame } from "../domain/contracts";
import {
  buildTargetNotes,
  DEFAULT_SCORING_POLICY,
  DEFAULT_SETTINGS,
  getExerciseById,
  MAJOR_TRIAD_EXERCISE
} from "../domain/exercise";
import { parseNoteName } from "../domain/music";
import type { AttemptHistoryRecord } from "../domain/contracts";
import { saveAttemptHistoryRecord } from "../storage/attemptHistoryStorage";
import { installFakeIndexedDB } from "../test/fakeIndexedDB";
import { PitchCoachApp } from "./PitchCoachApp";

describe("PitchCoachApp", () => {
  beforeEach(() => {
    installFakeIndexedDB();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("renders the initial exercise screen", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByRole("heading", { name: "Pitch Coach" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Practice Library" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Single Note Match/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start lesson" })).toBeNull();
  });

  it("advances a half step after a passing attempt", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(stableFrames(0))} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/Nice triad/).length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(950);
      await Promise.resolve();
    });

    expect(screen.getByText("A#3 major")).toBeTruthy();
  });

  it("shows retry feedback and keeps the same root for a flat attempt", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(stableFrames(-55))} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/flat/i).length).toBeGreaterThan(0);
    expect(screen.getByText("A3 major")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry triad" })).toBeTruthy();
  });

  it("advances after a pass with warning", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(scoopedFrames())} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/scoop/i).length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(950);
      await Promise.resolve();
    });

    expect(screen.getByText("A#3 major")).toBeTruthy();
  });

  it("waits for a usable sung pitch before starting the scoring timeline", async () => {
    vi.useFakeTimers();
    render(
      <PitchCoachApp
        services={createServices([
          { timeMs: 0, frequencyHz: null, clarity: 0, rms: 0 },
          { timeMs: 1200, frequencyHz: null, clarity: 0.1, rms: 0.002 },
          ...stableFrames(0, 2600)
        ])}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/Nice triad/).length).toBeGreaterThan(0);
  });

  it("passes slow singing without depending on the guide tempo", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(slowTriadFrames())} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/Nice triad/).length).toBeGreaterThan(0);
  });

  it("labels a wrong stable note while still scoring later notes", async () => {
    vi.useFakeTimers();
    render(
      <PitchCoachApp
        services={createServices(triadFrames({ offsets: [0, 100, 0] }))}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/landed closer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wrong note").length).toBeGreaterThan(0);
    expect(screen.getByText("A3 major")).toBeTruthy();
  });

  it("stays armed when the mic hears no usable sung pitch", async () => {
    vi.useFakeTimers();
    render(
      <PitchCoachApp
        services={createServices([
          { timeMs: 0, frequencyHz: null, clarity: 0, rms: 0 },
          { timeMs: 1200, frequencyHz: null, clarity: 0.1, rms: 0.002 }
        ])}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_SCORING_POLICY.attemptMaxDurationMs + 1000);
      await Promise.resolve();
    });

    expect(screen.getByText("Waiting for voice")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry triad" })).toBeNull();
  });

  it("surfaces microphone permission failures", async () => {
    render(
      <PitchCoachApp
        services={createServices([], new DOMException("Denied", "NotAllowedError"))}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await act(async () => {});

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/permission was denied/i));
  });

  it("keeps local clip capture off by default", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    const checkbox = screen.getByLabelText("Local clips") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("opens a selected exercise detail screen from the library", async () => {
    vi.useFakeTimers();
    const exercise = getExerciseById("single-note-match");
    const targets = buildTargetNotes(parseNoteName("A3"), exercise, exercise.defaultTempoBpm);
    render(
      <PitchCoachApp
        services={createServices(stableFramesForTargets(targets, 0))}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Single Note Match/i }));
    expect(screen.getByText("72 BPM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to exercises" })).toBeTruthy();
    expect(window.location.pathname).toBe("/exercises/single-note-match");

    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/Nice work/).length).toBeGreaterThan(0);
  });

  it("records attempt history and updates exercise progress", async () => {
    render(<PitchCoachApp services={createServices(stableFrames(0))} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    await waitFor(() => {
      expect(screen.getByLabelText("Attempt history").textContent).toContain("Pass");
      expect(screen.getByLabelText("Attempt history").textContent).toMatch(/Nice triad/);
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to exercises" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Practice Library" })).toBeTruthy());
    expect(screen.getByRole("button", { name: /Major Triad/i }).textContent).toContain("100% recent pass");
  });

  it("loads selected exercise history on a direct exercise route", async () => {
    await saveAttemptHistoryRecord(historyRecord("five-note-scale", 0, true));
    window.history.replaceState(null, "", "/exercises/five-note-scale");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Attempt history").textContent).toContain("Pass");
      expect(screen.getByLabelText("Attempt history").textContent).toContain("Scale felt good.");
    });
  });

  it("clears local attempt history after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PitchCoachApp services={createServices(stableFrames(-55))} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    await waitFor(() => expect(screen.getByLabelText("Attempt history").textContent).toContain("Retry"));
    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));

    await waitFor(() =>
      expect(screen.getByText("No attempts yet for this exercise.")).toBeTruthy()
    );
    expect(window.confirm).toHaveBeenCalledWith("Clear all local attempt history?");
  });

  it("returns to the library when browser history goes back from practice", async () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    expect(window.location.pathname).toBe("/exercises/major-triad");
    expect(screen.getByRole("button", { name: "Start lesson" })).toBeTruthy();

    await act(async () => {
      window.history.back();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
      expect(screen.getByRole("heading", { name: "Practice Library" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Start lesson" })).toBeNull();
  });

  it("opens directly to an exercise route", () => {
    window.history.replaceState(null, "", "/exercises/five-note-scale");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getAllByText("Five-Note Major Scale").length).toBeGreaterThan(0);
    expect(screen.getByText("92 BPM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to exercises" })).toBeTruthy();
  });

  it("changes lessons from the exercise dropdown", async () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Single Note Match/i }));
    expect(window.location.pathname).toBe("/exercises/single-note-match");

    const exerciseDropdown = screen.getByRole("combobox", { name: "Exercise" });
    expect(exerciseDropdown.tagName).toBe("BUTTON");

    await chooseDropdownOption(exerciseDropdown, "Major Triad");

    expect(window.location.pathname).toBe("/exercises/major-triad");
    expect(screen.getByText("A3 major")).toBeTruthy();

    await act(async () => {
      window.history.back();
      await Promise.resolve();
    });

    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("uses shared dropdown controls instead of native selects", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();

    expect(document.querySelector("select")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Exercise" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("combobox", { name: "Low" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("combobox", { name: "High" }).tagName).toBe("BUTTON");
  });

  it("replaces invalid exercise routes with the library route", async () => {
    window.history.replaceState(null, "", "/exercises/not-real");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(screen.getByRole("heading", { name: "Practice Library" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start lesson" })).toBeNull();
  });

  it("uses a chord-then-sequence prompt for the major triad", async () => {
    vi.useFakeTimers();
    const services = createServices(stableFrames(0));
    render(<PitchCoachApp services={services} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledWith(
      expect.any(Array),
      80,
      "chord-then-sequence"
    );
  });

  it("uses a sequence-only prompt for scale exercises", async () => {
    vi.useFakeTimers();
    const exercise = getExerciseById("five-note-scale");
    const targets = buildTargetNotes(parseNoteName("A3"), exercise, exercise.defaultTempoBpm);
    const services = createServices(stableFramesForTargets(targets, 0));
    render(<PitchCoachApp services={services} initialSettings={DEFAULT_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Five-Note Major Scale/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledWith(
      expect.any(Array),
      92,
      "sequence-only"
    );
  });
});

function stableFrames(offsetCents: number, rawStartMs = 0): PitchFrame[] {
  return triadFrames({ offsets: [offsetCents, offsetCents, offsetCents], rawStartMs });
}

function slowTriadFrames(): PitchFrame[] {
  return triadFrames({ starts: [0, 2800, 6500] });
}

function triadFrames(options: {
  offsets?: [number, number, number];
  starts?: [number, number, number];
  rawStartMs?: number;
} = {}): PitchFrame[] {
  const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80);
  const offsets = options.offsets ?? [0, 0, 0];
  const starts = options.starts ?? targets.map((target) => target.startMs);
  const rawStartMs = options.rawStartMs ?? 0;
  const sungFrames = targets.flatMap((target, index) =>
    [0, 100, 200, 300, 400, 500, 620].map((offsetMs) => ({
      timeMs: rawStartMs + (starts[index] ?? target.startMs) + offsetMs,
      frequencyHz: target.frequencyHz * 2 ** ((offsets[index] ?? 0) / 1200),
      clarity: 0.96,
      rms: 0.08
    }))
  );
  const finalTargetStartMs = starts.at(-1) ?? 0;
  const finalSilenceStartMs = rawStartMs + finalTargetStartMs + 760;
  const silenceFrames = [0, 150, 300].map((offsetMs) => ({
    timeMs: finalSilenceStartMs + offsetMs,
    frequencyHz: null,
    clarity: 0,
    rms: 0.001
  }));

  return [...sungFrames, ...silenceFrames];
}

function stableFramesForTargets(targets: ReturnType<typeof buildTargetNotes>, offsetCents: number): PitchFrame[] {
  const sungFrames = targets.flatMap((target) =>
    [0, 100, 200, 300, 400, 500, 620].map((offsetMs) => ({
      timeMs: target.startMs + offsetMs,
      frequencyHz: target.frequencyHz * 2 ** (offsetCents / 1200),
      clarity: 0.96,
      rms: 0.08
    }))
  );
  const finalSilenceStartMs = (targets.at(-1)?.startMs ?? 0) + 760;
  const silenceFrames = [0, 150, 300].map((offsetMs) => ({
    timeMs: finalSilenceStartMs + offsetMs,
    frequencyHz: null,
    clarity: 0,
    rms: 0.001
  }));

  return [...sungFrames, ...silenceFrames];
}

function historyRecord(
  exerciseId: AttemptHistoryRecord["exerciseId"],
  index: number,
  passed: boolean
): AttemptHistoryRecord {
  return {
    id: `${exerciseId}-${index}`,
    exerciseId,
    createdAt: new Date(Date.UTC(2026, 4, 13, 18, index)).toISOString(),
    rootMidi: parseNoteName("A3"),
    tempoBpm: exerciseId === "five-note-scale" ? 92 : 80,
    toleranceCents: 35,
    passed,
    summary: passed ? "Scale felt good." : "A3 was flat.",
    durationMs: 2400,
    notes: [
      {
        degree: 1,
        label: "A3",
        midi: parseNoteName("A3"),
        status: passed ? "pass" : "flat",
        medianCents: passed ? 0 : -45,
        warnings: []
      }
    ]
  };
}

function scoopedFrames(): PitchFrame[] {
  const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80);
  const sungFrames = targets.flatMap((target, targetIndex) => {
    if (targetIndex > 0) {
      return [0, 100, 200, 300, 400, 500, 620].map((offsetMs) => ({
        timeMs: target.startMs + offsetMs,
        frequencyHz: target.frequencyHz,
        clarity: 0.96,
        rms: 0.08
      }));
    }

    return [-90, -62, -30, -8, 0, 4, -2, 0].map((offsetCents, index) => ({
      timeMs: target.startMs + index * 85,
      frequencyHz: target.frequencyHz * 2 ** (offsetCents / 1200),
      clarity: 0.96,
      rms: 0.08
    }));
  });

  const finalSilenceStartMs = targets.at(-1)!.startMs + 760;
  const silenceFrames = [0, 150, 300].map((offsetMs) => ({
    timeMs: finalSilenceStartMs + offsetMs,
    frequencyHz: null,
    clarity: 0,
    rms: 0.001
  }));

  return [...sungFrames, ...silenceFrames];
}

function createServices(frames: PitchFrame[], rejection?: Error): {
  audioEngine: AudioInputEngine;
  detector: PitchDetectorAdapter;
  promptPlayer: PromptPlayer;
} {
  return {
    audioEngine: new MockAudioEngine(frames, rejection),
    detector: {
      detectPitch: vi.fn()
    },
    promptPlayer: {
      playPrompt: vi.fn((_targetNotes, _tempoBpm, _promptStyle) => Promise.resolve()),
      cancel: vi.fn()
    }
  };
}

class MockAudioEngine implements AudioInputEngine {
  constructor(
    private readonly frames: PitchFrame[],
    private readonly rejection?: Error
  ) {}

  async startCapture(config: AudioCaptureConfig) {
    if (this.rejection) {
      throw this.rejection;
    }

    this.frames.forEach(config.onPitchFrame);
  }

  async stop() {}

  isRunning() {
    return false;
  }
}

const _settingsCheck: CoachSettings = DEFAULT_SETTINGS;
void _settingsCheck;

function openMajorTriad() {
  fireEvent.click(screen.getByRole("button", { name: /Major Triad/i }));
}

async function chooseDropdownOption(trigger: HTMLElement, optionName: string) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1, pointerType: "mouse" });
  const option = await screen.findByRole("option", { name: optionName });
  fireEvent.click(option);
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
  });
}
