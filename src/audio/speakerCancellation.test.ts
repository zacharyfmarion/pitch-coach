import { describe, expect, it } from "vitest";
import { AEC_DELAY_SAMPLES, loadEchoCanceller, SpeakerCancellation } from "./speakerCancellation";

describe("the actual WASM echo canceller", () => {
  it("has the delay used to align its pitch frames and frees each instance safely", async () => {
    const processor = new SpeakerCancellation(await loadEchoCanceller());
    const zero = new Float32Array(480);
    let peak = 0, maximum = 0;
    for (let block = 0; block < 80; block += 1) {
      const microphone = zero.slice();
      if (block === 50) microphone[0] = 0.1;
      const output = processor.process(microphone, zero, zero);
      for (let i = 0; i < output.length; i += 1) {
        if (Math.abs(output[i]) > maximum) { maximum = Math.abs(output[i]); peak = block * 480 + i; }
      }
    }
    expect(maximum).toBeGreaterThan(0.05);
    expect(peak - 50 * 480).toBe(AEC_DELAY_SAMPLES);
    processor.dispose();
    processor.dispose();
    expect(() => processor.process(zero, zero, zero)).toThrow(/disposed/);
  });
});
