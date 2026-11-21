import { createRng } from '../sandbox/rng';
import type { Law } from './laws';

/**
 * Seeded draws by inverse-CDF sampling. u is mapped to the centre of a 2^-32 cell, so it is
 * never exactly 0 or 1 (avoids infinite quantiles). Same seed + label → same draws.
 */
export function uniformStream(seed: string, label: string): () => number {
  const rng = createRng(`${seed}|${label}`);
  return () => (Math.floor(rng() * 4294967296) + 0.5) / 4294967296;
}

export function drawFrom(law: Law, seed: string, label: string, n: number): number[] {
  const u = uniformStream(seed, label);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = law.inv(u());
  return out;
}

export interface PreviewRow { lo: number; hi: number; count: number; observed: number; expected: number }

/** Histogram of draws with the model probability of each bin (bins on integers for discrete laws). */
export function binDraws(law: Law, draws: number[], maxBins = 30): PreviewRow[] {
  const n = draws.length;
  const sorted = [...draws].sort((a, b) => a - b);
  const min = sorted[0], max = sorted[n - 1];
  const integer = law.discrete && draws.every(Number.isSafeInteger);
  const bins = max === min ? 1 : integer ? Math.min(maxBins, max - min + 1) : maxBins;
  const width = max === min ? 1 : integer ? Math.ceil((max - min + 1) / bins) : (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const x of draws) counts[Math.min(bins - 1, Math.floor((x - min) / width))]++;
  const below = (x: number) => law.cdf(x) - (law.discrete ? law.pdf(x) : 0);
  return counts.map((count, i) => {
    const lo = min + i * width, hi = lo + width;
    const upper = i === bins - 1 ? law.cdf(integer ? hi - 1 : hi) : below(hi);
    return { lo, hi: integer ? hi - 1 : hi, count, observed: count / n, expected: Math.max(0, upper - below(lo)) };
  });
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
