import {
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  Check,
  Mic,
  Play,
  Settings,
  Target,
  X
} from "lucide-react";
import type { VocalRange, VocalRangeSetupSource } from "../../domain/contracts";
import { midiToNoteName } from "../../domain/music";
import {
  formatOctaveSpan,
  guessVoiceType,
  normalizeSetupRange,
  VOCAL_RANGE_MAX_MIDI,
  VOCAL_RANGE_MIN_MIDI,
  VOCAL_RANGE_MIN_SPAN_SEMITONES
} from "../../domain/vocalRange";
import type { RangeCaptureState, RangeCaptureTarget } from "../../app/usePitchCoachController";
import {
  NoteStepper,
  RangeKeyboard,
  RangeSummary,
  VoiceTypePresetList
} from "./RangeControls";

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
