import * as Tone from "tone";
import type { PromptStyle, TargetSegment } from "../domain/contracts";
import { getPromptTimeline } from "../domain/promptTiming";
import type { PromptPlayer } from "./types";

export class TonePromptPlayer implements PromptPlayer {
  private synth: Tone.PolySynth | null = null;
  private glideSynth: Tone.Synth | null = null;
  private completionTimer: number | null = null;

  async playPrompt(targetSegments: TargetSegment[], tempoBpm: number, promptStyle: PromptStyle) {
    this.cancel();
    await Tone.start();
    const synth = this.getSynth();
    const glideSynth = this.getGlideSynth();
    const promptTimeline = getPromptTimeline(targetSegments, tempoBpm, promptStyle);
    const beatSeconds = promptTimeline.beatMs / 1000;
    const now = Tone.now() + 0.08;
    const chordSeconds = promptTimeline.chordDurationMs / 1000;
    const shouldPlayChord = chordSeconds > 0;
    const noteStartSeconds = now + promptTimeline.sequenceLeadInMs / 1000;

    if (shouldPlayChord) {
      synth.triggerAttackRelease(
        [...new Set(targetSegments.flatMap(getSegmentPromptNoteNames))],
        chordSeconds,
        now
      );
    }

    targetSegments.forEach((segment) => {
      const segmentStartSeconds = noteStartSeconds + segment.startMs / 1000;
      const segmentDurationSeconds = (segment.endMs - segment.startMs) / 1000;
      if (segment.kind === "note") {
        const noteDurationSeconds = Math.max(beatSeconds * 0.5, segmentDurationSeconds * 0.72);
        synth.triggerAttackRelease(
          segment.noteName,
          noteDurationSeconds,
          segmentStartSeconds
        );
        return;
      }

      glideSynth.frequency.setValueAtTime(segment.fromFrequencyHz, segmentStartSeconds);
      glideSynth.triggerAttack(segment.fromFrequencyHz, segmentStartSeconds);
      glideSynth.frequency.linearRampToValueAtTime(
        segment.toFrequencyHz,
        segmentStartSeconds + segmentDurationSeconds
      );
      glideSynth.triggerRelease(segmentStartSeconds + segmentDurationSeconds);
    });

    await new Promise<void>((resolve) => {
      this.completionTimer = window.setTimeout(resolve, promptTimeline.totalDurationMs);
    });
  }

  cancel() {
    if (this.completionTimer !== null) {
      window.clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
    this.synth?.releaseAll();
    this.glideSynth?.triggerRelease();
  }

  private getSynth() {
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: "sine"
        },
        envelope: {
          attack: 0.015,
          decay: 0.12,
          sustain: 0.35,
          release: 0.18
        }
      }).toDestination();
    }

    return this.synth;
  }

  private getGlideSynth() {
    if (!this.glideSynth) {
      this.glideSynth = new Tone.Synth({
        oscillator: {
          type: "sine"
        },
        envelope: {
          attack: 0.015,
          decay: 0.03,
          sustain: 0.72,
          release: 0.18
        }
      }).toDestination();
    }

    return this.glideSynth;
  }
}

function getSegmentPromptNoteNames(segment: TargetSegment) {
  return segment.kind === "note"
    ? [segment.noteName]
    : [segment.fromNoteName, segment.toNoteName];
}
