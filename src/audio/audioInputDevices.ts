import type { AudioInputDevice, AudioInputDeviceService } from "./types";
import { preparePlayAndRecordAudioSession } from "./audioSession";
import { createAudioInputConstraints } from "./inputConstraints";

export class BrowserAudioInputDeviceService implements AudioInputDeviceService {
  static isSupported() {
    return Boolean(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.enumerateDevices === "function" &&
        typeof navigator.mediaDevices?.getUserMedia === "function"
    );
  }

  async listDevices(): Promise<AudioInputDevice[]> {
    if (!BrowserAudioInputDeviceService.isSupported()) {
      return [createDefaultDevice()];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return normalizeAudioInputDevices(devices);
  }

  async requestPermission(): Promise<AudioInputDevice[]> {
    if (!BrowserAudioInputDeviceService.isSupported()) {
      return [createDefaultDevice()];
    }

    preparePlayAndRecordAudioSession();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: createAudioInputConstraints()
    });
    stream.getTracks().forEach((track) => track.stop());
    return this.listDevices();
  }

  subscribe(onChange: () => void) {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.addEventListener ||
      !navigator.mediaDevices?.removeEventListener
    ) {
      return () => {};
    }

    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }
}

function normalizeAudioInputDevices(devices: MediaDeviceInfo[]): AudioInputDevice[] {
  const inputDevices = devices.filter((device) => device.kind === "audioinput");
  const defaultDevice = inputDevices.find((device) => device.deviceId === "default");
  const namedDevices = inputDevices.filter(
    (device) => device.deviceId && device.deviceId !== "default"
  );

  return [
    createDefaultDevice(defaultDevice?.label),
    ...namedDevices.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${index + 1}`
    }))
  ];
}

function createDefaultDevice(label = "Default microphone"): AudioInputDevice {
  return {
    deviceId: "",
    label,
    isDefault: true
  };
}
