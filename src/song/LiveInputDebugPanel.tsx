import { levelDb, type PitchRejection } from "../audio/inputDiagnostics";
import { Button } from "../components/ui/Button";
import { Toggle } from "../components/ui/Toggle";
import type { useLiveInputDiagnostics } from "./useLiveInputDiagnostics";

const REASONS: Record<PitchRejection, string> = {
  accepted: "Pitch detected",
  "below-level": "Below volume threshold",
  unclear: "Pitch clarity too low",
  "outside-range-or-no-pitch": "Outside range or no pitch candidate"
};

export function LiveInputDebugPanel({ debug, busy }: { debug: ReturnType<typeof useLiveInputDiagnostics>; busy: boolean }) {
  const latest = debug.frames.at(-1);
  const visible = debug.frames.filter((frame) => frame.processed.timeMs >= (latest?.processed.timeMs ?? 0) - 6000);
  const y = (rms: number) => 90 - (Math.max(-70, Math.min(0, levelDb(rms))) + 70) / 70 * 80;
  const points = (kind: "raw" | "processed") => visible.map((frame) => `${300 - ((latest?.processed.timeMs ?? 0) - frame[kind].timeMs) / 6000 * 300},${y(frame[kind].rms)}`).join(" ");
  const threshold = debug.session?.thresholds.rmsThreshold ?? 0.008;
  const count = (reason: PitchRejection) => debug.frames.filter((frame) => frame.rejection === reason).length;
  return (
    <section className="control-group" aria-label="Live input debug">
      <label className="toggle-row">
        <span>Debug microphone</span>
        <Toggle aria-label="Debug microphone" checked={debug.enabled} onChange={debug.setEnabled} disabled={busy} />
      </label>
      {debug.enabled ? <>
        <p className="history-empty">Enable before starting. Stay quiet during the speaker check and first few notes, then hold a vowel with the Guide playing. Stop and download the report.</p>
        <p className="history-empty">Only numeric levels and pitch measurements are kept locally. No audio is saved or uploaded. The microphone signal includes the speakers; its pitch is not proof of singing.</p>
        <svg viewBox="0 0 300 100" role="img" aria-label="Microphone and cancelled levels over the last six seconds" style={{ width: "100%", display: "block" }}>
          <line x1="0" x2="300" y1={y(threshold)} y2={y(threshold)} stroke="var(--text-secondary, #777)" strokeDasharray="4 4" />
          <polyline fill="none" stroke="#a18cdd" strokeWidth="2" points={points("raw")} />
          <polyline fill="none" stroke="#3b9a98" strokeWidth="2" points={points("processed")} />
        </svg>
        <p className="history-empty">Purple: microphone · Teal: after cancellation · Dashed: pitch volume threshold</p>
        <div className="song-debug-readout" aria-label="Input measurements">
          <span>Microphone</span><strong>{latest ? `${levelDb(latest.raw.rms).toFixed(1)} dBFS` : "—"}</strong>
          <span>After cancellation</span><strong>{latest ? `${levelDb(latest.processed.rms).toFixed(1)} dBFS` : "—"}</strong>
          <span>Pitch status</span><strong>{latest ? REASONS[latest.rejection] : "Start a new attempt"}</strong>
          <span>Frames captured</span><strong>{debug.frames.length}</strong>
          <span>Below volume gate</span><strong>{count("below-level")}</strong>
          <span>Low clarity</span><strong>{count("unclear")}</strong>
          <span>Speaker check</span><strong>{debug.session?.calibration ? `${debug.session.calibration.accepted ? "Passed" : "Failed"} · ${debug.session.calibration.reductionDb.toFixed(1)} dB reduction` : "—"}</strong>
        </div>
        <Button onClick={debug.download} disabled={!debug.frames.length && !debug.session}>Download input report</Button>
      </> : null}
    </section>
  );
}
