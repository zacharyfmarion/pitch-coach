import type {
  ExercisePatternSegment,
  GeneratedRandomRun,
  RandomRunConfig,
  RandomRunDifficulty,
  VocalRange
} from "./contracts";

export const RANDOM_RUN_EXERCISE_ID = "random-run-playback";
export const MIN_RANDOM_RUN_LENGTH = 3;
export const MAX_RANDOM_RUN_LENGTH = 12;
export const DEFAULT_RANDOM_RUN_CONFIG: RandomRunConfig = {
  length: 5,
  difficulty: 2
};

type DifficultyProfile = {
  offsets: readonly number[];
  maxJumpSemitones: number;
};

const DIFFICULTY_PROFILES: Record<RandomRunDifficulty, DifficultyProfile> = {
  1: {
    offsets: [-5, -4, -2, 0, 2, 4, 5],
    maxJumpSemitones: 2
  },
  2: {
    offsets: [-7, -5, -4, -2, 0, 2, 4, 5, 7],
    maxJumpSemitones: 4
  },
  3: {
    offsets: [-9, -7, -5, -4, -2, 0, 2, 4, 5, 7, 9, 11, 12],
    maxJumpSemitones: 5
  },
  4: {
    offsets: [-12, -10, -9, -7, -5, -4, -2, 0, 2, 3, 4, 5, 7, 8, 9, 11, 12],
    maxJumpSemitones: 7
  },
  5: {
    offsets: [-14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    maxJumpSemitones: 12
  }
};

export function normalizeRandomRunConfig(value: unknown): RandomRunConfig {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_RANDOM_RUN_CONFIG;
  }

  const config = value as Partial<RandomRunConfig>;
  return {
    length: normalizeRunLength(config.length),
    difficulty: normalizeDifficulty(config.difficulty)
  };
}

export function generateRandomRun(
  value: RandomRunConfig,
  rootMidi: number,
  range: VocalRange,
  seed: number
): GeneratedRandomRun {
  const config = normalizeRandomRunConfig(value);
  const normalizedSeed = normalizeSeed(seed);
  const profile = DIFFICULTY_PROFILES[config.difficulty];
  const candidates = getRangeSafeOffsets(profile.offsets, rootMidi, range);
  const random = createSeededRandom(normalizedSeed);
  const offsets = createOffsetSequence(config.length, profile, candidates, random);

  return {
    seed: normalizedSeed,
    config,
    offsets,
    patternSegments: offsets.map(createPatternSegment)
  };
}

export function createRandomRunSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function nextRandomRunSeed(seed: number) {
  return (normalizeSeed(seed) + 1) % 0x7fffffff;
}

function createOffsetSequence(
  length: number,
  profile: DifficultyProfile,
  candidates: number[],
  random: () => number
) {
  const offsets = [candidates.includes(0) ? 0 : findClosestToRoot(candidates)];

  while (offsets.length < length) {
    const current = offsets.at(-1) ?? 0;
    const nearbyCandidates = candidates.filter(
      (candidate) =>
        Math.abs(candidate - current) <= profile.maxJumpSemitones &&
        (candidates.length === 1 || candidate !== current)
    );
    const pool = nearbyCandidates.length > 0 ? nearbyCandidates : candidates;
    offsets.push(pool[Math.floor(random() * pool.length)] ?? offsets[0]);
  }

  return offsets;
}

function getRangeSafeOffsets(
  offsets: readonly number[],
  rootMidi: number,
  range: VocalRange
) {
  const candidates = offsets
    .filter((offset) => rootMidi + offset >= range.lowestMidi && rootMidi + offset <= range.highestMidi)
    .sort((a, b) => a - b);

  if (candidates.length > 0) {
    return candidates;
  }

  return [0];
}

function createPatternSegment(offsetSemitones: number, index: number): ExercisePatternSegment {
  return {
    kind: "note",
    id: `random-run-${index + 1}`,
    label: offsetSemitones === 0 && index === 0 ? "Root" : `Run note ${index + 1}`,
    shortLabel: `${index + 1}`,
    offsetSemitones
  };
}

function normalizeRunLength(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_RANDOM_RUN_CONFIG.length;
  }

  return Math.min(
    Math.max(Math.round(numericValue), MIN_RANDOM_RUN_LENGTH),
    MAX_RANDOM_RUN_LENGTH
  );
}

function normalizeDifficulty(value: unknown): RandomRunDifficulty {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (numericValue === 1 || numericValue === 2 || numericValue === 3 || numericValue === 4 || numericValue === 5) {
    return numericValue;
  }

  return DEFAULT_RANDOM_RUN_CONFIG.difficulty;
}

function normalizeSeed(seed: number) {
  if (!Number.isFinite(seed)) {
    return 1;
  }

  return Math.abs(Math.trunc(seed)) % 0x7fffffff;
}

function findClosestToRoot(offsets: number[]) {
  return offsets.reduce((closest, offset) =>
    Math.abs(offset) < Math.abs(closest) ? offset : closest
  );
}

function createSeededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
