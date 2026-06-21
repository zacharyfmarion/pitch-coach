import { describe, expect, it } from "vitest";
import { parseNoteName } from "./music";
import {
  DEFAULT_RANDOM_RUN_CONFIG,
  MAX_RANDOM_RUN_LENGTH,
  MIN_RANDOM_RUN_LENGTH,
  generateRandomRun,
  nextRandomRunSeed,
  normalizeRandomRunConfig
} from "./randomRun";

describe("random run generation", () => {
  const range = {
    lowestMidi: parseNoteName("C3"),
    highestMidi: parseNoteName("C5")
  };
  const rootMidi = parseNoteName("A3");

  it("generates deterministic runs for a seed", () => {
    const config = { length: 7, difficulty: 3 as const };

    const first = generateRandomRun(config, rootMidi, range, 4321);
    const second = generateRandomRun(config, rootMidi, range, 4321);
    const next = generateRandomRun(config, rootMidi, range, nextRandomRunSeed(4321));

    expect(first.offsets).toEqual(second.offsets);
    expect(first.patternSegments).toEqual(second.patternSegments);
    expect(next.offsets).not.toEqual(first.offsets);
  });

  it("normalizes run length and difficulty", () => {
    expect(normalizeRandomRunConfig({ length: 99, difficulty: 8 })).toEqual({
      length: MAX_RANDOM_RUN_LENGTH,
      difficulty: DEFAULT_RANDOM_RUN_CONFIG.difficulty
    });
    expect(normalizeRandomRunConfig({ length: 1, difficulty: 1 })).toEqual({
      length: MIN_RANDOM_RUN_LENGTH,
      difficulty: 1
    });
    expect(normalizeRandomRunConfig(null)).toEqual(DEFAULT_RANDOM_RUN_CONFIG);
  });

  it("returns the requested number of note segments inside the singer range", () => {
    const run = generateRandomRun({ length: 10, difficulty: 5 }, rootMidi, range, 123);

    expect(run.offsets).toHaveLength(10);
    expect(run.patternSegments).toHaveLength(10);
    expect(run.patternSegments.every((segment) => segment.kind === "note")).toBe(true);
    expect(run.offsets.every((offset) => rootMidi + offset >= range.lowestMidi)).toBe(true);
    expect(run.offsets.every((offset) => rootMidi + offset <= range.highestMidi)).toBe(true);
  });

  it("keeps level one runs stepwise", () => {
    const run = generateRandomRun({ length: 8, difficulty: 1 }, rootMidi, range, 987);
    const intervals = run.offsets.slice(1).map((offset, index) => Math.abs(offset - run.offsets[index]));

    expect(intervals.every((interval) => interval <= 2)).toBe(true);
  });

  it("degrades to reachable notes in a narrow range", () => {
    const narrowRange = {
      lowestMidi: rootMidi,
      highestMidi: rootMidi
    };
    const run = generateRandomRun({ length: 6, difficulty: 5 }, rootMidi, narrowRange, 654);

    expect(run.offsets).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
