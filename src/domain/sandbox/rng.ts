/**
 * Seeded pseudo-random number generation for the sandbox.
 *
 * Algorithm (RNG_VERSION 'sfc32-cyrb128-v1'):
 *  - Seed strings are hashed with cyrb128 into four 32-bit words.
 *  - Those words initialise an sfc32 generator (Small Fast Counter, 32-bit).
 *  - The first 15 outputs are discarded to diffuse weak seeds.
 *  - Replication i uses the stream seeded by `${seed}|rep|${i}`.
 *
 * Stream assumption: per-replication streams are derived by hashing distinct
 * strings. This gives reproducible, practically uncorrelated streams for teaching
 * workloads, but we do NOT claim proven mathematical independence between streams.
 *
 * Domain code must never call Math.random().
 */
export const RNG_VERSION = 'sfc32-cyrb128-v1';

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export type Uniform = () => number;

/** Returns a generator of uniform values in [0, 1). */
export function sfc32(a: number, b: number, c: number, d: number): Uniform {
  return function next() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Uniform {
  const [a, b, c, d] = cyrb128(seed);
  const rng = sfc32(a, b, c, d);
  for (let i = 0; i < 15; i++) rng();
  return rng;
}

/** Deterministic stream for one replication; independent of scheduling or chunking. */
export function replicationStream(seed: string, replicationIndex: number): Uniform {
  return createRng(`${seed}|rep|${replicationIndex}`);
}
