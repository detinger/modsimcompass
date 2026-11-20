import jStat from 'jstat';

/**
 * Probability distributions for input modelling.
 * Families, parameter conventions and validation follow the Monte Carlo Simulation Lab
 * (`src/science/distributions.js`), so a family chosen here means the same thing there.
 *
 * Each law exposes pdf (density, or probability mass for discrete laws), cdf, inverse cdf
 * (quantile) and the theoretical mean (NaN with `undefinedMean` for Cauchy).
 */
export type Kind =
  | 'constant' | 'weibull' | 'normal' | 'logistic' | 'cauchy' | 'minextreme' | 'uniform' | 'discrete'
  | 'bernoulli' | 'binomial' | 'geometric' | 'negbinomial' | 'hypergeometric' | 'categorical' | 'truncated'
  | 'lognormal' | 'triangular' | 'beta' | 'gamma' | 'exponential' | 'poisson' | 'empirical';

export interface FamilyDef { title: string; params: string[]; defaults: (number | string)[]; discrete: boolean; support: string }

export const FAMILIES: Record<Kind, FamilyDef> = {
  constant: { title: 'Constant', params: ['Fixed value'], defaults: [1], discrete: true, support: 'one value' },
  weibull: { title: 'Weibull', params: ['Shape', 'Scale'], defaults: [2, 3], discrete: false, support: 'x ≥ 0' },
  normal: { title: 'Normal', params: ['Mean', 'Standard deviation'], defaults: [0, 1], discrete: false, support: 'all real numbers' },
  logistic: { title: 'Logistic', params: ['Location', 'Scale'], defaults: [0, 1], discrete: false, support: 'all real numbers' },
  cauchy: { title: 'Cauchy', params: ['Location', 'Scale'], defaults: [0, 1], discrete: false, support: 'all real numbers' },
  minextreme: { title: 'Minimum extreme', params: ['Location', 'Scale'], defaults: [0, 1], discrete: false, support: 'all real numbers' },
  uniform: { title: 'Uniform', params: ['Minimum', 'Maximum'], defaults: [0, 1], discrete: false, support: 'min ≤ x ≤ max' },
  discrete: { title: 'Discrete uniform', params: ['Minimum integer', 'Maximum integer'], defaults: [1, 6], discrete: true, support: 'integers min…max' },
  bernoulli: { title: 'Bernoulli', params: ['Success probability'], defaults: [0.5], discrete: true, support: '0 or 1' },
  binomial: { title: 'Binomial', params: ['Trials (0–100)', 'Success probability'], defaults: [10, 0.5], discrete: true, support: '0…trials' },
  geometric: { title: 'Geometric', params: ['Success probability'], defaults: [0.3], discrete: true, support: '0, 1, 2, … (failures before first success)' },
  negbinomial: { title: 'Negative binomial', params: ['Successes needed (1–100)', 'Success probability'], defaults: [5, 0.5], discrete: true, support: '0, 1, 2, … (failures before r-th success)' },
  hypergeometric: { title: 'Hypergeometric', params: ['Population size', 'Successes in population', 'Draws'], defaults: [50, 20, 12], discrete: true, support: 'successes in the draws' },
  categorical: { title: 'Categorical', params: ['Probabilities for categories 1, 2, … (sum to 1)'], defaults: ['0.2, 0.3, 0.5'], discrete: true, support: 'categories 1, 2, …' },
  truncated: { title: 'Truncated normal', params: ['Parent mean', 'Parent standard deviation', 'Lower bound', 'Upper bound'], defaults: [0, 1, -1, 2], discrete: false, support: 'lower ≤ x ≤ upper' },
  lognormal: { title: 'Lognormal', params: ['Log-space mean', 'Log-space standard deviation'], defaults: [0, 0.5], discrete: false, support: 'x > 0' },
  triangular: { title: 'Triangular', params: ['Minimum', 'Mode', 'Maximum'], defaults: [1, 3, 8], discrete: false, support: 'min ≤ x ≤ max' },
  beta: { title: 'Beta', params: ['Shape α', 'Shape β'], defaults: [2, 5], discrete: false, support: '0 ≤ x ≤ 1' },
  gamma: { title: 'Gamma', params: ['Shape', 'Scale'], defaults: [2, 3], discrete: false, support: 'x > 0' },
  exponential: { title: 'Exponential', params: ['Rate per unit'], defaults: [1], discrete: false, support: 'x ≥ 0' },
  poisson: { title: 'Poisson', params: ['Mean count (0–100)'], defaults: [4], discrete: true, support: '0, 1, 2, …' },
  empirical: { title: 'Empirical', params: ['Equally weighted observations'], defaults: ['2, 3, 3, 5, 8'], discrete: true, support: 'the observed values' },
};

export const KINDS = Object.keys(FAMILIES) as Kind[];
export const isKind = (k: string): k is Kind => Object.prototype.hasOwnProperty.call(FAMILIES, k);

export interface Law {
  discrete: boolean;
  pdf: (x: number) => number;
  cdf: (x: number) => number;
  inv: (p: number) => number;
  mean: number;
  undefinedMean?: boolean;
}

export class DistributionError extends Error {}
function invalid(message: string): never { throw new DistributionError(message); }
const unit = (p: number) => p >= 0 && p <= 1;

function numeric(x: unknown): number {
  if (x === null || x === undefined || String(x).trim() === '' || !Number.isFinite(Number(x))) invalid('Enter a finite number in every parameter field.');
  return Number(x);
}

function discreteLaw(values: number[], masses: number[]): Law {
  const total = masses.reduce((s, x) => s + x, 0);
  let sum = 0;
  const cuts = masses.map((x) => (sum += x) / total);
  return {
    discrete: true,
    pdf: (x) => values.reduce((s, v, i) => (v === x ? s + masses[i] / total : s), 0),
    cdf: (x) => values.reduce((s, v, i) => (v <= x ? s + masses[i] / total : s), 0),
    inv: (p) => values[Math.max(0, cuts.findIndex((c) => c >= p - 1e-15))] ?? values[values.length - 1],
    mean: values.reduce((s, v, i) => s + (v * masses[i]) / total, 0),
  };
}

function searchInverse(cdf: (x: number) => number, p: number, start = 1): number {
  let low = 0, high = start;
  while (cdf(high) < p && high < 2 ** 40) high *= 2;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (cdf(mid) >= p) high = mid; else low = mid + 1;
  }
  return low;
}

export function lawFor(kind: Kind, fields: (number | string)[]): Law {
  if (!isKind(kind) || fields.length !== FAMILIES[kind].params.length) invalid('Choose a distribution and its parameters.');
  if (kind === 'categorical' || kind === 'empirical') {
    const values = String(fields[0]).split(',').map(numeric);
    if (values.length > 256) invalid('Enter up to 256 comma-separated values.');
    if (kind === 'empirical') {
      const sorted = [...values].sort((a, b) => a - b);
      return discreteLaw(sorted, sorted.map(() => 1));
    }
    if (values.some((v) => !unit(v)) || Math.abs(values.reduce((s, x) => s + x, 0) - 1) > 1e-9) invalid('Enter nonnegative category probabilities that sum to 1.');
    return discreteLaw(values.map((_, i) => i + 1), values);
  }
  const p = fields.map(numeric);
  const [a, b, c, d] = p;
  switch (kind) {
    case 'constant': return discreteLaw([a], [1]);
    case 'discrete': {
      if (![a, b].every(Number.isSafeInteger) || a > b || b - a > 9999) invalid('Use ordered integer bounds with at most 10,000 possible values.');
      return {
        discrete: true, mean: a + (b - a) / 2,
        pdf: (x) => (Number.isInteger(x) && x >= a && x <= b ? 1 / (b - a + 1) : 0),
        cdf: (x) => Math.max(0, Math.min(1, (Math.floor(x) - a + 1) / (b - a + 1))),
        inv: (q) => Math.min(b, a + Math.floor(q * (b - a + 1))),
      };
    }
    case 'bernoulli':
      if (!unit(a)) invalid('Probability must be between 0 and 1.');
      return discreteLaw([0, 1], [1 - a, a]);
    case 'binomial':
    case 'poisson': {
      const binomial = kind === 'binomial';
      if (a < 0 || a > 100 || (binomial && (!Number.isInteger(a) || !unit(b)))) invalid('Use a count parameter from 0 to 100 and a valid probability. Binomial trials must be integers.');
      if (a === 0 || (binomial && b === 0)) return discreteLaw([0], [1]);
      if (binomial && b === 1) return discreteLaw([a], [1]);
      const cdf = (x: number) => (x < 0 ? 0 : binomial ? jStat.binomial.cdf(Math.floor(x), a, b) : 1 - jStat.lowRegGamma(Math.floor(x) + 1, a));
      return {
        discrete: true, mean: binomial ? a * b : a, cdf,
        pdf: (x) => (Number.isInteger(x) && x >= 0 ? cdf(x) - cdf(x - 1) : 0),
        inv: (q) => {
          let low = 0, high = binomial ? a : Math.ceil(a + 12 * Math.sqrt(a) + 30);
          while (low < high) { const mid = Math.floor((low + high) / 2); if (cdf(mid) >= q) high = mid; else low = mid + 1; }
          return low;
        },
      };
    }
    case 'geometric':
      if (!(a > 0 && a <= 1)) invalid('Success probability must be above 0 and at most 1.');
      if (a === 1) return discreteLaw([0], [1]);
      return {
        discrete: true, mean: (1 - a) / a,
        pdf: (x) => (Number.isInteger(x) && x >= 0 ? a * Math.pow(1 - a, x) : 0),
        cdf: (x) => (x < 0 ? 0 : 1 - Math.pow(1 - a, Math.floor(x) + 1)),
        inv: (q) => Math.max(0, Math.ceil(Math.log1p(-q) / Math.log1p(-a)) - 1),
      };
    case 'negbinomial': {
      if (!Number.isInteger(a) || a < 1 || a > 100 || !(b > 0 && b <= 1)) invalid('Use 1 to 100 successes and a success probability above 0 and at most 1.');
      if (b === 1) return discreteLaw([0], [1]);
      const cdf = (x: number) => (x < 0 ? 0 : jStat.ibeta(b, a, Math.floor(x) + 1));
      return { discrete: true, mean: (a * (1 - b)) / b, cdf, pdf: (x) => (Number.isInteger(x) && x >= 0 ? cdf(x) - cdf(x - 1) : 0), inv: (q) => searchInverse(cdf, q) };
    }
    case 'hypergeometric': {
      if (![a, b, c].every(Number.isSafeInteger) || a < 1 || a > 10000 || b < 0 || b > a || c < 0 || c > a) invalid('Use whole numbers: population 1 to 10,000, with successes and draws no larger than the population.');
      const lc = (n: number, k: number) => jStat.gammaln(n + 1) - jStat.gammaln(k + 1) - jStat.gammaln(n - k + 1);
      const vals: number[] = [];
      for (let k = Math.max(0, c + b - a); k <= Math.min(c, b); k++) vals.push(k);
      return discreteLaw(vals, vals.map((k) => Math.exp(lc(b, k) + lc(a - b, c - k) - lc(a, c))));
    }
    case 'logistic':
    case 'cauchy':
    case 'minextreme':
      if (b <= 0) invalid('Scale must be positive.');
      if (kind === 'logistic') return { discrete: false, mean: a, pdf: (x) => { const e = Math.exp(-Math.abs(x - a) / b); return e / (b * (1 + e) ** 2); }, cdf: (x) => 1 / (1 + Math.exp(-(x - a) / b)), inv: (q) => a + b * Math.log(q / (1 - q)) };
      if (kind === 'cauchy') return { discrete: false, mean: NaN, undefinedMean: true, pdf: (x) => 1 / (Math.PI * b * (1 + ((x - a) / b) ** 2)), cdf: (x) => 0.5 + Math.atan((x - a) / b) / Math.PI, inv: (q) => a + b * Math.tan(Math.PI * (q - 0.5)) };
      return { discrete: false, mean: a - 0.5772156649015329 * b, pdf: (x) => { const z = (x - a) / b; return Math.exp(z - Math.exp(z)) / b; }, cdf: (x) => 1 - Math.exp(-Math.exp((x - a) / b)), inv: (q) => a + b * Math.log(-Math.log1p(-q)) };
    case 'normal':
    case 'lognormal':
      if (b <= 0) invalid('Standard deviation must be positive.');
      return wrap(kind, [a, b]);
    case 'truncated': {
      if (b <= 0) invalid('Standard deviation must be positive.');
      if (c >= d) invalid('Upper bound must exceed lower bound.');
      const N = jStat.normal;
      const lower = N.cdf(c, a, b), mass = N.cdf(d, a, b) - lower;
      if (mass < 1e-10) invalid('The selected interval is too far into the tail for this preview.');
      return {
        discrete: false, mean: a + (b * b * (N.pdf(c, a, b) - N.pdf(d, a, b))) / mass,
        pdf: (x) => (x < c || x > d ? 0 : N.pdf(x, a, b) / mass),
        cdf: (x) => Math.max(0, Math.min(1, (N.cdf(x, a, b) - lower) / mass)),
        inv: (q) => N.inv(lower + q * mass, a, b),
      };
    }
    case 'gamma':
    case 'beta':
      if (!(a > 0 && b > 0)) invalid('Both shape or scale parameters must be positive.');
      return wrap(kind, [a, b]);
    case 'weibull':
      if (a <= 0 || b <= 0) invalid('Weibull shape and scale must both be positive.');
      return wrap('weibull', [b, a]); // jStat expects (scale, shape)
    case 'exponential':
      if (a <= 0) invalid('Rate must be positive.');
      return wrap('exponential', [a]);
    case 'uniform':
      if (a >= b) invalid('Maximum must exceed minimum.');
      return wrap('uniform', [a, b]);
    case 'triangular':
      if (!(a < c && a <= b && b <= c)) invalid('Set minimum ≤ mode ≤ maximum with a positive range.');
      return wrap('triangular', [a, c, b]); // jStat expects (min, max, mode)
  }
  invalid('Unsupported distribution.');
}

function wrap(name: 'normal' | 'lognormal' | 'beta' | 'gamma' | 'exponential' | 'weibull' | 'uniform' | 'triangular', params: number[]): Law {
  const L = jStat[name];
  return { discrete: false, mean: L.mean(...params), pdf: (x) => L.pdf(x, ...params), cdf: (x) => L.cdf(x, ...params), inv: (q) => L.inv(q, ...params) };
}

/** Human-readable label, e.g. “Gamma(shape 2, scale 3)”. */
export function describeLaw(kind: Kind, fields: (number | string)[]): string {
  const f = FAMILIES[kind];
  return `${f.title}(${f.params.map((p, i) => `${p.replace(/ \(.*\)$/, '').toLowerCase()} ${fields[i]}`).join(', ')})`;
}

/** Theoretical variance by numeric integration over quantiles (adequate for display). */
export function lawSD(law: Law): number {
  if (law.undefinedMean) return NaN;
  const n = 2000;
  let s = 0;
  for (let i = 0; i < n; i++) { const x = law.inv((i + 0.5) / n); s += (x - law.mean) ** 2; }
  return Math.sqrt(s / n);
}
