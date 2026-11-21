import { mdCell, mdLine, mdText } from '../../exports/mdText';
import {
  pairedDifferences, quantile, replicationsNeeded, replicationsNeededTwoSample, REPLICATIONS_CAP, sampleSD, summarise, tInterval, welchInterval,
  type OutcomeSummary,
} from '../sandbox/stats';
import { numOrNull, isObj, numbers, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { Comparison } from './types';

/**
 * Comparison of two policies from replication outcomes (docs/TOOLBOX-SPEC.md §5).
 * Everything the Fair comparison tool shows is computed here, so the page, the cards, the report and the
 * exports cannot disagree: `analyse` for the numbers and the verdict, `differenceSvg` and `policiesSvg` for the pictures.
 */
const DIRECTIONS = ['lower', 'higher'] as const;
const ORIGINS = ['pasted', 'imported', 'example'] as const;
const ORIGIN_TEXT: Record<Comparison['origin'], string> = { pasted: 'Entered by hand', imported: 'Imported from a file', example: 'Example data, not results of this project' };

/** Not paired until the user says so: results from another simulator rarely share random inputs, and a paired interval would then be too narrow. */
const empty = (): Comparison => ({
  outcome: '', unit: '', direction: 'lower', baselineLabel: 'Baseline', alternativeLabel: 'Alternative',
  baseline: [], alternative: [], paired: false, minimumDifference: null, targetHalfWidth: null, origin: 'pasted', note: '',
});

function sanitize(raw: unknown, warn: Warn): Comparison | null {
  if (!isObj(raw)) return null;
  const baseline = numbers(own(raw, 'baseline'), 'baseline', warn), alternative = numbers(own(raw, 'alternative'), 'alternative', warn);
  if (!baseline || !alternative) return null;
  let paired = own(raw, 'paired') === true;
  if (typeof own(raw, 'paired') !== 'boolean') warn('paired: not stated; treated as not paired.');
  // A paired interval is only honest for paired data: lists of different length cannot be pairs.
  if (paired && baseline.length !== alternative.length) { warn('paired: the two lists differ in length; treated as not paired.'); paired = false; }
  let targetHalfWidth = numOrNull(own(raw, 'targetHalfWidth'), 'targetHalfWidth', warn);
  if (targetHalfWidth !== null && targetHalfWidth <= 0) { warn('targetHalfWidth: must be above zero; cleared.'); targetHalfWidth = null; }
  return {
    outcome: text(own(raw, 'outcome'), 'outcome', warn, 500), unit: text(own(raw, 'unit'), 'unit', warn, 200),
    direction: oneOf(own(raw, 'direction'), DIRECTIONS, 'lower', 'direction', warn),
    baselineLabel: text(own(raw, 'baselineLabel'), 'baselineLabel', warn, 200), alternativeLabel: text(own(raw, 'alternativeLabel'), 'alternativeLabel', warn, 200),
    baseline, alternative, paired,
    minimumDifference: numOrNull(own(raw, 'minimumDifference'), 'minimumDifference', warn), targetHalfWidth,
    origin: oneOf(own(raw, 'origin'), ORIGINS, 'pasted', 'origin', warn),
    note: text(own(raw, 'note'), 'note', warn),
  };
}

// ── Words and numbers ────────────────────────────────────────────────────

/** Plain number for Markdown and tables: four significant digits, ordinary minus sign. */
const num = (x: number | null) => (x === null || !Number.isFinite(x) ? '—' : String(Number(x.toPrecision(4))));

/** Number for the screen and for pictures: about three significant digits, a real minus sign, no thousands separators. */
export function fmtNum(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  const dp = a === 0 ? 0 : a >= 1000 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : Math.min(10, 2 - Math.floor(Math.log10(a)));
  return String(Number(x.toFixed(dp))).replace('-', '−');
}

const named = (s: string, fallback: string) => mdLine(s) || fallback;
/** The names of the two policies, never empty and always on one line. */
export const policyNames = (d: Comparison) => ({ baseline: named(d.baselineLabel, 'Baseline'), alternative: named(d.alternativeLabel, 'Alternative') });
/** “Average backlog (requests)”, or a neutral word when the outcome is not named yet. */
export function outcomeName(d: Comparison, fallback = 'Outcome'): string {
  const unit = mdLine(d.unit);
  return `${mdLine(d.outcome) || fallback}${unit ? ` (${unit})` : ''}`;
}
/** Paired is a statement about the data that only equal, non-empty lists can carry. */
export const isPaired = (d: Comparison): boolean => d.paired && d.baseline.length === d.alternative.length && d.baseline.length > 0;

// ── Analysis ─────────────────────────────────────────────────────────────

export interface DifferenceSummary {
  /** `paired`: t interval of the paired differences. `welch`: two-sample interval of the difference of means. `none`: a policy has no results. */
  kind: 'paired' | 'welch' | 'none';
  /** Alternative − baseline. */
  mean: number | null;
  lower: number | null; upper: number | null; halfWidth: number | null;
  unavailableReason: string | null;
  /** Paired only: one difference per replication, their standard deviation, and how many favour the alternative. */
  differences: number[];
  sd: number | null;
  favour: number | null;
}

export type VerdictCode = 'no-data' | 'no-interval' | 'includes-zero' | 'excludes-zero' | 'beyond-minimum' | 'may-be-smaller' | 'smaller-than-minimum';
export interface Verdict {
  code: VerdictCode;
  headline: string;
  detail: string;
  /** Which policy the difference favours, when the interval excludes zero. */
  favours: 'alternative' | 'baseline' | null;
  tone: 'none' | 'neutral' | 'good' | 'caution';
}

export interface Precision {
  target: number | null;
  /** Estimated replications needed: pairs when paired, per policy otherwise. Null when it cannot be estimated. */
  needed: number | null;
  have: number;
  per: 'pair' | 'policy';
  capped: boolean;
  /** Why there is no estimate. */
  reason: string | null;
}

export interface Analysis {
  baseline: OutcomeSummary | null;
  alternative: OutcomeSummary | null;
  difference: DifferenceSummary;
  verdict: Verdict;
  precision: Precision;
}

/** What a verdict is, and is not, about. Shown wherever a verdict is shown. */
export const VERDICT_SCOPE = 'This describes these simulation runs. Whether it holds for the real system depends on how well the model has been validated.';

function differenceOf(d: Comparison): DifferenceSummary {
  const none: DifferenceSummary = { kind: 'none', mean: null, lower: null, upper: null, halfWidth: null, unavailableReason: null, differences: [], sd: null, favour: null };
  if (!d.baseline.length || !d.alternative.length) return none;
  if (isPaired(d)) {
    const differences = pairedDifferences(d.baseline, d.alternative);
    const ci = tInterval(differences);
    const better = d.direction === 'lower' ? differences.filter((x) => x < 0).length : differences.filter((x) => x > 0).length;
    return { kind: 'paired', mean: ci.mean, lower: ci.lower, upper: ci.upper, halfWidth: ci.halfWidth, unavailableReason: ci.unavailableReason, differences, sd: ci.sd, favour: better };
  }
  const w = welchInterval(d.baseline, d.alternative);
  return { ...none, kind: 'welch', mean: w.mean, lower: w.lower, upper: w.upper, halfWidth: w.halfWidth, unavailableReason: w.unavailableReason };
}

/** The smallest difference that matters as a size; zero or nothing means “not set”. */
export const minimumOf = (d: Comparison): number | null => (d.minimumDifference !== null && Number.isFinite(d.minimumDifference) && d.minimumDifference !== 0 ? Math.abs(d.minimumDifference) : null);

/**
 * Reads the interval of the difference against zero and against the smallest difference that matters.
 * Worded as a reading of these runs: it never calls a result proved, and makes no claim about the real system.
 */
export function verdictFor(d: Comparison, diff: DifferenceSummary): Verdict {
  if (diff.kind === 'none') return { code: 'no-data', headline: 'No verdict yet.', detail: 'Enter results for both policies.', favours: null, tone: 'none' };
  if (diff.lower === null || diff.upper === null) {
    return { code: 'no-interval', headline: 'Interval unavailable.', detail: 'One replication cannot show how much the outcome varies. Run each policy at least twice.', favours: null, tone: 'none' };
  }
  const { lower, upper } = diff;
  const names = policyNames(d), unit = mdLine(d.unit), m = minimumOf(d);
  const withUnit = (x: number) => `${fmtNum(x)}${unit ? ` ${unit}` : ''}`;
  if (lower <= 0 && upper >= 0) {
    const inside = m !== null && lower > -m && upper < m;
    return {
      code: 'includes-zero', headline: 'The interval includes zero: these runs do not show a difference.', favours: null, tone: 'neutral',
      detail: inside ? `The whole interval is closer to zero than your minimum of ${withUnit(m)}: any difference is smaller than what matters to you.` : 'More replications, or the same random inputs for both policies, would narrow the interval.',
    };
  }
  const favours: Verdict['favours'] = (upper < 0) === (d.direction === 'lower') ? 'alternative' : 'baseline';
  const who = `in favour of ${names[favours]}`;
  const tone: Verdict['tone'] = favours === 'alternative' ? 'good' : 'caution';
  if (m === null) {
    return { code: 'excludes-zero', headline: `The interval excludes zero: these runs show a difference ${who}.`, detail: 'Set the smallest difference that matters to judge whether it is large enough.', favours, tone };
  }
  const near = Math.min(Math.abs(lower), Math.abs(upper)), far = Math.max(Math.abs(lower), Math.abs(upper));
  if (near >= m) {
    return { code: 'beyond-minimum', headline: `The interval lies entirely beyond your minimum difference, ${who}.`, detail: `Even the end nearest zero, ${fmtNum(near)}, is at least your minimum of ${withUnit(m)}.`, favours, tone };
  }
  if (far < m) {
    return { code: 'smaller-than-minimum', headline: `Shows a difference ${who}, but it is smaller than your minimum.`, detail: `The whole interval is closer to zero than your minimum of ${withUnit(m)}.`, favours, tone: 'neutral' };
  }
  return { code: 'may-be-smaller', headline: `Shows a difference ${who}, but it may be smaller than your minimum.`, detail: `Part of the interval is closer to zero than your minimum of ${withUnit(m)}. More replications would narrow it.`, favours, tone: 'neutral' };
}

function precisionOf(d: Comparison, diff: DifferenceSummary): Precision {
  const paired = diff.kind === 'paired';
  const base: Precision = { target: d.targetHalfWidth, needed: null, have: paired ? diff.differences.length : Math.min(d.baseline.length, d.alternative.length), per: paired ? 'pair' : 'policy', capped: false, reason: null };
  if (d.targetHalfWidth === null) return base;
  if (diff.kind === 'none') return { ...base, reason: 'Enter results for both policies first.' };
  const needed = paired
    ? (diff.sd === null ? null : replicationsNeeded(diff.sd, d.targetHalfWidth))
    : (d.baseline.length < 2 || d.alternative.length < 2 ? null : replicationsNeededTwoSample(sampleSD(d.baseline), sampleSD(d.alternative), d.targetHalfWidth));
  if (needed === null) return { ...base, reason: 'At least two replications are needed to estimate the spread.' };
  return { ...base, needed, capped: needed >= REPLICATIONS_CAP };
}

/** Every number the tool shows, from the artefact alone. */
export function analyse(d: Comparison): Analysis {
  const difference = differenceOf(d);
  return {
    baseline: d.baseline.length ? summarise(d.baseline) : null,
    alternative: d.alternative.length ? summarise(d.alternative) : null,
    difference, verdict: verdictFor(d, difference), precision: precisionOf(d, difference),
  };
}

/** “n = 40 paired replications”, or the two counts when the lists are not paired. */
export function replicationsText(d: Comparison): string {
  const a = d.baseline.length, b = d.alternative.length;
  if (isPaired(d)) return `n = ${a} paired replication${a === 1 ? '' : 's'}`;
  return a === b ? `n = ${a} replication${a === 1 ? '' : 's'} per policy, not paired` : `n = ${a} and ${b} replications, not paired`;
}

/** “Mean difference −23.8 (95% interval −25.1 to −22.6)”. */
export function differenceText(diff: DifferenceSummary): string {
  if (diff.kind === 'none' || diff.mean === null) return 'No difference yet';
  const what = diff.kind === 'paired' ? 'Mean difference' : 'Difference of means';
  if (diff.lower === null || diff.upper === null) return `${what} ${fmtNum(diff.mean)} (interval unavailable)`;
  return `${what} ${fmtNum(diff.mean)} (95% ${diff.kind === 'welch' ? 'Welch ' : ''}interval ${fmtNum(diff.lower)} to ${fmtNum(diff.upper)})`;
}

/** “About 18 pairs”, for the precision planner. */
export function precisionText(p: Precision): string {
  if (p.target === null) return '';
  if (p.needed === null) return p.reason ?? '';
  const unit = p.per === 'pair' ? 'paired replications' : 'replications of each policy';
  if (p.capped) return `More than ${REPLICATIONS_CAP.toLocaleString('en-GB')} ${unit}: this precision is out of reach.`;
  const gap = p.needed - p.have;
  return `About ${p.needed} ${unit}. You have ${p.have}${gap > 0 ? `: ${gap} more.` : ': enough.'}`;
}

function summary(d: Comparison): string[] {
  const names = policyNames(d);
  if (!d.baseline.length && !d.alternative.length) return [mdLine(d.outcome) ? `Outcome: ${outcomeName(d)}` : 'No results yet.'];
  const L = [`${outcomeName(d, 'Outcome not named')}, ${d.direction} is better`];
  if (!d.baseline.length || !d.alternative.length) {
    const which = d.baseline.length ? 'baseline' : 'alternative', xs = d.baseline.length ? d.baseline : d.alternative;
    L.push(`${names[which]}: mean ${fmtNum(summarise(xs).mean)}, n = ${xs.length}`, `No results for ${which === 'baseline' ? 'the alternative' : 'the baseline'} yet`);
  } else {
    const diff = differenceOf(d);
    L.push(replicationsText(d), differenceText(diff), verdictFor(d, diff).headline);
  }
  if (d.origin === 'example') L.push('Example data, not your results');
  return L;
}

function markdown(d: Comparison): string[] {
  const names = policyNames(d);
  const L = [
    `- **Outcome:** ${mdText(d.outcome)}`, `- **Unit:** ${mdText(d.unit)}`, `- **Better is:** ${d.direction}`,
    `- **Baseline:** ${names.baseline}`, `- **Alternative:** ${names.alternative}`,
    `- **Where the numbers come from:** ${ORIGIN_TEXT[d.origin]}`,
  ];
  if (d.note.trim()) L.push(`- **Note:** ${mdText(d.note)}`);
  L.push('');
  if (!d.baseline.length && !d.alternative.length) return [...L, 'Results: _Not yet specified_', ''];
  const an = analyse(d), diff = an.difference, paired = diff.kind === 'paired';
  L.push(`- **Replications:** ${paired ? `${d.baseline.length}, paired: row by row, both policies used the same random inputs` : `${d.baseline.length} for the baseline and ${d.alternative.length} for the alternative, not paired`}`, '');
  L.push('| Policy | Replications | Mean | 95% interval for the mean | 5th to 95th percentile | Standard deviation |', '| --- | --- | --- | --- | --- | --- |');
  for (const [name, xs, s] of [[names.baseline, d.baseline, an.baseline], [names.alternative, d.alternative, an.alternative]] as const) {
    const ci = !s ? '—' : s.ci.lower === null ? 'unavailable' : `${num(s.ci.lower)} to ${num(s.ci.upper)}`;
    L.push(`| ${mdCell(name)} | ${xs.length} | ${num(s ? s.mean : null)} | ${ci} | ${s && xs.length > 1 ? `${num(s.p05)} to ${num(s.p95)}` : '—'} | ${num(xs.length > 1 ? sampleSD(xs) : null)} |`);
  }
  L.push('');
  if (diff.kind === 'none') return [...L, `- No results for ${d.baseline.length ? 'the alternative' : 'the baseline'} yet, so there is no difference to report.`, ''];
  const interval = diff.unavailableReason ?? `approximate 95% ${paired ? 't' : 'Welch'} interval ${num(diff.lower)} to ${num(diff.upper)}`;
  if (paired) {
    L.push(`- Paired difference (alternative − baseline): mean ${num(diff.mean)}; ${interval} (n = ${diff.differences.length}).`);
    L.push(`- Replications that favour the alternative: ${diff.favour} of ${diff.differences.length} (${d.direction} is better).`);
  } else {
    L.push(`- Difference of means (alternative − baseline): ${num(diff.mean)}; ${interval} (two-sample, ${d.baseline.length} and ${d.alternative.length} replications).`);
    L.push('- The replications are not paired, so no paired interval is given. Giving both policies the same random inputs would usually give a sharper answer.');
  }
  const m = minimumOf(d);
  if (m !== null) L.push(`- Smallest difference that matters: ${num(m)}`);
  L.push(`- **Reading:** ${an.verdict.headline} ${an.verdict.detail}`, `- ${VERDICT_SCOPE}`);
  if (d.targetHalfWidth !== null) L.push(`- Target precision (half-width of the interval): ${num(d.targetHalfWidth)}. ${precisionText(an.precision)}${an.precision.needed !== null ? ' An estimate from the spread of the current runs.' : ''}`);
  L.push('');
  return L;
}

// ── Pictures ─────────────────────────────────────────────────────────────

/** Text inside a picture: markup characters, and the characters a link, a style or an event attribute would need, become entities. */
export function svgText(s: string): string {
  return s.replace(/[&<>"'=:@()]/g, (c) => `&#${c.charCodeAt(0)};`);
}
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const r1 = (x: number) => String(Math.round(x * 10) / 10);

/** Round tick values (1, 2 or 5 × a power of ten apart) that lie inside [lo, hi]. */
function ticksFor(lo: number, hi: number, target: number): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / target, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  const step = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k++) out.push(Number((k * step).toPrecision(12)));
  return out;
}
const tickText = (t: number) => String(t).replace('-', '−');
function spread(values: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}
function padded(lo: number, hi: number): [number, number] {
  if (lo === hi) { const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.5 : 1; return [lo - pad, hi + pad]; }
  const pad = (hi - lo) * 0.06;
  return [lo - pad, hi + pad];
}

/* Colours: a literal first, then the app's token. A viewer that knows no CSS variables keeps the literal, so a saved picture prints well. */
const INK = 'fill:#17202c;fill:var(--text,#17202c)', QUIET = 'fill:#4b5867;fill:var(--text-muted,#4b5867)';
const STYLE = `<style>`
  + `.cmpf text{font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12px;${INK}}`
  + `.cmpf .q{${QUIET}}.cmpf .s{font-weight:650}`
  + `.cmpf .ax{fill:none;stroke:#b7c1cf;stroke:var(--border-strong,#b7c1cf);stroke-width:1.5}`
  + `.cmpf .zero{fill:none;stroke:#4b5867;stroke:var(--text-muted,#4b5867);stroke-width:1.5;stroke-dasharray:3 4}`
  + `.cmpf .min{fill:none;stroke:#b7791f;stroke:var(--warning,#b7791f);stroke-width:1.5;stroke-dasharray:7 3}`
  + `.cmpf .band{fill:#1f5f8b;fill:var(--primary,#1f5f8b);opacity:.18}`
  + `.cmpf .mean{fill:none;stroke:#1f5f8b;stroke:var(--primary,#1f5f8b);stroke-width:2.5}`
  + `.cmpf .dot{fill:#1f5f8b;fill:var(--primary,#1f5f8b);stroke:#ffffff;stroke:var(--bg-elevated,#ffffff);stroke-width:1}`
  + `.cmpf .b{fill:#2a78d6;fill:var(--ms-baseline,#2a78d6);stroke:#2a78d6;stroke:var(--ms-baseline,#2a78d6)}`
  + `.cmpf .a{fill:#eb6834;fill:var(--ms-alternative,#eb6834);stroke:#eb6834;stroke:var(--ms-alternative,#eb6834)}`
  + `.cmpf .range{stroke-width:2;opacity:.45}.cmpf .ci{stroke-width:9;stroke-linecap:round;opacity:.5}.cmpf .pt{stroke:#ffffff;stroke:var(--bg-elevated,#ffffff);stroke-width:1.5}.cmpf .rug{stroke-width:1;opacity:.35}`
  + `</style>`;
const open = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" class="cmpf" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${STYLE}`;

/** The caption every picture of the example carries, so a saved copy cannot pass for real results. */
export const EXAMPLE_CAPTION = 'Example data, not real results';
const EXAMPLE_ROOM = 20;
const exampleLine = (d: Comparison, W: number, y: number) => (d.origin === 'example' ? `<text class="s" x="${r1(W / 2)}" y="${y}" text-anchor="middle">${svgText(EXAMPLE_CAPTION)}</text>` : '');

/** The axis of the difference depends only on the two samples, not on how they are paired: paired and unpaired results of the same policies can be compared by eye. */
function differenceAxis(d: Comparison, diff: DifferenceSummary): [number, number] {
  const [b0, b1] = spread(d.baseline), [a0, a1] = spread(d.alternative);
  let lo = Math.min(a0 - b1, 0), hi = Math.max(a1 - b0, 0);
  const m = minimumOf(d);
  if (m !== null) { lo = Math.min(lo, -m); hi = Math.max(hi, m); }
  if (diff.lower !== null && diff.upper !== null) { lo = Math.min(lo, diff.lower); hi = Math.max(hi, diff.upper); }
  return padded(lo, hi);
}

/**
 * The difference between the policies on a fixed axis: zero line, smallest difference that matters, the interval as a band
 * and, for paired data, one dot per replication. Null when a policy has no results.
 */
export function differenceSvg(d: Comparison, opts: { width?: number } = {}): string | null {
  const diff = differenceOf(d);
  if (diff.kind === 'none' || diff.mean === null) return null;
  const W = Math.max(280, Math.round(opts.width ?? 640)), padX = 26, plotW = W - 2 * padX;
  const names = policyNames(d), [lo, hi] = differenceAxis(d, diff);
  const x = (v: number) => padX + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * plotW;

  // Stack the dots in columns; shrink them until the tallest column fits, and fall back to bars when even that fails.
  const maxDots = 132, dots: string[] = [];
  let dotsH = 46;
  if (diff.kind === 'paired' && diff.differences.length > 0) {
    let pitch = 0, tallest = 0;
    let columns = new Map<number, number>();
    for (const p of [10, 8, 6, 5, 4]) {
      columns = new Map();
      for (const v of diff.differences) { const c = Math.round((x(v) - padX) / p); columns.set(c, (columns.get(c) ?? 0) + 1); }
      tallest = Math.max(...columns.values());
      pitch = p;
      if (tallest * p <= maxDots) break;
    }
    if (tallest * pitch <= maxDots) {
      dotsH = Math.max(46, tallest * pitch + 8);
      const seen = new Map<number, number>();
      diff.differences.forEach((v, i) => {
        const c = Math.round((x(v) - padX) / pitch), k = seen.get(c) ?? 0;
        seen.set(c, k + 1);
        dots.push(`<circle class="dot" cx="${r1(padX + c * pitch)}" cy="${r1(-pitch / 2 - k * pitch)}" r="${r1(pitch / 2 - 0.5)}"><title>Replication ${i + 1}: ${fmtNum(v)}</title></circle>`);
      });
    } else {
      dotsH = maxDots + 8;
      for (const [c, k] of columns) { const h = (k / tallest) * maxDots; dots.push(`<rect class="dot" x="${r1(padX + c * pitch - pitch / 2 + 0.5)}" y="${r1(-h)}" width="${pitch - 1}" height="${r1(h)}"><title>${k} replications</title></rect>`); }
    }
  }

  const top = 30, base = top + dotsH, H = base + 62 + (d.origin === 'example' ? EXAMPLE_ROOM : 0);
  const better = d.direction === 'lower' ? 'left' : 'right';
  const sideLabel = (side: 'left' | 'right') => {
    const name = clip(side === better ? names.alternative : names.baseline, Math.max(8, Math.floor(plotW / 18)));
    return side === 'left' ? `<text class="q" x="${padX - 8}" y="14">← favours ${svgText(name)}</text>` : `<text class="q" x="${W - padX + 8}" y="14" text-anchor="end">favours ${svgText(name)} →</text>`;
  };
  const parts: string[] = [open(W, H), sideLabel('left'), sideLabel('right')];
  if (diff.lower !== null && diff.upper !== null) {
    const x0 = x(diff.lower), x1 = x(diff.upper);
    parts.push(`<rect class="band" x="${r1(x0)}" y="${top - 6}" width="${r1(Math.max(2, x1 - x0))}" height="${dotsH + 6}" rx="2"><title>95% interval ${fmtNum(diff.lower)} to ${fmtNum(diff.upper)}</title></rect>`);
  }
  const m = minimumOf(d);
  if (m !== null) for (const v of [-m, m]) parts.push(`<line class="min" x1="${r1(x(v))}" x2="${r1(x(v))}" y1="${top - 6}" y2="${base + 5}"><title>Smallest difference that matters ${fmtNum(v)}</title></line>`);
  parts.push(`<line class="zero" x1="${r1(x(0))}" x2="${r1(x(0))}" y1="${top - 10}" y2="${base + 5}"/>`);
  parts.push(`<line class="mean" x1="${r1(x(diff.mean))}" x2="${r1(x(diff.mean))}" y1="${top - 6}" y2="${base}"><title>Mean difference ${fmtNum(diff.mean)}</title></line>`);
  parts.push(`<line class="ax" x1="${padX - 6}" x2="${W - padX + 6}" y1="${base}" y2="${base}"/>`);
  parts.push(`<g transform="translate(0 ${base})">${dots.join('')}</g>`);
  for (const t of ticksFor(lo, hi, Math.max(3, Math.floor(plotW / 90)))) {
    parts.push(`<line class="ax" x1="${r1(x(t))}" x2="${r1(x(t))}" y1="${base}" y2="${base + 5}"/><text class="q" x="${r1(x(t))}" y="${base + 19}" text-anchor="middle">${tickText(t)}</text>`);
  }
  const axisTitle = clip(`Difference in ${outcomeName(d, 'the outcome')}`, Math.max(20, Math.floor(plotW / 7)));
  parts.push(`<text class="s" x="${W / 2}" y="${base + 38}" text-anchor="middle">${svgText(axisTitle)}</text>`);
  const legend = [
    diff.kind === 'paired' ? 'Dot: one replication' : 'No dots: the runs are not paired',
    diff.lower === null ? 'Interval unavailable' : `Band: 95% ${diff.kind === 'welch' ? 'Welch ' : ''}interval ${fmtNum(diff.lower)} to ${fmtNum(diff.upper)}`,
    ...(m !== null ? [`Dashed: minimum ±${fmtNum(m)}`] : []),
  ].join('  ·  ');
  parts.push(`<text class="q" x="${W / 2}" y="${base + 55}" text-anchor="middle">${svgText(clip(legend, Math.floor(W / 6.2)))}</text>`);
  parts.push(exampleLine(d, W, base + 75));
  parts.push('</svg>');
  return parts.join('');
}

/**
 * The two policies on the axis of the outcome: for each, the 5th to 95th percentile of its replications (thin line),
 * the 95% interval for its mean (thick bar) and the mean (point). Null when both are empty.
 */
export function policiesSvg(d: Comparison, opts: { width?: number } = {}): string | null {
  if (!d.baseline.length && !d.alternative.length) return null;
  const W = Math.max(280, Math.round(opts.width ?? 640));
  const names = policyNames(d), an = analyse(d), m = minimumOf(d);
  const gutter = Math.min(150, Math.round(W * 0.26)), padR = 26, plotW = W - gutter - padR;
  const all = [...d.baseline, ...d.alternative];
  let [lo, hi] = spread(all);
  // The marker for the minimum sits a minimum difference away from the baseline mean, on the side that is better.
  const marker = m !== null && an.baseline ? an.baseline.mean + (d.direction === 'lower' ? -m : m) : null;
  if (marker !== null) { lo = Math.min(lo, marker); hi = Math.max(hi, marker); }
  for (const s of [an.baseline, an.alternative]) if (s && s.ci.lower !== null && s.ci.upper !== null) { lo = Math.min(lo, s.ci.lower); hi = Math.max(hi, s.ci.upper); }
  // Start the axis at zero when zero is near, so that lengths can be read as sizes.
  if (lo > 0 && lo < 0.5 * hi) lo = 0;
  if (hi < 0 && hi > 0.5 * lo) hi = 0;
  [lo, hi] = padded(lo, hi);
  const x = (v: number) => gutter + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * plotW;
  const lane = 38, top = 16, base = top + 2 * lane + 4, footer = an.difference.kind === 'none' ? 40 : 58, H = base + footer + (d.origin === 'example' ? EXAMPLE_ROOM : 0);
  const parts: string[] = [open(W, H)];
  if (lo < 0 && hi > 0) parts.push(`<line class="zero" x1="${r1(x(0))}" x2="${r1(x(0))}" y1="${top - 8}" y2="${base + 5}"/>`);
  if (marker !== null) {
    parts.push(`<line class="min" x1="${r1(x(marker))}" x2="${r1(x(marker))}" y1="${top - 8}" y2="${base + 5}"><title>Baseline mean ${d.direction === 'lower' ? 'minus' : 'plus'} the smallest difference that matters</title></line>`);
  }
  ([['b', names.baseline, d.baseline, an.baseline], ['a', names.alternative, d.alternative, an.alternative]] as const).forEach(([cls, name, xs, s], i) => {
    const y = top + lane * i + lane / 2;
    parts.push(`<text x="${gutter - 12}" y="${y - 2}" text-anchor="end" class="s">${svgText(clip(name, Math.max(6, Math.floor((gutter - 16) / 7))))}</text>`);
    parts.push(`<text x="${gutter - 12}" y="${y + 13}" text-anchor="end" class="q">${s ? `mean ${fmtNum(s.mean)}` : 'no results'}</text>`);
    if (!s) return;
    if (xs.length <= 400) for (const v of xs) parts.push(`<line class="${cls} rug" x1="${r1(x(v))}" x2="${r1(x(v))}" y1="${y + 9}" y2="${y + 15}"/>`);
    if (xs.length > 1) parts.push(`<line class="${cls} range" x1="${r1(x(quantile(xs, 0.05)))}" x2="${r1(x(quantile(xs, 0.95)))}" y1="${y}" y2="${y}"><title>5th to 95th percentile ${fmtNum(s.p05)} to ${fmtNum(s.p95)}</title></line>`);
    if (s.ci.lower !== null && s.ci.upper !== null) parts.push(`<line class="${cls} ci" x1="${r1(x(s.ci.lower))}" x2="${r1(x(s.ci.upper))}" y1="${y}" y2="${y}"><title>95% interval for the mean ${fmtNum(s.ci.lower)} to ${fmtNum(s.ci.upper)}</title></line>`);
    parts.push(`<circle class="${cls} pt" cx="${r1(x(s.mean))}" cy="${y}" r="5"><title>Mean ${fmtNum(s.mean)}</title></circle>`);
  });
  parts.push(`<line class="ax" x1="${gutter - 6}" x2="${W - padR + 6}" y1="${base}" y2="${base}"/>`);
  for (const t of ticksFor(lo, hi, Math.max(3, Math.floor(plotW / 90)))) {
    parts.push(`<line class="ax" x1="${r1(x(t))}" x2="${r1(x(t))}" y1="${base}" y2="${base + 5}"/><text class="q" x="${r1(x(t))}" y="${base + 19}" text-anchor="middle">${tickText(t)}</text>`);
  }
  const mid = gutter + plotW / 2, room = Math.max(16, Math.floor(plotW / 6.4));
  parts.push(`<text class="s" x="${r1(mid)}" y="${base + 37}" text-anchor="middle">${svgText(clip(outcomeName(d), room))}</text>`);
  if (an.difference.kind !== 'none') {
    const note = `${differenceText(an.difference)}${marker !== null ? `  ·  Dashed: baseline mean ${d.direction === 'lower' ? '−' : '+'} minimum` : ''}`;
    parts.push(`<text class="q" x="${W / 2}" y="${base + 54}" text-anchor="middle">${svgText(clip(note, Math.floor(W / 6.2)))}</text>`);
  }
  parts.push(exampleLine(d, W, base + footer + 14));
  parts.push('</svg>');
  return parts.join('');
}

/** Paired results: the dot plot of the differences. Results that are not paired: the two policies with their intervals. */
function figure(d: Comparison): string | null {
  if (!d.baseline.length || !d.alternative.length) return null;
  return isPaired(d) ? differenceSvg(d) : policiesSvg(d);
}

export const comparison: KindDef<'comparison'> = {
  kind: 'comparison', label: 'Comparison', toolPath: '/toolbox/compare', step: 'experiment', many: true,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure,
  /** Nothing to write: the copy itself is the record. */
  applyToProject: () => {},
};
