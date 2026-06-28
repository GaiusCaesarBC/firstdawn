export type DeterministicRandomSeed = {
  worldSeed: string;
  tick: bigint;
  systemName: string;
};

export type DeterministicRandom = {
  next: () => number;
  float: (min?: number, max?: number) => number;
  integer: (min: number, max: number) => number;
  boolean: (probability?: number) => boolean;
  pick: <T>(values: readonly T[]) => T;
};

const UINT32_RANGE = 4_294_967_296;

function hashStringToUint32(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function createDeterministicRandom({
  worldSeed,
  tick,
  systemName,
}: DeterministicRandomSeed): DeterministicRandom {
  const normalizedSeed = worldSeed.trim();

  if (!normalizedSeed) {
    throw new Error("Deterministic random requires a world seed.");
  }

  const next = createMulberry32(
    hashStringToUint32(`${normalizedSeed}:${tick.toString()}:${systemName}`),
  );

  return {
    next,
    float(min = 0, max = 1) {
      if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
        throw new Error("Invalid deterministic random float range.");
      }

      return min + next() * (max - min);
    },
    integer(min: number, max: number) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error("Invalid deterministic random integer range.");
      }

      return Math.floor(next() * (max - min + 1)) + min;
    },
    boolean(probability = 0.5) {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error("Deterministic random probability must be between 0 and 1.");
      }

      return next() < probability;
    },
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) {
        throw new Error("Cannot pick from an empty deterministic random collection.");
      }

      return values[Math.floor(next() * values.length)];
    },
  };
}
