import type {
  AttemptAlignment,
  AttemptScore,
  NoteAssessment,
  NoteWarning,
  PitchFrame,
  ScoredTargetNote,
  ScoringPolicy,
  SungNoteEvent,
  TargetNote,
  VocalRange
} from "./contracts";
import { frequencyToMidi, midiToFrequency, midiToNoteName } from "./music";

const SILENCE_RMS = 0.006;
const MIN_CLARITY = 0.65;
const MIN_EVENT_FRAMES = 3;

type VoicedFrame = PitchFrame & {
  frequencyHz: number;
  midi: number;
  smoothedMidi: number;
};

type StableWindow = {
  startIndex: number;
  endIndex: number;
  startMs: number;
  endMs: number;
  medianMidi: number;
  stabilityCents: number;
};

type EventGroup = {
  windows: StableWindow[];
  medianMidi: number;
};

type AlignmentResult = {
  alignment: AttemptAlignment[];
  ignoredEventIndices: number[];
};

export function scoreAttempt(
  frames: PitchFrame[],
  targetNotes: TargetNote[],
  policy: ScoringPolicy,
  range: VocalRange
): AttemptScore {
  const events = extractSungNoteEvents(frames, policy, range);
  const { alignment, ignoredEventIndices } = alignEventsToTargets(events, targetNotes, policy);
  const noEventAssessment = createNoEventAssessment(frames, range);
  const notes = alignment.map(({ target, event }) => ({
    ...target,
    sungEvent: event,
    score: event
      ? scoreAlignedEvent(event, target, policy)
      : events.length === 0
        ? noEventAssessment
        : unresolvedAssessment("missed", "No sung note was detected for this target.")
  }));
  const passed = notes.every((note) => isPassingStatus(note.score.status));

  return {
    passed,
    notes,
    events,
    alignment,
    ignoredEventIndices,
    durationMs: Math.max(...frames.map((frame) => frame.timeMs), 0),
    summary: createAttemptSummary(notes, passed)
  };
}

export function isPitchFirstAttemptComplete(
  frames: PitchFrame[],
  targetNotes: TargetNote[],
  policy: ScoringPolicy,
  range: VocalRange
) {
  const score = scoreAttempt(frames, targetNotes, policy, range);
  const allTargetsHaveEvents = score.alignment.every((item) => item.event !== undefined);
  if (!allTargetsHaveEvents) {
    return false;
  }

  const lastEvent = score.alignment.at(-1)?.event;
  const latestTimeMs = score.durationMs;
  return Boolean(
    lastEvent &&
      lastEvent.stableEndMs - lastEvent.stableStartMs >= policy.minStableDurationMs &&
      latestTimeMs >= lastEvent.stableStartMs + policy.minStableDurationMs + policy.finalNoteSettleMs
  );
}

export function extractSungNoteEvents(
  frames: PitchFrame[],
  policy: ScoringPolicy,
  range: VocalRange
): SungNoteEvent[] {
  const voicedFrames = buildVoicedFrames(frames, range);
  const segments = splitContiguousFrames(voicedFrames, policy.maxDropoutMs);
  const events: SungNoteEvent[] = [];

  segments.forEach((segment) => {
    const windows = findStableWindows(segment, policy);
    const groups = groupStableWindows(windows, policy);
    groups.forEach((group) => {
      const event = createEventFromGroup(group, segment, policy, events.length);
      if (event) {
        events.push(event);
      }
    });
  });

  return events.sort((a, b) => a.stableStartMs - b.stableStartMs);
}

function scoreAlignedEvent(
  event: SungNoteEvent,
  target: TargetNote,
  policy: ScoringPolicy
): NoteAssessment {
  const medianCents = (event.medianMidi - target.midi) * 100;
  const warnings = collectEventWarnings(event, medianCents, policy);
  const base: Omit<NoteAssessment, "status" | "instruction"> = {
    medianCents,
    stableStartMs: event.stableStartMs,
    stableEndMs: event.stableEndMs,
    stabilityCents: event.stabilityCents,
    voicedCoverage: event.voicedCoverage,
    warnings
  };
  const absoluteMedian = Math.abs(medianCents);

  if (absoluteMedian <= policy.toleranceCents) {
    const status = warnings.length > 0 ? "passWithWarning" : "pass";
    return {
      ...base,
      status,
      instruction:
        status === "pass"
          ? `${target.label} centered.`
          : createWarningInstruction(warnings, medianCents)
    };
  }

  if (absoluteMedian >= policy.wrongNoteCents) {
    return {
      ...base,
      status: "wrongNote",
      instruction: `${target.label} landed closer to ${midiToNoteName(
        Math.round(event.medianMidi)
      )}. Check the target and retry.`
    };
  }

  return {
    ...base,
    status: medianCents < 0 ? "flat" : "sharp",
    instruction: `${target.label} was ${Math.abs(Math.round(medianCents))} cents ${
      medianCents < 0 ? "flat" : "sharp"
    }.`
  };
}

function buildVoicedFrames(frames: PitchFrame[], range: VocalRange): VoicedFrame[] {
  const minFrequencyHz = midiToFrequency(range.lowestMidi);
  const maxFrequencyHz = midiToFrequency(range.highestMidi);
  const voicedFrames = frames
    .filter(
      (frame) =>
        frame.frequencyHz !== null &&
        frame.rms >= SILENCE_RMS &&
        frame.clarity >= MIN_CLARITY &&
        frame.frequencyHz >= minFrequencyHz &&
        frame.frequencyHz <= maxFrequencyHz
    )
    .map((frame) => ({
      ...frame,
      frequencyHz: frame.frequencyHz!,
      midi: frequencyToMidi(frame.frequencyHz!),
      smoothedMidi: frequencyToMidi(frame.frequencyHz!)
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  return rejectIsolatedOctaveGlitches(smoothVoicedFrames(voicedFrames));
}

function smoothVoicedFrames(frames: VoicedFrame[]) {
  return frames.map((frame, index) => {
    const window = frames
      .slice(Math.max(0, index - 1), Math.min(frames.length, index + 2))
      .map((candidate) => candidate.midi);
    return {
      ...frame,
      smoothedMidi: median(window)
    };
  });
}

function rejectIsolatedOctaveGlitches(frames: VoicedFrame[]) {
  if (frames.length < 3) {
    return frames;
  }

  return frames.filter((frame, index) => {
    if (index === 0 || index === frames.length - 1) {
      return true;
    }

    const previous = frames[index - 1];
    const next = frames[index + 1];
    const neighborsAgree = Math.abs(previous.smoothedMidi - next.smoothedMidi) < 1.4;
    const frameDisagrees =
      Math.abs(frame.smoothedMidi - previous.smoothedMidi) > 7 &&
      Math.abs(frame.smoothedMidi - next.smoothedMidi) > 7;
    return !(neighborsAgree && frameDisagrees);
  });
}

function findStableWindows(segment: VoicedFrame[], policy: ScoringPolicy): StableWindow[] {
  const windows: StableWindow[] = [];
  let endIndex = 0;

  for (let startIndex = 0; startIndex < segment.length - 1; startIndex += 1) {
    const startMs = segment[startIndex].timeMs;
    while (
      endIndex < segment.length - 1 &&
      segment[endIndex].timeMs - startMs < policy.minStableDurationMs
    ) {
      endIndex += 1;
    }

    if (segment[endIndex].timeMs - startMs < policy.minStableDurationMs) {
      break;
    }

    const endMs = segment[endIndex].timeMs;
    const windowFrames = segment.slice(startIndex, endIndex + 1);
    const midiValues = windowFrames.map((frame) => frame.smoothedMidi);
    const stabilityCents = robustSpread(midiValues.map((midi) => midi * 100));
    if (stabilityCents > policy.maxStableSpreadCents) {
      continue;
    }

    windows.push({
      startIndex,
      endIndex,
      startMs,
      endMs,
      medianMidi: median(midiValues),
      stabilityCents
    });
  }

  return windows;
}

function groupStableWindows(windows: StableWindow[], policy: ScoringPolicy) {
  const sortedWindows = [...windows].sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);
  const groups: EventGroup[] = [];

  sortedWindows.forEach((window) => {
    const lastGroup = groups.at(-1);
    if (
      lastGroup &&
      window.startMs <= lastGroup.windows.at(-1)!.endMs + policy.maxDropoutMs &&
      Math.abs(window.medianMidi - lastGroup.medianMidi) * 100 <= policy.noteChangeCents
    ) {
      lastGroup.windows.push(window);
      lastGroup.medianMidi = median(lastGroup.windows.map((candidate) => candidate.medianMidi));
      return;
    }

    groups.push({
      windows: [window],
      medianMidi: window.medianMidi
    });
  });

  return groups;
}

function createEventFromGroup(
  group: EventGroup,
  segment: VoicedFrame[],
  policy: ScoringPolicy,
  eventIndex: number
): SungNoteEvent | null {
  const stableStartIndex = Math.min(...group.windows.map((window) => window.startIndex));
  const stableEndIndex = Math.max(...group.windows.map((window) => window.endIndex));
  const stableFrames = segment
    .slice(stableStartIndex, stableEndIndex + 1)
    .filter(
      (frame) => Math.abs(frame.smoothedMidi - group.medianMidi) * 100 <= policy.noteChangeCents
    );

  if (stableFrames.length < MIN_EVENT_FRAMES) {
    return null;
  }

  const medianMidi = median(stableFrames.map((frame) => frame.smoothedMidi));
  const stableStartMs = stableFrames[0].timeMs;
  const stableEndMs = stableFrames.at(-1)!.timeMs;
  const expandedStartIndex = expandEventStart(segment, stableStartIndex, medianMidi, policy);
  const expandedEndIndex = expandEventEnd(segment, stableEndIndex, medianMidi, policy);
  const eventFrames = segment.slice(expandedStartIndex, expandedEndIndex + 1);
  const durationMs = Math.max(1, segment[expandedEndIndex].timeMs - segment[expandedStartIndex].timeMs);
  const voicedDurationMs = eventFrames.reduce((total, frame, index) => {
    const next = eventFrames[index + 1];
    return total + (next ? Math.max(0, next.timeMs - frame.timeMs) : 0);
  }, 0);

  return {
    id: `event-${eventIndex}`,
    startMs: segment[expandedStartIndex].timeMs,
    endMs: segment[expandedEndIndex].timeMs,
    stableStartMs,
    stableEndMs,
    medianHz: midiToFrequency(medianMidi),
    medianMidi,
    stabilityCents: robustSpread(stableFrames.map((frame) => frame.smoothedMidi * 100)),
    voicedCoverage: Math.min(1, voicedDurationMs / durationMs)
  };
}

function expandEventStart(
  segment: VoicedFrame[],
  stableStartIndex: number,
  medianMidi: number,
  policy: ScoringPolicy
) {
  let index = stableStartIndex;
  while (index > 0) {
    const previous = segment[index - 1];
    const current = segment[index];
    const gapMs = current.timeMs - previous.timeMs;
    const distanceCents = Math.abs(previous.smoothedMidi - medianMidi) * 100;
    if (gapMs > policy.maxDropoutMs || distanceCents > policy.scoopWarningCents * 2.4) {
      break;
    }
    index -= 1;
  }
  return index;
}

function expandEventEnd(
  segment: VoicedFrame[],
  stableEndIndex: number,
  medianMidi: number,
  policy: ScoringPolicy
) {
  let index = stableEndIndex;
  while (index < segment.length - 1) {
    const next = segment[index + 1];
    const current = segment[index];
    const gapMs = next.timeMs - current.timeMs;
    const distanceCents = Math.abs(next.smoothedMidi - medianMidi) * 100;
    if (gapMs > policy.maxDropoutMs || distanceCents > policy.noteChangeCents) {
      break;
    }
    index += 1;
  }
  return index;
}

function alignEventsToTargets(
  events: SungNoteEvent[],
  targetNotes: TargetNote[],
  policy: ScoringPolicy
): AlignmentResult {
  const targetCount = targetNotes.length;
  const eventCount = events.length;
  const dp = Array.from({ length: targetCount + 1 }, () =>
    Array.from({ length: eventCount + 1 }, () => Number.POSITIVE_INFINITY)
  );
  const backtrack: Array<Array<"assign" | "miss" | "skip" | null>> = Array.from(
    { length: targetCount + 1 },
    () => Array.from({ length: eventCount + 1 }, () => null)
  );

  dp[0][0] = 0;

  for (let targetIndex = 0; targetIndex <= targetCount; targetIndex += 1) {
    for (let eventIndex = 0; eventIndex <= eventCount; eventIndex += 1) {
      const current = dp[targetIndex][eventIndex];
      if (!Number.isFinite(current)) {
        continue;
      }

      if (targetIndex < targetCount) {
        const missCost = current + policy.missingTargetCost;
        if (missCost < dp[targetIndex + 1][eventIndex]) {
          dp[targetIndex + 1][eventIndex] = missCost;
          backtrack[targetIndex + 1][eventIndex] = "miss";
        }
      }

      if (eventIndex < eventCount) {
        const skipCost = current + policy.extraEventSkipCost;
        if (skipCost < dp[targetIndex][eventIndex + 1]) {
          dp[targetIndex][eventIndex + 1] = skipCost;
          backtrack[targetIndex][eventIndex + 1] = "skip";
        }
      }

      if (targetIndex < targetCount && eventIndex < eventCount) {
        const assignCost =
          current + assignmentCost(events[eventIndex], targetNotes[targetIndex], policy);
        if (assignCost < dp[targetIndex + 1][eventIndex + 1]) {
          dp[targetIndex + 1][eventIndex + 1] = assignCost;
          backtrack[targetIndex + 1][eventIndex + 1] = "assign";
        }
      }
    }
  }

  const alignment: AttemptAlignment[] = [];
  const ignoredEventIndices = new Set<number>();
  let targetIndex = targetCount;
  let eventIndex = eventCount;

  while (targetIndex > 0 || eventIndex > 0) {
    const action = backtrack[targetIndex][eventIndex];
    if (action === "assign") {
      alignment.unshift({
        targetIndex: targetIndex - 1,
        target: targetNotes[targetIndex - 1],
        eventIndex: eventIndex - 1,
        event: events[eventIndex - 1]
      });
      targetIndex -= 1;
      eventIndex -= 1;
    } else if (action === "miss") {
      alignment.unshift({
        targetIndex: targetIndex - 1,
        target: targetNotes[targetIndex - 1]
      });
      targetIndex -= 1;
    } else if (action === "skip") {
      ignoredEventIndices.add(eventIndex - 1);
      eventIndex -= 1;
    } else {
      break;
    }
  }

  return { alignment, ignoredEventIndices: [...ignoredEventIndices].sort((a, b) => a - b) };
}

function assignmentCost(event: SungNoteEvent, target: TargetNote, policy: ScoringPolicy) {
  const cents = Math.abs((event.medianMidi - target.midi) * 100);
  const wrongNotePenalty = cents >= policy.wrongNoteCents ? 35 : 0;
  return Math.min(cents, 240) + wrongNotePenalty;
}

function collectEventWarnings(
  event: SungNoteEvent,
  medianCents: number,
  policy: ScoringPolicy
): NoteWarning[] {
  const warnings = new Set<NoteWarning>();
  const stableDurationMs = event.stableEndMs - event.stableStartMs;

  if (event.stableStartMs - event.startMs > 80) {
    warnings.add("scoop");
  }

  if (stableDurationMs < policy.minStableDurationMs / policy.shortSustainRatio) {
    warnings.add("shortSustain");
  }

  if (event.stabilityCents > policy.mildWobbleCents) {
    warnings.add("mildWobble");
  }

  if (event.voicedCoverage < 0.72) {
    warnings.add("dropout");
  }

  if (Math.abs(medianCents) > policy.toleranceCents * 0.7 && Math.abs(medianCents) <= policy.toleranceCents) {
    warnings.add("mildWobble");
  }

  return sortWarnings([...warnings]);
}

function unresolvedAssessment(
  status: "missed" | "unclear" | "unstable",
  instruction: string,
  voicedCoverage = 0
): NoteAssessment {
  return {
    status,
    voicedCoverage,
    warnings: [],
    instruction
  };
}

function createNoEventAssessment(frames: PitchFrame[], range: VocalRange): NoteAssessment {
  if (frames.length === 0) {
    return unresolvedAssessment("missed", "No sung note was detected for this target.");
  }

  const minFrequencyHz = midiToFrequency(range.lowestMidi);
  const maxFrequencyHz = midiToFrequency(range.highestMidi);
  const audibleFrames = frames.filter((frame) => frame.rms >= SILENCE_RMS);
  const confidentFrames = audibleFrames.filter(
    (frame) =>
      frame.frequencyHz !== null &&
      frame.clarity >= MIN_CLARITY &&
      frame.frequencyHz >= minFrequencyHz &&
      frame.frequencyHz <= maxFrequencyHz
  );

  if (audibleFrames.length === 0) {
    return unresolvedAssessment("missed", "No sung note was detected for this target.");
  }

  if (confidentFrames.length === 0) {
    return unresolvedAssessment(
      "unclear",
      "The mic heard you, but the pitch was not clear enough to score."
    );
  }

  return unresolvedAssessment(
    "unstable",
    "The pitch never settled into a clear note center."
  );
}

function createAttemptSummary(notes: ScoredTargetNote[], passed: boolean) {
  const firstIssue = notes.find((note) => !isPassingStatus(note.score.status));
  if (firstIssue) {
    return createFailureSummary(firstIssue);
  }

  const firstWarning = notes.find((note) => note.score.status === "passWithWarning");
  if (passed && firstWarning) {
    return `${firstWarning.label} was in tune, with a ${describeWarning(firstWarning.score.warnings[0])}. Moving on.`;
  }

  return isMajorTriadScore(notes)
    ? "Nice triad. Moving up a half step."
    : "Nice work. Moving up a half step.";
}

function createFailureSummary(note: ScoredTargetNote) {
  const score = note.score;
  switch (score.status) {
    case "flat":
      return `${note.label} was ${Math.abs(Math.round(score.medianCents ?? 0))} cents flat.`;
    case "sharp":
      return `${note.label} was ${Math.round(score.medianCents ?? 0)} cents sharp.`;
    case "wrongNote":
      return `${note.label} landed closer to another note. Check the target and retry.`;
    case "unstable":
      return `${note.label} never settled into a clear center.`;
    case "unclear":
      return `${note.label} was unclear. Sing a bit more directly into the mic.`;
    case "missed":
      return `${note.label} was missed. Try the exercise again.`;
    case "pass":
    case "passWithWarning":
      return "Try that again.";
  }
}

function isMajorTriadScore(notes: ScoredTargetNote[]) {
  return (
    notes.length === 3 &&
    notes[0]?.degree === 1 &&
    notes[1]?.degree === 3 &&
    notes[2]?.degree === 5
  );
}

function createWarningInstruction(warnings: NoteWarning[], medianCents: number) {
  const primaryWarning = warnings[0];
  switch (primaryWarning) {
    case "scoop":
      return `Centered at ${formatCents(medianCents)}, but scoop into the note more cleanly.`;
    case "late":
    case "early":
      return `Centered at ${formatCents(medianCents)}.`;
    case "shortSustain":
      return `Centered at ${formatCents(medianCents)}, but hold it longer.`;
    case "mildWobble":
      return `Centered at ${formatCents(medianCents)}, with a little wobble.`;
    case "dropout":
      return `Centered at ${formatCents(medianCents)}, but the mic lost parts of the note.`;
    default:
      return `Centered at ${formatCents(medianCents)}.`;
  }
}

function isPassingStatus(status: NoteAssessment["status"]) {
  return status === "pass" || status === "passWithWarning";
}

function describeWarning(warning: NoteWarning | undefined) {
  switch (warning) {
    case "scoop":
      return "scoop";
    case "late":
      return "late arrival";
    case "early":
      return "early arrival";
    case "shortSustain":
      return "short hold";
    case "mildWobble":
      return "little wobble";
    case "dropout":
      return "mic dropout";
    default:
      return "small warning";
  }
}

function sortWarnings(warnings: NoteWarning[]) {
  const priority: Record<NoteWarning, number> = {
    scoop: 0,
    late: 1,
    early: 1,
    shortSustain: 2,
    mildWobble: 3,
    dropout: 4
  };

  return warnings.sort((a, b) => priority[a] - priority[b]);
}

function splitContiguousFrames<T extends { timeMs: number }>(frames: T[], maxGapMs: number) {
  const segments: T[][] = [];
  let current: T[] = [];

  frames.forEach((frame) => {
    const previous = current.at(-1);
    if (previous && frame.timeMs - previous.timeMs > maxGapMs) {
      if (current.length > 0) {
        segments.push(current);
      }
      current = [];
    }
    current.push(frame);
  });

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function formatCents(cents: number) {
  const rounded = Math.round(cents);
  if (rounded === 0) {
    return "0 cents";
  }

  return `${Math.abs(rounded)} cents ${rounded < 0 ? "flat" : "sharp"}`;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function robustSpread(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center)));
  const iqr = percentile(values, 0.75) - percentile(values, 0.25);
  const trimmedRange = percentile(values, 0.9) - percentile(values, 0.1);
  return Math.max(mad * 1.4826, iqr * 0.7413, trimmedRange * 0.55);
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
