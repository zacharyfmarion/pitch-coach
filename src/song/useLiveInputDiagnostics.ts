import { useCallback, useRef, useState } from "react";
import { InputDiagnosticRecorder, type InputDiagnosticFrame, type InputDiagnosticSession } from "../audio/inputDiagnostics";
import { downloadJson } from "../storage/downloadJson";

export function useLiveInputDiagnostics() {
  const [enabled, setEnabled] = useState(false);
  const [frames, setFrames] = useState<InputDiagnosticFrame[]>([]);
  const [session, setSession] = useState<InputDiagnosticSession | null>(null);
  const recorder = useRef(new InputDiagnosticRecorder());
  const sessionRef = useRef<InputDiagnosticSession | null>(null);
  const count = useRef(0);
  const reset = useCallback(() => {
    recorder.current = new InputDiagnosticRecorder();
    sessionRef.current = null;
    count.current = 0;
    setSession(null);
    setFrames([]);
  }, []);
  const receiveSession = useCallback((value: InputDiagnosticSession) => {
    sessionRef.current = value;
    setSession(value);
  }, []);
  const receive = useCallback((frame: InputDiagnosticFrame) => {
    recorder.current.push(frame);
    if (++count.current % 5 === 0) setFrames(recorder.current.snapshot());
  }, []);
  const finish = useCallback(() => setFrames(recorder.current.snapshot()), []);
  const download = useCallback(() => {
    downloadJson(recorder.current.report(sessionRef.current), "pitch-coach-input-debug.json");
  }, []);
  return { enabled, setEnabled, frames, session, reset, receiveSession, receive, finish, download };
}
