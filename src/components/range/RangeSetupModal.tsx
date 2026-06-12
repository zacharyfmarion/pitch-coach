import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  Check,
  Minus,
  Mic,
  Play,
  Plus,
  Settings,
  Target,
  Volume2,
  X
} from "lucide-react";
import type { VocalRange, VocalRangeSetupSource } from "../../domain/contracts";
import { midiToFrequency, midiToNoteName } from "../../domain/music";
import {
  formatOctaveSpan,
  guessVoiceType,
  normalizeSetupRange,
  VOCAL_RANGE_MAX_MIDI,
  VOCAL_RANGE_MIN_MIDI,
  VOCAL_RANGE_MIN_SPAN_SEMITONES,
  VOICE_TYPE_PRESETS
} from "../../domain/vocalRange";
import type { RangeCaptureState, RangeCaptureTarget } from "../../app/usePitchCoachController";

type RangeSetupModalMode = "manual" | "sing";
type SingStep = "idle" | "low" | "low-done" | "high" | "done";
type ModalView = "edit" | "saved";

type RangeSetupModalProps = {
  open: boolean;
  initialRange: VocalRange;
  captureState: RangeCaptureState;
  allowSkip?: boolean;
  completionLabel?: string;
  savedContext?: "start" | "edit";
  onStartCapture: (target: RangeCaptureTarget) => void;
  onStopCapture: () => void;
  onSave: (range: VocalRange, source: VocalRangeSetupSource) => void;
  onSkip: () => void;
  onDismiss: () => void;
  onContinue: () => void;
};

const KEYBOARD_WIDTH = 556;
const KEYBOARD_HEIGHT = 104;
const FLAG_HEIGHT = 34;

export function RangeSetupModal({
  open,
  initialRange,
  captureState,
  allowSkip = true,
  completionLabel = "Start practicing",
  savedContext = "start",
  onStartCapture,
  onStopCapture,
  onSave,
  onSkip,
  onDismiss,
  onContinue
}: RangeSetupModalProps) {
  const [mode, setMode] = useState<RangeSetupModalMode>("manual");
  const [view, setView] = useState<ModalView>("edit");
  const [singStep, setSingStep] = useState<SingStep>("idle");
  const [draftRange, setDraftRange] = useState(() => normalizeSetupRange(initialRange));
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      setMode("manual");
      setView("edit");
      setSingStep("idle");
      setDraftRange(normalizeSetupRange(initialRange));
      window.setTimeout(() => dialogRef.current?.focus(), 0);
    }
    wasOpenRef.current = true;
  }, [initialRange, open]);

  useEffect(() => {
    if (!open || captureState.status !== "captured") {
      return;
    }

    setDraftRange((current) =>
      captureState.target === "low"
        ? normalizeSetupRange({
            lowestMidi: Math.min(captureState.capturedMidi, current.highestMidi - VOCAL_RANGE_MIN_SPAN_SEMITONES),
            highestMidi: current.highestMidi
          })
        : normalizeSetupRange({
            lowestMidi: current.lowestMidi,
            highestMidi: Math.max(captureState.capturedMidi, current.lowestMidi + VOCAL_RANGE_MIN_SPAN_SEMITONES)
          })
    );
    setSingStep(captureState.target === "low" ? "low-done" : "done");
  }, [captureState, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      handleDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!open) {
    return null;
  }

  const liveMidi = captureState.status === "listening" ? captureState.latestMidi : undefined;
  const canSave = mode === "manual" || singStep === "done";

  function setRange(lowestMidi: number, highestMidi: number) {
    setDraftRange(normalizeSetupRange({ lowestMidi, highestMidi }));
  }

  function handleDismiss() {
    onStopCapture();
    if (allowSkip && savedContext === "start") {
      handleSkip();
      return;
    }

    onDismiss();
  }

  function handleSkip() {
    onStopCapture();
    onSkip();
  }

  function handleSave() {
    onStopCapture();
    onSave(draftRange, mode);
    setView("saved");
  }

  function startCapture(target: RangeCaptureTarget) {
    setMode("sing");
    setSingStep(target);
    onStartCapture(target);
  }

  return (
    <div className="range-setup" role="presentation">
      <button className="range-setup__scrim" type="button" aria-label="Dismiss range setup" onClick={handleDismiss} />
      <div className="range-setup__stage">
        {view === "saved" ? (
          <section
            ref={dialogRef}
            className="range-setup-card range-setup-card--saved"
            role="dialog"
            aria-modal="true"
            aria-labelledby="range-setup-saved-title"
            tabIndex={-1}
          >
            <div className="range-saved">
              <span className="range-saved__halo" aria-hidden="true">
                <span className="range-saved__check">
                  <Check size={26} strokeWidth={2.6} />
                </span>
              </span>
              <div className="range-saved__copy">
                <h2 id="range-setup-saved-title">Range saved</h2>
                <p>
                  Your drills will sit between <strong>{midiToNoteName(draftRange.lowestMidi)}</strong> and{" "}
                  <strong>{midiToNoteName(draftRange.highestMidi)}</strong>, right where your voice is comfortable.
                </p>
              </div>
              <div className="range-saved__stats" aria-label="Saved range summary">
                <RangeStat label="Span" value={`${formatOctaveSpan(draftRange.lowestMidi, draftRange.highestMidi)} octaves`} />
                <span aria-hidden="true" />
                <RangeStat label="Voice type" value={guessVoiceType(draftRange.lowestMidi, draftRange.highestMidi)} />
              </div>
              <div className="range-saved__actions">
                <button className="range-primary-button" type="button" onClick={onContinue}>
                  <Play size={13} fill="currentColor" />
                  <span>{completionLabel}</span>
                </button>
                <button className="range-ghost-button" type="button" onClick={() => setView("edit")}>
                  Tweak range
                </button>
              </div>
              <p className="range-saved__note">
                <Settings size={13} />
                <span>{savedContext === "start" ? "Change anytime from the Range panel." : "Your next drill will use this range."}</span>
              </p>
            </div>
          </section>
        ) : (
          <section
            ref={dialogRef}
            className="range-setup-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="range-setup-title"
            tabIndex={-1}
          >
            <header className="range-setup-card__header">
              <span className="range-coach-head" aria-hidden="true">
                <Target size={22} />
              </span>
              <div>
                <h2 id="range-setup-title">Set your vocal range</h2>
                <p>So your drills land in keys you can actually sing. Takes a few seconds - you can change it anytime.</p>
              </div>
              {allowSkip ? (
                <button className="range-close-button" type="button" aria-label="Skip for now" onClick={handleSkip}>
                  <X size={16} />
                </button>
              ) : (
                <button className="range-close-button" type="button" aria-label="Close range setup" onClick={handleDismiss}>
                  <X size={16} />
                </button>
              )}
            </header>

            <div className="range-mode-tabs" role="group" aria-label="Range setup mode">
              <ModeButton
                active={mode === "manual"}
                icon={<Target size={16} />}
                label="I know my range"
                onClick={() => {
                  onStopCapture();
                  setMode("manual");
                }}
              />
              <ModeButton
                active={mode === "sing"}
                icon={<Mic size={16} />}
                label="Find it by singing"
                onClick={() => {
                  onStopCapture();
                  setMode("sing");
                }}
              />
            </div>

            <div className="range-setup-card__body">
              {mode === "manual" ? (
                <ManualRangeEditor range={draftRange} onRangeChange={setRange} />
              ) : (
                <SingRangeEditor
                  range={draftRange}
                  singStep={singStep}
                  captureState={captureState}
                  liveMidi={liveMidi}
                  onRangeChange={setRange}
                  onStartLow={() => startCapture("low")}
                  onStartHigh={() => startCapture("high")}
                  onManual={() => {
                    onStopCapture();
                    setMode("manual");
                  }}
                />
              )}
            </div>

            <footer className="range-setup-card__footer">
              <RangeSummary range={draftRange} />
              <div className="range-setup-card__actions">
                {allowSkip ? (
                  <button className="range-text-button" type="button" onClick={handleSkip}>
                    Skip for now
                  </button>
                ) : null}
                <button className="range-primary-button" type="button" disabled={!canSave} onClick={handleSave}>
                  Save range
                </button>
              </div>
            </footer>
          </section>
        )}
      </div>
    </div>
  );
}

function ManualRangeEditor({
  range,
  onRangeChange
}: {
  range: VocalRange;
  onRangeChange: (lowestMidi: number, highestMidi: number) => void;
}) {
  return (
    <div className="manual-range-editor">
      <div className="range-keyboard-shell">
        <RangeKeyboard range={range} onRangeChange={onRangeChange} />
        <p>
          Drag the <strong>Low</strong> / <strong>High</strong> flags, or tap a key
        </p>
      </div>
      <div className="range-stepper-row">
        <NoteStepper
          label="Lowest note"
          value={range.lowestMidi}
          min={VOCAL_RANGE_MIN_MIDI}
          max={range.highestMidi - VOCAL_RANGE_MIN_SPAN_SEMITONES}
          onChange={(lowestMidi) => onRangeChange(lowestMidi, range.highestMidi)}
        />
        <NoteStepper
          label="Highest note"
          value={range.highestMidi}
          min={range.lowestMidi + VOCAL_RANGE_MIN_SPAN_SEMITONES}
          max={VOCAL_RANGE_MAX_MIDI}
          onChange={(highestMidi) => onRangeChange(range.lowestMidi, highestMidi)}
        />
      </div>
      <VoiceTypePresetList range={range} onRangeChange={onRangeChange} />
    </div>
  );
}

function SingRangeEditor({
  range,
  singStep,
  captureState,
  liveMidi,
  onRangeChange,
  onStartLow,
  onStartHigh,
  onManual
}: {
  range: VocalRange;
  singStep: SingStep;
  captureState: RangeCaptureState;
  liveMidi?: number;
  onRangeChange: (lowestMidi: number, highestMidi: number) => void;
  onStartLow: () => void;
  onStartHigh: () => void;
  onManual: () => void;
}) {
  return (
    <div className="sing-range-editor">
      <SingProgress step={singStep} />
      <div className="range-keyboard-shell">
        <RangeKeyboard range={range} needleMidi={liveMidi} interactive={false} onRangeChange={onRangeChange} />
      </div>
      <div className="sing-range-editor__action">
        {captureState.status === "error" ? (
          <div className="range-capture-error" role="alert">
            {captureState.errorMessage}
          </div>
        ) : captureState.status === "listening" ? (
          <div className="range-listening-pill" aria-live="polite">
            <EqMini />
            <span>
              Listening for your {captureState.target === "low" ? "lowest" : "highest"} note...
              {liveMidi !== undefined ? <strong>{midiToNoteName(liveMidi)}</strong> : null}
            </span>
          </div>
        ) : singStep === "idle" ? (
          <div className="sing-range-editor__prompt">
            <p>
              Hum your <strong>lowest</strong> comfortable note, then your highest. We read the pitch locally.
            </p>
            <button className="range-primary-button" type="button" onClick={onStartLow}>
              <Mic size={15} />
              <span>Start - sing your lowest</span>
            </button>
          </div>
        ) : singStep === "low-done" ? (
          <div className="sing-range-editor__inline">
            <span>
              Lowest: <strong>{midiToNoteName(range.lowestMidi)}</strong>
            </span>
            <button className="range-primary-button" type="button" onClick={onStartHigh}>
              Now the highest
            </button>
            <button className="range-text-button" type="button" onClick={onStartLow}>
              Redo
            </button>
          </div>
        ) : (
          <div className="sing-range-editor__inline">
            <span className="range-captured-label">
              <Check size={16} />
              Got your range
            </span>
            <button className="range-text-button" type="button" onClick={onStartHigh}>
              Redo highest
            </button>
            <button className="range-text-button" type="button" onClick={onManual}>
              Fine-tune by hand
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="range-mode-tab" type="button" data-active={active || undefined} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function RangeKeyboard({
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
    () => Array.from({ length: VOCAL_RANGE_MAX_MIDI - VOCAL_RANGE_MIN_MIDI + 1 }, (_, index) => VOCAL_RANGE_MIN_MIDI + index),
    []
  );

  function noteAtClientX(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return range.lowestMidi;
    }

    const x = Math.max(0, Math.min(KEYBOARD_WIDTH, (clientX - rect.left) * (KEYBOARD_WIDTH / rect.width)));
    return keys.reduce((best, midi) =>
      Math.abs(geometry.centerX(midi) - x) < Math.abs(geometry.centerX(best) - x) ? midi : best
    );
  }

  function updateEndpoint(which: "low" | "high", midi: number) {
    if (which === "low") {
      onRangeChange(Math.min(midi, range.highestMidi - VOCAL_RANGE_MIN_SPAN_SEMITONES), range.highestMidi);
      return;
    }

    onRangeChange(range.lowestMidi, Math.max(midi, range.lowestMidi + VOCAL_RANGE_MIN_SPAN_SEMITONES));
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
    <div className="range-keyboard" style={{ "--keyboard-aspect": `${KEYBOARD_WIDTH} / ${KEYBOARD_HEIGHT + FLAG_HEIGHT}` } as CSSProperties}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${KEYBOARD_WIDTH} ${KEYBOARD_HEIGHT + FLAG_HEIGHT}`}
        role="img"
        aria-label={`Range keyboard from ${midiToNoteName(range.lowestMidi)} to ${midiToNoteName(range.highestMidi)}`}
        onPointerDown={onTrackClick}
      >
        <rect className="range-keyboard__band" x={bandLeft} y={FLAG_HEIGHT} width={Math.max(0, bandRight - bandLeft)} height={KEYBOARD_HEIGHT} />
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
                <text x={geometry.whiteIndex(midi) * geometry.whiteWidth + geometry.whiteWidth / 2} y={FLAG_HEIGHT + KEYBOARD_HEIGHT - 8}>
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
          <line className="range-keyboard__needle" x1={geometry.centerX(needle)} x2={geometry.centerX(needle)} y1={FLAG_HEIGHT - 4} y2={FLAG_HEIGHT + KEYBOARD_HEIGHT} />
        ) : null}
      </svg>
      <RangeFlag label="Low" midi={range.lowestMidi} left={geometry.centerX(range.lowestMidi)} onPointerDown={onPointerDown("low")} interactive={interactive} />
      <RangeFlag label="High" midi={range.highestMidi} left={geometry.centerX(range.highestMidi)} onPointerDown={onPointerDown("high")} interactive={interactive} />
      {needle !== undefined ? (
        <span className="range-keyboard__needle-chip" style={{ left: `${(geometry.centerX(needle) / KEYBOARD_WIDTH) * 100}%` }}>
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

function NoteStepper({
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

function VoiceTypePresetList({
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

function SingProgress({ step }: { step: SingStep }) {
  const activeIndex = step === "idle" || step === "low" ? 0 : step === "low-done" || step === "high" ? 1 : 2;
  const items = ["Lowest note", "Highest note"];

  return (
    <div className="range-sing-progress" aria-label="Singing range capture progress">
      {items.map((label, index) => {
        const done = activeIndex > index;
        const active = activeIndex === index;
        return (
          <span key={label} className="range-sing-progress__item" data-active={active || undefined} data-done={done || undefined}>
            <span>{done ? <Check size={13} strokeWidth={2.6} /> : index + 1}</span>
            <strong>{label}</strong>
            {index === 0 ? <i aria-hidden="true" data-done={activeIndex > 0 || undefined} /> : null}
          </span>
        );
      })}
    </div>
  );
}

function RangeSummary({ range }: { range: VocalRange }) {
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

function RangeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="range-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EqMini() {
  return (
    <span className="range-eq" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} style={{ animationDelay: `${index * 0.12}s` }} />
      ))}
    </span>
  );
}

export function RangeSetupToast({
  range,
  onOpen
}: {
  range: VocalRange;
  onOpen: () => void;
}) {
  return (
    <div className="range-setup-toast" role="status" aria-label="Default vocal range">
      <span className="range-setup-toast__icon" aria-hidden="true">
        <Target size={17} />
      </span>
      <span className="range-setup-toast__copy">
        <strong>
          Using a default range {"\u00b7"} {midiToNoteName(range.lowestMidi)}
          {"\u2013"}
          {midiToNoteName(range.highestMidi)}
        </strong>
        <span>Set yours so drills fit your voice.</span>
      </span>
      <button type="button" onClick={onOpen}>
        Set my range
      </button>
    </div>
  );
}

export function RangeControlSummary({
  range,
  status,
  onEdit
}: {
  range: VocalRange;
  status: string;
  onEdit: () => void;
}) {
  return (
    <div className="range-control-summary">
      <div>
        <strong>
          {midiToNoteName(range.lowestMidi)}-{midiToNoteName(range.highestMidi)}
        </strong>
        <span>
          {formatOctaveSpan(range.lowestMidi, range.highestMidi)} oct - {guessVoiceType(range.lowestMidi, range.highestMidi)}
          {status !== "completed" ? " - default" : ""}
        </span>
      </div>
      <button type="button" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

function buildKeyboardGeometry() {
  const whites = Array.from({ length: VOCAL_RANGE_MAX_MIDI - VOCAL_RANGE_MIN_MIDI + 1 }, (_, index) => VOCAL_RANGE_MIN_MIDI + index).filter(
    (midi) => !isSharp(midi)
  );
  const whiteWidth = KEYBOARD_WIDTH / whites.length;
  const whiteIndex = (midi: number) => Math.max(0, whites.filter((white) => white <= midi).length - 1);
  const centerX = (midi: number) =>
    isSharp(midi) ? whiteIndex(midi) * whiteWidth + whiteWidth : whiteIndex(midi) * whiteWidth + whiteWidth / 2;

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

function playReferenceTone(midi: number) {
  try {
    referenceToneContext = referenceToneContext ?? new AudioContext();
    if (referenceToneContext.state === "suspended") {
      void referenceToneContext.resume();
    }

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
    // Reference tones are an optional affordance; setup still works without Web Audio.
  }
}

function ReferenceToneButton({ midi, label }: { midi: number; label: string }) {
  return (
    <button className="range-tone-button" type="button" aria-label={`Hear ${label}`} onClick={() => playReferenceTone(midi)}>
      <Volume2 size={15} />
    </button>
  );
}
