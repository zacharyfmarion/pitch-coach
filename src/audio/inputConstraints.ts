export function createAudioInputConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {})
  };
}
