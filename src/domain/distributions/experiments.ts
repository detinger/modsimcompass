import { uniformStream } from './preview';
import { lawFor } from './laws';
import { tQuantile } from '../sandbox/stats';

/** Seeded sampling and regression experiments for the Tools area. */

export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function sampleLetters(n: number, seed: string): string[] {
  const u = uniformStream(seed, 'letters');
  return Array.from({ length: n }, () => LETTERS[Math.floor(u() * 26)]);
}

/** Coin flips: returns the flips and the running share of heads after each flip. */
export function flipCoins(n: number, pHeads: number, seed: string): { flips: boolean[]; heads: number; running: number[] } {
  const u = uniformStream(seed, 'coins');
  const flips: boolean[] = [], running: number[] = [];
  let heads = 0;
  for (let i = 0; i < n; i++) { const h = u() < pHeads; flips.push(h); if (h) heads++; running.push(heads / (i + 1)); }
  return { flips, heads, running };
}

export interface LinearSample { x: number[]; y: number[] }
export interface OlsFit { intercept: number; slope: number; seSlope: number; seIntercept: number; r2: number; sigmaHat: number; slopeCI: [number, number] | null; n: number }

/** y = β0 + β1·x + ε, x ~ U(10, 20), ε ~ N(0, σ²). Seeded and reproducible. */
export function simulateLinear(b0: number, b1: number, sigma: number, n: number, seed: string, rep = 0): LinearSample {
  const u = uniformStream(seed, `linear|${rep}`);
  const z = lawFor('normal', [0, 1]);
  const x: number[] = [], y: number[] = [];
  for (let i = 0; i < n; i++) {
    const xi = 10 + 10 * u();
    x.push(xi);
    y.push(b0 + b1 * xi + (sigma > 0 ? sigma * z.inv(u()) : 0));
  }
  return { x, y };
}

export function ols(x: number[], y: number[]): OlsFit {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); syy += (y[i] - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - intercept - slope * x[i]) ** 2;
  const df = n - 2;
  const sigmaHat = df > 0 ? Math.sqrt(sse / df) : NaN;
  const seSlope = sigmaHat / Math.sqrt(sxx);
  const seIntercept = sigmaHat * Math.sqrt(1 / n + (mx * mx) / sxx);
  const q = df > 0 ? tQuantile(0.975, df) : NaN;
  return {
    intercept, slope, seSlope, seIntercept, n, sigmaHat,
    r2: syy > 0 ? 1 - sse / syy : 1,
    slopeCI: df > 0 && Number.isFinite(seSlope) ? [slope - q * seSlope, slope + q * seSlope] : null,
  };
}

/** Repeat the experiment to show the sampling distribution of the slope estimate. */
export function repeatedSlopes(b0: number, b1: number, sigma: number, n: number, seed: string, reps: number): number[] {
  return Array.from({ length: reps }, (_, r) => { const s = simulateLinear(b0, b1, sigma, n, seed, r + 1); return ols(s.x, s.y).slope; });
}
