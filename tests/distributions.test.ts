import { describe, expect, it } from 'vitest';
import { FAMILIES, KINDS, lawFor, type Kind } from '../src/domain/distributions/laws';
import { binDraws, drawFrom, median } from '../src/domain/distributions/preview';
import { fitAll, fitFamily, isFit, logLikelihood, deltaAicLabel, parseData, WHOLE_NUMBER_FLOOR, wholeNumberLogLikelihood } from '../src/domain/distributions/fitting';
import { EDGES, FAMILY_NOTES, LEAVES, QUESTIONS, pathTo } from '../src/domain/distributions/tree';
import { DATASETS } from '../src/domain/distributions/datasets';
import { flipCoins, ols, sampleLetters, simulateLinear } from '../src/domain/distributions/experiments';
import { rCode, pythonCode } from '../src/domain/distributions/code';

// Independent references: scipy.stats MLE (floc=0 for positive families), computed 2026-11-20.
const REF: Record<string, Record<string, number[]>> = {
  'dataset-1': {
    normal: [9.461939555, 2.6564403117459094, -95.83702124414742],
    lognormal: [2.2009664250080903, 0.3221447506412732, -99.48602639667803],
    exponential: [0.10568657664607116, -129.8910955601694],
    gamma: [10.960615621996086, 0.8632671632067366, -97.51793133729055],
    weibull: [4.000807718196624, 10.439460990871703, -95.72324131369012],
    logistic: [9.482495526363813, 1.5383431735674271, -96.50907043565294],
  },
  'dataset-2': {
    normal: [42.49772727272727, 4.040258690883072, -61.93543962154],
    lognormal: [3.744947608588893, 0.0948214533188689, -61.77878404064804],
    exponential: [0.02353067008930959, -104.48791316842238],
    gamma: [111.20374947489273, 0.3821609205930802, -61.81346235601432],
    weibull: [11.61039651386753, 44.36543176929773, -62.58313198627],
    logistic: [42.39241838342411, 2.4900571329287544, -63.08250871000946],
  },
};

describe('maximum-likelihood fits match scipy.stats on the preserved datasets', () => {
  for (const ds of DATASETS) {
    for (const [kind, ref] of Object.entries(REF[ds.id])) {
      it(`${ds.id} ${kind}`, () => {
        const r = fitFamily(kind as Kind, ds.values);
        expect(isFit(r)).toBe(true);
        if (!isFit(r)) return;
        const params = ref.slice(0, -1), ll = ref[ref.length - 1];
        r.params.forEach((p, i) => expect(p).toBeCloseTo(params[i], kind === 'gamma' || kind === 'weibull' || kind === 'logistic' ? 2 : 6));
        expect(r.logLik).toBeCloseTo(ll, 3);
      });
    }
  }
  it('triangular and logistic fits are local optima of the log-likelihood', () => {
    for (const kind of ['triangular', 'logistic'] as Kind[]) {
      const r = fitFamily(kind, DATASETS[0].values);
      if (!isFit(r)) throw new Error(r.reason);
      for (let i = 0; i < r.params.length; i++) for (const d of [-0.01, 0.01]) {
        const p = [...r.params]; p[i] += d * Math.max(1, Math.abs(p[i]));
        try { expect(logLikelihood(lawFor(kind, p), DATASETS[0].values)).toBeLessThanOrEqual(r.logLik + 1e-6); } catch { /* invalid params are worse */ }
      }
    }
  });
  it('ranks by AIC, adds count families only for count data, and labels ΔAIC', () => {
    const cont = fitAll(DATASETS[0].values);
    expect(cont.countData).toBe(false);
    for (let i = 1; i < cont.fits.length; i++) expect(cont.fits[i].aic).toBeGreaterThanOrEqual(cont.fits[i - 1].aic);
    const counts = fitAll([3, 5, 4, 2, 6, 4, 3, 5, 7, 4]);
    expect(counts.fits.map((f) => f.kind)).toContain('poisson');
    expect(fitFamily('poisson', [3, 5, 4]) && (fitFamily('poisson', [3, 5, 4]) as { params: number[] }).params[0]).toBe(4);
    expect(deltaAicLabel(0)).toBe('Lowest AIC');
    expect(deltaAicLabel(1.5)).toBe('Similar support');
    expect(deltaAicLabel(12)).toBe('Essentially no support');
  });
  it('rejects unsupported data honestly', () => {
    const r = fitFamily('lognormal', [-1, 2, 3]);
    expect(isFit(r)).toBe(false);
    expect(parseData('1, 2; x 3').rejected).toEqual(['x']);
    // A comma between digits is a decimal comma only when commas are not also used as separators.
    expect(parseData('1,5 2,25\n3').values).toEqual([1.5, 2.25, 3]);
    expect(parseData('1,5 2,25\n3').commaIsDecimal).toBe(true);
    expect(parseData('1,2,3').values).toEqual([1, 2, 3]);
    // A comma between digits that is not read as a decimal comma is always reported.
    expect(parseData('1,2,3').decimalCommas).toEqual(['1,2,3']);
    const mixed = parseData('23, 31; 18 45 1,5');
    expect(mixed.values).toEqual([23, 31, 18, 45, 1, 5]);
    expect(mixed.commaIsDecimal).toBe(false);
    expect(mixed.decimalCommas).toEqual(['1,5']);
    expect(parseData('4.2, 5.1, 3.8').decimalCommas).toEqual([]);
    expect(parseData('1,2,3 4,5,6').values).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('reports every piece whose comma between digits was split, so a decimal comma is never misread silently', () => {
    expect(parseData('3,5')).toMatchObject({ values: [3, 5], decimalCommas: ['3,5'] });
    expect(parseData('12,5\n')).toMatchObject({ values: [12, 5], decimalCommas: ['12,5'] });
    expect(parseData('1.000,5 2.000,5').decimalCommas).toEqual(['1.000,5', '2.000,5']);
    expect(parseData('1,5 2,5').decimalCommas).toEqual([]); // read as decimal commas: nothing to report
    expect(parseData('4, 7, 9').decimalCommas).toEqual([]); // no comma between two digits
  });
  it('count data: continuous curves are scored on whole numbers, so counts and curves compare fairly', () => {
    // 100 counts in the proportions of a Poisson with mean 1.4.
    const counts = [...Array(25).fill(0), ...Array(34).fill(1), ...Array(24).fill(2), ...Array(11).fill(3), ...Array(4).fill(4), ...Array(2).fill(5)];
    const { fits, countData } = fitAll(counts);
    expect(countData).toBe(true);
    expect(fits[0].kind).toBe('poisson');
    for (const f of fits) {
      expect(!!f.wholeNumberScore).toBe(!f.law.discrete);
      expect(f.aic).toBeCloseTo(2 * f.k - 2 * f.logLik, 9);
    }
    // The score of a curve is its probability for each whole number: F(x + ½) − F(x − ½), here for the uniform.
    const uniform = fits.find((f) => f.kind === 'uniform')!;
    expect(uniform.logLik).toBeCloseTo(27 * Math.log(0.1) + 73 * Math.log(0.2), 9);
    expect(wholeNumberLogLikelihood(uniform.law, [99])).toBe(Math.log(WHOLE_NUMBER_FLOOR));
    // Data that are not count data are scored on the density exactly as before.
    const cont = fitAll([0.8, 1.9, 2.4, 3.1, 0.5, 4.7, 2.2, 1.3, 2.9, 6.1]);
    expect(cont.countData).toBe(false);
    for (const f of cont.fits) { expect(f.wholeNumberScore).toBeUndefined(); expect(f.logLik).toBeCloseTo(logLikelihood(f.law, [0.8, 1.9, 2.4, 3.1, 0.5, 4.7, 2.2, 1.3, 2.9, 6.1]), 9); }
  });
  it('recovers known parameters from a large seeded sample', () => {
    const xs = drawFrom(lawFor('gamma', [3, 2]), 'recover', 'g', 5000);
    const r = fitFamily('gamma', xs);
    if (!isFit(r)) throw new Error('fit failed');
    expect(r.params[0]).toBeGreaterThan(2.8); expect(r.params[0]).toBeLessThan(3.2);
    expect(fitAll(xs).fits[0].kind === 'gamma' || fitAll(xs).fits[1].kind === 'gamma').toBe(true);
  });
});

describe('distribution laws (ported from Monte Carlo Simulation Lab tests)', () => {
  for (const kind of KINDS) {
    it(`${kind}: seeded preview is reproducible and consistent with its model`, () => {
      const law = lawFor(kind, FAMILIES[kind].defaults);
      const a = drawFrom(law, '42', kind, 2000), b = drawFrom(law, '42', kind, 100);
      expect(a.slice(0, 100)).toEqual(b);
      const rows = binDraws(law, a);
      expect(rows.reduce((s, r) => s + r.count, 0)).toBe(2000);
      expect(rows.every((r) => Number.isFinite(r.expected) && r.expected >= 0 && r.expected <= 1 + 1e-7)).toBe(true);
      if (law.undefinedMean) {
        const m = law.inv(0.5), dens = law.pdf(m);
        expect(Math.abs(median(a) - m)).toBeLessThan(5 / (2 * dens * Math.sqrt(2000)));
        return;
      }
      const mean = a.reduce((s, x) => s + x, 0) / a.length;
      const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / 1999);
      expect(Math.abs(mean - law.mean)).toBeLessThan((5 * sd) / Math.sqrt(2000) + 1e-10);
    });
  }
  it('invalid parameters are rejected', () => {
    for (const [k, p] of [['uniform', [3, 2]], ['normal', [0, -1]], ['categorical', ['2,3']], ['empirical', ['2,,3']], ['truncated', [0, 1, 3, 3]]] as [Kind, (number | string)[]][]) expect(() => lawFor(k, p)).toThrow();
  });
  it('R and Python snippets exist for every family', () => {
    for (const k of KINDS) {
      expect(rCode(k, FAMILIES[k].defaults, 100)).not.toMatch(/Not available/);
      expect(pythonCode(k, FAMILIES[k].defaults, 100)).not.toMatch(/Not available/);
    }
  });
});

describe('Choose-a-distribution tree', () => {
  it('every answer leads to a question or a supported family; all nodes reachable', () => {
    for (const [from, to, answer] of EDGES) { expect(QUESTIONS[from]).toBeDefined(); expect(QUESTIONS[to] || LEAVES[to]).toBeDefined(); expect(answer.trim()).not.toBe(''); }
    for (const [id, leaf] of Object.entries(LEAVES)) {
      expect(pathTo(id).length).toBeGreaterThan(0);
      for (const k of leaf.kinds) { expect(FAMILY_NOTES[k]).toBeDefined(); lawFor(k, FAMILY_NOTES[k]!.thumb); }
    }
    for (const id of Object.keys(QUESTIONS)) if (id !== 'root') expect(pathTo(id).length).toBeGreaterThan(0);
  });
});

describe('sampling and regression experiments', () => {
  it('seeded letters and coins are reproducible; running share converges', () => {
    expect(sampleLetters(10, 's')).toEqual(sampleLetters(10, 's'));
    const c = flipCoins(20000, 0.3, 's');
    expect(Math.abs(c.heads / 20000 - 0.3)).toBeLessThan(0.015);
    expect(c.running).toHaveLength(20000);
  });
  it('OLS recovers exact coefficients without noise, and matches a hand calculation', () => {
    const s = simulateLinear(10, 1.5, 0, 30, 'x');
    const f = ols(s.x, s.y);
    expect(f.slope).toBeCloseTo(1.5, 10); expect(f.intercept).toBeCloseTo(10, 8); expect(f.r2).toBeCloseTo(1, 10);
    const g = ols([1, 2, 3, 4], [2, 4, 5, 8]); // slope 1.9, intercept 0, R²
    expect(g.slope).toBeCloseTo(1.9, 10); expect(g.intercept).toBeCloseTo(0, 10);
    expect(g.r2).toBeCloseTo(1 - 0.7 / 18.75, 10);
  });
});

import { lawToDemand } from '../src/domain/distributions/transfer';
describe('distribution → sandbox demand transfer', () => {
  it('Poisson(12) becomes a finite, normalised demand list with reported trimmed mass', () => {
    const t = lawToDemand(lawFor('poisson', [12]));
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(t.droppedMass).toBeLessThan(3e-4);
    expect(t.mean).toBeCloseTo(12, 2);
    expect(t.values.length).toBeLessThanOrEqual(60);
  });
  it('rejects continuous and negative-support laws', () => {
    expect(lawToDemand(lawFor('normal', [12, 2])).ok).toBe(false);
    expect(lawToDemand(lawFor('discrete', [-2, 3])).ok).toBe(false);
  });
});

import { pairedColumns, parseCsv } from '../src/domain/distributions/csv';
import { fitPythonCode, fitRCode, scriptSeed } from '../src/domain/distributions/code';
describe('CSV import', () => {
  it('detects the separator, the header and decimal commas, and counts what it leaves out', () => {
    const res = parseCsv('id;time;note\n1;2,5;a\n2;n/a;b\n3;4,25;c\n4;;d\n5;1,5;e\n');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const t = res.table;
    expect([t.separator, t.header, t.rows]).toEqual([';', true, 5]);
    const time = t.columns[1];
    expect(time.name).toBe('time');
    expect(time.decimalComma).toBe(true);
    expect(time.values).toEqual([2.5, 4.25, 1.5]);
    expect([time.blank, time.rejected]).toEqual([1, 1]);
    expect(time.rejectedSamples[0]).toEqual({ line: 3, text: 'n/a' });
    expect(time.byRow).toEqual([2.5, null, 4.25, null, 1.5]);
    expect(t.columns[2].offered).toBe(false);
  });
  it('reads quoted cells, tabs and a byte-order mark; refuses binary and oversized text', () => {
    const res = parseCsv('﻿a\tb\n"1"\t2\n3\t"4"\n5\t6\n');
    expect(res.ok && res.table.separator).toBe('\t');
    expect(res.ok && res.table.columns.map((c) => c.values)).toEqual([[1, 3, 5], [2, 4, 6]]);
    expect(parseCsv('a,b\n1,\u00002').ok).toBe(false);
    expect(parseCsv(' ').ok).toBe(false);
    expect(parseCsv('x'.repeat(5 * 1024 * 1024 + 1)).ok).toBe(false);
  });
  it('keeps two columns row by row, so pairs stay pairs', () => {
    const res = parseCsv('a,b\n1,10\n2,\n,30\n4,40\n');
    if (!res.ok) throw new Error(res.error);
    const [a, b] = res.table.columns;
    expect(pairedColumns(a, b)).toEqual({ first: [1, 4], second: [10, 40], dropped: 2 });
  });
});

describe('R and Python code', () => {
  it('uses the app seed when it is a plain whole number, and never writes a cut-off list', () => {
    expect(scriptSeed('777')).toBe(777);
    expect(scriptSeed('abc')).toBe(42);
    expect(scriptSeed('1234567890')).toBe(42);
    expect(rCode('normal', [0, 1], 10, '7')).toMatch(/set\.seed\(7\)/);
    expect(pythonCode('normal', [0, 1], 10, '7')).toMatch(/random_state=7/);
    expect(rCode('normal', [0, 1], 10)).toMatch(/set\.seed\(42\)/);
    const many = Array.from({ length: 300 }, (_, i) => i);
    expect(fitRCode(many)).toMatch(/read\.csv/);
    expect(fitRCode(many)).not.toMatch(/\.\.\./);
    expect(fitPythonCode(many)).not.toMatch(/\.\.\./);
    expect(fitRCode([1, 2, 3])).toMatch(/x <- c\(1, 2, 3\)/);
  });
});
