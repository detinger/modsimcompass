import { mdCell, mdText } from '../../exports/mdText';
import { mean, pairedDifferences, sampleSD, tInterval } from '../sandbox/stats';
import { numOrNull, isObj, numbers, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { Comparison } from './types';

const DIRECTIONS = ['lower', 'higher'] as const;
const ORIGINS = ['pasted', 'imported', 'example'] as const;
const ORIGIN_TEXT: Record<Comparison['origin'], string> = { pasted: 'Entered by hand', imported: 'Imported from a file', example: 'Example data, not results of this project' };

const empty = (): Comparison => ({
  outcome: '', unit: '', direction: 'lower', baselineLabel: 'Baseline', alternativeLabel: 'Alternative',
  baseline: [], alternative: [], paired: true, minimumDifference: null, targetHalfWidth: null, origin: 'pasted', note: '',
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

const num = (x: number | null) => (x === null || !Number.isFinite(x) ? '—' : String(Number(x.toPrecision(4))));
const label = (s: string, fallback: string) => s.trim() || fallback;

function summary(d: Comparison): string[] {
  if (!d.baseline.length && !d.alternative.length) return [d.outcome.trim() ? `Outcome: ${d.outcome.trim()}` : 'No results yet.'];
  const L = [`${d.outcome.trim() || 'Outcome not named'}${d.unit.trim() ? ` (${d.unit.trim()})` : ''}`];
  L.push(`${label(d.baselineLabel, 'Baseline')}: mean ${num(mean(d.baseline))}, ${d.baseline.length} replications`);
  L.push(`${label(d.alternativeLabel, 'Alternative')}: mean ${num(mean(d.alternative))}, ${d.alternative.length} replications`);
  if (d.baseline.length && d.alternative.length) L.push(`Difference of means: ${num(mean(d.alternative) - mean(d.baseline))} (${d.paired ? 'paired' : 'not paired'})`);
  if (d.origin === 'example') L.push('Example data');
  return L;
}

function markdown(d: Comparison): string[] {
  const L = [
    `- **Outcome:** ${mdText(d.outcome)}`, `- **Unit:** ${mdText(d.unit)}`, `- **Better is:** ${d.direction}`,
    `- **Where the numbers come from:** ${ORIGIN_TEXT[d.origin]}`,
  ];
  if (d.note.trim()) L.push(`- **Note:** ${mdText(d.note)}`);
  L.push('');
  if (!d.baseline.length && !d.alternative.length) return [...L, 'Results: _Not yet specified_', ''];
  L.push('| Policy | Replications | Mean | Standard deviation |', '| --- | --- | --- | --- |');
  for (const [name, xs] of [[label(d.baselineLabel, 'Baseline'), d.baseline], [label(d.alternativeLabel, 'Alternative'), d.alternative]] as const) {
    L.push(`| ${mdCell(name)} | ${xs.length} | ${num(mean(xs))} | ${num(sampleSD(xs))} |`);
  }
  L.push('');
  if (d.baseline.length && d.alternative.length) {
    if (d.paired) {
      const ci = tInterval(pairedDifferences(d.baseline, d.alternative));
      L.push(`- Paired difference (alternative − baseline): mean ${num(ci.mean)}; ${ci.unavailableReason ?? `approximate 95% t interval ${num(ci.lower)} to ${num(ci.upper)}`} (n = ${ci.n}).`);
    } else {
      L.push(`- Difference of means (alternative − baseline): ${num(mean(d.alternative) - mean(d.baseline))}. The replications are not paired, so no paired interval is given.`);
    }
    if (d.minimumDifference !== null) L.push(`- Smallest difference that matters: ${num(d.minimumDifference)}`);
    if (d.targetHalfWidth !== null) L.push(`- Target precision (half-width): ${num(d.targetHalfWidth)}`);
    L.push('');
  }
  return L;
}

export const comparison: KindDef<'comparison'> = {
  kind: 'comparison', label: 'Comparison', toolPath: '/toolbox/compare', step: 'experiment', many: true,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure: () => null,
  /** Nothing to write: the copy itself is the record. */
  applyToProject: () => {},
};
