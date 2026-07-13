export function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function range(random: () => number, min: number, max: number) {
  return min + (max - min) * random();
}

export function pick<T>(random: () => number, values: T[]) {
  return values[Math.floor(random() * values.length) % values.length];
}
