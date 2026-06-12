import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Mic, RotateCcw, Settings, Target, X } from "lucide-react";
import type { AudioInputDevice } from "../../audio/types";
import type { CoachSettings, VocalRange } from "../../domain/contracts";
import { midiToNoteName } from "../../domain/music";
import {
  DEFAULT_TEMPO_OPTIONS,
  getStrictnessPresetId,
  getStrictnessToleranceCents,
  SCORING_STRICTNESS_PRESETS,
  type SettingsSectionId,
  type StrictnessPresetId
} from "../../domain/settings";
import {
  formatOctaveSpan,
  guessVoiceType,
  normalizeSetupRange,
  VOCAL_RANGE_MAX_MIDI,
  VOCAL_RANGE_MIN_MIDI,
  VOCAL_RANGE_MIN_SPAN_SEMITONES
} from "../../domain/vocalRange";
import { Dropdown, type DropdownOption } from "../Dropdown";
import {
  NoteStepper,
  RangeKeyboard,
  RangeSummary,
  VoiceTypePresetList
} from "../range/RangeControls";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { SegmentedControl } from "../ui/SegmentedControl";

type SettingsInputLevelState =
  | {
      status: "idle";
      level: 0;
    }
  | {
      status: "listening";
      level: number;
    }
  | {
      status: "error";
      level: 0;
      errorMessage: string;
    };

export type SettingsDialogProps = {
  open: boolean;
  settings: CoachSettings;
  audioInputDevices: AudioInputDevice[];
  audioInputErrorMessage: string | null;
  inputLevelState: SettingsInputLevelState;
  onClose: () => void;
  onSettingsChange: (settings: CoachSettings) => void;
  onDefaultTempoChange: (tempoBpm: number) => void;
  onRangeChange: (range: VocalRange) => void;
  onRetestRange: () => void;
  onPreferredAudioInputChange: (deviceId: string) => void;
  onRequestAudioInputPermission: () => void;
  onStartInputLevelMonitor: () => void;
  onStopInputLevelMonitor: () => void;
  onResetSettings: () => void;
};

const SETTINGS_SECTIONS = [
  { id: "voice", icon: Mic, label: "Voice", sub: "Your vocal range" },
  { id: "practice", icon: Target, label: "Practice", sub: "Tempo & strictness" },
  { id: "audio", icon: Activity, label: "Audio", sub: "Mic & input" }
] satisfies ReadonlyArray<{
  id: SettingsSectionId;
  icon: typeof Mic;
  label: string;
  sub: string;
}>;

export function SettingsDialog({
  open,
  settings,
  audioInputDevices,
  audioInputErrorMessage,
  inputLevelState,
  onClose,
  onSettingsChange,
  onDefaultTempoChange,
  onRangeChange,
  onRetestRange,
  onPreferredAudioInputChange,
  onRequestAudioInputPermission,
  onStartInputLevelMonitor,
  onStopInputLevelMonitor,
  onResetSettings
}: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("voice");

  useEffect(() => {
    if (open) {
      setActiveSection("voice");
      return;
    }

    onStopInputLevelMonitor();
  }, [onStopInputLevelMonitor, open]);

  useEffect(() => {
    if (!open || activeSection !== "audio") {
      onStopInputLevelMonitor();
      return;
    }

    onStartInputLevelMonitor();
    return onStopInputLevelMonitor;
  }, [activeSection, onStartInputLevelMonitor, onStopInputLevelMonitor, open]);

  if (!open) {
    return null;
  }

  return (
    <SettingsShell onClose={onClose}>
      <SettingsSectionNav activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className="settings-dialog__content">
        <header className="settings-dialog__header">
          <div>
            <h2 id="settings-dialog-title">{sectionTitle(activeSection)}</h2>
            <p>{sectionDescription(activeSection)}</p>
          </div>
          <IconButton variant="toolbar" size="md" title="Close settings" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </header>
        <div className="settings-dialog__body">
          {activeSection === "voice" ? (
            <VoiceSettingsSection
              settings={settings}
              onRangeChange={onRangeChange}
              onRetestRange={onRetestRange}
            />
          ) : activeSection === "practice" ? (
            <PracticeSettingsSection
              settings={settings}
              onSettingsChange={onSettingsChange}
              onDefaultTempoChange={onDefaultTempoChange}
            />
          ) : (
            <AudioSettingsSection
              settings={settings}
              devices={audioInputDevices}
              errorMessage={audioInputErrorMessage}
              inputLevelState={inputLevelState}
              onPreferredAudioInputChange={onPreferredAudioInputChange}
              onRequestAudioInputPermission={onRequestAudioInputPermission}
            />
          )}
        </div>
        <SettingsFooter onReset={onResetSettings} onDone={onClose} />
      </div>
    </SettingsShell>
  );
}

function SettingsShell({
  children,
  onClose
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="settings-dialog" role="presentation">
      <button className="settings-dialog__scrim" type="button" aria-label="Close settings" onClick={onClose} />
      <section
        className="settings-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        {children}
      </section>
    </div>
  );
}

function SettingsSectionNav({
  activeSection,
  onSectionChange
}: {
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
}) {
  return (
    <aside className="settings-dialog__nav" aria-label="Settings sections">
      <div className="settings-dialog__nav-title">
        <span aria-hidden="true">
          <Settings size={18} />
        </span>
        <strong>Settings</strong>
      </div>
      <div className="settings-dialog__nav-list">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              data-active={active || undefined}
              onClick={() => onSectionChange(section.id)}
            >
              <span aria-hidden="true">
                <Icon size={17} />
              </span>
              <span>
                <strong>{section.label}</strong>
                <small>{section.sub}</small>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function VoiceSettingsSection({
  settings,
  onRangeChange,
  onRetestRange
}: {
  settings: CoachSettings;
  onRangeChange: (range: VocalRange) => void;
  onRetestRange: () => void;
}) {
  const range = normalizeSetupRange(settings.range);

  function setRange(lowestMidi: number, highestMidi: number) {
    onRangeChange(normalizeSetupRange({ lowestMidi, highestMidi }));
  }

  return (
    <SettingsSection>
      <div className="settings-voice-summary">
        <div>
          <strong>Vocal range</strong>
          <span>Drills transpose to sit inside these notes.</span>
        </div>
        <div>
          <strong>
            {midiToNoteName(range.lowestMidi)}-{midiToNoteName(range.highestMidi)}
          </strong>
          <span>
            {formatOctaveSpan(range.lowestMidi, range.highestMidi)} oct -{" "}
            {guessVoiceType(range.lowestMidi, range.highestMidi)}
          </span>
        </div>
      </div>
      <div className="range-keyboard-shell settings-range-keyboard">
        <RangeKeyboard range={range} onRangeChange={setRange} />
      </div>
      <div className="range-stepper-row settings-range-stepper-row">
        <NoteStepper
          label="Lowest note"
          value={range.lowestMidi}
          min={VOCAL_RANGE_MIN_MIDI}
          max={range.highestMidi - VOCAL_RANGE_MIN_SPAN_SEMITONES}
          onChange={(lowestMidi) => setRange(lowestMidi, range.highestMidi)}
        />
        <NoteStepper
          label="Highest note"
          value={range.highestMidi}
          min={range.lowestMidi + VOCAL_RANGE_MIN_SPAN_SEMITONES}
          max={VOCAL_RANGE_MAX_MIDI}
          onChange={(highestMidi) => setRange(range.lowestMidi, highestMidi)}
        />
      </div>
      <VoiceTypePresetList range={range} onRangeChange={setRange} />
      <div className="settings-voice-actions">
        <RangeSummary range={range} />
        <Button variant="secondary" size="md" onClick={onRetestRange}>
          <Mic size={15} />
          <span>Re-test by singing</span>
        </Button>
      </div>
    </SettingsSection>
  );
}

function PracticeSettingsSection({
  settings,
  onSettingsChange,
  onDefaultTempoChange
}: {
  settings: CoachSettings;
  onSettingsChange: (settings: CoachSettings) => void;
  onDefaultTempoChange: (tempoBpm: number) => void;
}) {
  const strictness = getStrictnessPresetId(settings.toleranceCents);

  function setStrictness(value: StrictnessPresetId) {
    onSettingsChange({
      ...settings,
      toleranceCents: getStrictnessToleranceCents(value)
    });
  }

  return (
    <SettingsSection>
      <SettingRow label="Default guide tempo" hint="Where each drill starts - you can still nudge it live.">
        <div className="settings-tempo-control">
          <output>{settings.defaultTempoBpm} BPM</output>
          <input
            type="range"
            min="60"
            max="120"
            step="2"
            value={settings.defaultTempoBpm}
            aria-label="Default guide tempo"
            onChange={(event) => onDefaultTempoChange(Number(event.target.value))}
          />
          <div>
            {DEFAULT_TEMPO_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                data-active={settings.defaultTempoBpm === option.bpm || undefined}
                onClick={() => onDefaultTempoChange(option.bpm)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </SettingRow>
      <SettingRow
        label="Strictness"
        hint={`How close counts as in-tune - within +/-${settings.toleranceCents} cents of the target.`}
        last
      >
        <SegmentedControl
          aria-label="Strictness"
          value={strictness}
          onChange={setStrictness}
          options={SCORING_STRICTNESS_PRESETS.map((preset) => ({
            value: preset.id,
            label: preset.label
          }))}
        />
      </SettingRow>
    </SettingsSection>
  );
}

function AudioSettingsSection({
  settings,
  devices,
  errorMessage,
  inputLevelState,
  onPreferredAudioInputChange,
  onRequestAudioInputPermission
}: {
  settings: CoachSettings;
  devices: AudioInputDevice[];
  errorMessage: string | null;
  inputLevelState: SettingsInputLevelState;
  onPreferredAudioInputChange: (deviceId: string) => void;
  onRequestAudioInputPermission: () => void;
}) {
  const deviceOptions = useMemo(
    () => buildDeviceOptions(devices, settings.preferredAudioInput?.deviceId, settings.preferredAudioInput?.label),
    [devices, settings.preferredAudioInput?.deviceId, settings.preferredAudioInput?.label]
  );
  const selectedDeviceId = settings.preferredAudioInput?.deviceId ?? "";

  return (
    <SettingsSection>
      <SettingRow label="Microphone" hint="Which input we listen to.">
        <div className="settings-device-control">
          <Dropdown
            value={selectedDeviceId}
            options={deviceOptions}
            onValueChange={onPreferredAudioInputChange}
            ariaLabel="Microphone"
            triggerClassName="settings-device-dropdown"
          />
          <Button variant="ghost" size="sm" onClick={onRequestAudioInputPermission}>
            <Mic size={14} />
            <span>Refresh inputs</span>
          </Button>
        </div>
      </SettingRow>
      <SettingRow label="Input level" hint="Sing - aim for the green zone." last>
        <InputLevelMeter state={inputLevelState} />
      </SettingRow>
      {errorMessage ? (
        <p className="settings-inline-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </SettingsSection>
  );
}

function SettingsSection({ children }: { children: ReactNode }) {
  return <div className="settings-section">{children}</div>;
}

function SettingRow({
  label,
  hint,
  children,
  last = false
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className="setting-row" data-last={last || undefined}>
      <div>
        <strong>{label}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsFooter({
  onReset,
  onDone
}: {
  onReset: () => void;
  onDone: () => void;
}) {
  return (
    <footer className="settings-dialog__footer">
      <button type="button" onClick={onReset}>
        <RotateCcw size={14} />
        <span>Reset to defaults</span>
      </button>
      <Button variant="primary" size="lg" onClick={onDone}>
        Done
      </Button>
    </footer>
  );
}

function InputLevelMeter({ state }: { state: SettingsInputLevelState }) {
  const level = state.status === "listening" ? state.level : 0;
  return (
    <div className="settings-level-meter" aria-label="Input level">
      <div aria-hidden="true">
        {Array.from({ length: 26 }, (_, index) => {
          const fraction = index / 25;
          return <span key={index} data-lit={fraction <= level || undefined} data-zone={meterZone(fraction)} />;
        })}
      </div>
      <span>
        {state.status === "error"
          ? state.errorMessage
          : state.status === "listening"
            ? "Listening locally"
            : "Select Audio to check input"}
      </span>
    </div>
  );
}

function buildDeviceOptions(
  devices: AudioInputDevice[],
  preferredDeviceId: string | undefined,
  preferredLabel: string | undefined
): DropdownOption<string>[] {
  const options = devices.map((device) => ({
    value: device.deviceId,
    label: device.label
  }));

  if (preferredDeviceId && !options.some((option) => option.value === preferredDeviceId)) {
    return [
      ...options,
      {
        value: preferredDeviceId,
        label: `${preferredLabel ?? "Selected microphone"} (unavailable)`
      }
    ];
  }

  return options.length > 0
    ? options
    : [
        {
          value: "",
          label: "Default microphone"
        }
      ];
}

function meterZone(fraction: number) {
  if (fraction > 0.85) {
    return "hot";
  }

  if (fraction > 0.65) {
    return "warm";
  }

  return "good";
}

function sectionTitle(section: SettingsSectionId) {
  return SETTINGS_SECTIONS.find((candidate) => candidate.id === section)?.label ?? "Settings";
}

function sectionDescription(section: SettingsSectionId) {
  if (section === "voice") {
    return "How drills fit your voice.";
  }

  if (section === "practice") {
    return "How guided practice starts and scores.";
  }

  return "Which microphone we listen to on this device.";
}
