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
import { midiToFrequency, parseNoteName } from "../domain/music";
import { createStereoBuffer } from "../song/audioData";
import { SONG_REFERENCE_ANALYSIS_VERSION } from "../song/referenceVersion";
import type { SongModeServices, SongPracticeConfig, SongReference, SongStereoBuffer } from "../song/types";
import type { AttemptHistoryRecord } from "../domain/contracts";
import { saveAttemptHistoryRecord } from "../storage/attemptHistoryStorage";
import { installFakeIndexedDB } from "../test/fakeIndexedDB";
import { DEFAULT_THEME } from "../themes";
import { PitchCoachApp } from "./PitchCoachApp";

describe("PitchCoachApp", () => {
  beforeEach(() => {
    installFakeIndexedDB();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-name");
    document.documentElement.removeAttribute("data-theme-type");
    document.documentElement.style.colorScheme = "";
    window.history.replaceState(null, "", "/");
  });

  it("renders the initial exercise screen", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByRole("heading", { name: "Good evening, Robin" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Resume practice/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Interval Training/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sing a Song/i })).toBeTruthy();
    expect(screen.getByText("12 days")).toBeTruthy();
    expect(screen.getByText("1,284")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Practice Library" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start lesson" })).toBeNull();
  });

  it("navigates top-level shell tabs without leaving the app shell", async () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByRole("tab", { name: "Home" }).getAttribute("data-state")).toBe("active");

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Practice" }), {
        button: 0,
        ctrlKey: false
      });
    });
    expect(window.location.pathname).toBe("/practice");
    expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy();

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Progress" }), {
        button: 0,
        ctrlKey: false
      });
    });
    expect(window.location.pathname).toBe("/progress");
    expect(screen.getByRole("heading", { name: "Your Progress" })).toBeTruthy();
  });

  it("opens the practice library route directly", () => {
    window.history.replaceState(null, "", "/practice");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByRole("tab", { name: "Practice" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Major Triad/i })).toBeTruthy();
  });

  it("renders the progress route from local attempt history", async () => {
    await saveAttemptHistoryRecord(historyRecord("major-triad", 0, false));
    await saveAttemptHistoryRecord(historyRecord("five-note-scale", 1, true));
    window.history.replaceState(null, "", "/progress");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Recent Sessions" })).toBeTruthy();
    });
    expect(screen.queryByText("Local stats")).toBeNull();
    expect(screen.getByText("Day streak")).toBeTruthy();
    expect(screen.getByText("Accuracy")).toBeTruthy();
    expect(screen.getByText("Notes in tune")).toBeTruthy();
    expect(screen.getByText("Practiced")).toBeTruthy();
    expect(screen.getByText(/Major Triad · A3 major/)).toBeTruthy();
    expect(screen.getByText("A3 was flat.")).toBeTruthy();
    expect(screen.getAllByText(/Five-Note Major Scale/).length).toBeGreaterThan(0);
  });

  it("opens the mock resume card into the matching exercise route", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Resume practice/i }));

    expect(window.location.pathname).toBe("/exercises/third-up-back");
    expect(screen.getByRole("button", { name: "Start lesson" })).toBeTruthy();
  });

  it("filters the practice library by exercise category", async () => {
    window.history.replaceState(null, "", "/practice");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: /Scales/i }), {
        button: 0,
        ctrlKey: false
      });
    });

    expect(screen.getByRole("button", { name: /Five-Note Major Scale/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Major Triad/i })).toBeNull();
  });

  it("opens song mode in the mock empty state when unsupported", async () => {
    render(
      <PitchCoachApp
        services={createServices([])}
        songServices={createSongServices({ supported: false })}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sing a Song/ }));

    await waitFor(() => expect(window.location.pathname).toBe("/songs"));
    expect(screen.getByRole("tab", { name: "Sing" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByRole("heading", { name: "Sing a Song" })).toBeTruthy();
    expect(screen.getByText("Drop a song here")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose a file" })).toBeTruthy();
    expect(screen.getByText(/How it works/i)).toBeTruthy();
    expect(screen.queryByLabelText("Song pitch timeline")).toBeNull();
    expect(screen.queryByLabelText("Song controls and feedback")).toBeNull();
  });

  it("applies the locked mock theme on direct song mode navigation", async () => {
    mockPreferredColorScheme(true);
    window.history.replaceState(null, "", "/songs");

    render(
      <PitchCoachApp
        services={createServices([])}
        songServices={createSongServices({ supported: true })}
      />
    );

    await screen.findByRole("heading", { name: "Sing a Song" });
    expect(screen.getByRole("tab", { name: "Sing" }).getAttribute("data-state")).toBe("active");
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(document.documentElement.dataset.themeName).toBe(DEFAULT_THEME.name);
  });

  it("uploads, analyzes, and scores a song practice attempt with fake local services", async () => {
    const songServices = createSongServices({ supported: true });
    render(
      <PitchCoachApp
        services={createServices([])}
        songServices={songServices}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sing a Song/ }));
    expect(await screen.findByRole("heading", { name: "Sing a Song" })).toBeTruthy();
    expect(screen.getByText("Drop a song here")).toBeTruthy();
    const fileInput = await screen.findByLabelText("Audio");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["audio"], "practice.wav", { type: "audio/wav" })]
      }
    });

    await screen.findByLabelText("Song processing");
    expect(screen.getAllByText("practice.wav").length).toBeGreaterThan(0);

    await screen.findByText(/1 note/i);
    expect(screen.getByText(/Follow the mapped vocal contour/i)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Reference detail" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Debug note timing"));
    expect(screen.getByLabelText("Song debug audit").textContent).toMatch(/C4 MIDI 60/);
    expect(screen.getByLabelText("Song debug audit").textContent).toMatch(/conf 0\.900 amp 0\.900/);
    fireEvent.click(screen.getByRole("button", { name: "Start song practice" }));

    await waitFor(() => expect(screen.getByLabelText("Song feedback").textContent).toMatch(/Strong match/i));
    expect(songServices.separator.separate).toHaveBeenCalled();
    expect(songServices.transcriber.transcribe).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ detail: "balanced" })
    );
  });

  it("pauses and resumes an active song practice attempt", async () => {
    const songServices = createSongServices({ supported: true, autoEndPractice: false });
    render(
      <PitchCoachApp
        services={createServices([])}
        songServices={songServices}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sing a Song/ }));
    const fileInput = await screen.findByLabelText("Audio");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["audio"], "practice.wav", { type: "audio/wav" })]
      }
    });

    await screen.findByText(/1 note/i);

    fireEvent.click(screen.getByRole("button", { name: "Start song practice" }));
    await waitFor(() => expect(screen.getAllByText("Singing").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(screen.getAllByText("On pause").length).toBeGreaterThan(0));
    expect(songServices.practiceEngine.pause).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(screen.getAllByText("Singing").length).toBeGreaterThan(0));
    expect(songServices.practiceEngine.resume).toHaveBeenCalled();
  });

  it("clears stale song references from an older transcription build", async () => {
    const songServices = createSongServices({
      supported: true,
      referenceAnalysisVersion: "older-transcription-build"
    });
    render(
      <PitchCoachApp
        services={createServices([])}
        songServices={songServices}
        initialSettings={DEFAULT_SETTINGS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sing a Song/ }));
    const fileInput = await screen.findByLabelText("Audio");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["audio"], "practice.wav", { type: "audio/wav" })]
      }
    });

    await screen.findByText(/Transcription engine updated\. Analyze song again\./i);
    expect(screen.queryByLabelText("Debug note timing")).toBeNull();
    expect(songServices.separator.separate).toHaveBeenCalledTimes(1);
  });

  it("does not filter song transcription to a narrow exercise range", async () => {
    const songServices = createSongServices({ supported: true, referenceMidis: [61, 64] });
    render(
      <PitchCoachApp
        services={createServices([])}
        songServices={songServices}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          range: {
            lowestMidi: parseNoteName("C3"),
            highestMidi: parseNoteName("D4")
          }
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sing a Song/ }));
    const fileInput = await screen.findByLabelText("Audio");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["audio"], "practice.wav", { type: "audio/wav" })]
      }
    });

    await screen.findByText(/range C3-C5/i);
    expect(songServices.transcriber.transcribe).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        range: {
          lowestMidi: parseNoteName("C3"),
          highestMidi: parseNoteName("C5")
        }
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Start song practice" }));
    await waitFor(() => expect(songServices.practiceEngine.lastConfig).not.toBeNull());
    expect(songServices.practiceEngine.lastConfig?.bounds.maxFrequencyHz).toBeGreaterThan(
      midiToFrequency(parseNoteName("D#4"))
    );
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
    const switchControl = screen.getByRole("switch", { name: "Local clips" });
    expect(switchControl.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(switchControl);
    expect(switchControl.getAttribute("aria-checked")).toBe("true");
  });

  it("locks the app to the mock theme and hides theme controls", () => {
    mockPreferredColorScheme(true);

    render(<PitchCoachApp services={createServices([])} />);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themeName).toBe(DEFAULT_THEME.name);
    expect(screen.queryByRole("radiogroup", { name: "Theme" })).toBeNull();
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

    openSingleNoteMatch();
    expect(screen.getByText("72 BPM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to exercises" })).toBeTruthy();
    expect(window.location.pathname).toBe("/exercises/single-note-match");

    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/Nice work/).length).toBeGreaterThan(0);
  });

  it("shows guided practice status and updates note checkpoints after scoring", async () => {
    render(<PitchCoachApp services={createServices(stableFrames(0))} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();
    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Listen to the guide");
    expect(screen.getByLabelText("Target notes").textContent).toContain("Target");
    expect(screen.getByLabelText("Target notes").textContent).toContain("A3");

    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    await waitFor(() => {
      expect(screen.getByLabelText("Practice guidance").textContent).toContain("Nice pass");
      expect(screen.getByLabelText("Target notes").textContent).toContain("Pass");
    });
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
    await waitFor(() => expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy());
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
      expect(window.location.pathname).toBe("/practice");
      expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy();
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

    openSingleNoteMatch();
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

    await waitFor(() => expect(window.location.pathname).toBe("/practice"));
  });

  it("uses shared dropdown controls instead of native selects", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    openMajorTriad();

    expect(document.querySelector("select")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Exercise" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("combobox", { name: "Low" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("combobox", { name: "High" }).tagName).toBe("BUTTON");
  });

  it("replaces invalid exercise routes with the home route", async () => {
    window.history.replaceState(null, "", "/exercises/not-real");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(screen.getByRole("heading", { name: "Good evening, Robin" })).toBeTruthy();
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

    openFiveNoteScale();
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

function mockPreferredColorScheme(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject | null) => {
      if (listener) {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject | null) => {
      if (listener) {
        listeners.delete(listener);
      }
    }),
    addListener: vi.fn((listener: ((this: MediaQueryList, event: MediaQueryListEvent) => void) | null) => {
      if (listener) {
        listeners.add(listener as EventListener);
      }
    }),
    removeListener: vi.fn((listener: ((this: MediaQueryList, event: MediaQueryListEvent) => void) | null) => {
      if (listener) {
        listeners.delete(listener as EventListener);
      }
    }),
    dispatchEvent: vi.fn()
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: mediaQueryList.media
      } as MediaQueryListEvent;
      listeners.forEach((listener) => {
        if (typeof listener === "function") {
          listener.call(mediaQueryList, event);
          return;
        }

        listener.handleEvent(event);
      });
    }
  };
}

function createSongServices(options: {
  supported: boolean;
  referenceAnalysisVersion?: string;
  referenceMidis?: number[];
  autoEndPractice?: boolean;
}): SongModeServices & {
  separator: SongModeServices["separator"] & { separate: ReturnType<typeof vi.fn> };
  transcriber: SongModeServices["transcriber"] & { transcribe: ReturnType<typeof vi.fn> };
  practiceEngine: MockSongPracticeEngine;
} {
  const audio = createTestSongBuffer();
  const separated = {
    vocals: audio,
    accompaniment: audio,
    stems: {
      drums: audio,
      bass: audio,
      other: audio,
      vocals: audio
    }
  };
  const practiceEngine = new MockSongPracticeEngine(options.autoEndPractice ?? true);
  return {
    detectSupport: vi.fn(() =>
      Promise.resolve(
        options.supported
          ? { supported: true, checking: false, reasons: [] }
          : {
              supported: false,
              checking: false,
              reasons: ["Song mode requires WebGPU."]
            }
      )
    ),
    decodeFile: vi.fn(() => Promise.resolve(audio)),
    separator: {
      separate: vi.fn(() => Promise.resolve(separated))
    },
    transcriber: {
      transcribe: vi.fn((_vocals, transcriptionOptions) => {
        transcriptionOptions.onProgress?.({ progress: 1 });
        return Promise.resolve(createTestSongReference(options.referenceAnalysisVersion, options.referenceMidis));
      })
    },
    practiceEngine,
    detector: {
      detectPitch: vi.fn((_samples, _sampleRate, timeMs) => ({
        timeMs,
        frequencyHz: midiToFrequency(60),
        clarity: 0.96,
        rms: 0.08
      }))
    }
  };
}

function createTestSongReference(
  analysisVersion: string | undefined = SONG_REFERENCE_ANALYSIS_VERSION,
  midis: number[] = [60]
): SongReference {
  const firstMidi = midis[0] ?? 60;
  return {
    analysisVersion,
    analysisRange: DEFAULT_SETTINGS.range,
    durationMs: 1200,
    frames: [0, 100, 200, 300, 400, 500].map((timeMs) => ({
      timeMs,
      frequencyHz: midiToFrequency(firstMidi),
      midi: firstMidi,
      clarity: 0.9,
      rms: 0.08
    })),
    notes: midis.map((midi, index) => ({
      id: `note-${index}`,
      startMs: index * 300,
      endMs: index * 300 + 240,
      midi,
      medianMidi: midi,
      confidence: 0.9,
      amplitude: 0.9,
      pitchBends: []
    })),
    contour: midis.flatMap((midi, index) => [
      { timeMs: index * 300, midi, confidence: 0.9, noteId: `note-${index}` },
      { timeMs: index * 300 + 240, midi, confidence: 0.9, noteId: `note-${index}` }
    ]),
    phrases: [{ id: "phrase-0", startMs: 0, endMs: Math.max(240, midis.length * 300), medianMidi: firstMidi }],
    quality: { noteCount: midis.length, lowConfidenceCount: 0, suggestion: null }
  };
}

function createTestSongBuffer(): SongStereoBuffer {
  const sampleRate = 44100;
  const samples = new Float32Array(Math.round(sampleRate * 1.2));
  return createStereoBuffer(samples, samples, sampleRate);
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

class MockSongPracticeEngine {
  private running = false;
  private paused = false;
  lastConfig: SongPracticeConfig | null = null;

  constructor(private readonly autoEndPractice: boolean) {}

  async start(config: SongPracticeConfig) {
    this.running = true;
    this.paused = false;
    this.lastConfig = config;
    Array.from({ length: 12 }, (_, index) => index * 100).forEach((timeMs) =>
      config.onPitchFrame({
        timeMs,
        frequencyHz: midiToFrequency(60),
        clarity: 0.96,
        rms: 0.08
      })
    );
    if (this.autoEndPractice) {
      this.running = false;
      config.onEnded();
    }
  }

  pause = vi.fn(async () => {
    this.paused = true;
  });

  resume = vi.fn(async () => {
    this.paused = false;
  });

  async stop() {
    this.running = false;
    this.paused = false;
  }

  setVocalGuideGain() {}

  isRunning() {
    return this.running;
  }

  isPaused() {
    return this.paused;
  }
}

const _settingsCheck: CoachSettings = DEFAULT_SETTINGS;
void _settingsCheck;

function openMajorTriad() {
  openPracticeLibrary();
  fireEvent.click(screen.getByRole("button", { name: /Major Triad/i }));
}

function openSingleNoteMatch() {
  openPracticeLibrary();
  fireEvent.click(screen.getByRole("button", { name: /Single Note Match/i }));
}

function openFiveNoteScale() {
  openPracticeLibrary();
  fireEvent.click(screen.getByRole("button", { name: /Five-Note Major Scale/i }));
}

function openPracticeLibrary() {
  if (screen.queryByRole("heading", { name: "Practice Library", level: 1 })) {
    return;
  }

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Practice" }), {
    button: 0,
    ctrlKey: false
  });
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
