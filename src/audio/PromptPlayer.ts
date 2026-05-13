import * as Tone from "tone";
import type { PromptStyle, TargetNote } from "../domain/contracts";
import type { PromptPlayer } from "./types";

export class TonePromptPlayer implements PromptPlayer {
  private synth: Tone.PolySynth | null = null;
  private completionTimer: number | null = null;

  async playPrompt(targetNotes: TargetNote[], tempoBpm: number, promptStyle: PromptStyle) {
    this.cancel();
    await Tone.start();
    const synth = this.getSynth();
    const beatSeconds = 60 / tempoBpm;
    const now = Tone.now() + 0.08;
    const chordSeconds = beatSeconds * 1.05;
    const gapSeconds = beatSeconds * 0.45;
    const shouldPlayChord = promptStyle === "chord-then-sequence" && targetNotes.length > 1;
    const noteStartSeconds = shouldPlayChord ? now + chordSeconds + gapSeconds : now;

    if (shouldPlayChord) {
      synth.triggerAttackRelease(
        [...new Set(targetNotes.map((note) => note.label))],
        chordSeconds,
        now
      );
    }

    targetNotes.forEach((note) => {
      const noteDurationSeconds = Math.max(beatSeconds * 0.5, ((note.endMs - note.startMs) / 1000) * 0.72);
      synth.triggerAttackRelease(
        note.label,
        noteDurationSeconds,
        noteStartSeconds + note.startMs / 1000
      );
    });

    const lastTargetEndSeconds = (targetNotes.at(-1)?.endMs ?? 0) / 1000;
    const leadInSeconds = shouldPlayChord ? chordSeconds + gapSeconds : 0;
    const totalMs = (leadInSeconds + lastTargetEndSeconds + beatSeconds * 0.25) * 1000;

    await new Promise<void>((resolve) => {
      this.completionTimer = window.setTimeout(resolve, totalMs);
    });
  }

  cancel() {
    if (this.completionTimer !== null) {
      window.clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
    this.synth?.releaseAll();
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
}
