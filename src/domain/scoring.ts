import type {
  AttemptAlignment,
  AttemptScore,
  SegmentWarning,
  PitchFrame,
  ScoredTargetSegment,
  SegmentAssessment,
  SungContourEvent,
  ScoringPolicy,
  SungNoteEvent,
  TargetNoteSegment,
  TargetSegment,
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
  targetSegments: TargetSegment[],
  policy: ScoringPolicy,
  range: VocalRange
): AttemptScore {
  const noteTargets = targetSegments.filter(isTargetNoteSegment);
  if (noteTargets.length === targetSegments.length) {
    return scoreStableNoteAttempt(frames, noteTargets, policy, range);
  }

  return scoreContourAttempt(frames, targetSegments, policy, range);
}

function scoreStableNoteAttempt(
  frames: PitchFrame[],
  targetNotes: TargetNoteSegment[],
  policy: ScoringPolicy,
  range: VocalRange
): AttemptScore {
  const events = extractSungNoteEvents(frames, policy, range);
  const { alignment, ignoredEventIndices } = alignEventsToTargets(events, targetNotes, policy);
  const noEventAssessment = createNoEventAssessment(frames, range);
  const segments = alignment.map(({ target, event }) => {
    const noteTarget = target as TargetNoteSegment;
    return {
      ...noteTarget,
      sungEvent: event,
      score: event
        ? scoreAlignedEvent(event, noteTarget, policy)
        : events.length === 0
          ? noEventAssessment
          : unresolvedAssessment("missed", "No sung note was detected for this target.")
    };
  });
  const passed = segments.every((segment) => isPassingStatus(segment.score.status));

  return {
    passed,
    segments,
    events,
    contourEvents: [],
    alignment,
    ignoredEventIndices,
    durationMs: Math.max(...frames.map((frame) => frame.timeMs), 0),
    summary: createAttemptSummary(segments, passed)
  };
}

export function isPitchFirstAttemptComplete(
  frames: PitchFrame[],
  targetSegments: TargetSegment[],
  policy: ScoringPolicy,
  range: VocalRange
) {
  const score = scoreAttempt(frames, targetSegments, policy, range);
  const allTargetsHaveEvents = score.alignment.every((item) =>
    item.target.kind === "glide" ? item.contour !== undefined : item.event !== undefined
  );
  if (!allTargetsHaveEvents) {
    return false;
  }

  if (targetSegments.some((target) => target.kind === "glide")) {
    const lastContour = score.alignment.at(-1)?.contour;
    const latestTimeMs = score.durationMs;
    return Boolean(
      score.passed &&
        lastContour &&
        latestTimeMs >= lastContour.endMs + policy.finalNoteSettleMs
    );
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
  target: TargetNoteSegment,
  policy: ScoringPolicy
): SegmentAssessment {
  const medianCents = (event.medianMidi - target.midi) * 100;
  const warnings = collectEventWarnings(event, medianCents, policy);
  const base: Omit<SegmentAssessment, "status" | "instruction"> = {
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
          ? `${target.noteName} centered.`
          : createWarningInstruction(warnings, medianCents)
    };
  }

  if (absoluteMedian >= policy.wrongNoteCents) {
    return {
      ...base,
      status: "wrongNote",
      instruction: `${target.noteName} landed closer to ${midiToNoteName(
        Math.round(event.medianMidi)
      )}. Check the target and retry.`
    };
  }

  return {
    ...base,
    status: medianCents < 0 ? "flat" : "sharp",
    instruction: `${target.noteName} was ${Math.abs(Math.round(medianCents))} cents ${
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

function scoreContourAttempt(
  frames: PitchFrame[],
  targetSegments: TargetSegment[],
  policy: ScoringPolicy,
  range: VocalRange
): AttemptScore {
  const voicedFrames = buildVoicedFrames(frames, range);
  const noEventAssessment = createNoEventAssessment(frames, range);
  const { alignment, contourEvents } = alignContoursToTargets(voicedFrames, targetSegments, policy);
  const segments = alignment.map(({ target, contour }) => ({
    ...target,
    sungContour: contour,
    score:
      target.kind === "glide"
        ? scoreGlideContour(target, contour, noEventAssessment, policy)
        : unresolvedAssessment("missed", "No sung note was detected for this target.")
  }));
  const passed = segments.every((segment) => isPassingStatus(segment.score.status));

  return {
    passed,
    segments,
    events: [],
    contourEvents,
    alignment,
    ignoredEventIndices: [],
    durationMs: Math.max(...frames.map((frame) => frame.timeMs), 0),
    summary: createAttemptSummary(segments, passed)
  };
}

function alignContoursToTargets(
  voicedFrames: VoicedFrame[],
  targetSegments: TargetSegment[],
  policy: ScoringPolicy
) {
  const contourEvents: SungContourEvent[] = [];
  const alignment: AttemptAlignment[] = [];
  const totalTargetDurationMs = targetSegments.reduce(
    (total, target) => total + Math.max(1, target.endMs - target.startMs),
    0
  );
  const firstFrame = voicedFrames[0];
  const lastFrame = voicedFrames.at(-1);
  const sungDurationMs =
    firstFrame && lastFrame ? Math.max(1, lastFrame.timeMs - firstFrame.timeMs) : 0;
  let targetCursorMs = 0;

  targetSegments.forEach((target, targetIndex) => {
    if (target.kind !== "glide" || !firstFrame || !lastFrame || voicedFrames.length < MIN_EVENT_FRAMES) {
      alignment.push({ targetIndex, target });
      targetCursorMs += Math.max(1, target.endMs - target.startMs);
      return;
    }

    const targetDurationMs = Math.max(1, target.endMs - target.startMs);
    const startRatio = targetCursorMs / Math.max(1, totalTargetDurationMs);
    const endRatio = (targetCursorMs + targetDurationMs) / Math.max(1, totalTargetDurationMs);
    const contourStartMs = firstFrame.timeMs + sungDurationMs * startRatio;
    const contourEndMs = firstFrame.timeMs + sungDurationMs * endRatio;
    const contourFrames = voicedFrames.filter((frame) => {
      if (targetIndex === targetSegments.length - 1) {
        return frame.timeMs >= contourStartMs && frame.timeMs <= contourEndMs;
      }
      return frame.timeMs >= contourStartMs && frame.timeMs < contourEndMs;
    });
    const contour = createContourEvent(target, contourFrames, contourEvents.length, policy);
    if (contour) {
      contourEvents.push(contour);
      alignment.push({
        targetIndex,
        target,
        contourIndex: contourEvents.length - 1,
        contour
      });
    } else {
      alignment.push({ targetIndex, target });
    }
    targetCursorMs += targetDurationMs;
  });

  return { alignment, contourEvents };
}

function createContourEvent(
  target: Extract<TargetSegment, { kind: "glide" }>,
  frames: VoicedFrame[],
  eventIndex: number,
  policy: ScoringPolicy
): SungContourEvent | null {
  if (frames.length < MIN_EVENT_FRAMES) {
    return null;
  }

  const startMs = frames[0].timeMs;
  const endMs = frames.at(-1)!.timeMs;
  const durationMs = Math.max(1, endMs - startMs);
  if (durationMs < policy.minStableDurationMs) {
    return null;
  }

  const expectedDeltaMidi = target.toMidi - target.fromMidi;
  const errorCents = frames.map((frame, index) => {
    const progress =
      durationMs <= 1
        ? index / Math.max(1, frames.length - 1)
        : (frame.timeMs - startMs) / durationMs;
    const expectedMidi = target.fromMidi + expectedDeltaMidi * Math.min(1, Math.max(0, progress));
    return (frame.smoothedMidi - expectedMidi) * 100;
  });
  const voicedDurationMs = frames.reduce((total, frame, index) => {
    const next = frames[index + 1];
    return total + (next ? Math.min(policy.maxDropoutMs, Math.max(0, next.timeMs - frame.timeMs)) : 0);
  }, 0);

  return {
    id: `contour-${eventIndex}`,
    startMs,
    endMs,
    fromMidi: frames[0].smoothedMidi,
    toMidi: frames.at(-1)!.smoothedMidi,
    voicedCoverage: Math.min(1, voicedDurationMs / durationMs),
    medianErrorCents: median(errorCents),
    medianAbsErrorCents: median(errorCents.map(Math.abs)),
    startCents: (frames[0].smoothedMidi - target.fromMidi) * 100,
    endCents: (frames.at(-1)!.smoothedMidi - target.toMidi) * 100,
    contourSpreadCents: robustSpread(errorCents)
  };
}

function scoreGlideContour(
  target: Extract<TargetSegment, { kind: "glide" }>,
  contour: SungContourEvent | undefined,
  noEventAssessment: SegmentAssessment,
  policy: ScoringPolicy
): SegmentAssessment {
  if (!contour) {
    return {
      ...noEventAssessment,
      instruction:
        noEventAssessment.status === "missed"
          ? `${target.label} was missed. Try the glide again.`
          : `${target.label} was not clear enough to score.`
    };
  }

  const expectedDirection = Math.sign(target.toMidi - target.fromMidi);
  const actualDirection = Math.sign(contour.toMidi - contour.fromMidi);
  const warnings = collectContourWarnings(contour, policy);
  const base: Omit<SegmentAssessment, "status" | "instruction"> = {
    medianCents: contour.medianErrorCents,
    contourErrorCents: contour.medianAbsErrorCents,
    startCents: contour.startCents,
    endCents: contour.endCents,
    stableStartMs: contour.startMs,
    stableEndMs: contour.endMs,
    voicedCoverage: contour.voicedCoverage,
    stabilityCents: contour.contourSpreadCents,
    warnings
  };

  if (contour.voicedCoverage < policy.minVoicedCoverage) {
    return {
      ...base,
      status: "unclear",
      instruction: `${target.label} dropped out before there was enough clear pitch to score.`
    };
  }

  if (expectedDirection !== 0 && actualDirection !== 0 && expectedDirection !== actualDirection) {
    return {
      ...base,
      status: "wrongDirection",
      instruction: `${target.label} moved the wrong direction. Follow the guide line and try again.`
    };
  }

  const endpointErrorCents = Math.max(Math.abs(contour.startCents), Math.abs(contour.endCents));
  if (contour.medianAbsErrorCents > policy.toleranceCents || endpointErrorCents > policy.toleranceCents) {
    return {
      ...base,
      status: "offContour",
      instruction: `${target.label} drifted ${Math.round(
        Math.max(contour.medianAbsErrorCents, endpointErrorCents)
      )} cents from the guide.`
    };
  }

  const status = warnings.length > 0 ? "passWithWarning" : "pass";
  return {
    ...base,
    status,
    instruction:
      status === "pass"
        ? `${target.label} followed the guide.`
        : createContourWarningInstruction(warnings, contour)
  };
}

function alignEventsToTargets(
  events: SungNoteEvent[],
  targetNotes: TargetNoteSegment[],
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

function assignmentCost(event: SungNoteEvent, target: TargetNoteSegment, policy: ScoringPolicy) {
  const cents = Math.abs((event.medianMidi - target.midi) * 100);
  const wrongNotePenalty = cents >= policy.wrongNoteCents ? 35 : 0;
  return Math.min(cents, 240) + wrongNotePenalty;
}

function collectEventWarnings(
  event: SungNoteEvent,
  medianCents: number,
  policy: ScoringPolicy
): SegmentWarning[] {
  const warnings = new Set<SegmentWarning>();
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

function collectContourWarnings(contour: SungContourEvent, policy: ScoringPolicy): SegmentWarning[] {
  const warnings = new Set<SegmentWarning>();
  const endpointErrorCents = Math.max(Math.abs(contour.startCents), Math.abs(contour.endCents));

  if (endpointErrorCents > policy.toleranceCents * 0.7 && endpointErrorCents <= policy.toleranceCents) {
    warnings.add("endpointDrift");
  }

  if (contour.contourSpreadCents > policy.mildWobbleCents) {
    warnings.add("unevenGlide");
  }

  if (contour.voicedCoverage < 0.72) {
    warnings.add("dropout");
  }

  return sortWarnings([...warnings]);
}

function unresolvedAssessment(
  status: "missed" | "unclear" | "unstable",
  instruction: string,
  voicedCoverage = 0
): SegmentAssessment {
  return {
    status,
    voicedCoverage,
    warnings: [],
    instruction
  };
}

function createNoEventAssessment(frames: PitchFrame[], range: VocalRange): SegmentAssessment {
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

function createAttemptSummary(segments: ScoredTargetSegment[], passed: boolean) {
  const firstIssue = segments.find((segment) => !isPassingStatus(segment.score.status));
  if (firstIssue) {
    return createFailureSummary(firstIssue);
  }

  const firstWarning = segments.find((segment) => segment.score.status === "passWithWarning");
  if (passed && firstWarning) {
    return `${describeSegmentTarget(firstWarning)} passed, with a ${describeWarning(
      firstWarning.score.warnings[0]
    )}. Moving on.`;
  }

  return isMajorTriadScore(segments)
    ? "Nice triad. Moving up a half step."
    : "Nice work. Moving up a half step.";
}

function createFailureSummary(segment: ScoredTargetSegment) {
  const score = segment.score;
  const targetName = describeSegmentTarget(segment);
  switch (score.status) {
    case "flat":
      return `${targetName} was ${Math.abs(Math.round(score.medianCents ?? 0))} cents flat.`;
    case "sharp":
      return `${targetName} was ${Math.round(score.medianCents ?? 0)} cents sharp.`;
    case "wrongNote":
      return `${targetName} landed closer to another note. Check the target and retry.`;
    case "wrongDirection":
      return `${targetName} moved the wrong direction.`;
    case "offContour":
      return `${targetName} drifted away from the guide contour.`;
    case "unstable":
      return `${targetName} never settled into a clear center.`;
    case "unclear":
      return `${targetName} was unclear. Sing a bit more directly into the mic.`;
    case "missed":
      return `${targetName} was missed. Try the exercise again.`;
    case "pass":
    case "passWithWarning":
      return "Try that again.";
  }
}

function isMajorTriadScore(segments: ScoredTargetSegment[]) {
  return (
    segments.length === 3 &&
    segments[0]?.kind === "note" &&
    segments[0].offsetSemitones === 0 &&
    segments[1]?.kind === "note" &&
    segments[1].offsetSemitones === 4 &&
    segments[2]?.kind === "note" &&
    segments[2].offsetSemitones === 7
  );
}

function createWarningInstruction(warnings: SegmentWarning[], medianCents: number) {
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
    case "unevenGlide":
    case "endpointDrift":
      return `Centered at ${formatCents(medianCents)}.`;
    default:
      return `Centered at ${formatCents(medianCents)}.`;
  }
}

function createContourWarningInstruction(warnings: SegmentWarning[], contour: SungContourEvent) {
  const primaryWarning = warnings[0];
  switch (primaryWarning) {
    case "endpointDrift":
      return `The glide shape worked, but the endpoints drifted by ${Math.round(
        Math.max(Math.abs(contour.startCents), Math.abs(contour.endCents))
      )} cents.`;
    case "unevenGlide":
      return "The glide reached the target, with a little unevenness through the line.";
    case "dropout":
      return "The glide reached the target, but the mic lost parts of the line.";
    default:
      return "The glide reached the target with a small warning.";
  }
}

function isPassingStatus(status: SegmentAssessment["status"]) {
  return status === "pass" || status === "passWithWarning";
}

function isTargetNoteSegment(target: TargetSegment): target is TargetNoteSegment {
  return target.kind === "note";
}

function describeSegmentTarget(segment: ScoredTargetSegment) {
  return segment.kind === "note"
    ? segment.noteName
    : `${segment.fromNoteName} to ${segment.toNoteName}`;
}

function describeWarning(warning: SegmentWarning | undefined) {
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
    case "unevenGlide":
      return "uneven glide";
    case "endpointDrift":
      return "endpoint drift";
    default:
      return "small warning";
  }
}

function sortWarnings(warnings: SegmentWarning[]) {
  const priority: Record<SegmentWarning, number> = {
    scoop: 0,
    late: 1,
    early: 1,
    shortSustain: 2,
    mildWobble: 3,
    unevenGlide: 3,
    endpointDrift: 3,
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
