import { lawFor, type Kind, type Law } from './laws';

/**
 * Maximum-likelihood fitting of candidate families to one sample (PLAN: honest evidence).
 * - Normal, lognormal, exponential, uniform, Poisson, geometric: closed-form MLE.
 * - Gamma: Newton iteration on the shape (digamma/trigamma); scale = mean / shape.
 * - Weibull: bisection on the shape's profile-likelihood equation; scale closed form.
 * - Logistic and triangular: Nelder–Mead on the log-likelihood in an unconstrained parameterisation.
 * Reports log-likelihood, AIC, BIC and the Kolmogorov–Smirnov distance D. No KS p-value is
 * reported: with estimated parameters the standard p-value is invalid.
 */
export interface FitResult {
  kind: Kind;
  params: number[];          // in laws.ts field order
  paramLabels: string[];
  k: number;                 // number of estimated parameters
  logLik: number;
  aic: number;
  bic: number;
  ksD: number | null;        // continuous families only
  method: string;
  law: Law;
  /** True for a continuous family fitted to whole numbers: its log-likelihood, AIC and BIC use P(x − ½ < X ≤ x + ½). */
  wholeNumberScore?: boolean;
}
export interface FitFailure { kind: Kind; reason: string }

export const CONTINUOUS_CANDIDATES: Kind[] = ['normal', 'lognormal', 'exponential', 'gamma', 'weibull', 'logistic', 'uniform', 'triangular'];
export const COUNT_CANDIDATES: Kind[] = ['poisson', 'geometric'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function digamma(x: number): number {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}
export function trigamma(x: number): number {
  let r = 0;
  while (x < 6) { r += 1 / (x * x); x += 1; }
  const f = 1 / (x * x);
  return r + 1 / x + f / 2 + (f / x) * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f / 30)));
}

export function logLikelihood(law: Law, xs: number[]): number {
  let s = 0;
  for (const x of xs) {
    const p = law.pdf(x);
    if (!(p > 0) || !Number.isFinite(p)) return -Infinity;
    s += Math.log(p);
  }
  return s;
}

/** Nelder–Mead minimiser (small, deterministic). */
export function nelderMead(f: (v: number[]) => number, start: number[], step = 0.5, iters = 800): number[] {
  const n = start.length;
  let simplex = [start, ...start.map((_, i) => start.map((v, j) => (i === j ? v + step : v)))];
  let vals = simplex.map(f);
  for (let it = 0; it < iters; it++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map((i) => simplex[i]); vals = order.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < 1e-12 * (1 + Math.abs(vals[0]))) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const at = (t: number) => c.map((cj, j) => cj + t * (simplex[n][j] - cj));
    const r = at(-1), fr = f(r);
    if (fr < vals[0]) {
      const e = at(-2), fe = f(e);
      if (fe < fr) { simplex[n] = e; vals[n] = fe; } else { simplex[n] = r; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { simplex[n] = r; vals[n] = fr; }
    else {
      const k = at(fr < vals[n] ? -0.5 : 0.5), fk = f(k);
      if (fk < Math.min(fr, vals[n])) { simplex[n] = k; vals[n] = fk; }
      else {
        for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); }
      }
    }
  }
  const best = vals.indexOf(Math.min(...vals));
  return simplex[best];
}

function ksDistance(law: Law, xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const F = law.cdf(s[i]);
    d = Math.max(d, Math.abs(F - i / n), Math.abs((i + 1) / n - F));
  }
  return d;
}

const LABELS: Partial<Record<Kind, string[]>> = {
  normal: ['μ (mean)', 'σ (sd)'], lognormal: ['μ (log-mean)', 'σ (log-sd)'], exponential: ['λ (rate)'], gamma: ['shape k', 'scale θ'],
  weibull: ['shape k', 'scale λ'], logistic: ['location μ', 'scale s'], uniform: ['min a', 'max b'], triangular: ['min a', 'mode c', 'max b'],
  poisson: ['λ (mean count)'], geometric: ['p (success probability)'],
};

function estimate(kind: Kind, xs: number[]): { params: number[]; method: string } {
  const n = xs.length, m = mean(xs);
  const min = Math.min(...xs), max = Math.max(...xs);
  switch (kind) {
    case 'normal': {
      const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / n);
      if (!(sd > 0)) throw new Error('All values are equal; the spread cannot be estimated.');
      return { params: [m, sd], method: 'Closed-form MLE (σ uses n, not n − 1)' };
    }
    case 'lognormal': {
      if (min <= 0) throw new Error('Needs strictly positive values.');
      const l = xs.map(Math.log), lm = mean(l), ls = Math.sqrt(l.reduce((s, x) => s + (x - lm) ** 2, 0) / n);
      if (!(ls > 0)) throw new Error('All values are equal.');
      return { params: [lm, ls], method: 'Closed-form MLE on log values' };
    }
    case 'exponential':
      if (min < 0) throw new Error('Needs nonnegative values.');
      if (!(m > 0)) throw new Error('Mean must be positive.');
      return { params: [1 / m], method: 'Closed-form MLE (λ = 1 / mean)' };
    case 'gamma': {
      if (min <= 0) throw new Error('Needs strictly positive values.');
      const s = Math.log(m) - mean(xs.map(Math.log));
      if (!(s > 0)) throw new Error('All values are equal.');
      let k = (3 - s + Math.sqrt((s - 3) ** 2 + 24 * s)) / (12 * s);
      for (let i = 0; i < 100; i++) {
        const step = (Math.log(k) - digamma(k) - s) / (1 / k - trigamma(k));
        k = Math.max(k - step, k / 10);
        if (Math.abs(step) < 1e-12 * k) break;
      }
      return { params: [k, m / k], method: 'MLE: Newton iteration on shape, scale = mean / shape' };
    }
    case 'weibull': {
      if (min <= 0) throw new Error('Needs strictly positive values.');
      const lx = xs.map(Math.log), mlx = mean(lx);
      const g = (k: number) => {
        let a = 0, b = 0;
        for (let i = 0; i < n; i++) { const p = Math.pow(xs[i] / max, k); a += p * lx[i]; b += p; }
        return a / b - 1 / k - mlx;
      };
      let lo = 0.02, hi = 200;
      if (g(lo) * g(hi) > 0) throw new Error('Shape equation has no root in range.');
      for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid; if (hi - lo < 1e-12) break; }
      const k = (lo + hi) / 2;
      const lam = max * Math.pow(mean(xs.map((x) => Math.pow(x / max, k))), 1 / k);
      return { params: [k, lam], method: 'MLE: bisection on the shape equation, scale closed form' };
    }
    case 'logistic': {
      const sd0 = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / n);
      if (!(sd0 > 0)) throw new Error('All values are equal.');
      const negLL = ([mu, ls]: number[]) => -logLikelihood(lawFor('logistic', [mu, Math.exp(ls)]), xs);
      const [mu, ls] = nelderMead(negLL, [m, Math.log((sd0 * Math.sqrt(3)) / Math.PI)], 0.3);
      return { params: [mu, Math.exp(ls)], method: 'MLE: Nelder–Mead on (μ, log s)' };
    }
    case 'uniform':
      if (!(max > min)) throw new Error('All values are equal.');
      return { params: [min, max], method: 'Closed-form MLE (sample minimum and maximum)' };
    case 'triangular': {
      const r = max - min;
      if (!(r > 0)) throw new Error('All values are equal.');
      const sig = (t: number) => 1 / (1 + Math.exp(-t));
      const decode = ([u1, u2, u3]: number[]) => { const a = min - r * Math.exp(u1), b = max + r * Math.exp(u2); return [a, a + (b - a) * sig(u3), b]; };
      const negLL = (v: number[]) => { const [a, c, b] = decode(v); const ll = logLikelihood(lawFor('triangular', [a, c, b]), xs); return Number.isFinite(ll) ? -ll : 1e300; };
      const mode0 = Math.min(0.98, Math.max(0.02, (3 * m - 2 * min - max + r * 0.02) / (r * 1.04)));
      const v = nelderMead(negLL, [Math.log(0.02), Math.log(0.02), Math.log(mode0 / (1 - mode0))], 0.5, 1500);
      return { params: decode(v), method: 'MLE: Nelder–Mead with bounds outside the data' };
    }
    case 'poisson':
      if (!xs.every((x) => Number.isInteger(x) && x >= 0)) throw new Error('Needs nonnegative whole numbers.');
      if (m > 100) throw new Error('Mean count above 100 is outside the supported range.');
      return { params: [m], method: 'Closed-form MLE (λ = mean)' };
    case 'geometric':
      if (!xs.every((x) => Number.isInteger(x) && x >= 0)) throw new Error('Needs nonnegative whole numbers.');
      return { params: [1 / (1 + m)], method: 'Closed-form MLE (p = 1 / (1 + mean))' };
    default:
      throw new Error('Not a fitting candidate.');
  }
}

/** Fields in laws.ts order (triangular is min, mode, max). */
export function fitFamily(kind: Kind, xs: number[]): FitResult | FitFailure {
  try {
    if (xs.length < 3) return { kind, reason: 'Needs at least 3 values.' };
    const { params, method } = estimate(kind, xs);
    const law = lawFor(kind, params);
    const ll = logLikelihood(law, xs);
    if (!Number.isFinite(ll)) return { kind, reason: 'Some values have zero probability under the fitted law.' };
    const k = params.length, n = xs.length;
    return {
      kind, params, paramLabels: LABELS[kind] ?? [], k, logLik: ll, aic: 2 * k - 2 * ll, bic: k * Math.log(n) - 2 * ll,
      ksD: law.discrete ? null : ksDistance(law, xs), method, law,
    };
  } catch (e) {
    return { kind, reason: e instanceof Error ? e.message : String(e) };
  }
}

export const isFit = (r: FitResult | FitFailure): r is FitResult => 'law' in r;

/** Smallest probability counted for one value, so that a value the curve all but rules out costs a lot but not infinitely much. */
export const WHOLE_NUMBER_FLOOR = 1e-12;

/**
 * Log-likelihood of whole numbers under a continuous law, each value x scored as P(x − ½ < X ≤ x + ½) = F(x + ½) − F(x − ½).
 * These are probabilities, like those of the Poisson and the geometric, so the AICs of both kinds can be compared.
 */
export function wholeNumberLogLikelihood(law: Law, xs: number[]): number {
  let s = 0;
  for (const x of xs) {
    const p = law.cdf(x + 0.5) - law.cdf(x - 0.5);
    s += Math.log(Number.isFinite(p) ? Math.max(WHOLE_NUMBER_FLOOR, p) : WHOLE_NUMBER_FLOOR);
  }
  return s;
}

/** A continuous fit rescored on whole numbers: the same parameters, its log-likelihood, AIC and BIC from probabilities. */
function onWholeNumbers(f: FitResult, xs: number[]): FitResult {
  const ll = wholeNumberLogLikelihood(f.law, xs);
  return { ...f, logLik: ll, aic: 2 * f.k - 2 * ll, bic: f.k * Math.log(xs.length) - 2 * ll, method: `${f.method}; scored on whole numbers`, wholeNumberScore: true };
}

/**
 * Every candidate, ranked by AIC. For count data (whole numbers of at least zero) the count families join the candidates,
 * and the continuous families are scored on whole numbers too: a density is not a probability, so its AIC could not
 * otherwise be compared with theirs. Data that are not count data are scored exactly as before.
 */
export function fitAll(xs: number[]): { fits: FitResult[]; failures: FitFailure[]; countData: boolean } {
  const countData = xs.length > 0 && xs.every((x) => Number.isInteger(x) && x >= 0);
  const candidates = countData ? [...COUNT_CANDIDATES, ...CONTINUOUS_CANDIDATES] : CONTINUOUS_CANDIDATES;
  const results = candidates.map((k) => fitFamily(k, xs)).map((r) => (countData && isFit(r) && !r.law.discrete ? onWholeNumbers(r, xs) : r));
  const fits = results.filter(isFit).sort((a, b) => a.aic - b.aic);
  return { fits, failures: results.filter((r): r is FitFailure => !isFit(r)), countData };
}

/** Common rule-of-thumb wording for ΔAIC; descriptive, not a test. */
export function deltaAicLabel(d: number): string {
  if (d < 1e-9) return 'Lowest AIC';
  if (d <= 2) return 'Similar support';
  if (d <= 7) return 'Less support';
  if (d <= 10) return 'Much less support';
  return 'Essentially no support';
}

/** Empirical CDF points and Q–Q pairs for diagnostics. */
export function qqPairs(law: Law, xs: number[]): { theoretical: number; sample: number }[] {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return s.map((x, i) => ({ theoretical: law.inv((i + 0.5) / n), sample: x }));
}

/** Akaike weights: relative support among these candidates only. They add up to 1. */
export function akaikeWeights(fits: { aic: number }[]): number[] {
  if (!fits.length) return [];
  const best = Math.min(...fits.map((f) => f.aic));
  const w = fits.map((f) => Math.exp(-(f.aic - best) / 2));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

/** The most pieces of pasted text that are read. Anything beyond is counted in `truncated`, never dropped unseen. */
export const PASTE_MAX_VALUES = 100_000;

/**
 * Numbers separated by spaces, new lines, semicolons or commas. A comma between two digits is ambiguous
 * (“1,5” may be one and a half, or 1 and 5): when the text has no other use for commas they are read as
 * decimal commas; otherwise they separate values, and every piece with such a comma is reported in `decimalCommas`.
 * Pieces that are not finite numbers are listed in `rejected` (hexadecimal and similar spellings included).
 */
export function parseData(text: string): { values: number[]; rejected: string[]; decimalCommas: string[]; commaIsDecimal: boolean; truncated: number } {
  const tight = text.match(/\d,(?=\d)/g)?.length ?? 0;            // commas squeezed between digits
  const loose = (text.match(/,/g)?.length ?? 0) - tight;            // commas used as separators (followed by a space, etc.)
  const asDecimal = text.replace(/(\d),(?=\d)/g, '$1.').split(/[\s;]+/).filter(Boolean);
  // Decimal commas need another separator in the text, and no piece may end up with two decimal points (“1,2,3”).
  const commaIsDecimal = tight > 0 && loose === 0 && /[\s;]/.test(text.trim()) && asDecimal.every((t) => (t.match(/\./g)?.length ?? 0) <= 1);
  // Whenever a comma sits between two digits and was not read as a decimal comma, say which pieces were split.
  const decimalCommas = commaIsDecimal || tight === 0 ? [] : text.split(/[\s;]+/).filter((t) => /\d,\d/.test(t)).map((t) => t.replace(/^,+|,+$/g, '')).slice(0, 5);
  const parts = commaIsDecimal ? asDecimal : text.split(/[\s,;]+/).filter(Boolean);
  const values: number[] = [], rejected: string[] = [];
  for (const p of parts.slice(0, PASTE_MAX_VALUES)) {
    const v = /^[-+\u2212]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(p) ? Number(p.replace(/^\u2212/, '-')) : NaN;
    if (Number.isFinite(v)) values.push(v); else rejected.push(p);
  }
  return { values, rejected, decimalCommas, commaIsDecimal, truncated: Math.max(0, parts.length - PASTE_MAX_VALUES) };
}
