import jStat from 'jstat';
import type { DataModel } from '../artefacts/types';
import { akaikeWeights, fitAll, type FitFailure, type FitResult } from './fitting';
import { FAMILIES, lawFor, lawSD, type Kind, type Law } from './laws';
import { drawFrom } from './preview';
import { describeSample, thinEvenly, type SampleSummary } from './sample';

/**
 * The steps of the Data and inputs tool as pure functions: from a sample of numbers to ranked fits, from a chosen
 * fit to what a data model stores, and from a data model to seeded synthetic data. The page, the card, the report
 * and the exports all read the model through these, so they cannot disagree.
 */

/** Fits use at most this many values; a longer sample is thinned evenly (first and last kept), never cut off. */
export const FIT_MAX_VALUES = 5000;
/** A data model keeps at most this many raw values (the artefact limit for number lists). */
export const KEEP_MAX_VALUES = 10_000;
/** Largest synthetic sample. */
export const GENERATE_MAX = 100_000;

export interface PreparedSample {
  /** Every value, in the order given. */
  values: number[];
  summary: SampleSummary;
  /** The values the fits used: all of them, or an even thinning when there are more than `FIT_MAX_VALUES`. */
  fitted: number[];
  /** Ranked by AIC, lowest first. */
  fits: FitResult[];
  failures: FitFailure[];
  /** True when every value is a whole number of at least zero; count families are then fitted too. */
  countData: boolean;
  /** Akaike weights of `fits`, in the same order. */
  weights: number[];
}

/** Summary and ranked fits of a sample. Null for an empty sample. Fewer than three values: summary only, no fits. */
export function prepareSample(values: number[]): PreparedSample | null {
  const summary = describeSample(values);
  if (!summary) return null;
  const fitted = thinEvenly(values, FIT_MAX_VALUES);
  const { fits, failures, countData } = values.length >= 3 ? fitAll(fitted) : { fits: [], failures: [], countData: false };
  return { values, summary, fitted, fits, failures, countData, weights: akaikeWeights(fits) };
}

/** What a data model stores about its data: n, mean, standard deviation, minimum and maximum. */
export const summaryRecord = (s: SampleSummary): NonNullable<DataModel['summary']> => ({ n: s.n, mean: s.mean, sd: s.sd, min: s.min, max: s.max });

/** Parameters as stored: four significant digits. Finer than the estimates are sure, short enough to read. */
export const roundParams = (params: number[]): number[] => params.map((p) => Number(p.toPrecision(4)));

/** The fit record of a data model when `kind` is taken from `fits`: its rank, every candidate's AIC, and its KS distance. */
export function fitRecord(fits: FitResult[], kind: Kind): DataModel['fit'] {
  const i = fits.findIndex((f) => f.kind === kind);
  if (i < 0) return null;
  return { rank: i + 1, candidates: fits.slice(0, 50).map((f) => ({ family: f.kind, aic: Number(f.aic.toPrecision(8)) })), ksD: fits[i].ksD === null ? null : Number(fits[i].ksD!.toPrecision(4)) };
}

/** Writes a chosen fit into a data model draft. */
export function applyFit(d: DataModel, sample: PreparedSample, fit: FitResult): void {
  d.family = fit.kind;
  d.params = roundParams(fit.params);
  d.origin = 'fitted';
  d.fit = fitRecord(sample.fits, fit.kind);
  d.summary = summaryRecord(sample.summary);
}

/** The parameter fields `lawFor` expects. List families take their values as one comma-separated field. */
const fieldsOf = (d: Pick<DataModel, 'family' | 'params'>): (number | string)[] =>
  (d.family === 'categorical' || d.family === 'empirical' ? [d.params.join(', ')] : [...d.params]);

/** The distribution of a data model, or null when its parameters are not valid for its family. */
export function modelLaw(d: Pick<DataModel, 'family' | 'params'>): Law | null {
  try { return lawFor(d.family, fieldsOf(d)); } catch { return null; }
}

/** Why the parameters are not valid, or null when they are. */
export function modelError(d: Pick<DataModel, 'family' | 'params'>): string | null {
  try { lawFor(d.family, fieldsOf(d)); return null; } catch (e) { return e instanceof Error ? e.message : String(e); }
}

/** Exact variance where the family has a closed form; null where it has none here (the caller integrates instead). */
export function exactVariance(family: Kind, p: number[]): number | null {
  const [a, b, c] = p;
  switch (family) {
    case 'constant': return 0;
    case 'normal': return b * b;
    case 'lognormal': return (Math.exp(b * b) - 1) * Math.exp(2 * a + b * b);
    case 'exponential': return 1 / (a * a);
    case 'gamma': return a * b * b;
    case 'weibull': { const g1 = jStat.gammafn(1 + 1 / a), g2 = jStat.gammafn(1 + 2 / a); return b * b * (g2 - g1 * g1); }
    case 'uniform': return ((b - a) ** 2) / 12;
    case 'triangular': return (a * a + b * b + c * c - a * b - a * c - b * c) / 18; // min, mode, max
    case 'beta': return (a * b) / ((a + b) ** 2 * (a + b + 1));
    case 'logistic': return (b * b * Math.PI * Math.PI) / 3;
    case 'minextreme': return (Math.PI * Math.PI * b * b) / 6;
    case 'discrete': return ((b - a + 1) ** 2 - 1) / 12;
    case 'bernoulli': return a * (1 - a);
    case 'binomial': return a * b * (1 - b);
    case 'poisson': return a;
    case 'geometric': return (1 - a) / (a * a);
    case 'negbinomial': return (a * (1 - b)) / (b * b);
    case 'hypergeometric': return a > 1 ? (c * (b / a) * (1 - b / a) * (a - c)) / (a - 1) : 0;
    case 'categorical': { const m = p.reduce((s, q, i) => s + q * (i + 1), 0); return p.reduce((s, q, i) => s + q * (i + 1 - m) ** 2, 0); }
    case 'empirical': { const m = p.reduce((s, x) => s + x, 0) / p.length; return p.reduce((s, x) => s + (x - m) ** 2, 0) / p.length; }
    default: return null; // truncated normal; Cauchy has none
  }
}

/** Mean and standard deviation of the model; null where the family has none (the Cauchy has no mean). */
export function modelMoments(law: Law, model?: Pick<DataModel, 'family' | 'params'>): { mean: number | null; sd: number | null } {
  if (law.undefinedMean || !Number.isFinite(law.mean)) return { mean: null, sd: null };
  const v = model ? exactVariance(model.family, model.params) : null;
  const sd = v !== null && Number.isFinite(v) && v >= 0 ? Math.sqrt(v) : lawSD(law);
  return { mean: law.mean, sd: Number.isFinite(sd) ? sd : null };
}

/** The number of synthetic values to draw: a whole number from 1 to `GENERATE_MAX`. */
export const generatorSize = (n: number): number => (Number.isFinite(n) ? Math.min(GENERATE_MAX, Math.max(1, Math.round(n))) : 100);

/**
 * Seeded synthetic data from the model: the same model, seed and size always give the same numbers.
 * Null when the model is not valid. These are draws from an assumption, never observations.
 */
export function generate(d: Pick<DataModel, 'family' | 'params' | 'generator'>): number[] | null {
  const law = modelLaw(d);
  if (!law) return null;
  return drawFrom(law, d.generator.seed.trim() || '0', 'generate', generatorSize(d.generator.n));
}

/** Synthetic data as CSV: one row per draw. */
export function generatedCsv(values: number[]): string {
  return `draw,value\r\n${values.map((v, i) => `${i + 1},${v}`).join('\r\n')}\r\n`;
}

/** Values kept with an artefact: all of them, or an even thinning when there are more than the limit. */
export const keptValues = (values: number[]): number[] => thinEvenly(values, KEEP_MAX_VALUES);

/** Default parameters of a family as numbers (list families as their list). */
export function defaultParams(kind: Kind): number[] {
  const def = FAMILIES[kind].defaults;
  return kind === 'categorical' || kind === 'empirical' ? String(def[0]).split(',').map((s) => Number(s)) : def.map(Number);
}

/**
 * A data model for one column of a file, fitted by the lowest AIC: what the tool makes for each ticked column when
 * several inputs are made at once. Null when the column has fewer than three values or no candidate fits.
 */
export function dataModelFromColumn(base: DataModel, name: string, values: number[], file: string): DataModel | null {
  const sample = prepareSample(values);
  if (!sample || !sample.fits.length) return null;
  const d: DataModel = { ...structuredClone(base), name: name.slice(0, 200), provenance: `File “${file}”, column “${name}” (${values.length} values)`, availability: 'have' };
  applyFit(d, sample, sample.fits[0]);
  return d;
}
