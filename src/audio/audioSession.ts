export type BrowserAudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

type BrowserAudioSession = {
  type: BrowserAudioSessionType;
};

type NavigatorWithAudioSession = Navigator & {
  audioSession?: BrowserAudioSession;
};

export function preparePlaybackAudioSession() {
  return setBrowserAudioSessionType("playback");
}

export function preparePlayAndRecordAudioSession() {
  return setBrowserAudioSessionType("play-and-record", "auto");
}

export function setBrowserAudioSessionType(
  preferredType: BrowserAudioSessionType,
  fallbackType?: BrowserAudioSessionType
) {
  const audioSession = getBrowserAudioSession();
  if (!audioSession) {
    return false;
  }

  return (
    trySetBrowserAudioSessionType(audioSession, preferredType) ||
    (fallbackType ? trySetBrowserAudioSessionType(audioSession, fallbackType) : false)
  );
}

export async function resumeAudioContext(context: AudioContext) {
  if (context.state === "suspended") {
    await context.resume();
  }
}

function getBrowserAudioSession() {
  if (typeof navigator === "undefined") {
    return null;
  }

  return (navigator as NavigatorWithAudioSession).audioSession ?? null;
}

function trySetBrowserAudioSessionType(
  audioSession: BrowserAudioSession,
  type: BrowserAudioSessionType
) {
  try {
    audioSession.type = type;
    return audioSession.type === type;
  } catch {
    return false;
  }
}
