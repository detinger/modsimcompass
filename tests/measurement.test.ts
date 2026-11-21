import { describe, expect, it } from 'vitest';
import { createArtefact } from '../src/domain/artefacts/file';
import { includeArtefact, removeInclusion } from '../src/domain/artefacts/include';
import { constructLine, measurementData, sampleSizeText } from '../src/domain/artefacts/measurementData';
import type { Artefact, MeasurementData } from '../src/domain/artefacts/types';
import { buildFromSurvey, itemColumns, moveItem, nameTaken, recoded, reliabilityScreen, renameConstruct, setMode, setReverse, setScale, straightLining, uniqueName } from '../src/domain/measurement/build';
import { EXAMPLE_SURVEY_CASES, exampleSurvey } from '../src/domain/measurement/example';
import { keptRows, MAX_KEPT_CELLS } from '../src/domain/measurement/limits';
import {
  completeRows, constructPrefix, cronbachAlpha, detectScale, groupByPrefix, isCaseNumber, itemSummary, itemTotal, looksLikeRowNumber, maxInDegree, pearson, reverseCode,
  skewness, straightLiners, tenCasesPerArrow, valueCounts, variance,
} from '../src/domain/measurement/stats';
import { createProject } from '../src/domain/passport/schema';
import { surveyFromCsv } from '../src/features/toolbox/data/measurement/MBring';
import { dictionaryCsv, dictionaryMarkdown, itemSummariesCsv } from '../src/features/toolbox/data/measurement/exports';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';

const NOW = '2026-11-21T10:00:00.000Z';

describe('measurement statistics, against hand calculations', () => {
  it('variance, skewness and reverse coding', () => {
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(32 / 7, 12);
    // n = 4, mean 4, Σ(x − 4)³ = −27 − 8 − 1 + 216 = 180, s² = 50/3; adjusted: n / ((n − 1)(n − 2)) = 2/3.
    expect(skewness([1, 2, 3, 10])).toBeCloseTo((2 / 3) * 180 / (50 / 3) ** 1.5, 12);
    expect(skewness([1, 2])).toBeNull();
    expect(skewness([3, 3, 3])).toBeNull();
    expect(reverseCode(2, { min: 1, max: 7 })).toBe(6);
    expect(reverseCode(0, { min: 0, max: 10 })).toBe(10);
  });

  it('an item summary counts missing answers and describes the rest', () => {
    expect(itemSummary([1, null, 3, 5, null])).toEqual({ n: 3, missing: 2, mean: 3, sd: 2, min: 1, max: 5, skew: 0 });
    expect(itemSummary([null, null])).toBeNull();
    expect(valueCounts([1, 2, 2, null, 5, 9], { min: 1, max: 5 })).toEqual([{ value: 1, count: 1 }, { value: 2, count: 2 }, { value: 3, count: 0 }, { value: 4, count: 0 }, { value: 5, count: 1 }]);
  });

  it('Cronbach’s alpha, corrected item–total correlations and alpha without an item', () => {
    const m = [[1, 2, 3], [2, 3, 3], [3, 3, 4], [4, 5, 5]];
    // Item variances 5/3, 4.75/3, 2.75/3 (sum 12.5/3); sum-score variance 35/3; alpha = 3/2 · (1 − 12.5/35).
    expect(cronbachAlpha(m)).toBeCloseTo(1.5 * (1 - 12.5 / 35), 12);
    const t = itemTotal(m);
    // Item 1 against the sum of items 2 and 3 (5, 6, 7, 10): Sxy = 8, Sxx = 5, Syy = 14.
    expect(t[0].r).toBeCloseTo(8 / Math.sqrt(70), 12);
    // Without item 1: variances 4.75/3 and 2.75/3, sum-score variance 14/3; alpha = 2 · (1 − 7.5/14).
    expect(t[0].alphaIfDeleted).toBeCloseTo(2 * (1 - 7.5 / 14), 12);
    expect(cronbachAlpha([[1], [2], [3]])).toBeNull();
    expect(cronbachAlpha([[2, 2], [2, 2]])).toBeNull(); // no spread in the sum
    expect(itemTotal([[1, 2], [2, 3], [3, 5]])[0].alphaIfDeleted).toBeNull(); // one item left: no alpha
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
    expect(pearson([1, 1, 1], [2, 4, 6])).toBeNull();
  });

  it('complete cases, straight-lining, the scale and case numbers', () => {
    expect(completeRows([[1, 2], [null, 3], [4, 5]], [0, 1])).toEqual([[1, 2], [4, 5]]);
    // A case is judged only when it answered at least three items.
    expect(straightLiners([[3, 3, 3], [1, 2, 3], [5, 5, null], [4, 4, null, 4]], [0, 1, 2])).toBe(1);
    expect(straightLiners([[3, 3, 3], [4, 4, 4]], [0, 1, 2], 3)).toBe(2);
    expect(detectScale([[1, 7, 3], [2, null]])).toEqual({ min: 1, max: 7 });
    expect(detectScale([[1.5, 2]])).toBeNull();
    expect(detectScale([[0, 20]])).toBeNull();
    expect(isCaseNumber([1, 2, 3, 4])).toBe(true);
    expect(isCaseNumber([3, 1, 2])).toBe(false);
  });

  it('groups columns into constructs by their name prefix', () => {
    expect(['PEOU1', 'PEOU_2', 'pu-3', 'Q10', 'item 4', 'BI', '123'].map(constructPrefix)).toEqual(['PEOU', 'PEOU', 'pu', 'Q', 'item', 'BI', '123']);
    expect(groupByPrefix(['PEOU1', 'PEOU_2', 'pu1', 'PU2', 'Age', 'BI3', 'Gender'])).toEqual([
      { name: 'PEOU', columns: [0, 1] }, { name: 'pu', columns: [2, 3] }, { name: 'Age', columns: [4] }, { name: 'BI', columns: [5] }, { name: 'Gender', columns: [6] },
    ]);
  });

  it('the sample-size floor: ten cases per arrow into the busiest construct', () => {
    expect(maxInDegree([{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'd' }])).toBe(2);
    expect(maxInDegree([])).toBe(0);
    expect(tenCasesPerArrow(3)).toBe(30);
    expect(sampleSizeText({ maxArrows: 3, cases: 150 })).toMatch(/ten cases per arrow asks for 30 cases; there are 150\. A rule of thumb, not a power analysis\./);
    expect(sampleSizeText({ maxArrows: null, cases: 150 })).toBeNull();
  });
});

describe('the example survey', () => {
  const s = exampleSurvey();
  const built = buildFromSurvey({ columns: s.columns, labels: s.labels, rows: s.rows }, { source: 'Example', origin: 'example', reverse: s.reverse });
  it('is seeded, labelled as an example, and grouped into four constructs on a 1–7 scale', () => {
    expect(exampleSurvey()).toEqual(s);
    const d = built.data;
    expect(d.cases).toBe(EXAMPLE_SURVEY_CASES);
    expect(d.scale).toEqual({ min: 1, max: 7 });
    expect(d.constructs.map((c) => [c.name, c.items.length, c.mode])).toEqual([['PEOU', 4, 'reflective'], ['PU', 4, 'reflective'], ['ATT', 3, 'reflective'], ['BI', 3, 'reflective']]);
    expect(d.items.find((it) => it.column === 'PU4')?.reverse).toBe(true);
    expect(measurementData.summary(d)).toContain('Example data, not responses from real people');
    expect(straightLining(d, built.rows)).toBe(3);
    expect(d.items.some((it) => (it.summary?.missing ?? 0) > 0)).toBe(true);
  });
  it('reverse coding the reverse-worded item is what makes its construct consistent', () => {
    const pu = built.data.constructs.find((c) => c.name === 'PU')!;
    expect(pu.alpha!).toBeGreaterThan(0.7);
    const wrong = structuredClone(built.data);
    setReverse(wrong, wrong.items.find((it) => it.column === 'PU4')!.id, false, built.rows);
    expect(wrong.constructs.find((c) => c.name === 'PU')!.alpha!).toBeLessThan(pu.alpha! - 0.2);
    // The screen agrees with the stored alpha.
    expect(reliabilityScreen(built.data, built.rows)[1].alpha).toBeCloseTo(pu.alpha!, 12);
  });
});

describe('building and editing measurement data', () => {
  const survey = { columns: ['id', 'A1', 'A2', 'A3', 'B1', 'note'], rows: [[1, 4, 5, 4, 2, null], [2, 2, 2, 3, 6, null], [3, 5, 4, 5, 1, null], [4, 3, 3, 2, 5, null]] };
  it('takes the measured columns, leaving out a case number and an empty column', () => {
    expect(itemColumns(survey)).toEqual([1, 2, 3, 4]);
    const { data, rows } = buildFromSurvey(survey, { source: 'Test', origin: 'imported' });
    expect(data.items.map((it) => it.column)).toEqual(['A1', 'A2', 'A3', 'B1']);
    expect(rows[0]).toEqual([4, 5, 4, 2]);
    expect(data.constructs.map((c) => [c.name, c.mode])).toEqual([['A', 'reflective'], ['B', 'single']]);
    expect(data.missing).toBe('none');
    expect(data.constructs[1].alpha).toBeNull();
  });
  it('moves an item to another or a new construct; modes follow the item counts; alpha is recomputed', () => {
    const { data, rows } = buildFromSurvey(survey, { source: 'Test', origin: 'imported' });
    const a = data.constructs[0].alpha;
    moveItem(data, 'A3', 'B', rows);
    expect(data.constructs.map((c) => [c.name, c.items, c.mode])).toEqual([['A', ['A1', 'A2'], 'reflective'], ['B', ['B1', 'A3'], 'reflective']]);
    expect(data.constructs[0].alpha).not.toBe(a);
    moveItem(data, 'A3', null, rows);
    expect(data.constructs.map((c) => c.mode)).toEqual(['reflective', 'single', 'single']);
    moveItem(data, 'B1', 'A', rows);
    expect(data.constructs.map((c) => c.name)).toEqual(['A', 'A3']); // B is empty and gone
    setMode(data, 'A', 'formative', rows);
    expect(data.constructs[0]).toMatchObject({ mode: 'formative', alpha: null });
    setMode(data, 'A3-c', 'reflective', rows); // one item: only `single` fits
    expect(data.constructs[1].mode).toBe('single');
  });
  it('without the answers in memory, a reversed item is mirrored on the scale and its construct’s alpha is cleared', () => {
    const { data } = buildFromSurvey(survey, { source: 'Test', origin: 'imported' });
    const before = data.items[0].summary!;
    setReverse(data, 'A1', true, null);
    expect(data.items[0].summary).toMatchObject({ mean: reverseCode(before.mean, data.scale!), min: reverseCode(before.max, data.scale!), max: reverseCode(before.min, data.scale!) });
    expect(data.constructs[0].alpha).toBeNull();
    expect(recoded(data, [[4, 5, 4, 2]])[0][0]).toBe(reverseCode(4, data.scale!));
  });
  it('reads a survey CSV row by row, and refuses a file with fewer than two measured columns', () => {
    const res = surveyFromCsv('id;Q1;Q2;Q3;group\n1;4;5;;x\n2;3;4;4;y\n3;5;5;5;x\n4;2;1;2;y\n');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.survey.columns).toEqual(['id', 'Q1', 'Q2', 'Q3']);
    expect(res.survey.rows[0]).toEqual([1, 4, 5, null]);
    expect(res.leftOut).toEqual(['id', 'group']);
    expect(surveyFromCsv('a,b\nx,1\ny,2\nz,3\n').ok).toBe(false);
  });
  it('keeps at most the cell limit of raw answers', () => {
    const rows = Array.from({ length: 30_000 }, () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(keptRows(rows, 10).length * 10).toBeLessThanOrEqual(MAX_KEPT_CELLS);
  });
});

describe('the measurement data kind', () => {
  const s = exampleSurvey();
  const sample = (): MeasurementData => {
    const d = buildFromSurvey({ columns: s.columns, labels: s.labels, rows: s.rows }, { source: 'Example survey', origin: 'example', reverse: s.reverse });
    return { ...d.data, maxArrows: 2, keepData: true, data: keptRows(d.rows, d.data.items.length) };
  };
  const clean = (raw: unknown) => { const w: string[] = []; return { out: measurementData.sanitize(raw, (m) => w.push(m)), w }; };

  it('round-trips through its sanitizer unchanged, and is empty only when blank', () => {
    const d = sample();
    expect(clean(JSON.parse(JSON.stringify(d)))).toEqual({ out: d, w: [] });
    expect(measurementData.isEmpty(measurementData.empty())).toBe(true);
    expect(measurementData.isEmpty(d)).toBe(false);
    expect(measurementData.figure(measurementData.empty())).toBeNull();
  });
  it('a hostile file is cleaned: repeated items, impossible modes and alphas, raw rows not marked to be kept', () => {
    const r = JSON.parse(JSON.stringify(sample()));
    r.constructs[1].items.push(r.constructs[0].items[0]);  // an item in two constructs
    r.constructs[2].mode = 'single';                         // three items cannot be single
    r.constructs[3].alpha = 1.4;                             // impossible
    r.items[0].extra = '<script>'; r.extra = 1;
    r.keepData = false;
    const { out, w } = clean(r);
    expect(out!.constructs[1].items).not.toContain(r.constructs[0].items[0]);
    expect(out!.constructs[2].mode).toBe('reflective');
    expect(out!.constructs[3].alpha).toBeNull();
    expect(out!.data).toEqual([]);
    expect(Object.keys(out!.items[0])).toEqual(['id', 'column', 'label', 'reverse', 'summary']);
    expect(w.join(' ')).toMatch(/repeated items removed[\s\S]*does not fit the number of items[\s\S]*not a possible value[\s\S]*not marked to be kept/);
    const bad = JSON.parse(JSON.stringify(sample()));
    bad.data[0] = [1, 2]; // a row of the wrong width
    expect(clean(bad).out).toBeNull();
    expect(clean({ ...bad, items: 'none' }).out).toBeNull();
  });
  it('card lines, report section and picture', () => {
    const d = sample();
    const lines = measurementData.summary(d);
    expect(lines[0]).toBe('4 constructs, 14 items');
    expect(lines[1]).toBe('150 cases · scale 1–7');
    expect(lines.length).toBeLessThanOrEqual(5);
    const md = measurementData.markdown(d).join('\n');
    expect(md).toMatch(/\| PEOU \| Reflective \| PEOU1, PEOU2, PEOU3, PEOU4 \| 0\.\d\d \|/);
    expect(md).toMatch(/not evidence that a construct is valid/);
    expect(md).not.toMatch(/p-value|p =/i);
    expect(md.split('\n').some((l) => /^#/.test(l))).toBe(false);
    const svg = measurementData.figure(d);
    expect(isSafeSvg(svg)).toBe(true);
    expect(svg).toMatch(/<ellipse class="c"/);
    const formative = { ...d, constructs: d.constructs.map((c, i) => (i === 0 ? { ...c, mode: 'formative' as const, alpha: null } : c)) };
    expect(measurementData.figure(formative)).toMatch(/<ellipse class="c f"/);
    expect(isSafeSvg(measurementData.figure({ ...d, constructs: [{ ...d.constructs[0], name: '<img src=x onerror=alert(1)>' }] }))).toBe(true);
  });
  it('in a project: one input row per construct, refreshed in place, removed with the copy', () => {
    const doc = createProject({ now: NOW });
    doc.passport.inputs.push({ id: 'in-own', name: 'Written by hand', value: '', unit: '', sourceType: 'assumed', provenance: '', uncertainty: '' });
    const a = { ...createArtefact('measurement-data', { title: 'Survey', now: NOW }), data: sample(), revision: 1 } as Artefact<'measurement-data'>;
    const { inclusionId } = includeArtefact(doc, a, NOW);
    const rows = doc.passport.inputs.filter((r) => r.inclusion === inclusionId);
    expect(rows.map((r) => r.name)).toEqual(['PEOU', 'PU', 'ATT', 'BI']);
    expect(rows[0]).toMatchObject({ value: constructLine(a.data, a.data.constructs[0]), sourceType: 'synthetic', provenance: 'Example survey' });
    expect(rows[0].value).toMatch(/^4 items · 1–7 · α 0\.\d\d$/);
    const ids = rows.map((r) => r.id);
    const renamed = structuredClone(a); renamed.revision = 2; renamed.data.constructs[0].name = 'Ease of use';
    includeArtefact(doc, renamed, NOW);
    const after = doc.passport.inputs.filter((r) => r.inclusion === inclusionId);
    expect(after.map((r) => r.id)).toEqual(ids);
    expect(after[0].name).toBe('Ease of use');
    removeInclusion(doc, inclusionId);
    expect(doc.passport.inputs.map((r) => r.id)).toEqual(['in-own']);
  });
});

describe('measurement data exports', () => {
  const s = exampleSurvey();
  const { data, rows } = buildFromSurvey({ columns: s.columns, labels: s.labels, rows: s.rows }, { source: 'Example', origin: 'example', reverse: s.reverse });
  it('the data dictionary and the item summaries', () => {
    const md = dictionaryMarkdown('# Survey', data, NOW);
    expect(md.startsWith('# Survey\n')).toBe(true);
    expect(md).toMatch(/> Example data made by the app, not responses from real people\./);
    const dict = dictionaryCsv(data).trimEnd().split('\r\n');
    expect(dict[0]).toBe('construct,mode,item,label,reverse_coded,scale_min,scale_max');
    expect(dict).toHaveLength(1 + 14);
    expect(dict.find((l) => l.includes('"PU4"'))).toMatch(/,yes,1,7$/);
    const items = itemSummariesCsv(data, rows).trimEnd().split('\r\n');
    expect(items[0]).toBe('construct,item,n,missing,mean,sd,min,max,skew,item_total_r_corrected,alpha_without_item,construct_alpha');
    expect(items[1].split(',')).toHaveLength(12);
    expect(items[1].split(',')[9]).not.toBe(''); // item–total r with the answers on screen
    expect(itemSummariesCsv(data, null).trimEnd().split('\r\n')[1].split(',')[9]).toBe('');
  });
});

describe('review fixes: grouping, unique names, the scale, wide surveys, row numbers', () => {
  const s3 = (cols: string[], rows: (number | null)[][]) => buildFromSurvey({ columns: cols, rows }, { source: 'Test', origin: 'imported' });

  it('groups Q1_1 and Q1_2 into Q1, while PEOU1, PEOU_2 and “peou 3” still group and PU stays apart from PUR', () => {
    expect(['Q1_1', 'Q1_2', 'A-1-2', 'item 10', 'SAT10'].map(constructPrefix)).toEqual(['Q1', 'Q1', 'A-1', 'item', 'SAT']);
    expect(groupByPrefix(['Q1_1', 'Q1_2', 'Q2_1', 'Q2_2', 'PEOU1', 'PEOU_2', 'peou 3', 'PU1', 'PUR1', 'PU2', 'PUR2']).map((g) => [g.name, g.columns])).toEqual([
      ['Q1', [0, 1]], ['Q2', [2, 3]], ['PEOU', [4, 5, 6]], ['PU', [7, 9]], ['PUR', [8, 10]],
    ]);
  });

  it('construct names are unique: built, moved, renamed, and in files', () => {
    const rows = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 3, 3, 3], [5, 4, 2, 1]];
    const { data } = s3(['PU', 'pu1', 'PU2', 'Age'], rows);
    expect(data.constructs.map((c) => c.name)).toEqual(['PU', 'pu 2', 'Age']);
    expect(renameConstruct(data, data.constructs[2].id, 'pu')).toBe(false);
    expect(data.constructs[2].name).toBe('Age');
    expect(nameTaken(data, data.constructs[2].id, ' PU ')).toBe(true);
    expect(renameConstruct(data, data.constructs[2].id, 'Age in years')).toBe(true);
    moveItem(data, data.items[3].id, null, rows); // Age in years had one item: moving it out empties it, the new one is named after the column
    expect(new Set(data.constructs.map((c) => c.name.toLowerCase())).size).toBe(data.constructs.length);
    expect(uniqueName('', ['', 'Construct 2'])).toBe('Construct 3');
    const warnings: string[] = [];
    const out = measurementData.sanitize({ ...data, constructs: [{ ...data.constructs[0], name: 'Trust' }, { ...data.constructs[1], name: 'TRUST' }] }, (m) => warnings.push(m));
    expect(out?.constructs.map((c) => c.name)).toEqual(['Trust', 'TRUST 2']);
    expect(warnings.join('\n')).toMatch(/renamed “TRUST 2”/);
  });

  it('the scale can be set beyond the answers given; reverse coding, ranges and bars follow, with or without the rows', () => {
    const rows = [[2, 7], [3, 6], [6, 3], [7, 2], [5, 4]]; // a 1–7 scale on which nobody answered 1
    const built = buildFromSurvey({ columns: ['TR1', 'TR2'], rows }, { source: 'x', origin: 'imported', reverse: ['TR2'] });
    expect(built.data.scale).toEqual({ min: 2, max: 7 });
    expect(built.data.items[1].summary?.mean).toBeCloseTo(4.6, 10);
    const alpha = built.data.constructs[0].alpha;
    const withRows = structuredClone(built.data), without = structuredClone(built.data);
    expect(setScale(withRows, { min: 1, max: 7 }, built.rows)).toBeNull();
    expect(setScale(without, { min: 1, max: 7 }, null)).toBeNull();
    for (const d of [withRows, without]) {
      expect(d.scale).toEqual({ min: 1, max: 7 });
      expect(d.items[1].summary?.mean).toBeCloseTo(3.6, 10);
      expect(d.items[1].summary).toMatchObject({ min: 1, max: 6 }); // 7, 6, 3, 2, 4 recoded on 1–7
      expect(d.constructs[0].alpha).toBeCloseTo(alpha!, 10); // a shift changes no spread
    }
    expect(valueCounts(recoded(withRows, built.rows).map((r) => r[1]), withRows.scale!).map((v) => v.count)).toEqual([1, 1, 0, 1, 1, 1, 0]);
    expect(setScale(withRows, { min: 3, max: 7 }, built.rows)).toMatch(/answers run from 2 to 7/);
    expect(setScale(without, { min: 1, max: 6 }, null)).toMatch(/answers run from 2 to 7/);
    expect(setScale(withRows, { min: 1.5, max: 7 }, built.rows)).toMatch(/whole numbers/);
    expect(setScale(withRows, null, built.rows)).toMatch(/Reverse-coded items need a scale/);
    expect(withRows.scale).toEqual({ min: 1, max: 7 });
  });

  it('a survey wider than the limit keeps its first 500 items and says how many were left', () => {
    const cols = Array.from({ length: 520 }, (_, i) => `X${i}`);
    const rows = Array.from({ length: 4 }, (_, r) => cols.map((_, j) => 1 + ((r * 7 + j * 3) % 5))); // no column reads 1, 2, 3, …
    const built = buildFromSurvey({ columns: cols, rows }, { source: 'wide', origin: 'imported' });
    expect(built.data.items).toHaveLength(500);
    expect(built.dropped).toBe(20);
    expect(built.rows[0]).toHaveLength(500);
  });

  it('kept rows wider than the items are trimmed, not refused', () => {
    const items = Array.from({ length: 502 }, (_, i) => ({ id: `I${i}`, column: `I${i}`, label: '', reverse: false, summary: null }));
    const warnings: string[] = [];
    const out = measurementData.sanitize({ ...measurementData.empty(), keepData: true, items, constructs: [{ id: 'c', name: 'C', mode: 'reflective', items: ['I0', 'I1'], alpha: null }], data: [Array(502).fill(3), Array(502).fill(4)] }, (m) => warnings.push(m));
    expect(out).not.toBeNull();
    expect(out!.items).toHaveLength(500);
    expect(out!.data.map((r) => r.length)).toEqual([500, 500]);
    expect(warnings.join('\n')).toMatch(/values beyond the 500 items removed/);
    expect(measurementData.sanitize({ ...measurementData.empty(), keepData: true, items: items.slice(0, 3), constructs: [], data: [[1, 2]] }, () => {})).toBeNull(); // a short row is still refused
  });

  it('a column that numbers the rows is recognised by its values or its name', () => {
    expect(looksLikeRowNumber('case', [5, 9, 2])).toBe(true);
    expect(looksLikeRowNumber('Respondent ID', [10, 3])).toBe(true);
    expect(looksLikeRowNumber('row_no', [1.5, 2])).toBe(true);
    expect(looksLikeRowNumber('n', [1, 2, 3, 4])).toBe(true); // 1, 2, 3, … in order
    expect(looksLikeRowNumber('arrivals', [8, 9, 12])).toBe(false);
    expect(looksLikeRowNumber('idle time', [3, 1, 2])).toBe(false);
    expect(looksLikeRowNumber('Width', [1, 3, 2])).toBe(false);
  });
});
