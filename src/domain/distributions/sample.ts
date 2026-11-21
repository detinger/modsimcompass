/**
 * Plain descriptions of one sample of numbers: summary statistics, quantiles, an evenly thinned subset
 * and histogram bins. Pure functions; nothing here knows about a distribution family.
 */
export interface SampleSummary {
  n: number; mean: number;
  /** Sample standard deviation (n − 1). Zero for a single value. */
  sd: number;
  min: number; max: number;
  q05: number; q25: number; median: number; q75: number; q95: number;
}

/** Quantile of an ascending list by linear interpolation between order statistics (the common “type 7” rule). */
export function quantileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = (n - 1) * Math.min(1, Math.max(0, p)), lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

export function describeSample(values: number[]): SampleSummary | null {
  const n = values.length;
  if (n === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  let sum = 0;
  for (const x of s) sum += x;
  const mean = sum / n;
  let ss = 0;
  for (const x of s) ss += (x - mean) ** 2;
  return {
    n, mean, sd: n > 1 ? Math.sqrt(ss / (n - 1)) : 0, min: s[0], max: s[n - 1],
    q05: quantileSorted(s, 0.05), q25: quantileSorted(s, 0.25), median: quantileSorted(s, 0.5), q75: quantileSorted(s, 0.75), q95: quantileSorted(s, 0.95),
  };
}

/**
 * At most `max` values, taken at even steps through the list (first and last kept), in their original order.
 * A long file is thinned this way rather than cut off, so a trend over the file does not bias what is used.
 */
export function thinEvenly<T>(values: T[], max: number): T[] {
  const n = values.length;
  if (n <= max || max < 2) return n <= max ? values : values.slice(0, Math.max(0, max));
  const out = new Array<T>(max);
  for (let i = 0; i < max; i++) out[i] = values[Math.round((i * (n - 1)) / (max - 1))];
  return out;
}

export interface Bin { from: number; to: number; count: number }

/** A sensible number of bins for n values: about 1.5·√n, between 6 and 30. */
export const binCount = (n: number): number => Math.min(30, Math.max(6, Math.round(Math.sqrt(n) * 1.5)));

/**
 * Equal-width bins over [lo, hi]. Each bin includes its lower edge; the last also includes its upper edge.
 * Values outside the range are not counted (the caller chooses a range that holds what it wants to show).
 */
export function histogram(values: number[], lo: number, hi: number, bins: number): Bin[] {
  if (!(hi > lo) || bins < 1) return values.length ? [{ from: lo, to: lo, count: values.filter((v) => v === lo).length }] : [];
  const width = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) {
    if (v < lo || v > hi) continue;
    counts[Math.min(bins - 1, Math.floor((v - lo) / width))]++;
  }
  return counts.map((count, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count }));
}

/** Whole numbers only: one bin per integer, or wider integer bins when the range is long. */
export function integerHistogram(values: number[], maxBins = 40): Bin[] {
  if (!values.length) return [];
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const width = Math.max(1, Math.ceil((hi - lo + 1) / maxBins));
  const bins = Math.ceil((hi - lo + 1) / width);
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) counts[Math.floor((v - lo) / width)]++;
  return counts.map((count, i) => ({ from: lo + i * width, to: lo + (i + 1) * width - 1, count }));
}

export const allWholeNumbers = (values: number[]): boolean => values.length > 0 && values.every(Number.isInteger);

/** Short, locale-free number for text that is stored or exported: four significant digits, no trailing zeros. */
export function sig(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const r = Number(x.toPrecision(digits));
  return Math.abs(r) >= 1e15 || Math.abs(r) < 1e-6 ? r.toExponential(digits - 1).replace(/\.?0+e/, 'e') : String(r);
}
