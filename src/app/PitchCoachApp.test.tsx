import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AudioCaptureConfig,
  AudioInputDevice,
  AudioInputDeviceService,
  AudioInputEngine,
  PitchDetectorAdapter,
  PromptPlayer
} from "../audio/types";
import type {
  CoachSettings,
  PitchFrame,
  PracticeSessionRecord,
  TargetNoteSegment,
  TargetSegment
} from "../domain/contracts";
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
import {
  loadAttemptHistory,
  saveAttemptHistoryRecord,
  savePracticeSessionRecord
} from "../storage/attemptHistoryStorage";
import { installFakeIndexedDB } from "../test/fakeIndexedDB";
import { DEFAULT_THEME } from "../themes";
import { PitchCoachApp } from "./PitchCoachApp";

const ONBOARDED_SETTINGS: CoachSettings = {
  ...DEFAULT_SETTINGS,
  rangeSetup: {
    status: "completed",
    source: "manual",
    completedAt: "2026-06-11T20:00:00.000Z"
  }
};

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
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    expect(screen.getByRole("heading", { name: "Good evening" })).toBeTruthy();
    expect(screen.getByText("Your local practice stats will build as you sing.")).toBeTruthy();
    expect(screen.getAllByText("Local practice").length).toBeGreaterThan(0);
    const brandLogo = document.querySelector<HTMLImageElement>(".shell-brand__logo");
    expect(brandLogo?.getAttribute("src")).toBe("/pitch-coach-logo.png");
    expect(brandLogo?.getAttribute("alt")).toBe("");
    expect(screen.queryByText("Robin")).toBeNull();
    expect(screen.getByRole("button", { name: /Start practice/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Interval Training/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sing a Song/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Interval Training/i }).textContent).toContain("0 / 12 done");
    expect(screen.getByText("Recently practiced")).toBeTruthy();
    expect(screen.getByText("Major Third")).toBeTruthy();
    expect(screen.getByText("Perfect Fifth")).toBeTruthy();
    expect(screen.queryByText("1,284")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Practice Library" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start lesson" })).toBeNull();
  });

  it("renders home stats from local attempt history", async () => {
    await saveAttemptHistoryRecord(historyRecord("major-triad", 0, false));
    await saveAttemptHistoryRecord(historyRecord("five-note-scale", 1, true));

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Interval Training/i }).textContent).toContain("2 / 12 done")
    );
    const stats = screen.getByLabelText("Practice stats").textContent ?? "";
    expect(stats).toContain("Accuracy50%");
    expect(stats).toContain("Targets in tune1");
    expect(stats).toContain("Practiced1min");
  });

  it("navigates top-level shell tabs without leaving the app shell", async () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

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

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    expect(screen.getByRole("tab", { name: "Practice" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy();
    expect(document.querySelector(".library-heading")?.textContent).toContain("0 / 12 exercises tried");
    expect(screen.getByLabelText("No accuracy yet").textContent).toContain("New");
    expect(screen.getByRole("button", { name: /Major Triad/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Major Triad/i }).textContent).toContain("New");
    expect(screen.getByRole("button", { name: /Major Triad/i }).textContent).toContain("No attempts yet");
  });

  it("renders the progress route from local attempt history", async () => {
    const triadAttempt = historyRecord("major-triad", 0, false);
    const scaleAttempt = historyRecord("five-note-scale", 1, true);
    await savePracticeSessionRecord(sessionRecord(triadAttempt.sessionId, triadAttempt.exerciseId, 0));
    await saveAttemptHistoryRecord(triadAttempt);
    await savePracticeSessionRecord(sessionRecord(scaleAttempt.sessionId, scaleAttempt.exerciseId, 1));
    await saveAttemptHistoryRecord(scaleAttempt);
    window.history.replaceState(null, "", "/progress");

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    expect(screen.getByRole("heading", { name: "Recent sessions" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText(/Five-Note Major Scale/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Local stats")).toBeNull();
    expect(screen.getByText("Day streak")).toBeTruthy();
    expect(screen.getByText("Accuracy over time")).toBeTruthy();
    expect(screen.getByText("Targets in tune")).toBeTruthy();
    expect(screen.getByText("Exercises done")).toBeTruthy();
    expect(screen.getByText("Time practiced")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText(/Scales/)).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getAllByText(/1 attempt/).length).toBeGreaterThan(0);
    const recentScaleLink = screen.getByRole("link", { name: /Five-Note Major Scale/ });
    expect(recentScaleLink.getAttribute("href")).toBe("/exercises/five-note-scale");
    fireEvent.click(recentScaleLink);
    expect(window.location.pathname).toBe("/exercises/five-note-scale");
  });

  it("groups progress recent activity by practice session", async () => {
    const session = sessionRecord("step-session", "step-up-back", 3);
    await savePracticeSessionRecord(session);
    await saveAttemptHistoryRecord(historyRecord("step-up-back", 0, true, session.id));
    await saveAttemptHistoryRecord(historyRecord("step-up-back", 1, true, session.id));
    await saveAttemptHistoryRecord(historyRecord("step-up-back", 2, false, session.id));
    window.history.replaceState(null, "", "/progress");

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Step Up and Back/ })).toHaveLength(1);
    });
    const stepSession = screen.getByRole("link", { name: /Step Up and Back/ });
    expect(stepSession.textContent).toContain("3 attempts");
    expect(stepSession.textContent).toContain("67%");
  });

  it("renders separate progress rows for separate visits to the same exercise", async () => {
    const firstSession = sessionRecord("first-step-session", "step-up-back", 0);
    const secondSession = sessionRecord("second-step-session", "step-up-back", 1);
    await savePracticeSessionRecord(firstSession);
    await saveAttemptHistoryRecord(historyRecord("step-up-back", 0, true, firstSession.id));
    await savePracticeSessionRecord(secondSession);
    await saveAttemptHistoryRecord(historyRecord("step-up-back", 1, true, secondSession.id));
    window.history.replaceState(null, "", "/progress");

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Step Up and Back/ })).toHaveLength(2);
    });
  });

  it("opens the recommendation card into the matching exercise route", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));

    expect(window.location.pathname).toBe("/exercises/major-triad");
    expect(screen.getByRole("button", { name: "Start lesson" })).toBeTruthy();
  });

  it("shows the default range prompt on the home screen until range is set", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByRole("heading", { name: "Good evening" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Set your vocal range" })).toBeNull();
    expect(screen.getByText(/Using a default range/).textContent).toContain("C3");
    expect(screen.getByText(/Using a default range/).textContent).toContain("C5");

    fireEvent.click(screen.getByRole("button", { name: "Set my range" }));
    expect(screen.getByRole("dialog", { name: "Set your vocal range" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save range" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByText(/Using a default range/)).toBeNull();
  });

  it("shows the default range prompt on the practice library until range is set", async () => {
    window.history.replaceState(null, "", "/practice");

    render(<PitchCoachApp services={createServices([])} initialSettings={DEFAULT_SETTINGS} />);

    expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Set your vocal range" })).toBeNull();
    expect(screen.getByText(/Using a default range/).textContent).toContain("C3");
    expect(screen.getByText(/Using a default range/).textContent).toContain("C5");

    fireEvent.click(screen.getByRole("button", { name: "Set my range" }));
    expect(screen.getByRole("dialog", { name: "Set your vocal range" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save range" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByText(/Using a default range/)).toBeNull();
  });

  it("opens first-run range setup from Start lesson and starts after saving", async () => {
    const services = createServices(stableFrames(0));
    render(<PitchCoachApp services={services} initialSettings={DEFAULT_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));
    expect(screen.queryByText(/Using a default range/)).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Set your vocal range" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));

    expect(await screen.findByRole("dialog", { name: "Set your vocal range" })).toBeTruthy();
    expect(services.promptPlayer.playPrompt).not.toHaveBeenCalled();
    expect(screen.getAllByText("C3-C5").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Save range" }));
    expect(screen.getByRole("dialog", { name: "Range saved" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start practicing" }));
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledWith(
      expect.any(Array),
      90,
      "chord-then-sequence"
    );
  });

  it("shows the default range prompt on the library after skipping setup", async () => {
    window.history.replaceState(null, "", "/practice");
    render(
      <PitchCoachApp
        services={createServices([])}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          rangeSetup: {
            status: "skipped",
            source: "default",
            skippedAt: "2026-06-12T15:00:00.000Z"
          }
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy();
    expect(screen.getByText(/Using a default range/).textContent).toContain("C3");
    expect(screen.getByText(/Using a default range/).textContent).toContain("C5");

    fireEvent.click(screen.getByRole("button", { name: "Set my range" }));
    expect(screen.getByRole("dialog", { name: "Set your vocal range" })).toBeTruthy();
  });

  it("does not render the completed range panel on the exercise screen", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));
    expect(screen.queryByLabelText("Range")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("captures low and high notes in singing setup mode", async () => {
    const services = createServices(rangeCaptureFrames());
    render(<PitchCoachApp services={services} initialSettings={DEFAULT_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    expect(await screen.findByRole("dialog", { name: "Set your vocal range" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Find it by singing" }));
    fireEvent.click(screen.getByRole("button", { name: "Start - sing your lowest" }));

    await waitFor(() => expect(screen.getByText(/Lowest:/).textContent).toContain("C3"));

    fireEvent.click(screen.getByRole("button", { name: "Now the highest" }));
    await waitFor(() => expect(screen.getByText("Got your range")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Save range" }));
    expect(screen.getByRole("dialog", { name: "Range saved" }).textContent).toContain("C3 and C5");
  });

  it("uses the preferred microphone for range capture", async () => {
    const services = createServices(rangeCaptureFrames());
    render(
      <PitchCoachApp
        services={services}
        initialSettings={{
          ...ONBOARDED_SETTINGS,
          preferredAudioInput: {
            deviceId: "studio-mic",
            label: "Studio Mic"
          }
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Start practice/i }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Find it by singing" }));
    fireEvent.click(screen.getByRole("button", { name: "Start - sing your lowest" }));

    await waitFor(() => expect(services.audioEngine.lastConfig?.deviceId).toBe("studio-mic"));
  });

  it("filters the practice library by exercise category", async () => {
    window.history.replaceState(null, "", "/practice");

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

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
        initialSettings={ONBOARDED_SETTINGS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sing a Song/ }));

    await waitFor(() => expect(window.location.pathname).toBe("/songs"));
    expect(screen.getByRole("tab", { name: "Sing" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByRole("heading", { name: "Sing a Song" })).toBeTruthy();
    expect(screen.getByText("Drop a song here")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Choose a file" })).toBeTruthy();
    expect(screen.getByText(/How it works/i)).toBeTruthy();
    expect(screen.queryByLabelText("Song pitch timeline")).toBeNull();
    expect(screen.queryByLabelText("Song controls and feedback")).toBeNull();
  });

  it("keeps long uploaded song names available while the processing title can truncate", async () => {
    const longFileName =
      "YTDown_YouTube_Green-Day-Good-Riddance-Time-Of-Your-Life_Media_fhrK0i-2Nes_009_128K.mp3";
    render(
      <PitchCoachApp
        services={createServices([])}
        songServices={createSongServices({ supported: false })}
        initialSettings={ONBOARDED_SETTINGS}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Sing a Song/ }));
    const fileInput = await screen.findByLabelText("Audio");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["audio"], longFileName, { type: "audio/mpeg" })]
      }
    });

    await screen.findByLabelText("Song processing");
    const titledFilenameNodes = screen.getAllByTitle(longFileName);
    expect(titledFilenameNodes[0].tagName).toBe("H2");
    expect(titledFilenameNodes.length).toBeGreaterThan(1);
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
        initialSettings={ONBOARDED_SETTINGS}
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
        initialSettings={ONBOARDED_SETTINGS}
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
        initialSettings={ONBOARDED_SETTINGS}
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
          ...ONBOARDED_SETTINGS,
          range: {
            lowestMidi: parseNoteName("C3"),
            highestMidi: parseNoteName("D4")
          },
          preferredAudioInput: {
            deviceId: "studio-mic",
            label: "Studio Mic"
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
    expect(songServices.practiceEngine.lastConfig?.deviceId).toBe("studio-mic");
  });

  it("advances a half step after a passing attempt", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(stableFrames(0))} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Nice pass");

    await act(async () => {
      vi.advanceTimersByTime(950);
      await Promise.resolve();
    });

    expect(screen.getByText("A#3 major")).toBeTruthy();
  });

  it("shows retry feedback and keeps the same root for a flat attempt", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(stableFrames(-55))} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/flat/i).length).toBeGreaterThan(0);
    expect(screen.getByText("A3 major")).toBeTruthy();
    const retryButton = screen.getByRole("button", { name: "Retry triad" });
    expect(retryButton).toBeTruthy();
    expect(retryButton.textContent).not.toContain("Retry triad");
  });

  it("shows guide playback status and lights chord targets together before the sequence", async () => {
    const { services, resolvePrompt } = createDeferredPromptServices(stableFrames(0));
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    await flushReact();
    fireEvent.click(screen.getByRole("button", { name: /Ready to begin.*Press play/i }));
    await flushReact();

    await waitFor(() => expect(services.promptPlayer.playPrompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Listening to the guide/)).toBeTruthy());
    const activeCheckpoints = screen
      .getByLabelText("Target segments")
      .querySelectorAll(".note-checkpoint--active");
    expect(activeCheckpoints).toHaveLength(3);
    expect([...activeCheckpoints].map((checkpoint) => checkpoint.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Root"),
        expect.stringContaining("Major third"),
        expect.stringContaining("Perfect fifth")
      ])
    );
    activeCheckpoints.forEach((checkpoint) => {
      expect(checkpoint.className).toContain("note-checkpoint--target");
      expect(checkpoint.getAttribute("aria-current")).toBe("step");
    });

    await act(async () => {
      resolvePrompt();
      await Promise.resolve();
    });
  });

  it("starts auto practice from the bottom ready control", async () => {
    const services = createServices([]);
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: /Ready to begin.*Press play/i }));
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledTimes(1);
  });

  it("uses the spacebar to play and pause auto practice", async () => {
    const services = createServices([]);
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    await flushReact();
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    await flushReact();

    expect(services.promptPlayer.cancel).toHaveBeenCalled();
  });

  it("replays a failed auto attempt and keeps trying the same root", async () => {
    vi.useFakeTimers();
    const services = createServices(stableFrames(-55));
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText(/flat/i).length).toBeGreaterThan(0);
    expect(screen.getByText("A3 major")).toBeTruthy();
    expect(services.promptPlayer.playPrompt).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1250);
      await Promise.resolve();
    });
    await flushReact();
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledTimes(2);
    expect(screen.getByText("A3 major")).toBeTruthy();
    const records = await loadAttemptHistory();
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.rootMidi === parseNoteName("A3"))).toBe(true);
  });

  it("advances after a pass with warning", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(scoopedFrames())} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Nice pass");

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
        initialSettings={ONBOARDED_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Nice pass");
  });

  it("passes slow singing without depending on the guide tempo", async () => {
    vi.useFakeTimers();
    render(<PitchCoachApp services={createServices(slowTriadFrames())} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Nice pass");
  });

  it("labels a wrong stable note while still scoring later notes", async () => {
    vi.useFakeTimers();
    render(
      <PitchCoachApp
        services={createServices(triadFrames({ offsets: [0, 100, 0] }))}
        initialSettings={ONBOARDED_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getAllByText("Wrong").length).toBeGreaterThan(0);
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
        initialSettings={ONBOARDED_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_SCORING_POLICY.attemptMaxDurationMs + 1000);
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Your turn");
    expect(screen.queryByRole("button", { name: "Retry triad" })).toBeNull();
  });

  it("surfaces microphone permission failures", async () => {
    render(
      <PitchCoachApp
        services={createServices([], new DOMException("Denied", "NotAllowedError"))}
        initialSettings={ONBOARDED_SETTINGS}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await act(async () => {});

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/permission was denied/i));
  });

  it("does not render local clip controls on the exercise screen", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    expect(screen.queryByRole("switch", { name: "Local clips" })).toBeNull();
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
    const targets = buildTargetNotes(parseNoteName("A3"), exercise, ONBOARDED_SETTINGS.defaultTempoBpm).filter(isNoteSegment);
    render(
      <PitchCoachApp
        services={createServices(stableFramesForTargets(targets, 0))}
        initialSettings={ONBOARDED_SETTINGS}
      />
    );

    openSingleNoteMatch();
    expect(screen.getByText("90 BPM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to exercises" })).toBeTruthy();
    expect(window.location.pathname).toBe("/exercises/single-note-match");

    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Nice pass");
  });

  it("shows guided practice status and updates note checkpoints after scoring", async () => {
    render(<PitchCoachApp services={createServices(stableFrames(0))} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    expect(screen.getByLabelText("Practice guidance").textContent).toContain("Listen to the guide");
    expect(screen.getByLabelText("Target segments").textContent).toContain("Target");
    expect(screen.getByLabelText("Target segments").textContent).toContain("A3");
    const scoreReadout = document.querySelector(".practice-score-readout");
    expect(scoreReadout?.textContent).toContain("notes in tune");
    expect(scoreReadout?.textContent).not.toContain("targets in tune");
    expect(scoreReadout?.getAttribute("aria-label")).toBe("0 notes in tune");
    const restartButton = screen.getByRole("button", { name: "Restart practice" });
    expect(restartButton.textContent).toBe("");
    expect(document.querySelector(".practice-status-legacy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    await waitFor(() => {
      expect(screen.getByLabelText("Practice guidance").textContent).toContain("Nice pass");
      expect(screen.getByLabelText("Target segments").textContent).toContain("Pass");
    });
    expect(
      screen.getByLabelText("Target segments").querySelectorAll(".note-checkpoint--pass .lucide-check")
    ).toHaveLength(3);
  });

  it("records attempt history and updates exercise progress", async () => {
    render(<PitchCoachApp services={createServices(stableFrames(0))} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    const records = await loadAttemptHistory();
    expect(records).toHaveLength(1);
    expect(records[0]?.passed).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Back to exercises" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy());
    expect(screen.getByRole("button", { name: /Major Triad/i }).textContent).toContain("100% recent pass");
  });

  it("keeps repeated attempts in one session until leaving the exercise route", async () => {
    render(<PitchCoachApp services={createServices(stableFrames(-55))} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();
    fireEvent.click(screen.getByRole("button", { name: "Retry triad" }));
    await flushReact();
    await flushReact();

    const records = await loadAttemptHistory();
    expect(records).toHaveLength(2);
    expect(new Set(records.map((record) => record.sessionId)).size).toBe(1);
  });

  it("starts a new session after leaving and reopening an exercise route", async () => {
    render(<PitchCoachApp services={createServices(stableFrames(-55))} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();
    fireEvent.click(screen.getByRole("button", { name: "Back to exercises" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Practice Library", level: 1 })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Major Triad/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    const records = await loadAttemptHistory();
    expect(records).toHaveLength(2);
    expect(new Set(records.map((record) => record.sessionId)).size).toBe(2);
  });

  it("does not render lower detail panels on a direct exercise route", async () => {
    await saveAttemptHistoryRecord(historyRecord("five-note-scale", 0, true));
    window.history.replaceState(null, "", "/exercises/five-note-scale");

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Exercise" }).textContent).toContain("Five-Note Major Scale")
    );
    expect(screen.queryByLabelText("Lesson controls and feedback")).toBeNull();
    expect(screen.queryByLabelText("Attempt feedback")).toBeNull();
    expect(screen.queryByLabelText("Attempt history")).toBeNull();
  });

  it("records retry history without showing bottom history controls", async () => {
    render(<PitchCoachApp services={createServices(stableFrames(-55))} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();
    await flushReact();

    const records = await loadAttemptHistory();
    expect(records).toHaveLength(1);
    expect(records[0]?.passed).toBe(false);
    expect(screen.queryByLabelText("Attempt history")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear history" })).toBeNull();
  });

  it("returns to the library when browser history goes back from practice", async () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

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

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    expect(screen.getAllByText("Five-Note Major Scale").length).toBeGreaterThan(0);
    expect(screen.getByText("90 BPM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to exercises" })).toBeTruthy();
  });

  it("changes lessons from the exercise dropdown", async () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

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

  it("uses shared dropdown controls without rendering bottom detail cards", () => {
    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();

    expect(document.querySelector("select")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Exercise" }).tagName).toBe("BUTTON");
    expect(screen.queryByLabelText("Range")).toBeNull();
    expect(screen.queryByLabelText("Attempt feedback")).toBeNull();
    expect(screen.queryByLabelText("Attempt history")).toBeNull();
  });

  it("opens settings from the local footer and applies practice defaults to new lessons", async () => {
    vi.useFakeTimers();
    const services = createServices(stableFrames(0));
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Local practice.*Settings & profile/i }));
    expect(screen.getByRole("dialog", { name: "Voice" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Practice.*Tempo & strictness/i }));
    expect(screen.getByRole("dialog", { name: "Practice" })).toBeTruthy();
    expect(screen.getByText("Default guide tempo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Slow" }));
    fireEvent.click(screen.getByRole("button", { name: "Strict" }));
    expect(screen.getByText(/within \+\/-22 cents/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledWith(
      expect.any(Array),
      70,
      "chord-then-sequence"
    );
    expect(screen.getByText("22 cents")).toBeTruthy();
  });

  it("resets dialog settings without clearing local practice history", async () => {
    await saveAttemptHistoryRecord(historyRecord("major-triad", 0, true));
    render(
      <PitchCoachApp
        services={createServices([])}
        initialSettings={{
          ...ONBOARDED_SETTINGS,
          defaultTempoBpm: 70,
          tempoBpm: 70,
          toleranceCents: 22,
          preferredAudioInput: {
            deviceId: "studio-mic",
            label: "Studio Mic"
          }
        }}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Interval Training/i }).textContent).toContain("1 attempt logged")
    );

    fireEvent.click(screen.getByRole("button", { name: /Local practice.*Settings & profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /Practice.*Tempo & strictness/i }));
    expect(screen.getByText("70 BPM")).toBeTruthy();
    expect(screen.getByText(/within \+\/-22 cents/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(screen.getByText("90 BPM")).toBeTruthy();
    expect(screen.getByText(/within \+\/-35 cents/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Interval Training/i }).textContent).toContain("1 attempt logged")
    );
  });

  it("selects a preferred microphone in settings and routes capture through it", async () => {
    const services = {
      ...createServices([{ timeMs: 0, frequencyHz: midiToFrequency(60), clarity: 0.96, rms: 0.08 }]),
      audioInputs: createAudioInputService([
        { deviceId: "default", label: "Built-in Microphone", isDefault: true },
        { deviceId: "studio-mic", label: "Studio Mic" }
      ])
    };
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    await waitFor(() => expect(services.audioInputs.listDevices).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Local practice.*Settings & profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /Audio.*Mic & input/i }));
    await waitFor(() => expect(screen.getByLabelText("Input level").textContent).toContain("Listening locally"));

    await chooseDropdownOption(screen.getByRole("combobox", { name: "Microphone" }), "Studio Mic");
    await waitFor(() => expect(services.audioEngine.lastConfig?.deviceId).toBe("studio-mic"));

    fireEvent.click(screen.getByRole("button", { name: /Refresh inputs/i }));
    await waitFor(() => expect(services.audioInputs.requestPermission).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));

    await waitFor(() => expect(services.audioEngine.lastConfig?.deviceId).toBe("studio-mic"));
  });

  it("hands off from settings voice retest into the singing range setup flow", () => {
    render(<PitchCoachApp services={createServices(rangeCaptureFrames())} initialSettings={ONBOARDED_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: /Local practice.*Settings & profile/i }));
    fireEvent.click(screen.getByRole("button", { name: "Re-test by singing" }));

    expect(screen.queryByRole("dialog", { name: "Voice" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Set your vocal range" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start - sing your lowest" })).toBeTruthy();
  });

  it("replaces invalid exercise routes with the home route", async () => {
    window.history.replaceState(null, "", "/exercises/not-real");

    render(<PitchCoachApp services={createServices([])} initialSettings={ONBOARDED_SETTINGS} />);

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(screen.getByRole("heading", { name: "Good evening" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start lesson" })).toBeNull();
  });

  it("uses a chord-then-sequence prompt for the major triad", async () => {
    vi.useFakeTimers();
    const services = createServices(stableFrames(0));
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledWith(
      expect.any(Array),
      90,
      "chord-then-sequence"
    );
  });

  it("uses the preferred microphone for exercise capture", async () => {
    const services = createServices(stableFrames(0));
    render(
      <PitchCoachApp
        services={services}
        initialSettings={{
          ...ONBOARDED_SETTINGS,
          preferredAudioInput: {
            deviceId: "studio-mic",
            label: "Studio Mic"
          }
        }}
      />
    );

    openMajorTriad();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await waitFor(() => expect(services.audioEngine.lastConfig?.deviceId).toBe("studio-mic"));
  });

  it("uses a sequence-only prompt for scale exercises", async () => {
    vi.useFakeTimers();
    const exercise = getExerciseById("five-note-scale");
    const targets = buildTargetNotes(parseNoteName("A3"), exercise, ONBOARDED_SETTINGS.defaultTempoBpm).filter(isNoteSegment);
    const services = createServices(stableFramesForTargets(targets, 0));
    render(<PitchCoachApp services={services} initialSettings={ONBOARDED_SETTINGS} />);

    openFiveNoteScale();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await flushReact();

    expect(services.promptPlayer.playPrompt).toHaveBeenCalledWith(
      expect.any(Array),
      90,
      "sequence-only"
    );
  });
});

function stableFrames(offsetCents: number, rawStartMs = 0): PitchFrame[] {
  return triadFrames({ offsets: [offsetCents, offsetCents, offsetCents], rawStartMs });
}

function rangeCaptureFrames(): PitchFrame[] {
  return [
    { timeMs: 0, frequencyHz: midiToFrequency(parseNoteName("C3")), clarity: 0.96, rms: 0.04 },
    { timeMs: 420, frequencyHz: midiToFrequency(parseNoteName("E3")), clarity: 0.96, rms: 0.04 },
    { timeMs: 920, frequencyHz: midiToFrequency(parseNoteName("C5")), clarity: 0.96, rms: 0.04 }
  ];
}

function slowTriadFrames(): PitchFrame[] {
  return triadFrames({ starts: [0, 2800, 6500] });
}

function triadFrames(options: {
  offsets?: [number, number, number];
  starts?: [number, number, number];
  rawStartMs?: number;
} = {}): PitchFrame[] {
  const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80).filter(isNoteSegment);
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

function stableFramesForTargets(targets: TargetNoteSegment[], offsetCents: number): PitchFrame[] {
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
  passed: boolean,
  sessionId = `${exerciseId}-session-${index}`
): AttemptHistoryRecord {
  return {
    id: `${exerciseId}-${index}`,
    sessionId,
    exerciseId,
    createdAt: new Date(Date.UTC(2026, 4, 13, 18, index)).toISOString(),
    rootMidi: parseNoteName("A3"),
    tempoBpm: exerciseId === "five-note-scale" ? 92 : 80,
    toleranceCents: 35,
    passed,
    summary: passed ? "Scale felt good." : "A3 was flat.",
    durationMs: 2400,
    segments: [
      {
        id: "root",
        kind: "note",
        label: "Root",
        shortLabel: "R",
        noteName: "A3",
        midi: parseNoteName("A3"),
        offsetSemitones: 0,
        status: passed ? "pass" : "flat",
        medianCents: passed ? 0 : -45,
        warnings: []
      }
    ]
  };
}

function sessionRecord(
  id: string,
  exerciseId: PracticeSessionRecord["exerciseId"],
  index: number
): PracticeSessionRecord {
  const timestamp = new Date(Date.UTC(2026, 4, 13, 18, index)).toISOString();
  return {
    id,
    exerciseId,
    startedAt: timestamp,
    lastAttemptAt: timestamp
  };
}

function scoopedFrames(): PitchFrame[] {
  const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80).filter(isNoteSegment);
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
  audioEngine: MockAudioEngine;
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

function createDeferredPromptServices(frames: PitchFrame[] = []) {
  const services = createServices(frames);
  let resolvePromptPromise: () => void = () => undefined;
  services.promptPlayer.playPrompt = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolvePromptPromise = resolve;
      })
  );

  return {
    services,
    resolvePrompt: () => resolvePromptPromise()
  };
}

function createAudioInputService(devices: AudioInputDevice[]): AudioInputDeviceService & {
  listDevices: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
} {
  return {
    listDevices: vi.fn(() => Promise.resolve(devices)),
    requestPermission: vi.fn(() => Promise.resolve(devices)),
    subscribe: vi.fn(() => () => {})
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
  lastConfig: AudioCaptureConfig | null = null;

  constructor(
    private readonly frames: PitchFrame[],
    private readonly rejection?: Error
  ) {}

  async startCapture(config: AudioCaptureConfig) {
    this.lastConfig = config;
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

function isNoteSegment(segment: TargetSegment): segment is TargetNoteSegment {
  return segment.kind === "note";
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
  });
}
