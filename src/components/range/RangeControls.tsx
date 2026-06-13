import {
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import { Mic, Minus, Plus, Volume2 } from "lucide-react";
import { preparePlaybackAudioSession, resumeAudioContext } from "../../audio/audioSession";
import type { VocalRange } from "../../domain/contracts";
import { midiToFrequency, midiToNoteName } from "../../domain/music";
import {
  formatOctaveSpan,
  guessVoiceType,
  VOCAL_RANGE_MAX_MIDI,
  VOCAL_RANGE_MIN_MIDI,
  VOCAL_RANGE_MIN_SPAN_SEMITONES,
  VOICE_TYPE_PRESETS
} from "../../domain/vocalRange";

const KEYBOARD_WIDTH = 556;
const KEYBOARD_HEIGHT = 104;
const FLAG_HEIGHT = 34;

export function RangeKeyboard({
  range,
  needleMidi,
  interactive = true,
  onRangeChange
}: {
  range: VocalRange;
  needleMidi?: number;
  interactive?: boolean;
  onRangeChange: (lowestMidi: number, highestMidi: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<"low" | "high" | null>(null);
  const geometry = useMemo(() => buildKeyboardGeometry(), []);
  const keys = useMemo(
    () =>
      Array.from(
        { length: VOCAL_RANGE_MAX_MIDI - VOCAL_RANGE_MIN_MIDI + 1 },
        (_, index) => VOCAL_RANGE_MIN_MIDI + index
      ),
    []
  );

  function noteAtClientX(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return range.lowestMidi;
    }

    const x = Math.max(
      0,
      Math.min(KEYBOARD_WIDTH, (clientX - rect.left) * (KEYBOARD_WIDTH / rect.width))
    );
    return keys.reduce((best, midi) =>
      Math.abs(geometry.centerX(midi) - x) < Math.abs(geometry.centerX(best) - x)
        ? midi
        : best
    );
  }

  function updateEndpoint(which: "low" | "high", midi: number) {
    if (which === "low") {
      onRangeChange(
        Math.min(midi, range.highestMidi - VOCAL_RANGE_MIN_SPAN_SEMITONES),
        range.highestMidi
      );
      return;
    }

    onRangeChange(
      range.lowestMidi,
      Math.max(midi, range.lowestMidi + VOCAL_RANGE_MIN_SPAN_SEMITONES)
    );
  }

  function onPointerDown(which: "low" | "high") {
    return (event: ReactPointerEvent) => {
      if (!interactive) {
        return;
      }

      event.preventDefault();
      dragRef.current = which;
      const move = (moveEvent: PointerEvent) => updateEndpoint(which, noteAtClientX(moveEvent.clientX));
      const up = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
  }

  function onTrackClick(event: ReactPointerEvent<SVGSVGElement>) {
    if (!interactive || dragRef.current) {
      return;
    }

    const midi = noteAtClientX(event.clientX);
    if (Math.abs(midi - range.lowestMidi) <= Math.abs(midi - range.highestMidi)) {
      updateEndpoint("low", midi);
    } else {
      updateEndpoint("high", midi);
    }
  }

  const bandLeft = geometry.centerX(range.lowestMidi);
  const bandRight = geometry.centerX(range.highestMidi);
  const needle = needleMidi === undefined ? undefined : Math.round(needleMidi);

  return (
    <div
      className="range-keyboard"
      style={
        {
          "--keyboard-aspect": `${KEYBOARD_WIDTH} / ${KEYBOARD_HEIGHT + FLAG_HEIGHT}`
        } as CSSProperties
      }
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${KEYBOARD_WIDTH} ${KEYBOARD_HEIGHT + FLAG_HEIGHT}`}
        role="img"
        aria-label={`Range keyboard from ${midiToNoteName(range.lowestMidi)} to ${midiToNoteName(range.highestMidi)}`}
        onPointerDown={onTrackClick}
      >
        <rect
          className="range-keyboard__band"
          x={bandLeft}
          y={FLAG_HEIGHT}
          width={Math.max(0, bandRight - bandLeft)}
          height={KEYBOARD_HEIGHT}
        />
        {geometry.whites.map((midi) => {
          const inRange = midi >= range.lowestMidi && midi <= range.highestMidi;
          return (
            <g key={`white-${midi}`}>
              <rect
                className="range-keyboard__white-key"
                data-in-range={inRange || undefined}
                x={geometry.whiteIndex(midi) * geometry.whiteWidth + 0.5}
                y={FLAG_HEIGHT}
                width={geometry.whiteWidth - 1}
                height={KEYBOARD_HEIGHT}
                rx="3"
              />
              {midi % 12 === 0 ? (
                <text
                  x={geometry.whiteIndex(midi) * geometry.whiteWidth + geometry.whiteWidth / 2}
                  y={FLAG_HEIGHT + KEYBOARD_HEIGHT - 8}
                >
                  {midiToNoteName(midi)}
                </text>
              ) : null}
            </g>
          );
        })}
        {keys.filter(isSharp).map((midi) => {
          const inRange = midi >= range.lowestMidi && midi <= range.highestMidi;
          return (
            <rect
              key={`black-${midi}`}
              className="range-keyboard__black-key"
              data-in-range={inRange || undefined}
              x={geometry.whiteIndex(midi) * geometry.whiteWidth + geometry.whiteWidth * 0.68}
              y={FLAG_HEIGHT}
              width={geometry.whiteWidth * 0.64}
              height={KEYBOARD_HEIGHT * 0.6}
              rx="2.5"
            />
          );
        })}
        {needle !== undefined ? (
          <line
            className="range-keyboard__needle"
            x1={geometry.centerX(needle)}
            x2={geometry.centerX(needle)}
            y1={FLAG_HEIGHT - 4}
            y2={FLAG_HEIGHT + KEYBOARD_HEIGHT}
          />
        ) : null}
      </svg>
      <RangeFlag
        label="Low"
        midi={range.lowestMidi}
        left={geometry.centerX(range.lowestMidi)}
        onPointerDown={onPointerDown("low")}
        interactive={interactive}
      />
      <RangeFlag
        label="High"
        midi={range.highestMidi}
        left={geometry.centerX(range.highestMidi)}
        onPointerDown={onPointerDown("high")}
        interactive={interactive}
      />
      {needle !== undefined ? (
        <span
          className="range-keyboard__needle-chip"
          style={{ left: `${(geometry.centerX(needle) / KEYBOARD_WIDTH) * 100}%` }}
        >
          {midiToNoteName(needle)}
        </span>
      ) : null}
    </div>
  );
}

function RangeFlag({
  label,
  midi,
  left,
  interactive,
  onPointerDown
}: {
  label: "Low" | "High";
  midi: number;
  left: number;
  interactive: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
}) {
  return (
    <button
      className="range-flag"
      type="button"
      style={{ left: `${(left / KEYBOARD_WIDTH) * 100}%` }}
      onPointerDown={onPointerDown}
      disabled={!interactive}
      aria-label={`${label} note ${midiToNoteName(midi)}`}
    >
      <span>
        <span>{label}</span>
        <strong>{midiToNoteName(midi)}</strong>
      </span>
      <i aria-hidden="true" />
    </button>
  );
}

export function NoteStepper({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="range-note-stepper">
      <span>{label}</span>
      <div>
        <ReferenceToneButton midi={value} label={label} />
        <button type="button" aria-label={`Lower ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>
          <Minus size={16} />
        </button>
        <strong>{midiToNoteName(value)}</strong>
        <button type="button" aria-label={`Raise ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function VoiceTypePresetList({
  range,
  onRangeChange
}: {
  range: VocalRange;
  onRangeChange: (lowestMidi: number, highestMidi: number) => void;
}) {
  return (
    <div className="voice-preset-list">
      <span>Or start from a voice type</span>
      <div>
        {VOICE_TYPE_PRESETS.map((preset) => {
          const active = range.lowestMidi === preset.lowestMidi && range.highestMidi === preset.highestMidi;
          return (
            <button
              key={preset.key}
              type="button"
              data-active={active || undefined}
              onClick={() => onRangeChange(preset.lowestMidi, preset.highestMidi)}
            >
              {preset.key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RangeSummary({ range }: { range: VocalRange }) {
  return (
    <div className="range-summary">
      <strong>
        {midiToNoteName(range.lowestMidi)}-{midiToNoteName(range.highestMidi)}
      </strong>
      <span aria-hidden="true" />
      {formatOctaveSpan(range.lowestMidi, range.highestMidi)} oct
      <span aria-hidden="true" />
      <Mic size={13} />
      {guessVoiceType(range.lowestMidi, range.highestMidi)}
    </div>
  );
}

function buildKeyboardGeometry() {
  const whites = Array.from(
    { length: VOCAL_RANGE_MAX_MIDI - VOCAL_RANGE_MIN_MIDI + 1 },
    (_, index) => VOCAL_RANGE_MIN_MIDI + index
  ).filter((midi) => !isSharp(midi));
  const whiteWidth = KEYBOARD_WIDTH / whites.length;
  const whiteIndex = (midi: number) =>
    Math.max(0, whites.filter((white) => white <= midi).length - 1);
  const centerX = (midi: number) =>
    isSharp(midi)
      ? whiteIndex(midi) * whiteWidth + whiteWidth
      : whiteIndex(midi) * whiteWidth + whiteWidth / 2;

  return {
    whites,
    whiteWidth,
    whiteIndex,
    centerX
  };
}

function isSharp(midi: number) {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

let referenceToneContext: AudioContext | null = null;

async function playReferenceTone(midi: number) {
  try {
    preparePlaybackAudioSession();
    referenceToneContext = referenceToneContext ?? new AudioContext();
    await resumeAudioContext(referenceToneContext);

    const oscillator = referenceToneContext.createOscillator();
    const gain = referenceToneContext.createGain();
    const now = referenceToneContext.currentTime;
    const sustainUntil = now + 1.15;
    const stopAt = sustainUntil + 0.18;
    oscillator.type = "sine";
    oscillator.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain.gain.setValueAtTime(0.18, sustainUntil);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    oscillator.connect(gain);
    gain.connect(referenceToneContext.destination);
    oscillator.start(now);
    oscillator.stop(stopAt + 0.02);
  } catch {
    // Reference tones are optional; range editing still works without Web Audio.
  }
}

function ReferenceToneButton({ midi, label }: { midi: number; label: string }) {
  return (
    <button
      className="range-tone-button"
      type="button"
      aria-label={`Hear ${label}`}
      onClick={() => void playReferenceTone(midi)}
    >
      <Volume2 size={15} />
    </button>
  );
}
