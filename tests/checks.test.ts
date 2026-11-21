import { describe, expect, it } from 'vitest';
import {
  addLibraryChecks, addOwnCheck, CALCULATOR_CHECK_ID, calibrationWords, checkCounts, checkLines, checkPlan, compareValidation, countsText, dataSeparation, editCheck,
  groupLabel, hasLibraryCheck, libraryPlanId, moveCheck, recordValidationCheck, removeCheck, restoreCheck, toleranceOnOf,
} from '../src/domain/artefacts/checkPlan';
import { CALIBRATION_NOTE, METHOD_PROFILES } from '../src/domain/methods/profiles';
import type { CheckPlan } from '../src/domain/artefacts/types';
import { createProject } from '../src/domain/passport/schema';
import { METHODS } from '../src/domain/methods/registry';
import { ALL_STANDARD_CHECKS, ESTIMATION_CHECKS, GENERAL_CHECKS, METHOD_CHECKS, planIdFor, standardChecks } from '../src/content/checks';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';
import { checkPlanCsv, checkPlanMarkdownFile, csvCell } from '../src/features/toolbox/checks/exports';
import { parseNumbers, parseOne, parsePairs, valuesText } from '../src/features/toolbox/checks/parse';
import { validationPlotSvg } from '../src/features/toolbox/checks/plot';

const blank = (): CheckPlan => checkPlan.empty();
const hostile = '<script>alert(1)</script> =HYPERLINK("x") | **x** onload=1';

describe('standard checks library', () => {
  it('has unique, valid ids, a text and a reason for every check, and general checks in all three groups', () => {
    const ids = ALL_STANDARD_CHECKS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of ALL_STANDARD_CHECKS) {
      expect(planIdFor(k.id)).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
      expect(k.text.trim().length, k.id).toBeGreaterThan(10);
      expect(k.why.trim().length, k.id).toBeGreaterThan(10);
      expect(k.text, k.id).not.toMatch(/\bvalid(ated)? model\b|proves?\b/i); // nothing here claims a model is valid
    }
    for (const g of ['verification', 'validation', 'calibration'] as const) expect(GENERAL_CHECKS.some((k) => k.group === g)).toBe(true);
  });

  it('every method has its own checks, with at least one verification and one validation check', () => {
    for (const m of METHODS) {
      const list = METHOD_CHECKS[m.id];
      expect(list.some((k) => k.group === 'verification'), m.id).toBe(true);
      expect(list.some((k) => k.group === 'validation'), m.id).toBe(true);
    }
  });

  it('covers the checks the plan names: units, conservation, known cases, extremes, repeatability, an expert walk-through', () => {
    const all = ALL_STANDARD_CHECKS.map((k) => k.text.toLowerCase()).join(' | ');
    for (const word of ['units', 'conservation', 'known answer', 'extreme', 'same seed', 'knows the system']) expect(all).toContain(word);
  });

  it('offers general checks always and method checks only once a method is chosen', () => {
    expect(standardChecks('', 'verification').specific).toEqual([]);
    const sd = standardChecks('system-dynamics', 'verification');
    expect(sd.specific.map((k) => k.id)).toContain('sd-conservation');
    expect(sd.general.every((k) => k.group === 'verification')).toBe(true);
  });
});

describe('check plan editing', () => {
  it('adds library checks as planned, once each, and reports how many were new', () => {
    const d = blank();
    const list = standardChecks('des', 'verification').specific;
    expect(addLibraryChecks(d, list)).toBe(list.length);
    expect(addLibraryChecks(d, list)).toBe(0);
    expect(d.checks.every((c) => c.status === 'planned' && c.evidence === '' && c.group === 'verification')).toBe(true);
    expect(hasLibraryCheck(d, list[0].id)).toBe(true);
    expect(d.checks[0].id).toBe(libraryPlanId(list[0].id));
    expect(libraryPlanId('x')).toBe(planIdFor('x'));
  });

  it('adds own checks with a fresh valid id and a trimmed text; refuses empty text, bad and repeated ids', () => {
    const d = blank();
    expect(addOwnCheck(d, 'validation', '  Compare with last year  ', 'own-1')).toBe(true);
    expect(d.checks[0]).toEqual({ id: 'own-1', group: 'validation', text: 'Compare with last year', status: 'planned', evidence: '' });
    expect(addOwnCheck(d, 'validation', '   ', 'own-2')).toBe(false);
    expect(addOwnCheck(d, 'validation', 'Again', 'own-1')).toBe(false);
    expect(addOwnCheck(d, 'validation', 'Bad id', '-x y')).toBe(false);
    expect(d.checks).toHaveLength(1);
  });

  it('edits, removes and restores a check in place', () => {
    const d = blank();
    addOwnCheck(d, 'verification', 'A', 'a'); addOwnCheck(d, 'verification', 'B', 'b'); addOwnCheck(d, 'verification', 'C', 'c');
    editCheck(d, 'b', { status: 'failed', evidence: 'Off by 3' });
    editCheck(d, 'nope', { status: 'passed' });
    expect(d.checks[1]).toMatchObject({ status: 'failed', evidence: 'Off by 3' });
    const removed = removeCheck(d, 'b')!;
    expect(d.checks.map((c) => c.id)).toEqual(['a', 'c']);
    restoreCheck(d, removed);
    expect(d.checks.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    restoreCheck(d, removed); // already back: nothing doubled
    expect(d.checks).toHaveLength(3);
    expect(removeCheck(d, 'nope')).toBeNull();
  });

  it('moves a check within its own group, skipping checks of other groups', () => {
    const d = blank();
    addOwnCheck(d, 'verification', 'V1', 'v1'); addOwnCheck(d, 'validation', 'A1', 'a1'); addOwnCheck(d, 'verification', 'V2', 'v2');
    moveCheck(d, 'v2', -1);
    expect(d.checks.map((c) => c.id)).toEqual(['v2', 'a1', 'v1']);
    moveCheck(d, 'v2', -1); // already first of its group
    expect(d.checks.map((c) => c.id)).toEqual(['v2', 'a1', 'v1']);
    moveCheck(d, 'a1', 1); // the only validation check
    expect(d.checks.map((c) => c.id)).toEqual(['v2', 'a1', 'v1']);
  });
});

describe('validation calculator', () => {
  it('judges the tolerance on each pair (mean absolute % error) or on the means, as chosen', () => {
    const c = compareValidation([10, 20, 30], [12, 18, 33], 10, 'means');
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.paired).toBe(true);
    expect(c.bias).toBeCloseTo(1, 10);
    expect(c.mae).toBeCloseTo(7 / 3, 10);
    expect(c.mape).toBeCloseTo(((0.2 + 0.1 + 0.1) / 3) * 100, 10);
    expect(c.gapPct).toBeCloseTo(5, 10);
    expect(c.verdict).toBe('within');
    expect(compareValidation([10, 20, 30], [12, 18, 33], 10, 'pairs')).toMatchObject({ verdict: 'outside' }); // 13.3% per pair
    expect(compareValidation([10, 20, 30], [12, 18, 33], 10)).toMatchObject({ toleranceOn: 'pairs', verdict: 'outside' }); // each pair by default
    expect(compareValidation([10, 20, 30], [12, 18, 33], 14, 'pairs')).toMatchObject({ verdict: 'within' });
    expect(compareValidation([10, 20, 30], [12, 18, 33], 4, 'means')).toMatchObject({ verdict: 'outside' });
    expect(compareValidation([10, 20, 30], [12, 18, 33], 5, 'means')).toMatchObject({ verdict: 'within' }); // on the line counts as within
    expect(compareValidation([10], [11], null)).toMatchObject({ verdict: 'no-tolerance' });
    expect(compareValidation([0, 0], [1, -1], 10, 'means')).toMatchObject({ verdict: 'undefined', mape: null, zeroObserved: 2 });
    expect(compareValidation([0, 10], [1, 11], 10, 'pairs')).toMatchObject({ verdict: 'undefined', mape: null, zeroObserved: 1 });
    expect(compareValidation([1, 2], [], 10)).toMatchObject({ ok: false, reason: 'missing' });
    expect(compareValidation([], [], 10)).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('errors of opposite sign cannot cancel when the tolerance applies to each pair', () => {
    const observed = [10, 10, 10, 10], simulated = [0, 20, 0, 20];
    expect(compareValidation(observed, simulated, 5, 'pairs')).toMatchObject({ mape: 100, verdict: 'outside' });
    expect(compareValidation(observed, simulated, 5, 'means')).toMatchObject({ gapPct: 0, verdict: 'within' });
    const d = blank();
    d.validation = { measure: 'Weekly backlog', tolerancePct: 5, toleranceOn: 'pairs', observed, simulated };
    recordValidationCheck(d);
    expect(d.checks[0].status).toBe('failed');
    expect(d.checks[0].evidence).toMatch(/mean absolute percentage error 100%.*difference of the means 0%.*outside the ±5% tolerance on each pair/);
  });

  it('lists of different length: no pairs, so no verdict on each pair; the means can still be judged', () => {
    const pairs = compareValidation([1, 2], [1], 10, 'pairs');
    expect(pairs).toMatchObject({ ok: true, paired: false, n: 0, bias: null, mae: null, mape: null, verdict: 'unpaired' });
    expect(compareValidation([1, 2], [1], 40, 'means')).toMatchObject({ ok: true, paired: false, verdict: 'within' });
    const d = blank();
    d.validation = { measure: '', tolerancePct: 10, toleranceOn: 'pairs', observed: [1, 2], simulated: [1] };
    recordValidationCheck(d);
    expect(d.checks[0].status).toBe('done'); // never passed without a verdict
    expect(checkPlan.markdown(d).join('\n')).toMatch(/no pairs, so no verdict/);
  });

  it('records the comparison as one validation check, refreshed (not doubled) when recorded again', () => {
    const d = blank();
    expect(recordValidationCheck(d)).toBe(false);
    d.validation = { measure: 'Mean weekly backlog', tolerancePct: 10, toleranceOn: 'means', observed: [10, 20, 30], simulated: [12, 18, 33] };
    expect(recordValidationCheck(d)).toBe(true);
    expect(d.checks).toHaveLength(1);
    expect(d.checks[0]).toMatchObject({ id: CALCULATOR_CHECK_ID, group: 'validation', status: 'passed' });
    expect(d.checks[0].text).toContain('Mean weekly backlog');
    expect(d.checks[0].evidence).toMatch(/n = 3;.*within the ±10% tolerance on the means/);
    d.validation.tolerancePct = 2;
    recordValidationCheck(d);
    expect(d.checks).toHaveLength(1);
    expect(d.checks[0].status).toBe('failed');
    d.validation.tolerancePct = null;
    recordValidationCheck(d);
    expect(d.checks[0].status).toBe('done');
    expect(checkLines(d, 'validation')[0]).toMatch(/^1\. Compare simulated with observed values/);
  });

  it('the plot is safe to show and to save, for small, large, constant and hostile inputs', () => {
    const cases: CheckPlan['validation'][] = [
      { measure: hostile, tolerancePct: 10, toleranceOn: 'pairs', observed: [1], simulated: [1] },
      { measure: '', tolerancePct: null, toleranceOn: 'means', observed: [5, 5, 5], simulated: [5, 5, 5] },
      { measure: 'Large', tolerancePct: 5, toleranceOn: 'pairs', observed: Array.from({ length: 600 }, (_, i) => i), simulated: Array.from({ length: 600 }, (_, i) => i * 1.1) },
      { measure: 'Negative', tolerancePct: 5, toleranceOn: 'pairs', observed: [-3, -1, 2], simulated: [-2.5, -1.5, 2.2] },
    ];
    for (const v of cases) for (const standalone of [false, true]) for (const width of [320, 900]) {
      const svg = validationPlotSvg(v, { width, standalone });
      expect(isSafeSvg(svg)).toBe(true);
      expect(svg).not.toContain('<script');
    }
    // Both panels need pairs: no picture for lists of different length, whatever the criterion.
    for (const toleranceOn of ['pairs', 'means'] as const) expect(validationPlotSvg({ measure: '', tolerancePct: 1, toleranceOn, observed: [1, 2], simulated: [1] }, { width: 600 })).toBeNull();
  });
});

describe('calibration record', () => {
  it('tells separate, same and incomplete data descriptions apart', () => {
    const d = blank();
    expect(dataSeparation(d)).toBe('incomplete');
    d.calibration.tunedOn = 'January to June';
    expect(dataSeparation(d)).toBe('incomplete');
    d.calibration.validatedOn = '  january   TO june ';
    expect(dataSeparation(d)).toBe('same');
    d.calibration.validatedOn = 'July to September';
    expect(dataSeparation(d)).toBe('separate');
  });
});

describe('the tolerance criterion in files, cards, reports and the project', () => {
  const raw = (v: Record<string, unknown>) => ({ method: '', checks: [], validation: { measure: 'm', tolerancePct: 10, ...v }, calibration: { parameters: '', tunedOn: '', validatedOn: '' } });
  it('keeps a stored criterion; a file without one gets each pair for equal lists, the means otherwise', () => {
    const w: string[] = [];
    expect(checkPlan.sanitize(raw({ toleranceOn: 'means', observed: [1, 2], simulated: [1, 2] }), (m) => w.push(m))!.validation.toleranceOn).toBe('means');
    expect(checkPlan.sanitize(raw({ observed: [1, 2], simulated: [1, 2] }), (m) => w.push(m))!.validation.toleranceOn).toBe('pairs');
    expect(checkPlan.sanitize(raw({ observed: [1, 2, 3], simulated: [1, 2] }), (m) => w.push(m))!.validation.toleranceOn).toBe('means');
    expect(w).toEqual([]);
    expect(checkPlan.sanitize(raw({ toleranceOn: 'median', observed: [1], simulated: [1] }), (m) => w.push(m))!.validation.toleranceOn).toBe('pairs');
    expect(w.join(' ')).toMatch(/toleranceOn/);
    expect(checkPlan.empty().validation.toleranceOn).toBe('pairs');
    // A plan stored before the choice existed is read the same way on screen.
    expect(toleranceOnOf({ observed: [1, 2], simulated: [1] })).toBe('means');
  });
  it('the card, the report section and the project lines say what the tolerance applies to', () => {
    const d = blank();
    d.validation = { measure: 'Backlog', tolerancePct: 20, toleranceOn: 'pairs', observed: [30, 31], simulated: [28, 33] };
    expect(checkPlan.summary(d)).toContain('Validation: within 20% tolerance on each pair');
    expect(checkPlan.markdown(d).join('\n')).toMatch(/\| Tolerance \| ±20%, on each pair \(mean absolute percentage error\) \|/);
    expect(checkLines(d, 'validation').at(-1)).toBe('Measure: Backlog; tolerance set beforehand ±20% on each pair');
    d.validation.toleranceOn = 'means';
    expect(checkPlan.summary(d)).toContain('Validation: within 20% tolerance on the means');
    expect(checkPlan.markdown(d).join('\n')).toMatch(/on the means \(difference of the means/);
  });
});

describe('pasting values', () => {
  it('reads one value per line, spaces, tabs, semicolons, decimal commas, signs and exponents', () => {
    expect(parseNumbers('12\n15.5\n-3\n+4\n1e3\n−2').values).toEqual([12, 15.5, -3, 4, 1000, -2]);
    expect(parseNumbers('1 2\t3;4').values).toEqual([1, 2, 3, 4]);
    expect(parseNumbers('12,5\n7,25').values).toEqual([12.5, 7.25]);
    expect(parseNumbers('12,5,7').values).toEqual([12, 5, 7]);
    // A comma followed by a space or a line break separates values; one between digits is a decimal comma.
    expect(parseNumbers('12, 15, 9')).toMatchObject({ values: [12, 15, 9], rejectedCount: 0 });
    expect(parseNumbers('12,\n15,\n9').values).toEqual([12, 15, 9]);
    expect(parseNumbers('1,5, 2,5').values).toEqual([1.5, 2.5]);
    expect(parseNumbers('12,5 7,25').values).toEqual([12.5, 7.25]);
    expect(parseNumbers('   ').values).toEqual([]);
  });

  it('reports what is not a number, without dropping the rest', () => {
    const p = parseNumbers('1\nabc\n2\n3x\nNaN\nInfinity');
    expect(p.values).toEqual([1, 2]);
    expect(p.rejectedCount).toBe(4);
    expect(p.rejected).toEqual(['abc', '3x', 'NaN', 'Infinity']);
  });

  it('reads one number at a time', () => {
    expect(parseOne('12,5')).toBe(12.5);
    expect(parseOne('10')).toBe(10);
    expect(Number.isNaN(parseOne('ten'))).toBe(true);
  });

  it('reads two pasted columns, skipping a header and lines that are not pairs', () => {
    const p = parsePairs('observed\tsimulated\n10\t11\n20\t19,5\nbroken line\n30\t31');
    expect(p).toEqual({ observed: [10, 20, 30], simulated: [11, 19.5, 31], skipped: 1, header: true });
    expect(parsePairs('1;2\n3;4')).toMatchObject({ observed: [1, 3], simulated: [2, 4], header: false });
    expect(parsePairs('1,2\n3 4')).toMatchObject({ observed: [1, 3], simulated: [2, 4] });
    expect(parsePairs('12, 11\n15, 16\n9, 10')).toEqual({ observed: [12, 15, 9], simulated: [11, 16, 10], skipped: 0, header: false });
    expect(parsePairs('observed, simulated\n12,5, 11,4\n12,5 11,4')).toEqual({ observed: [12.5, 12.5], simulated: [11.4, 11.4], skipped: 0, header: true });
    expect(valuesText([1, 2.5])).toBe('1\n2.5');
  });
});

describe('check plan exports', () => {
  const plan = (): CheckPlan => {
    const d = blank();
    d.method = 'system-dynamics';
    addLibraryChecks(d, standardChecks('system-dynamics', 'verification').specific);
    addOwnCheck(d, 'validation', hostile, 'own-h');
    editCheck(d, 'own-h', { status: 'failed', evidence: '=1+1' });
    d.validation = { measure: 'Backlog', tolerancePct: 20, toleranceOn: 'pairs', observed: [30, 31], simulated: [28, 33] };
    d.calibration = { parameters: 'Arrival rate', tunedOn: 'Weeks 1–8', validatedOn: 'Weeks 9–12' };
    return d;
  };

  it('CSV: a header, one row per check grouped in order, formulas neutralised and quotes doubled', () => {
    const csv = checkPlanCsv(plan());
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('group,check,status,evidence');
    expect(lines).toHaveLength(1 + 4 + 1);
    expect(lines[1].startsWith('"Verification"')).toBe(true);
    expect(lines.at(-1)).toContain('"Validation"');
    expect(lines.at(-1)).toContain(`"'=1+1"`);
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('-2')).toBe(`"'-2"`);
  });

  it('Markdown: a heading, the counts, a table per group, the validation result and the calibration record', () => {
    const md = checkPlanMarkdownFile('My checks', plan(), '2026-11-21T09:00:00Z');
    expect(md.startsWith('# My checks\n')).toBe(true);
    expect(md).toContain('Exported 2026-11-21');
    expect(md).toContain('- **Method:** System dynamics');
    expect(md).toContain('| Check | Status | Evidence |');
    expect(md).toContain('**Validation result:**');
    expect(md).toContain('- **Data kept for validation:** Weeks 9–12');
    expect(md.split('\n').some((l) => l.startsWith('<script>'))).toBe(false);
  });

  it('the plan writes numbered lines into the project, and leaves an empty group to the project’s own text', () => {
    const doc = createProject({ now: '2026-11-21T09:00:00Z' });
    doc.passport.evaluation.calibration = 'Written by hand.';
    const d = plan();
    d.calibration = { parameters: '', tunedOn: '', validatedOn: '' };
    checkPlan.applyToProject(doc, d, 'inc-1');
    expect(doc.passport.evaluation.verification.split('\n')[0]).toMatch(/^1\. /);
    expect(doc.passport.evaluation.calibration).toBe('Written by hand.');
  });

  it('the card figure is safe for an empty, a full and a very long plan', () => {
    expect(checkPlan.figure(blank())).toBeNull();
    expect(isSafeSvg(checkPlan.figure(plan()))).toBe(true);
    const many = blank();
    addLibraryChecks(many, ALL_STANDARD_CHECKS);
    expect(isSafeSvg(checkPlan.figure(many))).toBe(true);
  });
});

describe('method-aware checks', () => {
  const groups = ['verification', 'validation', 'calibration'] as const;
  const texts = (m: Parameters<typeof standardChecks>[0], g: (typeof groups)[number]) => { const r = standardChecks(m, g); return [...r.specific, ...r.general].map((k) => k.text.toLowerCase()).join(' | '); };

  it('never offers a general check that the method’s profile leaves out', () => {
    for (const m of METHODS) for (const g of groups) {
      const offered = standardChecks(m.id, g).general.map((k) => k.id);
      for (const id of METHOD_PROFILES[m.id].skipGeneral) expect(offered, `${m.id} ${g}`).not.toContain(id);
    }
    expect(texts('pls-sem', 'verification')).not.toMatch(/units on every equation|same seed and confirm identical/);
    expect(texts('queueing-theory', 'verification')).not.toMatch(/seed/);
    expect(texts('system-dynamics', 'verification')).not.toMatch(/seed/);
    expect(texts('des', 'verification')).toMatch(/same seed/);
  });

  it('offers estimation checks, not tuning checks, in the third group of a model estimated from data', () => {
    for (const m of ['path-analysis', 'cb-sem', 'pls-sem', 'markov-chains'] as const) {
      expect(standardChecks(m, 'calibration').general, m).toEqual(ESTIMATION_CHECKS);
      expect(texts(m, 'calibration'), m).not.toMatch(/\btun(e|ed|ing)\b/);
    }
    expect(standardChecks('des', 'calibration').general.map((k) => k.id)).toEqual(['g-tuned-list', 'g-data-aside', 'g-other-fits']);
    for (const m of ['cb-sem', 'pls-sem', 'path-analysis'] as const) expect(texts(m, 'calibration'), m).toMatch(/converged/);
    expect(texts('pls-sem', 'calibration')).toMatch(/predict cases that were not used for estimation/);
    expect(texts('markov-chains', 'calibration')).toMatch(/counted transitions/);
  });

  it('PLS-SEM: verification of specification, data and settings; validation of both measurement modes and the structural model', () => {
    const ver = texts('pls-sem', 'verification');
    for (const w of ['intended construct', 'reflective or formative', 'missing values', 'reverse-code', 'straight-lining', 'weighting scheme', 'seed', 'another seed', 'planted values']) expect(ver, w).toContain(w);
    const val = standardChecks('pls-sem', 'validation').specific;
    expect([...new Set(val.map((k) => k.part))]).toEqual(['Reflective measurement', 'Formative measurement', 'Structural model']);
    const by = (part: string) => val.filter((k) => k.part === part).map((k) => k.text.toLowerCase()).join(' | ');
    for (const w of ['loading', 'composite reliability', 'average variance extracted', 'htmt']) expect(by('Reflective measurement'), w).toContain(w);
    for (const w of ['collinearity', 'weight']) expect(by('Formative measurement'), w).toContain(w);
    for (const w of ['collinearity', 'bootstrap interval', 'r²', 'effect size', 'held-out', 'benchmark', 'rival', 'non-linear', 'groups']) expect(by('Structural model'), w).toContain(w);
  });

  it('CB-SEM and path analysis keep their own checks, with global fit read from several indices', () => {
    expect(texts('cb-sem', 'validation')).toMatch(/global fit with several indices/);
    expect(texts('path-analysis', 'validation')).toMatch(/global fit with several indices/);
    expect(METHOD_CHECKS['cb-sem'].map((k) => k.id)).toEqual(expect.arrayContaining(['cb-identified', 'cb-impossible', 'cb-converged', 'cb-measurement', 'cb-rival']));
  });

  it('names no authors and gives no threshold as a law: a number is always “a common guide”', () => {
    for (const k of ALL_STANDARD_CHECKS) {
      expect(`${k.text} ${k.why}`, k.id).not.toMatch(/\b(Cronbach|Fornell|Larcker|Hair|Sarstedt|Ringle|Kline|Bentler|Bonett|Chin|Stone|Geisser|Henseler|Tucker|Lewis|Steiger)\b/);
      if (/\b0\.\d/.test(k.text)) expect(k.text, k.id).toMatch(/a common guide is/);
    }
  });
});

describe('checks that do not apply', () => {
  const plan = (): CheckPlan => {
    const d = blank();
    addOwnCheck(d, 'verification', 'Repeat a run with the same seed', 'own-seed');
    addOwnCheck(d, 'verification', 'Trace one entity', 'own-trace');
    addOwnCheck(d, 'validation', 'Compare with last year', 'own-last');
    editCheck(d, 'own-seed', { status: 'na', evidence: 'The formula has no random numbers.' });
    editCheck(d, 'own-trace', { status: 'passed' });
    return d;
  };

  it('are kept by the sanitizer and counted apart: never open, never failed', () => {
    const raw = JSON.parse(JSON.stringify(plan()));
    const warnings: string[] = [];
    expect(checkPlan.sanitize(raw, (m) => warnings.push(m))).toEqual(plan());
    expect(warnings).toEqual([]);
    const n = checkCounts(plan(), 'verification');
    expect(n).toEqual({ total: 2, planned: 0, done: 0, passed: 1, failed: 0, na: 1 });
    expect(countsText(n)).toBe('1 passed, 1 not applicable');
  });

  it('read “Not applicable: reason” in the project, “not applicable” in the report, and draw neutral in the card', () => {
    const d = plan();
    expect(checkLines(d, 'verification')[0]).toBe('1. Repeat a run with the same seed — Not applicable: The formula has no random numbers.');
    expect(checkLines(d, 'verification')[1]).toBe('2. Trace one entity — passed');
    editCheck(d, 'own-seed', { evidence: '' });
    expect(checkLines(d, 'verification')[0]).toBe('1. Repeat a run with the same seed — Not applicable');
    expect(checkPlan.markdown(d).join('\n')).toContain('| Repeat a run with the same seed | not applicable |');
    const svg = checkPlan.figure(d)!;
    expect(isSafeSvg(svg)).toBe(true);
    expect(svg).toContain('stroke-dasharray="2 2"');
    expect(checkPlan.summary(d)[0]).toBe('3 checks: 1 passed, 1 planned, 1 not applicable');
  });
});

describe('the third group follows the method', () => {
  it('estimation: named “Estimation”, with the note and the record read as estimated on / predicted on', () => {
    const d = blank();
    d.method = 'pls-sem';
    d.calibration = { parameters: 'Loadings and paths', tunedOn: 'Wave 1, 412 cases', validatedOn: '100 held-out cases' };
    addLibraryChecks(d, standardChecks('pls-sem', 'calibration').general);
    const w = calibrationWords('pls-sem');
    expect([w.tab, w.note]).toEqual(['Estimation', CALIBRATION_NOTE.estimation]);
    expect(groupLabel('pls-sem', 'calibration')).toBe('Estimation');
    const md = checkPlan.markdown(d).join('\n');
    for (const t of ['**Estimation:** what did we estimate, and on what?', '- **Parameters estimated:** Loadings and paths', '- **Data used for estimation:** Wave 1, 412 cases', '- **Cases kept for prediction:** 100 held-out cases', CALIBRATION_NOTE.estimation!]) expect(md).toContain(t);
    expect(md).not.toMatch(/Parameters tuned|used for tuning|kept for validation/);
    expect(checkLines(d, 'calibration').slice(-3)).toEqual(['Parameters estimated: Loadings and paths', 'Estimated on: Wave 1, 412 cases', 'Predicted on: 100 held-out cases']);
    expect(checkPlan.summary(d)).toContain('Verification 0 · Validation 0 · Estimation 3');
    d.calibration.validatedOn = 'wave 1, 412 cases';
    expect(checkPlan.markdown(d).join('\n')).toMatch(/Caution:\*\* estimation and prediction are described with the same data/);
  });

  it('parameters: the note with the usual record; tuning: unchanged', () => {
    const q = blank();
    q.method = 'queueing-theory';
    q.calibration = { parameters: 'Arrival rate', tunedOn: 'March records', validatedOn: 'April records' };
    const md = checkPlan.markdown(q).join('\n');
    expect(md).toContain(CALIBRATION_NOTE.parameters!);
    expect(md).toContain('- **Data used for tuning:** March records');
    expect(groupLabel('queueing-theory', 'calibration')).toBe('Calibration');
    expect(calibrationWords('des').note).toBeNull();
    expect(calibrationWords('').tab).toBe('Calibration');
  });
});


describe('review fix: check texts that hold for every method that offers them', () => {
  const text = (id: string) => ALL_STANDARD_CHECKS.find((k) => k.id === id)!;
  it('words that fit the method', () => {
    expect(text('g-held-out').text).toBe('Compare model output with data that was not used to set its parameters');
    expect(standardChecks('pls-sem', 'validation').general.map((k) => k.id)).not.toContain('g-held-out');
    expect(standardChecks('markov-chains', 'validation').general.map((k) => k.id)).toContain('g-held-out');
    expect(`${text('pa-fit').text} ${text('pa-fit').why}`).toMatch(/degrees of freedom[\s\S]*saturated model fits perfectly by construction/);
    expect(text('cb-identified').why).toMatch(/necessary, not sufficient/);
    expect(text('mk-long-run').why).toMatch(/irreducible, aperiodic/);
  });
});
