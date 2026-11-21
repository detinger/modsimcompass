/**
 * Replication-level output statistics (PLAN §6.4). Each value passed in is one
 * replication summary (a complete trajectory), never a daily observation.
 */

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation (n − 1). NaN for n < 2. */
export function sampleSD(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return Math.sqrt(ss / (n - 1));
}

/**
 * Empirical quantile, type 7 (the R and NumPy default):
 * h = (n − 1)p, interpolate between order statistics floor(h) and ceil(h).
 */
export function quantile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

// ── Student t distribution ───────────────────────────────────────────────

function logGamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the regularised incomplete beta (Numerical Recipes betacf). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** CDF of Student t with df degrees of freedom. */
export function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * regIncBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Quantile of Student t (bisection on the CDF; tested against reference tables). */
export function tQuantile(p: number, df: number): number {
  if (!(p > 0 && p < 1) || !(df > 0)) return NaN;
  if (p === 0.5) return 0;
  let lo = -1e3, hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCDF(mid, df) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

export interface MeanInterval {
  n: number;
  mean: number;
  sd: number | null;
  halfWidth: number | null;
  lower: number | null;
  upper: number | null;
  /** Explanation shown instead of an interval when unavailable. */
  unavailableReason: string | null;
}

/**
 * Approximate 95% t interval for a population mean from replicate-level values.
 * Assumes approximately independent, identically distributed replications and
 * approximate normality of the sample mean; coverage may be poor for small or skewed samples.
 */
export function tInterval(xs: number[], level = 0.95): MeanInterval {
  const n = xs.length;
  const m = mean(xs);
  if (n < 2) {
    return { n, mean: m, sd: null, halfWidth: null, lower: null, upper: null,
      unavailableReason: n === 1 ? 'Interval unavailable: one replication.' : 'Interval unavailable: no replications.' };
  }
  const sd = sampleSD(xs);
  const q = tQuantile(1 - (1 - level) / 2, n - 1);
  const hw = (q * sd) / Math.sqrt(n);
  return { n, mean: m, sd, halfWidth: hw, lower: m - hw, upper: m + hw, unavailableReason: null };
}

/** Alternative − baseline, per replication pair. Arrays must be aligned by replication. */
export function pairedDifferences(baseline: number[], alternative: number[]): number[] {
  const n = Math.min(baseline.length, alternative.length);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = alternative[i] - baseline[i];
  return out;
}

export interface OutcomeSummary {
  n: number;
  mean: number;
  p05: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  ci: MeanInterval;
}

export function summarise(xs: number[]): OutcomeSummary {
  return {
    n: xs.length,
    mean: mean(xs),
    p05: quantile(xs, 0.05),
    p50: quantile(xs, 0.5),
    p95: quantile(xs, 0.95),
    min: xs.length ? Math.min(...xs) : NaN,
    max: xs.length ? Math.max(...xs) : NaN,
    ci: tInterval(xs),
  };
}

/** Equal-width histogram bins, closed on the left, last bin closed on both ends. */
export function histogram(xs: number[], binCount = 12): { from: number; to: number; count: number }[] {
  if (xs.length === 0) return [];
  const min = Math.min(...xs), max = Math.max(...xs);
  if (min === max) return [{ from: min, to: max, count: xs.length }];
  const w = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ from: min + i * w, to: min + (i + 1) * w, count: 0 }));
  for (const x of xs) {
    const i = Math.min(binCount - 1, Math.floor((x - min) / w));
    bins[i].count++;
  }
  return bins;
}

// ── Two independent samples ──────────────────────────────────────────────

export interface DifferenceInterval {
  /** Replications of the baseline and of the alternative. */
  n1: number;
  n2: number;
  /** Mean of the alternative minus mean of the baseline. NaN when a sample is empty. */
  mean: number;
  /** Standard error of the difference of means. */
  se: number | null;
  /** Welch–Satterthwaite degrees of freedom (usually not a whole number). */
  df: number | null;
  halfWidth: number | null;
  lower: number | null;
  upper: number | null;
  /** Explanation shown instead of an interval when unavailable. */
  unavailableReason: string | null;
}

/**
 * Approximate 95% two-sample (Welch) interval for the difference of two means, alternative − baseline.
 * For samples that are NOT paired: the two variances are not pooled, and the degrees of freedom follow
 * Welch–Satterthwaite. Needs at least two replications of each policy.
 */
export function welchInterval(baseline: number[], alternative: number[], level = 0.95): DifferenceInterval {
  const n1 = baseline.length, n2 = alternative.length;
  const m = mean(alternative) - mean(baseline);
  if (n1 < 2 || n2 < 2) {
    const reason = n1 === 0 || n2 === 0 ? 'Interval unavailable: a policy has no replications.' : 'Interval unavailable: a policy has one replication.';
    return { n1, n2, mean: m, se: null, df: null, halfWidth: null, lower: null, upper: null, unavailableReason: reason };
  }
  const v1 = sampleSD(baseline) ** 2 / n1, v2 = sampleSD(alternative) ** 2 / n2;
  const se = Math.sqrt(v1 + v2);
  // No spread at all in either sample: the interval collapses to the difference itself.
  if (se === 0) return { n1, n2, mean: m, se: 0, df: n1 + n2 - 2, halfWidth: 0, lower: m, upper: m, unavailableReason: null };
  const df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));
  const hw = tQuantile(1 - (1 - level) / 2, df) * se;
  return { n1, n2, mean: m, se, df, halfWidth: hw, lower: m - hw, upper: m + hw, unavailableReason: null };
}

/** Above this the search stops: the answer is “far more than is practical”. */
export const REPLICATIONS_CAP = 1_000_000;

/** Smallest whole n in [2, cap] for which `wide(n)` is false; `wide` must be true below some n and false from there on. */
function smallestEnough(wide: (n: number) => boolean): number {
  if (!wide(2)) return 2;
  let lo = 2, hi = 4; // wide(lo) is true throughout
  while (hi < REPLICATIONS_CAP && wide(hi)) { lo = hi; hi *= 2; }
  if (hi >= REPLICATIONS_CAP) { hi = REPLICATIONS_CAP; if (wide(hi)) return REPLICATIONS_CAP; }
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (wide(mid)) lo = mid; else hi = mid; }
  return hi;
}

/**
 * Smallest number of replications n (at least 2) for which the t interval of a mean has a half-width of at most
 * `halfWidth`, assuming the standard deviation stays at `sd`:  t(n − 1) · sd / √n ≤ halfWidth.
 * For paired data, `sd` is the standard deviation of the paired differences and n counts pairs.
 * An estimate only: `sd` is itself estimated from the runs so far. Null when the inputs make no sense.
 * Never more than `REPLICATIONS_CAP`.
 */
export function replicationsNeeded(sd: number, halfWidth: number, level = 0.95): number | null {
  if (!Number.isFinite(sd) || !Number.isFinite(halfWidth) || sd < 0 || halfWidth <= 0) return null;
  if (sd === 0) return 2;
  const p = 1 - (1 - level) / 2;
  return smallestEnough((n) => (tQuantile(p, n - 1) * sd) / Math.sqrt(n) > halfWidth);
}

/**
 * The same for two samples that are not paired, with n replications of each policy:
 * t(df) · √((sd1² + sd2²) / n) ≤ halfWidth, with Welch–Satterthwaite degrees of freedom for equal sample sizes.
 */
export function replicationsNeededTwoSample(sd1: number, sd2: number, halfWidth: number, level = 0.95): number | null {
  if (![sd1, sd2, halfWidth].every(Number.isFinite) || sd1 < 0 || sd2 < 0 || halfWidth <= 0) return null;
  const s2 = sd1 ** 2 + sd2 ** 2;
  if (s2 === 0) return 2;
  const p = 1 - (1 - level) / 2;
  const dfPer = s2 ** 2 / (sd1 ** 4 + sd2 ** 4); // the degrees of freedom are (n − 1) times this
  return smallestEnough((n) => tQuantile(p, (n - 1) * dfPer) * Math.sqrt(s2 / n) > halfWidth);
}
