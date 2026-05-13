import { describe, expect, it } from "vitest";
import type { PitchFrame, TargetNote } from "./contracts";
import {
  buildTargetNotes,
  createScoringPolicy,
  DEFAULT_SETTINGS,
  MAJOR_TRIAD_EXERCISE
} from "./exercise";
import { midiToFrequency, parseNoteName } from "./music";
import { extractSungNoteEvents, isPitchFirstAttemptComplete, scoreAttempt } from "./scoring";

const settings = DEFAULT_SETTINGS;
const policy = createScoringPolicy(settings);
const targets = buildTargetNotes(parseNoteName("A3"), MAJOR_TRIAD_EXERCISE, 80);

describe("pitch-first attempt scoring", () => {
  it("passes a clean triad without depending on tempo windows", () => {
    const score = scoreAttempt(triadFrames(), targets, policy, settings.range);

    expect(score.passed).toBe(true);
    expect(score.notes.map((note) => note.score.status)).toEqual(["pass", "pass", "pass"]);
    expect(score.alignment.map((item) => item.eventIndex)).toEqual([0, 1, 2]);
  });

  it("passes slow notes with long pauses between them", () => {
    const score = scoreAttempt(
      triadFrames({
        starts: [0, 2600, 6700]
      }),
      targets,
      policy,
      settings.range
    );

    expect(score.passed).toBe(true);
    expect(score.notes.map((note) => note.score.status)).toEqual(["pass", "pass", "pass"]);
    expect(score.events[1].startMs).toBeGreaterThan(2400);
  });

  it("scores a stable wrong note and continues aligning the sequence", () => {
    const score = scoreAttempt(
      triadFrames({
        offsets: [0, 100, 0]
      }),
      targets,
      policy,
      settings.range
    );

    expect(score.passed).toBe(false);
    expect(score.notes.map((note) => note.score.status)).toEqual(["pass", "wrongNote", "pass"]);
    expect(score.notes[2].sungEvent).toBeDefined();
  });

  it("ignores extra stable transition notes when a better ordered match follows", () => {
    const extraNote = noteFrames(targets[0], 900, 430, 200);
    const score = scoreAttempt(
      [
        ...noteFrames(targets[0], 0),
        ...extraNote,
        ...noteFrames(targets[1], 1700),
        ...noteFrames(targets[2], 2600)
      ],
      targets,
      policy,
      settings.range
    );

    expect(score.passed).toBe(true);
    expect(score.ignoredEventIndices.length).toBeGreaterThanOrEqual(1);
    expect(score.alignment.map((item) => item.event?.medianMidi.toFixed(2))).toEqual([
      targets[0].midi.toFixed(2),
      targets[1].midi.toFixed(2),
      targets[2].midi.toFixed(2)
    ]);
  });

  it("chooses the best ordered alignment when a note is repeated", () => {
    const score = scoreAttempt(
      [
        ...noteFrames(targets[0], 0, 430, 0, 20),
        ...noteFrames(targets[0], 820, 430, 75),
        ...noteFrames(targets[1], 1650),
        ...noteFrames(targets[2], 2500)
      ],
      targets,
      policy,
      settings.range
    );

    expect(["pass", "passWithWarning"]).toContain(score.notes[0].score.status);
    expect(score.notes[1].score.status).toBe("pass");
    expect(score.ignoredEventIndices.length).toBe(1);
  });

  it("marks a skipped target as missed without blocking later targets", () => {
    const score = scoreAttempt(
      [...noteFrames(targets[0], 0), ...noteFrames(targets[2], 1700)],
      targets,
      policy,
      settings.range
    );

    expect(score.passed).toBe(false);
    expect(score.notes.map((note) => note.score.status)).toEqual(["pass", "missed", "pass"]);
  });

  it("splits legato pitch changes into separate sung events", () => {
    const frames = [
      ...noteFrames(targets[0], 0, 520),
      ...glideFrames(targets[0].midi, targets[1].midi, 580, 220),
      ...noteFrames(targets[1], 850, 520),
      ...glideFrames(targets[1].midi, targets[2].midi, 1430, 220),
      ...noteFrames(targets[2], 1700, 520)
    ];
    const events = extractSungNoteEvents(frames, policy, settings.range);
    const score = scoreAttempt(frames, targets, policy, settings.range);

    expect(events).toHaveLength(3);
    expect(score.passed).toBe(true);
  });

  it("returns partial scoring at timeout without hanging", () => {
    const score = scoreAttempt(noteFrames(targets[0], 0), targets, policy, settings.range);

    expect(score.passed).toBe(false);
    expect(score.notes.map((note) => note.score.status)).toEqual(["pass", "missed", "missed"]);
    expect(isPitchFirstAttemptComplete(noteFrames(targets[0], 0), targets, policy, settings.range)).toBe(
      false
    );
  });

  it("handles a long held first note without fragmenting the event", () => {
    const longHold = longHeldNoteFrames(targets[0], policy.attemptMaxDurationMs);
    const score = scoreAttempt(longHold, targets, policy, settings.range);

    expect(score.events).toHaveLength(1);
    expect(score.notes.map((note) => note.score.status)).toEqual(["pass", "missed", "missed"]);
  });

  it("passes scoops and moderate vibrato as coachable warnings", () => {
    const scooped = scoreAttempt(scoopedFrames(), targets, policy, settings.range);
    const vibrato = scoreAttempt(
      triadFrames({
        vibratoDepthCents: 28
      }),
      targets,
      policy,
      settings.range
    );

    expect(scooped.passed).toBe(true);
    expect(scooped.notes[0].score.status).toBe("passWithWarning");
    expect(scooped.notes[0].score.warnings).toContain("scoop");
    expect(vibrato.passed).toBe(true);
  });

  it("detects flat, sharp, unclear, missed, and truly unstable inputs", () => {
    const flat = scoreAttempt(triadFrames({ offsets: [-52, 0, 0] }), targets, policy, settings.range);
    const sharp = scoreAttempt(triadFrames({ offsets: [48, 0, 0] }), targets, policy, settings.range);
    const unclear = scoreAttempt(
      triadFrames().map((frame) => ({ ...frame, frequencyHz: null, clarity: 0.2 })),
      targets,
      policy,
      settings.range
    );
    const missed = scoreAttempt([], targets, policy, settings.range);
    const unstable = scoreAttempt(unstableFrames(), targets, policy, settings.range);

    expect(flat.notes[0].score.status).toBe("flat");
    expect(sharp.notes[0].score.status).toBe("sharp");
    expect(unclear.notes[0].score.status).toBe("unclear");
    expect(missed.notes[0].score.status).toBe("missed");
    expect(unstable.notes[0].score.status).toBe("unstable");
  });

  it("does not mark screenshot-like stable traces as unstable", () => {
    const score = scoreAttempt(screenshotLikeFrames(), targets, policy, settings.range);

    expect(score.notes.map((note) => note.score.status)).not.toContain("unstable");
    expect(score.passed).toBe(true);
  });
});

function triadFrames(options: {
  starts?: [number, number, number];
  offsets?: [number, number, number];
  vibratoDepthCents?: number;
} = {}): PitchFrame[] {
  const starts = options.starts ?? [0, 900, 1800];
  const offsets = options.offsets ?? [0, 0, 0];
  return targets.flatMap((target, index) =>
    noteFrames(target, starts[index], 620, offsets[index], options.vibratoDepthCents ?? 0)
  );
}

function noteFrames(
  target: TargetNote,
  startMs: number,
  durationMs = 620,
  offsetCents = 0,
  vibratoDepthCents = 0
): PitchFrame[] {
  const frames: PitchFrame[] = [];
  for (let timeMs = startMs; timeMs <= startMs + durationMs; timeMs += 80) {
    const elapsed = timeMs - startMs;
    const vibrato = vibratoDepthCents ? Math.sin(elapsed / 70) * vibratoDepthCents : 0;
    frames.push({
      timeMs,
      frequencyHz: target.frequencyHz * 2 ** ((offsetCents + vibrato) / 1200),
      clarity: 0.96,
      rms: 0.08
    });
  }
  return frames;
}

function longHeldNoteFrames(target: TargetNote, durationMs: number): PitchFrame[] {
  const frames: PitchFrame[] = [];
  for (let timeMs = 0; timeMs <= durationMs; timeMs += 16) {
    frames.push({
      timeMs,
      frequencyHz: target.frequencyHz,
      clarity: 0.96,
      rms: 0.08
    });
  }
  return frames;
}

function glideFrames(startMidi: number, endMidi: number, startMs: number, durationMs: number): PitchFrame[] {
  const frames: PitchFrame[] = [];
  for (let timeMs = startMs; timeMs <= startMs + durationMs; timeMs += 55) {
    const progress = Math.min(1, (timeMs - startMs) / durationMs);
    frames.push({
      timeMs,
      frequencyHz: midiToFrequency(startMidi + (endMidi - startMidi) * progress),
      clarity: 0.92,
      rms: 0.08
    });
  }
  return frames;
}

function scoopedFrames(): PitchFrame[] {
  return [
    ...[-120, -82, -48, -20, -4, 0, 2, 0, -1, 0].map((offsetCents, index) => ({
      timeMs: index * 80,
      frequencyHz: targets[0].frequencyHz * 2 ** (offsetCents / 1200),
      clarity: 0.96,
      rms: 0.08
    })),
    ...noteFrames(targets[1], 980),
    ...noteFrames(targets[2], 1860)
  ];
}

function unstableFrames(): PitchFrame[] {
  return [-120, 95, -86, 112, -90, 105, -98, 92].map((offsetCents, index) => ({
    timeMs: index * 90,
    frequencyHz: targets[0].frequencyHz * 2 ** (offsetCents / 1200),
    clarity: 0.96,
    rms: 0.08
  }));
}

function screenshotLikeFrames(): PitchFrame[] {
  const offsetsByNote = [
    [-115, -80, -35, -10, 0, 3, -2, 0, 2],
    [-10, -5, 0, 4, 0, -3, 1, 0],
    [-38, -12, 0, 4, -1, 3, 0, 1]
  ];

  return targets.flatMap((target, targetIndex) =>
    offsetsByNote[targetIndex].map((offsetCents, index) => ({
      timeMs: targetIndex * 980 + index * 85,
      frequencyHz: target.frequencyHz * 2 ** (offsetCents / 1200),
      clarity: 0.96,
      rms: 0.08
    }))
  );
}
