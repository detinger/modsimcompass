import { describe, expect, it } from 'vitest';
import { dataModel, describeModel } from '../src/domain/artefacts/dataModel';
import type { DataModel } from '../src/domain/artefacts/types';
import { fitAll } from '../src/domain/distributions/fitting';
import {
  applyFit, defaultParams, FIT_MAX_VALUES, fitRecord, generate, generatedCsv, generatorSize, GENERATE_MAX, KEEP_MAX_VALUES, keptValues,
  exactVariance, modelError, modelLaw, modelMoments, prepareSample, roundParams, summaryRecord,
} from '../src/domain/distributions/inputModel';
import { FAMILIES, KINDS, lawFor } from '../src/domain/distributions/laws';
import { drawFrom } from '../src/domain/distributions/preview';
import { fitReportHtml, fitReportMarkdown, pythonScript, rScript, syntheticCsv } from '../src/features/toolbox/data/exports';
import { fileStem, headingText, htmlReport } from '../src/features/toolbox/data/report';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';
import { markdownToHtml } from '../src/exports/html';

const base = (): DataModel => dataModel.empty();
const fitted = (): DataModel => ({
  ...base(), name: 'Service time', unit: 'minutes', family: 'gamma', params: [2, 3], origin: 'fitted', provenance: 'Ticket system, September.', availability: 'have',
  summary: { n: 30, mean: 6.1, sd: 4.2, min: 0.4, max: 19 }, fit: { rank: 1, candidates: [{ family: 'gamma', aic: 140.2 }, { family: 'lognormal', aic: 141.9 }, { family: 'normal', aic: 160 }], ksD: 0.08 },
  generator: { seed: 'abc', n: 200 },
});
const sample = drawFrom(lawFor('gamma', [2, 3]), 'datamodel-test', 'x', 400).map((v) => Math.round(v * 100) / 100);

describe('data model: picture', () => {
  it('draws nothing while the artefact is empty, or when the parameters are not valid', () => {
    expect(dataModel.figure(base())).toBeNull();
    expect(dataModel.figure({ ...fitted(), params: [-2, 3] })).toBeNull();
    expect(dataModel.figure({ ...fitted(), family: 'categorical', params: [0.5, 0.2] })).toBeNull();
  });
  it('draws every family with its default parameters as a safe, self-contained picture', () => {
    for (const k of KINDS) {
      const svg = dataModel.figure({ ...base(), name: 'x', family: k, params: defaultParams(k) });
      expect(svg, k).not.toBeNull();
      expect(isSafeSvg(svg), k).toBe(true);
    }
  });
  it('shows the kept data behind the curve, or the range of a summary when the data was not kept', () => {
    const kept = dataModel.figure({ ...fitted(), keepData: true, data: sample })!;
    expect(kept).toMatch(/class="data"/);
    expect(kept).toMatch(/Shaded&#58; 400 data values/);
    const summary = dataModel.figure(fitted())!;
    expect(summary).not.toMatch(/class="data"/);
    expect(summary).toMatch(/class="range"/);
    expect(summary).toMatch(/class="mean"/);
    // A discrete model is drawn as bars, not as a curve.
    const counts = dataModel.figure({ ...base(), name: 'Arrivals', family: 'poisson', params: [12], keepData: true, data: [10, 12, 13, 9, 14, 12, 11] })!;
    expect(counts).toMatch(/class="bar"/);
    expect(counts).not.toMatch(/class="line"/);
  });
  it('escapes whatever the user typed, so the picture stays safe', () => {
    const svg = dataModel.figure({ ...fitted(), unit: '<img src=x onerror=alert(1)> url(https://x) href="javascript:1"' })!;
    expect(isSafeSvg(svg)).toBe(true);
    expect(svg).not.toMatch(/<img/);
  });
});

describe('data model: card lines and report section', () => {
  it('summarises in two to five lines, naming the model, how it was chosen and its source', () => {
    const lines = dataModel.summary(fitted());
    expect(lines[0]).toBe('Service time (minutes)');
    expect(lines[1]).toBe('Gamma(shape 2, scale 3) · mean 6');
    expect(lines[2]).toBe('Fitted to 30 values, lowest AIC of 3');
    expect(lines).toContain('Data: have it');
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(dataModel.summary({ ...fitted(), fit: { ...fitted().fit!, rank: 2 } })[2]).toBe('Fitted to 30 values, rank 2 of 3 by AIC');
    expect(dataModel.summary({ ...base(), family: 'cauchy', params: [0, 1], origin: 'described' })[1]).toMatch(/no mean/);
    expect(dataModel.summary({ ...base(), family: 'poisson', params: [4], origin: 'described' })[2]).toBe('Described without data');
  });
  it('reports the model, its fit ranking and the synthetic data, without headings and without p-values', () => {
    const md = dataModel.markdown(fitted());
    expect(md.some((l) => /^#/.test(l))).toBe(false);
    const text = md.join('\n');
    expect(text).toMatch(/\*\*Model mean and spread:\*\* mean 6; standard deviation 4\.243/);
    expect(text).toMatch(/\| Gamma \(chosen\) \| 140\.2 \| 0 \| Lowest AIC \|/);
    expect(text).toMatch(/\| Lognormal \| 141\.9 \| 1\.7 \| Similar support \|/);
    expect(text).toMatch(/No p-value is given/);
    expect(text).toMatch(/200 values drawn from the model with seed “abc”\. Generated, not observed\./);
    expect(() => markdownToHtml(text)).not.toThrow();
  });
  it('describes list families in plain words', () => {
    expect(describeModel({ family: 'categorical', params: [0.25, 0.5, 0.25] })).toBe('Categorical(probabilities 0.25, 0.5, 0.25)');
    expect(describeModel({ family: 'empirical', params: [2, 3, 5] })).toBe('Empirical(observations 2, 3, 5)');
  });
});

describe('input model steps', () => {
  it('summarises a sample and ranks the fits; few values give a summary but no fits', () => {
    const p = prepareSample(sample)!;
    expect(p.summary.n).toBe(400);
    expect(p.fitted).toBe(sample);
    expect(p.fits.length).toBeGreaterThan(3);
    for (let i = 1; i < p.fits.length; i++) expect(p.fits[i].aic).toBeGreaterThanOrEqual(p.fits[i - 1].aic);
    expect(p.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(prepareSample([])).toBeNull();
    const two = prepareSample([1, 2])!;
    expect(two.summary.n).toBe(2);
    expect(two.fits).toEqual([]);
  });
  it('fits a long sample on an even thinning, never on the first rows only', () => {
    const long = Array.from({ length: FIT_MAX_VALUES * 2 + 1 }, (_, i) => 1 + (i % 97) + i / 1000);
    const p = prepareSample(long)!;
    expect(p.summary.n).toBe(long.length);
    expect(p.fitted).toHaveLength(FIT_MAX_VALUES);
    expect(p.fitted[0]).toBe(long[0]);
    expect(p.fitted[p.fitted.length - 1]).toBe(long[long.length - 1]);
  });
  it('a chosen fit becomes the model, with its rank, every candidate and the summary', () => {
    const p = prepareSample(sample)!;
    const d = base();
    applyFit(d, p, p.fits[1]);
    expect(d.family).toBe(p.fits[1].kind);
    expect(d.params).toEqual(roundParams(p.fits[1].params));
    expect(d.origin).toBe('fitted');
    expect(d.fit).toMatchObject({ rank: 2 });
    expect(d.fit!.candidates.map((c) => c.family)).toEqual(p.fits.map((f) => f.kind));
    expect(d.summary).toEqual(summaryRecord(p.summary));
    expect(dataModel.sanitize(JSON.parse(JSON.stringify(d)), () => {})).toEqual(d);
    expect(fitRecord(fitAll(sample).fits, 'binomial')).toBeNull();
    expect(roundParams([1.23456789, -0.000123456])).toEqual([1.235, -0.0001235]);
  });
  it('knows when parameters are not valid, and says why', () => {
    expect(modelLaw({ family: 'normal', params: [0, -1] })).toBeNull();
    expect(modelError({ family: 'normal', params: [0, -1] })).toMatch(/positive/);
    expect(modelError({ family: 'normal', params: [0, 1] })).toBeNull();
    expect(modelMoments(modelLaw({ family: 'cauchy', params: [0, 1] })!)).toEqual({ mean: null, sd: null });
    expect(modelMoments(modelLaw({ family: 'exponential', params: [0.5] })!).mean).toBeCloseTo(2, 10);
    const g = { family: 'gamma' as const, params: [2, 3] };
    expect(modelMoments(modelLaw(g)!, g).sd).toBeCloseTo(Math.sqrt(18), 10);
  });
  it('the exact variance of every family agrees with a large seeded sample', () => {
    for (const k of KINDS) {
      const params = defaultParams(k), v = exactVariance(k, params);
      if (v === null) continue;
      const law = modelLaw({ family: k, params })!;
      const xs = drawFrom(law, 'variance', k, 20000);
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
      expect(Math.abs(Math.sqrt(v) - sd), k).toBeLessThanOrEqual(0.04 * Math.max(sd, 1e-9) + 1e-9);
    }
  });
  it('synthetic data: the same model, seed and size give the same numbers; another seed others', () => {
    const d = fitted();
    const a = generate(d)!, b = generate(d)!;
    expect(a).toHaveLength(200);
    expect(a).toEqual(b);
    expect(generate({ ...d, generator: { seed: 'other', n: 200 } })).not.toEqual(a);
    expect(generate({ ...d, params: [-1, 3] })).toBeNull();
    expect(generatorSize(1e9)).toBe(GENERATE_MAX);
    expect(generatorSize(0)).toBe(1);
    const csv = generatedCsv([1.5, 2]);
    expect(csv).toBe('draw,value\r\n1,1.5\r\n2,2\r\n');
    expect(syntheticCsv(d)!.split('\r\n')).toHaveLength(202);
  });
  it('keeps at most the artefact limit of raw values', () => {
    expect(keptValues(sample)).toBe(sample);
    expect(keptValues(Array.from({ length: KEEP_MAX_VALUES + 50 }, (_, i) => i))).toHaveLength(KEEP_MAX_VALUES);
  });
  it('default parameters are valid for every family', () => {
    for (const k of KINDS) expect(modelError({ family: k, params: defaultParams(k) }), k).toBeNull();
    expect(FAMILIES.categorical.defaults).toEqual(['0.2, 0.3, 0.5']);
    expect(defaultParams('categorical')).toEqual([0.2, 0.3, 0.5]);
  });
});

describe('Data and inputs exports', () => {
  const NOW = '2026-11-21T10:00:00.000Z';
  it('the fit report is the report section plus, with the data on screen, every candidate and the quantiles', () => {
    const d = fitted();
    const without = fitReportMarkdown('Service time model', d, null, NOW);
    expect(without.startsWith('# Service time model\n')).toBe(true);
    expect(without).toMatch(/Exported 2026-11-21/);
    expect(without).not.toMatch(/## Every candidate/);
    expect(without).toMatch(/No p-values are given/);
    const p = prepareSample(sample)!;
    const withData = fitReportMarkdown('# Service time model', d, p, NOW);
    expect(withData.startsWith('# Service time model\n')).toBe(true); // a leading # in the title is not doubled
    expect(withData).toMatch(/## Every candidate/);
    expect(withData).toMatch(/\| Minimum \| 5% \| 25% \| Median \| 75% \| 95% \| Maximum \|/);
    expect(withData.match(/^\| (Gamma|Lognormal|Weibull|Normal) \|/gm)?.length).toBeGreaterThanOrEqual(4);
  });
  it('the HTML report is standalone, escapes the title, and carries the picture', () => {
    const html = fitReportHtml('<script>alert(1)</script>', { ...fitted(), keepData: true, data: sample }, null, NOW);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).toMatch(/<svg /);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });
  it('scripts carry raw values only when the data is kept with the artefact', () => {
    const few = [3.1, 4.7, 2.2, 5.9, 4.4, 3.3, 6.0, 2.8];
    const prepared = prepareSample(few);
    const off = { ...fitted(), keepData: false, data: [] }, on = { ...fitted(), keepData: true, data: few };
    for (const script of [rScript('Model', off, prepared), pythonScript('Model', off, prepared)]) {
      expect(script).not.toMatch(/4\.7/);
      expect(script).toMatch(/read\.csv\("data\.csv"\)|np\.loadtxt\("data\.csv"/);
    }
    expect(rScript('Model', on, prepared)).toContain('x <- c(3.1, 4.7, 2.2, 5.9, 4.4, 3.3, 6, 2.8)');
    expect(pythonScript('Model', on, prepared)).toContain('x = np.array([3.1, 4.7, 2.2');
  });
  it('scripts carry the model and seed; user text cannot leave its comment line', () => {
    const d = { ...fitted(), name: 'Evil\nsystem("rm -rf /")', generator: { seed: '777', n: 50 } };
    const r = rScript('Model', d, null);
    expect(r).toMatch(/set\.seed\(777\)/);
    expect(r).toMatch(/x <- rgamma\(n, shape = 2, scale = 3\)/);
    for (const line of r.split('\n')) if (line.includes('system(')) expect(line.startsWith('#')).toBe(true);
    const py = pythonScript('Model', { ...d, generator: { seed: 'not-a-number', n: 50 } }, prepareSample(sample));
    expect(py).toMatch(/random_state=42/);
    for (const line of py.split('\n')) if (line.includes('system(')) expect(line.startsWith('#')).toBe(true);
    // More than 200 values: read from a file instead of a cut-off list.
    expect(py).toMatch(/np\.loadtxt\("data\.csv"/);
    expect(py).not.toMatch(/\.\.\.\]/);
  });
  it('file names and headings fall back when the title has no letters', () => {
    expect(fileStem('Service time!', 'x')).toBe('service-time');
    expect(fileStem('???', 'data model')).toBe('data-model');
    expect(headingText('  ## Two\nlines ', 'x')).toBe('Two lines');
    expect(htmlReport({ title: 't', kicker: 'k', md: '- a', generatedAt: NOW, figures: [{ svg: '<svg><script/></svg>', label: 'bad' }] })).not.toMatch(/<script/);
  });
});

import { dataModelFromColumn } from '../src/domain/distributions/inputModel';
describe('several inputs at once', () => {
  it('each column becomes its own data model, fitted by the lowest AIC and named after its column', () => {
    const d = dataModelFromColumn(dataModel.empty(), 'Service time', sample, 'times.csv')!;
    const best = prepareSample(sample)!.fits[0];
    expect(d).toMatchObject({ name: 'Service time', family: best.kind, origin: 'fitted', availability: 'have', provenance: 'File “times.csv”, column “Service time” (400 values)' });
    expect(d.fit?.rank).toBe(1);
    expect(dataModel.sanitize(JSON.parse(JSON.stringify(d)), () => {})).toEqual(d);
    expect(dataModelFromColumn(dataModel.empty(), 'Two', [1, 2], 'x.csv')).toBeNull();
  });
});
