/** Keep every possible guide-slider mix inside the measured ±0.2 probe range. */
export function speakerMixGain(accompaniment: { left: Float32Array; right: Float32Array }, vocals: { left: Float32Array; right: Float32Array }): number {
  let peak = 0;
  for (const channel of ["left", "right"] as const) {
    for (let i = 0; i < Math.max(accompaniment[channel].length, vocals[channel].length); i += 1) {
      peak = Math.max(peak, Math.abs(accompaniment[channel][i] ?? 0) * 0.95 + Math.abs(vocals[channel][i] ?? 0));
    }
  }
  return peak > 0.18 ? 0.18 / peak : 1;
}
