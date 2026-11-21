import { describe, expect, it } from 'vitest';
import { analyse, comparison, differenceSvg, isPaired, policiesSvg } from '../src/domain/artefacts/comparison';
import type { Comparison } from '../src/domain/artefacts/types';
import { arrivalsForReplication, defaultConfig } from '../src/domain/sandbox/engine';
import { welchInterval } from '../src/domain/sandbox/stats';
import { isRowCounter, readNumbers } from '../src/features/toolbox/compare/Entry';
import { EXAMPLE, exampleComparison, exampleRuns, typeValues } from '../src/features/toolbox/compare/example';
import { csvCell, differencesCsv, plotSvg, summaryHtml, summaryMarkdown } from '../src/features/toolbox/compare/exports';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';

const NOW = '2026-11-21T10:00:00.000Z';
const own = (): Comparison => ({
  ...comparison.empty(), outcome: 'Average waiting time', unit: 'minutes', direction: 'lower', baselineLabel: 'Two clerks', alternativeLabel: 'Three clerks',
  baseline: [12.1, 14.3, 11.8, 13.0, 15.2, 12.7, 13.9, 12.2], alternative: [9.4, 11.0, 9.9, 10.2, 12.1, 9.8, 10.9, 9.5], paired: true,
  minimumDifference: 2, targetHalfWidth: 0.25, origin: 'pasted',
});

describe('the example: two capacities of a daily backlog', () => {
  it('is seeded: every run gives the same numbers', () => {
    expect(exampleRuns(true)).toEqual(exampleRuns(true));
    expect(exampleRuns(false)).toEqual(exampleRuns(false));
    const r = exampleRuns(true);
    expect(r.baseline).toHaveLength(EXAMPLE.replications);
    expect(r.alternative).toHaveLength(EXAMPLE.replications);
  });
  it('with shared inputs both capacities see the same arrivals, so only the baseline is the same in both versions', () => {
    const shared = exampleRuns(true), separate = exampleRuns(false);
    expect(separate.baseline).toEqual(shared.baseline);
    expect(separate.alternative).not.toEqual(shared.alternative);
    // More capacity never leaves a larger backlog on the same arrivals.
    shared.baseline.forEach((b, i) => expect(shared.alternative[i]).toBeLessThanOrEqual(b));
  });
  it('shows why pairing matters: the paired interval is much narrower and needs far fewer runs', () => {
    const p = analyse(exampleComparison(true)), u = analyse(exampleComparison(false));
    expect(p.difference.kind).toBe('paired');
    expect(u.difference.kind).toBe('welch');
    expect(p.difference.halfWidth!).toBeLessThan(u.difference.halfWidth! / 2);
    expect(p.precision.needed!).toBeLessThan(u.precision.needed! / 4);
    // With the minimum of the example, the verdict itself depends on pairing.
    expect(p.verdict.code).toBe('beyond-minimum');
    expect(u.verdict.code).toBe('may-be-smaller');
  });
  it('is labelled as example data everywhere: the artefact, its card and its report', () => {
    const d = exampleComparison(true);
    expect(d.origin).toBe('example');
    expect(d.note).toMatch(/^Example data, not results of a project/);
    expect(comparison.summary(d)).toContain('Example data, not your results');
    expect(comparison.markdown(d).join('\n')).toMatch(/Example data, not results of this project/);
    expect(summaryMarkdown('Capacity 11 versus 12', d, NOW)).toMatch(/> Example data, not results of a project\./);
    expect(comparison.sanitize(JSON.parse(JSON.stringify(d)), () => {})).toEqual(d);
  });
  it('its pictures and its CSV say it is an example, so a saved copy cannot pass for real results', () => {
    for (const shared of [true, false]) {
      const d = exampleComparison(shared);
      const pictures = [differenceSvg(d)!, policiesSvg(d)!, plotSvg(d)!];
      for (const svg of pictures) expect(svg).toContain('Example data, not real results');
      expect(isSafeSvg(differenceSvg(d))).toBe(true);
      expect(isSafeSvg(policiesSvg(d))).toBe(true);
      expect(differencesCsv(d).split('\r\n')[0]).toBe('"# Example data, not real results"');
    }
    expect(differenceSvg({ ...exampleComparison(true), origin: 'pasted' })).not.toContain('Example data');
    expect(differencesCsv({ ...exampleComparison(true), origin: 'pasted' }).startsWith('replication,')).toBe(true);
  });
  it('typing over the example makes the numbers the user’s own: no longer an example, and not paired until stated', () => {
    const d = exampleComparison(true);
    typeValues(d, 'baseline', d.baseline);
    expect(d.origin).toBe('example'); // nothing changed yet
    typeValues(d, 'baseline', [1, 2, 3]);
    expect(d).toMatchObject({ origin: 'pasted', paired: false, note: '', baseline: [1, 2, 3] });
    expect(comparison.summary(d).join(' ')).not.toMatch(/Example/);
    expect(comparison.markdown(d).join('\n')).not.toMatch(/Example data/);
    const imported = { ...exampleComparison(false), origin: 'imported' as const, note: 'From a file', paired: true };
    typeValues(imported, 'alternative', [4, 5]);
    expect(imported).toMatchObject({ origin: 'pasted', note: 'From a file', paired: true });
  });
  it('uses the backlog engine only for its numbers: random arrivals around the stated mean', () => {
    const c = defaultConfig();
    expect(c.demand.mode).toBe('constant'); // the engine's own default is untouched
    const days = arrivalsForReplication({ ...c, horizon: 400, seed: 'x', demand: { ...c.demand, mode: 'random', values: [11, 12, 13], probs: [0.25, 0.5, 0.25] } }, 0);
    expect(days.reduce((a, b) => a + b, 0) / days.length).toBeCloseTo(12, 0);
  });
});

describe('Fair comparison: pairing is a statement the user makes', () => {
  it('a new comparison is not paired; a stored one keeps the value it was saved with', () => {
    expect(comparison.empty().paired).toBe(false);
    const stored = JSON.parse(JSON.stringify(own()));
    expect(comparison.sanitize(stored, () => {})!.paired).toBe(true);
    expect(comparison.sanitize({ ...stored, paired: false }, () => {})!.paired).toBe(false);
    // Equal lengths alone never make results paired.
    const pasted = { ...comparison.empty(), baseline: [1, 2, 3], alternative: [2, 3, 4] };
    expect(isPaired(pasted)).toBe(false);
    expect(analyse(pasted).difference.kind).toBe('welch');
  });
});

describe('Fair comparison: the analysis it shows', () => {
  it('paired data get a paired interval; data that are not paired get a Welch interval and say so', () => {
    const d = own();
    expect(analyse(d).difference.kind).toBe('paired');
    const u = { ...d, paired: false };
    const an = analyse(u);
    expect(an.difference.kind).toBe('welch');
    const w = welchInterval(u.baseline, u.alternative);
    expect(an.difference.lower).toBeCloseTo(w.lower!, 12);
    expect(comparison.markdown(u).join('\n')).toMatch(/not paired, so no paired interval is given/);
    // Lists of different length can never be paired.
    expect(isPaired({ ...d, alternative: d.alternative.slice(1) })).toBe(false);
  });
  it('estimates the replications for the wanted precision', () => {
    const an = analyse(own());
    expect(an.precision.per).toBe('pair');
    expect(an.precision.needed).toBeGreaterThan(8);
  });
});

describe('Fair comparison exports', () => {
  it('differences: one row per replication with the paired difference', () => {
    const csv = differencesCsv(own());
    const rows = csv.trimEnd().split('\r\n');
    expect(rows[0]).toBe('replication,"Two clerks","Three clerks","difference (alternative - baseline)"');
    expect(rows[1]).toBe('1,12.1,9.4,-2.7');
    expect(rows).toHaveLength(9);
  });
  it('results that are not paired have no difference column; a shorter list leaves cells empty', () => {
    const csv = differencesCsv({ ...own(), paired: false, alternative: [9.4, 11] });
    const rows = csv.trimEnd().split('\r\n');
    expect(rows[0]).toBe('replication,"Two clerks","Three clerks"');
    expect(rows[3]).toBe('3,11.8,');
  });
  it('a policy name a spreadsheet would run as a formula is written as text', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(differencesCsv({ ...own(), baselineLabel: '+cmd' }).split('\r\n')[0]).toMatch(/^replication,"'\+cmd"/);
  });
  it('summary and plot: Markdown under the artefact name, standalone HTML with both pictures, a safe SVG file', () => {
    const md = summaryMarkdown('Clerks', own(), NOW);
    expect(md.startsWith('# Clerks\n')).toBe(true);
    expect(md).toMatch(/paired: both policies faced the same random inputs/);
    const html = summaryHtml('Clerks <b>', own(), NOW);
    expect(html).not.toMatch(/<script|<b>/i);
    expect(html.match(/<svg /g)).toHaveLength(2);
    const svg = plotSvg(own())!;
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(isSafeSvg(svg.replace(/^<\?xml[^>]*>\n/, ''))).toBe(true);
    expect(plotSvg({ ...own(), alternative: [] })).toBeNull();
    expect(isSafeSvg(differenceSvg({ ...own(), alternativeLabel: '<script>' }))).toBe(true);
    expect(isSafeSvg(policiesSvg({ ...own(), paired: false }))).toBe(true);
  });
});

describe('Fair comparison entry', () => {
  it('reads numbers as pasted from a spreadsheet or typed in a line, and reports what it left out', () => {
    expect(readNumbers('12.1\n14.3\n\n11.8').values).toEqual([12.1, 14.3, 11.8]);
    expect(readNumbers('9.4, 11.0; 9.9 x').values).toEqual([9.4, 11, 9.9]);
    expect(readNumbers('9.4, 11.0; 9.9 x').note).toMatch(/left out: x/);
  });
  it('recognises a column that only counts rows', () => {
    expect(isRowCounter([1, 2, 3, 4])).toBe(true);
    expect(isRowCounter([0, 1, 2])).toBe(true);
    expect(isRowCounter([1, 2, 4])).toBe(false);
    expect(isRowCounter([30.1, 31.2])).toBe(false);
  });
});
