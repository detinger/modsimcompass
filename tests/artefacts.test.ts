import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { redirectFor } from '../src/app/redirects';
import { workedExample } from '../src/content/workedExample';
import { ID_PATTERN, LIMITS } from '../src/domain/artefacts/clean';
import { checkLines } from '../src/domain/artefacts/checkPlan';
import { describeModel, lawFields } from '../src/domain/artefacts/dataModel';
import { ARTEFACT_FILE_MAX_BYTES, artefactJson, createArtefact, parseArtefactJson } from '../src/domain/artefacts/file';
import { includeArtefact, inclusionOf, inclusionState, inclusionsFor, removeInclusion } from '../src/domain/artefacts/include';
import { KIND_ORDER, KINDS, isArtefactKind, kindDef } from '../src/domain/artefacts/kinds';
import {
  ARTEFACT_SCHEMA, ARTEFACT_SCHEMA_VERSION,
  type Artefact, type ArtefactData, type ArtefactKind, type CheckPlan, type Comparison, type ConceptModel, type DataModel, type MethodChoice,
} from '../src/domain/artefacts/types';
import { lawFor } from '../src/domain/distributions/laws';
import { RULE_VERSION, answersKey, emptyAnswers } from '../src/domain/methods/rules';
import { compassWarnings } from '../src/domain/passport/compass';
import { importProjectObject, parseProjectJson } from '../src/domain/passport/importer';
import { PASSPORT_SCHEMA_VERSION, createProject, type ProjectDoc } from '../src/domain/passport/schema';
import { UPGRADE_COPIES, upgradeProject } from '../src/domain/passport/upgrade';
import { markdownToHtml } from '../src/exports/html';
import { projectJson } from '../src/exports/projectFile';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';
import { DB_NAME, DB_VERSION, MemoryRepo, createRepo } from '../src/persistence/db';

const NOW = '2026-11-21T10:00:00.000Z';
const LATER = '2026-11-22T09:30:00.000Z';

// ── Valid samples, one per kind ──────────────────────────────────────────
const concept = (): ConceptModel => ({
  objectives: 'See how capacity changes the backlog.', assumptions: 'Unused capacity is lost.', simplifications: 'No priorities.',
  nodes: [
    { id: 'n1', type: 'actor', label: 'Head of the office', x: 10, y: 20, zone: 'inputs' },
    { id: 'n2', type: 'lever', label: 'Daily capacity', x: 120, y: 20, zone: 'inputs' },
    { id: 'n3', type: 'stock', label: 'Open requests', x: 240, y: 20, zone: 'content' },
    { id: 'n4', type: 'outcome', label: 'Average backlog', x: 360, y: 20, zone: 'outputs' },
    { id: 'n5', type: 'resource', label: 'Advisors', x: 240, y: 120, zone: 'content' },
    { id: 'n6', type: 'external', label: 'Other offices', x: 240, y: 220, zone: 'outside' },
    { id: 'n7', type: 'note', label: 'Check the term dates', x: 0, y: 300, zone: 'content' },
  ],
  edges: [
    { id: 'e1', from: 'n2', to: 'n3', kind: 'influence', sign: '-', label: '' },
    { id: 'e2', from: 'n3', to: 'n4', kind: 'information', sign: '', label: 'measured as' },
    { id: 'e3', from: 'n1', to: 'n2', kind: 'decides', sign: '', label: '' },
    { id: 'e4', from: 'n7', to: 'n3', kind: 'information', sign: '', label: 'about' },
  ],
});
const method = (): MethodChoice => ({
  answers: { ...emptyAnswers(), feedback: 'yes', time: 'dynamic', queues: 'simple' }, ruleVersion: RULE_VERSION, shortlist: ['system-dynamics', 'des'],
  primary: 'system-dynamics', alternative: 'des', justification: 'An aggregate that builds up over weeks.', alternativeJustification: 'Only if individual waits matter.',
});
const data = (): DataModel => ({
  name: 'Daily arrivals', unit: 'requests/day', family: 'gamma', params: [2, 3], origin: 'fitted', provenance: 'Ticket system, September.', uncertainty: 'Daily range 8 to 16',
  availability: 'have', plan: '', summary: { n: 30, mean: 12.1, sd: 2.4, min: 8, max: 16 },
  fit: { rank: 1, candidates: [{ family: 'gamma', aic: 140.2 }, { family: 'lognormal', aic: 141.9 }], ksD: 0.08 },
  generator: { seed: 'abc', n: 200 }, keepData: true, data: [8, 9, 12, 16],
});
const checks = (): CheckPlan => ({
  method: 'system-dynamics',
  checks: [
    { id: 'c1', group: 'verification', text: 'Conservation holds every day.', status: 'passed', evidence: 'Residual 0 in all runs.' },
    { id: 'c2', group: 'verification', text: 'Same seed, same result.', status: 'planned', evidence: '' },
    { id: 'c3', group: 'validation', text: 'Compare with held-out records.', status: 'failed', evidence: 'Mean off by 31%.' },
  ],
  validation: { measure: 'Mean end-of-day backlog', tolerancePct: 20, observed: [30, 31], simulated: [28, 33] },
  calibration: { parameters: 'Arrival rate', tunedOn: 'First 30 days', validatedOn: 'Next 30 days' },
});
const compare = (): Comparison => ({
  outcome: 'Average end-of-day backlog', unit: 'requests', direction: 'lower', baselineLabel: 'Capacity 10', alternativeLabel: 'Capacity 12',
  baseline: [30, 28, 33, 31], alternative: [6, 5, 8, 7], paired: true, minimumDifference: 5, targetHalfWidth: 1.5, origin: 'pasted', note: 'From the spreadsheet model.',
});
const SAMPLE: { [K in ArtefactKind]: () => ArtefactData[K] } = { 'concept-model': concept, 'method-choice': method, 'data-model': data, 'check-plan': checks, 'comparison': compare };

/** What a file would carry: plain JSON, free to be damaged. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (k: ArtefactKind): any => JSON.parse(JSON.stringify(SAMPLE[k]()));
const clean = (k: ArtefactKind, r: unknown) => { const warnings: string[] = []; return { out: kindDef(k).sanitize(r, (m) => warnings.push(m)) as never, warnings }; };
function artefact<K extends ArtefactKind>(kind: K, change: Partial<Artefact<K>> = {}): Artefact<K> {
  return { ...createArtefact(kind, { now: NOW, title: `My ${kind}` }), data: SAMPLE[kind](), revision: 3, ...change } as Artefact<K>;
}

describe('kinds', () => {
  it('match the table of the build spec', () => {
    const table = KIND_ORDER.map((k) => [k, KINDS[k].step, KINDS[k].many, KINDS[k].toolPath, KINDS[k].label]);
    expect(table).toEqual([
      ['concept-model', 'scope', false, '/toolbox/concept', 'Conceptual model'],
      ['method-choice', 'method', false, '/toolbox/method', 'Method choice'],
      ['data-model', 'inputs', true, '/toolbox/data', 'Data model'],
      ['check-plan', 'evaluation', false, '/toolbox/checks', 'Check plan'],
      ['comparison', 'experiment', true, '/toolbox/compare', 'Comparison'],
    ]);
    expect(isArtefactKind('constructor')).toBe(false);
    expect(isArtefactKind('comparison')).toBe(true);
  });
  for (const k of KIND_ORDER) {
    it(`${k}: a blank one is empty, survives its own sanitizer and reports itself`, () => {
      const def = kindDef(k);
      expect(def.isEmpty(def.empty())).toBe(true);
      expect(def.isEmpty(SAMPLE[k]() as never)).toBe(false);
      const { out, warnings } = clean(k, JSON.parse(JSON.stringify(def.empty())));
      expect(out).toEqual(def.empty());
      expect(warnings).toEqual([]);
      expect(def.figure(def.empty())).toBeNull();
      for (const d of [def.empty(), SAMPLE[k]()]) {
        const lines = def.summary(d as never);
        expect(lines.length).toBeGreaterThanOrEqual(1);
        expect(lines.length).toBeLessThanOrEqual(5);
        const md = def.markdown(d as never);
        expect(md.some((l) => /^#/.test(l))).toBe(false); // no headings: the report owns them
        expect(() => markdownToHtml(md.join('\n'))).not.toThrow();
      }
    });
    it(`${k}: a valid one round-trips unchanged, without warnings`, () => {
      const { out, warnings } = clean(k, raw(k));
      expect(out).toEqual(SAMPLE[k]());
      expect(warnings).toEqual([]);
      expect(out).not.toBe(SAMPLE[k]);
    });
    it(`${k}: anything that is not an object is refused`, () => {
      for (const bad of [null, undefined, 'text', 7, [], [SAMPLE[k]()], true]) expect(clean(k, bad).out, String(bad)).toBeNull();
    });
    it(`${k}: unknown keys never travel, at any level`, () => {
      const r = raw(k);
      r.extra = '<script>alert(1)</script>'; r.constructor = { polluted: true };
      const text = JSON.stringify(r).replace('{', '{"__proto__":{"polluted":true},');
      const { out } = clean(k, JSON.parse(text));
      expect(out).toEqual(SAMPLE[k]());
      expect(Object.keys(out as object).sort()).toEqual(Object.keys(SAMPLE[k]()).sort());
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
    it(`${k}: user text cannot create Markdown structure`, () => {
      const r = raw(k);
      const hostile = '| a | b |\n# Heading\n- item\n<script>alert(1)</script>';
      for (const key of Object.keys(r)) if (typeof r[key] === 'string' && !['family', 'origin', 'direction', 'method', 'primary', 'alternative', 'availability', 'ruleVersion'].includes(key)) r[key] = hostile;
      if (k === 'concept-model') r.nodes[0].label = hostile;
      if (k === 'check-plan') { r.checks[0].text = hostile; r.checks[0].evidence = hostile; }
      const { out } = clean(k, r);
      const md = kindDef(k).markdown(out);
      expect(md.some((l) => /^#/.test(l))).toBe(false);
      const html = markdownToHtml(md.join('\n'));
      expect(html).not.toMatch(/<(script|h1|h2|h3)\b/i);
      expect(html).toContain('&lt;script&gt;');
    });
  }
});

describe('conceptual model: sanitize', () => {
  const k = 'concept-model';
  it('refuses a model whose lists are missing or not lists', () => {
    for (const change of [(r: ReturnType<typeof raw>) => { r.nodes = 'none'; }, (r: ReturnType<typeof raw>) => { delete r.edges; }, (r: ReturnType<typeof raw>) => { r.nodes = { 0: {} }; }, (r: ReturnType<typeof raw>) => { r.edges = null; }]) {
      const r = raw(k); change(r);
      expect(clean(k, r).out).toBeNull();
    }
  });
  it('leaves out elements with an unknown type or a bad id, and the connections that used them', () => {
    const r = raw(k);
    r.nodes[1].type = 'weapon';               // n2
    r.nodes[4].id = '<img src=x onerror=1>';  // n5
    r.nodes.push({ id: 'n1', type: 'entity', label: 'duplicate id', x: 0, y: 0, zone: 'content' });
    r.nodes.push('not a node', null, { id: '_bad', type: 'entity' }, { id: 'x'.repeat(65), type: 'entity' });
    const { out, warnings } = clean(k, r) as { out: ConceptModel; warnings: string[] };
    expect(out.nodes.map((n) => n.id)).toEqual(['n1', 'n3', 'n4', 'n6', 'n7']);
    expect(out.nodes[0].label).toBe('Head of the office');
    expect(out.edges.map((e) => e.id)).toEqual(['e2', 'e4']); // e1 and e3 touched n2
    expect(warnings.length).toBeGreaterThanOrEqual(7);
    for (const n of out.nodes) expect(n.id).toMatch(ID_PATTERN);
  });
  it('leaves out connections with an unknown kind, a repeated id or a missing end', () => {
    const r = raw(k);
    r.edges[0].kind = 'teleports';
    r.edges[1].to = 'nowhere';
    r.edges.push({ id: 'e3', from: 'n1', to: 'n3', kind: 'flow', sign: '', label: 'repeated id' }, { id: 'e9', from: 'n1', kind: 'flow' }, 5);
    const { out } = clean(k, r) as { out: ConceptModel };
    expect(out.edges.map((e) => e.id)).toEqual(['e3', 'e4']);
    expect(out.edges[0].label).toBe('');
  });
  it('resets a sign that is not + or −, and any sign on a connection that is not an influence', () => {
    const r = raw(k);
    r.edges[0].sign = '++';
    r.edges[1].sign = '+';
    const { out } = clean(k, r) as { out: ConceptModel };
    expect(out.edges[0].sign).toBe('');
    expect(out.edges[1]).toMatchObject({ kind: 'information', sign: '' });
  });
  it('resets a position that is not a finite number and a zone that does not exist', () => {
    const r = raw(k);
    r.nodes[0].x = '10'; r.nodes[0].y = null; r.nodes[1].x = 1e400; r.nodes[2].zone = 'basement'; delete r.nodes[3].zone;
    const { out } = clean(k, r) as { out: ConceptModel };
    expect(out.nodes[0]).toMatchObject({ x: 0, y: 0 });
    expect(out.nodes[1].x).toBe(0);
    expect(out.nodes[2].zone).toBe('content');
    expect(out.nodes[3].zone).toBe('content');
  });
  it('keeps text as text and within the limits', () => {
    const r = raw(k);
    r.objectives = 'x'.repeat(LIMITS.text + 50); r.assumptions = 42; r.simplifications = { a: 1 };
    r.nodes[0].label = 'y'.repeat(900); r.nodes[1].label = ['a']; r.edges[1].label = 'z'.repeat(900);
    r.nodes[2].extra = 'dropped';
    const { out, warnings } = clean(k, r) as { out: ConceptModel; warnings: string[] };
    expect(out.objectives).toHaveLength(LIMITS.text);
    expect(out.assumptions).toBe('');
    expect(out.simplifications).toBe('');
    expect(out.nodes[0].label).toHaveLength(500);
    expect(out.nodes[1].label).toBe('');
    expect(out.edges[1].label).toHaveLength(200);
    expect(Object.keys(out.nodes[2])).toEqual(['id', 'type', 'label', 'x', 'y', 'zone']);
    expect(warnings.join(' ')).toMatch(/shortened/);
  });
  it('cuts a list that is longer than the limit', () => {
    const r = raw(k);
    r.nodes = Array.from({ length: LIMITS.list + 40 }, (_, i) => ({ id: `n${i}`, type: 'entity', label: '', x: i, y: 0, zone: 'content' }));
    r.edges = [];
    const { out, warnings } = clean(k, r) as { out: ConceptModel; warnings: string[] };
    expect(out.nodes).toHaveLength(LIMITS.list);
    expect(warnings.join(' ')).toMatch(/list shortened to 2000/);
  });
});

describe('method choice: sanitize', () => {
  const k = 'method-choice';
  it('refuses a choice without an answers object or a shortlist', () => {
    for (const change of [(r: ReturnType<typeof raw>) => { r.answers = 'yes'; }, (r: ReturnType<typeof raw>) => { delete r.answers; }, (r: ReturnType<typeof raw>) => { r.answers = []; }, (r: ReturnType<typeof raw>) => { r.shortlist = 'des'; }, (r: ReturnType<typeof raw>) => { delete r.shortlist; }]) {
      const r = raw(k); change(r);
      expect(clean(k, r).out).toBeNull();
    }
  });
  it('puts an answer that is not an option of its question back to “not sure”', () => {
    const r = raw(k);
    r.answers.feedback = 'maybe'; r.answers.claim = 'yes'; r.answers.queues = 3; r.answers.invented = 'yes'; delete r.answers.time;
    const { out, warnings } = clean(k, r) as { out: MethodChoice; warnings: string[] };
    expect(out.answers).toEqual({ ...emptyAnswers(), queues: 'unsure' });
    expect(Object.keys(out.answers).sort()).toEqual(Object.keys(emptyAnswers()).sort());
    expect(warnings).toHaveLength(3);
  });
  it('removes methods that are only inherited object keys, unknown or repeated', () => {
    const r = raw(k);
    r.primary = 'constructor'; r.alternative = 'toString';
    r.shortlist = ['__proto__', 'hasOwnProperty', 'des', 'des', 'abm', 7, null];
    const { out } = clean(k, r) as { out: MethodChoice };
    expect(out.primary).toBe('');
    expect(out.alternative).toBe('');
    expect(out.shortlist).toEqual(['des', 'abm']);
    expect(() => KINDS[k].markdown(out)).not.toThrow();
  });
  it('keeps text as text, within the limits, and restores a missing rule version', () => {
    const r = raw(k);
    r.justification = 'j'.repeat(LIMITS.text + 1); r.alternativeJustification = 12; r.ruleVersion = { v: 1 };
    const { out } = clean(k, r) as { out: MethodChoice };
    expect(out.justification).toHaveLength(LIMITS.text);
    expect(out.alternativeJustification).toBe('');
    expect(out.ruleVersion).toBe(RULE_VERSION);
  });
  it('accepts an empty method and every option of every question', () => {
    const r = raw(k);
    r.primary = ''; r.alternative = ''; r.answers.evidence = 'event-log'; r.answers.granularity = 'individual';
    const { out, warnings } = clean(k, r) as { out: MethodChoice; warnings: string[] };
    expect(out).toMatchObject({ primary: '', alternative: '' });
    expect(out.answers.evidence).toBe('event-log');
    expect(warnings).toEqual([]);
  });
});

describe('data model: sanitize', () => {
  const k = 'data-model';
  it('refuses an unknown family, parameters that do not fit it, and missing structures', () => {
    const cases: ((r: ReturnType<typeof raw>) => void)[] = [
      (r) => { r.family = 'toString'; }, (r) => { r.family = 'hasOwnProperty'; }, (r) => { r.family = 5; }, (r) => { delete r.family; },
      (r) => { r.params = [2]; }, (r) => { r.params = [2, 3, 4]; }, (r) => { r.params = [2, '3']; }, (r) => { r.params = [2, null]; }, (r) => { r.params = '2,3'; },
      (r) => { delete r.generator; }, (r) => { r.generator = 'seed'; }, (r) => { r.data = 'none'; }, (r) => { r.data = [1, 'x']; }, (r) => { delete r.data; },
    ];
    for (const change of cases) { const r = raw(k); change(r); expect(clean(k, r).out, change.toString()).toBeNull(); }
  });
  it('a list family takes 1 to 256 values; every other family exactly its own number', () => {
    const r = raw(k);
    r.family = 'categorical'; r.params = [0.2, 0.3, 0.5];
    expect((clean(k, r).out as DataModel).params).toEqual([0.2, 0.3, 0.5]);
    r.params = [];
    expect(clean(k, r).out).toBeNull();
    r.family = 'empirical'; r.params = Array.from({ length: 256 }, (_, i) => i);
    expect((clean(k, r).out as DataModel).params).toHaveLength(256);
    r.family = 'normal'; r.params = [0, 1, 2];
    expect(clean(k, r).out).toBeNull();
  });
  it('raw data stays out unless the user asked to keep it', () => {
    const r = raw(k);
    r.keepData = false;
    const off = clean(k, r) as { out: DataModel; warnings: string[] };
    expect(off.out.data).toEqual([]);
    expect(off.warnings.join(' ')).toMatch(/not marked to be kept/);
    r.keepData = 'yes';
    expect((clean(k, r).out as DataModel)).toMatchObject({ keepData: false, data: [] });
    r.keepData = true; r.data = Array.from({ length: LIMITS.numbers + 5 }, (_, i) => i);
    expect((clean(k, r).out as DataModel).data).toHaveLength(LIMITS.numbers);
  });
  it('drops a summary or a fit record that is not exactly the expected shape', () => {
    for (const bad of ['text', { n: 3 }, { n: '30', mean: 1, sd: 1, min: 0, max: 2 }, { n: 1.5, mean: 1, sd: 1, min: 0, max: 2 }, [1, 2]]) {
      const r = raw(k); r.summary = bad;
      expect((clean(k, r).out as DataModel).summary, JSON.stringify(bad)).toBeNull();
    }
    const fits: unknown[] = ['best', { rank: 0, candidates: [], ksD: null }, { rank: 1, candidates: [{ family: 'constructor', aic: 1 }], ksD: null },
      { rank: 1, candidates: [{ family: 'gamma', aic: '140' }], ksD: null }, { rank: 1, candidates: 'gamma', ksD: null }, { rank: 1, candidates: [], ksD: 'small' }];
    for (const bad of fits) {
      const r = raw(k); r.fit = bad;
      const res = clean(k, r) as { out: DataModel; warnings: string[] };
      expect(res.out.fit, JSON.stringify(bad)).toBeNull();
      expect(res.warnings.join(' ')).toMatch(/fit: not a fit record/);
    }
    const r = raw(k); r.summary = null; r.fit = null;
    expect(clean(k, r).warnings).toEqual([]);
  });
  it('resets enumerations and the sample size, and drops unknown keys inside', () => {
    const r = raw(k);
    r.origin = 'guessed'; r.availability = 'somewhere'; r.generator = { seed: 99, n: 1e9, extra: 1 }; r.summary.extra = 'x'; r.fit.candidates[0].extra = 'x';
    const { out } = clean(k, r) as { out: DataModel };
    expect(out).toMatchObject({ origin: 'manual', availability: '', generator: { seed: '', n: 100 } });
    expect(Object.keys(out.generator)).toEqual(['seed', 'n']);
    expect(Object.keys(out.summary!)).toEqual(['n', 'mean', 'sd', 'min', 'max']);
    expect(Object.keys(out.fit!.candidates[0])).toEqual(['family', 'aic']);
  });
  it('keeps names and long text within their limits', () => {
    const r = raw(k);
    r.name = 'n'.repeat(999); r.unit = 'u'.repeat(999); r.provenance = 'p'.repeat(LIMITS.text + 9); r.plan = 3;
    const { out } = clean(k, r) as { out: DataModel };
    expect([out.name.length, out.unit.length, out.provenance.length, out.plan]).toEqual([200, 200, LIMITS.text, '']);
  });
  it('describes the model in the words of the distribution library', () => {
    expect(describeModel(data())).toBe('Gamma(shape 2, scale 3)');
    expect(lawFields('categorical', [0.5, 0.5])).toEqual(['0.5, 0.5']);
    expect(() => lawFor('categorical', lawFields('categorical', [0.5, 0.5]))).not.toThrow();
    expect(describeModel({ family: 'empirical', params: Array.from({ length: 40 }, (_, i) => i) })).toBe('Empirical(40 equally weighted observations)');
  });
});

describe('check plan: sanitize', () => {
  const k = 'check-plan';
  it('refuses a plan whose structures are missing or of the wrong type', () => {
    const cases: ((r: ReturnType<typeof raw>) => void)[] = [
      (r) => { r.checks = {}; }, (r) => { delete r.checks; }, (r) => { r.validation = []; }, (r) => { delete r.validation; }, (r) => { r.calibration = 'none'; },
      (r) => { r.validation.observed = 'thirty'; }, (r) => { r.validation.simulated = [1, '2']; }, (r) => { delete r.validation.observed; },
    ];
    for (const change of cases) { const r = raw(k); change(r); expect(clean(k, r).out, change.toString()).toBeNull(); }
  });
  it('leaves out checks with an unknown group or status, a bad id or a repeated id', () => {
    const r = raw(k);
    r.checks[0].group = 'vibes';
    r.checks[1].status = 'almost';
    r.checks.push({ id: 'c3', group: 'validation', text: 'repeated id', status: 'done', evidence: '' }, { id: '', group: 'validation', text: 'no id', status: 'done', evidence: '' }, 'check', null);
    const { out, warnings } = clean(k, r) as { out: CheckPlan; warnings: string[] };
    expect(out.checks.map((c) => c.id)).toEqual(['c3']);
    expect(out.checks[0].text).toBe('Compare with held-out records.');
    expect(warnings).toHaveLength(6);
  });
  it('removes an unknown method and a tolerance that is not a number of zero or more', () => {
    const r = raw(k);
    r.method = 'constructor'; r.validation.tolerancePct = -5;
    let { out } = clean(k, r) as { out: CheckPlan };
    expect(out.method).toBe('');
    expect(out.validation.tolerancePct).toBeNull();
    r.validation.tolerancePct = '20';
    ({ out } = clean(k, r) as { out: CheckPlan });
    expect(out.validation.tolerancePct).toBeNull();
    r.validation.tolerancePct = 0; r.method = '';
    ({ out } = clean(k, r) as { out: CheckPlan });
    expect(out).toMatchObject({ method: '', validation: { tolerancePct: 0 } });
  });
  it('keeps text as text and drops unknown keys inside', () => {
    const r = raw(k);
    r.checks[0].text = 't'.repeat(LIMITS.text + 3); r.checks[0].evidence = 9; r.checks[0].extra = 1;
    r.validation.measure = ['a']; r.validation.extra = 1; r.calibration.parameters = null; r.calibration.extra = 1;
    const { out } = clean(k, r) as { out: CheckPlan };
    expect(out.checks[0].text).toHaveLength(LIMITS.text);
    expect(out.checks[0].evidence).toBe('');
    expect(Object.keys(out.checks[0])).toEqual(['id', 'group', 'text', 'status', 'evidence']);
    expect(out.validation.measure).toBe('');
    expect(Object.keys(out.validation)).toEqual(['measure', 'tolerancePct', 'observed', 'simulated']);
    expect(Object.keys(out.calibration)).toEqual(['parameters', 'tunedOn', 'validatedOn']);
  });
  it('cuts lists that are longer than the limits', () => {
    const r = raw(k);
    r.checks = Array.from({ length: LIMITS.list + 1 }, (_, i) => ({ id: `c${i}`, group: 'verification', text: 'x', status: 'planned', evidence: '' }));
    r.validation.observed = Array.from({ length: LIMITS.numbers + 1 }, () => 1);
    const { out } = clean(k, r) as { out: CheckPlan };
    expect(out.checks).toHaveLength(LIMITS.list);
    expect(out.validation.observed).toHaveLength(LIMITS.numbers);
  });
});

describe('comparison: sanitize', () => {
  const k = 'comparison';
  it('refuses results that are not two lists of finite numbers', () => {
    const cases: ((r: ReturnType<typeof raw>) => void)[] = [
      (r) => { r.baseline = '30, 28'; }, (r) => { delete r.alternative; }, (r) => { r.baseline[1] = '28'; }, (r) => { r.alternative[0] = null; },
      (r) => { r.baseline = [[30]]; }, (r) => { r.alternative = { 0: 6 }; }, (r) => { r.baseline[0] = '=1+1'; },
    ];
    for (const change of cases) { const r = raw(k); change(r); expect(clean(k, r).out, change.toString()).toBeNull(); }
    const withInfinity = { ...compare(), baseline: [1, Infinity] };
    expect(clean(k, withInfinity).out).toBeNull();
    expect(clean(k, { ...compare(), alternative: [NaN, 2, 3, 4] }).out).toBeNull();
  });
  it('never calls results paired when they cannot be', () => {
    const r = raw(k);
    r.alternative.pop();
    let res = clean(k, r) as { out: Comparison; warnings: string[] };
    expect(res.out.paired).toBe(false);
    expect(res.warnings.join(' ')).toMatch(/differ in length/);
    const r2 = raw(k); r2.paired = 'true';
    res = clean(k, r2) as { out: Comparison; warnings: string[] };
    expect(res.out.paired).toBe(false);
    const r3 = raw(k); delete r3.paired;
    expect((clean(k, r3).out as Comparison).paired).toBe(false);
  });
  it('resets enumerations and numbers that make no sense', () => {
    const r = raw(k);
    r.direction = 'sideways'; r.origin = 'measured'; r.targetHalfWidth = 0; r.minimumDifference = '5';
    const { out } = clean(k, r) as { out: Comparison };
    expect(out).toMatchObject({ direction: 'lower', origin: 'pasted', targetHalfWidth: null, minimumDifference: null });
    r.targetHalfWidth = -1;
    expect((clean(k, r).out as Comparison).targetHalfWidth).toBeNull();
  });
  it('keeps text as text, within the limits, and cuts very long lists', () => {
    const r = raw(k);
    r.outcome = 'o'.repeat(900); r.baselineLabel = 'b'.repeat(900); r.note = 'n'.repeat(LIMITS.text + 1); r.unit = 5; r.alternativeLabel = null;
    r.baseline = Array.from({ length: LIMITS.numbers + 7 }, () => 1); r.alternative = Array.from({ length: LIMITS.numbers + 7 }, () => 2);
    const { out } = clean(k, r) as { out: Comparison };
    expect([out.outcome.length, out.baselineLabel.length, out.note.length, out.unit, out.alternativeLabel]).toEqual([500, 200, LIMITS.text, '', '']);
    expect([out.baseline.length, out.alternative.length, out.paired]).toEqual([LIMITS.numbers, LIMITS.numbers, true]);
  });
  it('reports a paired interval only for paired results', () => {
    const paired = KINDS[k].markdown(compare()).join('\n');
    expect(paired).toMatch(/Paired difference \(alternative − baseline\): mean -24; approximate 95% t interval -25\.3 to -22\.7 \(n = 4\)/);
    const loose = KINDS[k].markdown({ ...compare(), paired: false }).join('\n');
    expect(loose).toMatch(/not paired, so no paired interval is given/);
    expect(loose).not.toMatch(/t interval/);
  });
});

describe('artefact files', () => {
  it('a new artefact is blank, has revision 0 and a safe id', () => {
    for (const k of KIND_ORDER) {
      const a = createArtefact(k, { now: NOW });
      expect(a).toMatchObject({ schema: ARTEFACT_SCHEMA, schemaVersion: ARTEFACT_SCHEMA_VERSION, kind: k, revision: 0, createdAt: NOW, updatedAt: NOW });
      expect(a.id).toMatch(ID_PATTERN);
      expect(a.title).toBe(`Untitled ${KINDS[k].label.toLowerCase()}`);
      expect(a.data).toEqual(KINDS[k].empty());
    }
    expect(createArtefact('comparison', { title: 'Mine' }).title).toBe('Mine');
    expect(createArtefact('comparison').id).not.toBe(createArtefact('comparison').id);
  });
  it('every kind round-trips through its file, as a new artefact with its own id', () => {
    for (const k of KIND_ORDER) {
      const a = artefact(k);
      const res = parseArtefactJson(artefactJson(a), { now: LATER });
      if (!res.ok) throw new Error(res.error);
      expect(res.warnings).toEqual([]);
      expect(res.artefact.id).not.toBe(a.id);
      expect(res.artefact.id).toMatch(ID_PATTERN);
      expect(res.artefact).toMatchObject({ kind: k, title: a.title, revision: 1, createdAt: NOW, updatedAt: LATER, schemaVersion: ARTEFACT_SCHEMA_VERSION });
      expect(res.artefact.data).toEqual(a.data);
    }
  });
  it('the file names the app and holds no raw data that was not meant to be kept', () => {
    const a = artefact('data-model', { data: { ...data(), keepData: false } });
    const file = JSON.parse(artefactJson(a));
    expect(file.exportedBy.app).toBe('ModSim Essentials');
    expect(file.data.data).toEqual([]);
    expect(a.data.data).toEqual([8, 9, 12, 16]); // the artefact in memory is untouched
    expect(JSON.parse(artefactJson(artefact('data-model'))).data.data).toEqual([8, 9, 12, 16]);
  });
  it('refuses what is not an artefact file, and says why', () => {
    const good = JSON.parse(artefactJson(artefact('comparison')));
    const fail = (text: string) => { const r = parseArtefactJson(text); return r.ok ? 'imported' : r.error; };
    expect(fail('{ not json')).toMatch(/not valid JSON/);
    expect(fail('')).toMatch(/not valid JSON/);
    expect(fail('[1,2]')).toMatch(/does not contain an artefact/);
    expect(fail('"text"')).toMatch(/does not contain an artefact/);
    expect(fail(JSON.stringify({ ...good, schema: 'something/else' }))).toMatch(/not a ModSim Essentials artefact file/);
    expect(fail(JSON.stringify({ ...good, schema: undefined }))).toMatch(/not a ModSim Essentials artefact file/);
    expect(fail(projectJson(createProject()))).toMatch(/project file, not an artefact file/);
    expect(fail(JSON.stringify({ ...good, schemaVersion: 2 }))).toMatch(/newer schema \(version 2\); this app supports version 1/);
    for (const bad of [0, 1.5, '1', null, -1]) expect(fail(JSON.stringify({ ...good, schemaVersion: bad })), String(bad)).toMatch(/invalid schema version/);
    for (const bad of ['constructor', 'sandbox', 7, undefined]) expect(fail(JSON.stringify({ ...good, kind: bad })), String(bad)).toMatch(/does not know/);
    expect(fail(JSON.stringify({ ...good, data: { ...good.data, baseline: 'x' } }))).toMatch(/comparison in this file is not in a recognised format/);
    expect(fail(JSON.stringify({ ...good, data: undefined }))).toMatch(/not in a recognised format/);
    expect(fail(`${' '.repeat(ARTEFACT_FILE_MAX_BYTES)}{}`)).toMatch(/larger than 5 MB/);
  });
  it('cleans the envelope: title, dates, revision and unknown fields', () => {
    const good = JSON.parse(artefactJson(artefact('check-plan')));
    const res = parseArtefactJson(JSON.stringify({ ...good, title: 't'.repeat(900), createdAt: '<script>', updatedAt: 'yesterday', revision: 'many', id: '../../etc', extra: { a: 1 } }), { now: LATER });
    if (!res.ok) throw new Error(res.error);
    expect(res.artefact.title).toHaveLength(LIMITS.title);
    expect(res.artefact).toMatchObject({ createdAt: LATER, updatedAt: LATER, revision: 1 });
    expect(res.artefact.id).toMatch(/^art-/);
    expect(Object.keys(res.artefact).sort()).toEqual(['createdAt', 'data', 'id', 'kind', 'revision', 'schema', 'schemaVersion', 'title', 'updatedAt']);
    const untitled = parseArtefactJson(JSON.stringify({ ...good, title: 5 }));
    expect(untitled.ok && untitled.artefact.title).toBe('Untitled check plan');
    expect(untitled.ok && untitled.warnings.length).toBe(1);
  });
  it('passes on the warnings of the kind sanitizer', () => {
    const good = JSON.parse(artefactJson(artefact('concept-model')));
    good.data.nodes[0].type = 'weapon';
    const res = parseArtefactJson(JSON.stringify(good));
    expect(res.ok && res.artefact.kind === 'concept-model' && res.artefact.data.nodes).toHaveLength(6);
    expect(res.ok && res.warnings.join(' ')).toMatch(/nodes\[0\]: not a valid element/);
  });
});

describe('adding an artefact to a project', () => {
  const project = () => createProject({ title: 'P', now: NOW });

  it('conceptual model: writes the sketch with the three earlier element types, and the notes when empty', () => {
    const doc = project();
    const a = artefact('concept-model');
    const { inclusionId, replaced } = includeArtefact(doc, a, LATER);
    expect(replaced).toBeNull();
    expect(doc.artefacts).toHaveLength(1);
    expect(doc.artefacts[0]).toMatchObject({ id: inclusionId, sourceId: a.id, sourceRevision: 3, kind: 'concept-model', title: a.title, addedAt: LATER });
    expect(doc.artefacts[0].data).toEqual(a.data);
    expect(doc.artefacts[0].data).not.toBe(a.data);
    const rep = doc.passport.representation;
    expect(rep.nodes.map((n) => [n.id, n.type])).toEqual([['n1', 'stakeholder'], ['n2', 'variable'], ['n3', 'variable'], ['n4', 'variable'], ['n5', 'entity'], ['n6', 'entity']]);
    expect(rep.nodes[1]).toEqual({ id: 'n2', type: 'variable', label: 'Daily capacity', x: 120, y: 20 });
    // The note is not an element, so the connection that starts at it is not a relation.
    expect(rep.relations).toEqual([
      { id: 'e1', from: 'n2', to: 'n3', label: 'influence −', directed: true },
      { id: 'e2', from: 'n3', to: 'n4', label: 'measured as', directed: true },
      { id: 'e3', from: 'n1', to: 'n2', label: 'decides', directed: true },
    ]);
    expect(rep.notes).toBe('Objectives: See how capacity changes the backlog.\nAssumptions: Unused capacity is lost.\nSimplifications: No priorities.');
    expect(compassWarnings(doc).some((w) => w.id === 'sketch' || w.id === 'relation-label')).toBe(false);
  });
  it('conceptual model: notes written by hand are kept', () => {
    const doc = project();
    doc.passport.representation.notes = 'My own notes';
    includeArtefact(doc, artefact('concept-model'), LATER);
    expect(doc.passport.representation.notes).toBe('My own notes');
  });
  it('a kind a project holds once: another artefact replaces the copy', () => {
    const doc = project();
    const first = artefact('concept-model'), second = artefact('concept-model', { title: 'Second', data: { ...concept(), nodes: concept().nodes.slice(0, 2), edges: [] } });
    const a = includeArtefact(doc, first, NOW);
    const b = includeArtefact(doc, second, LATER);
    expect(doc.artefacts).toHaveLength(1);
    expect(b.replaced).toMatchObject({ id: a.inclusionId, sourceId: first.id });
    expect(b.inclusionId).not.toBe(a.inclusionId);
    expect(doc.artefacts[0]).toMatchObject({ sourceId: second.id, title: 'Second' });
    expect(doc.passport.representation.nodes).toHaveLength(2);
    expect(doc.passport.representation.relations).toEqual([]);
  });
  it('the same artefact again refreshes its copy in place', () => {
    const doc = project();
    const a = artefact('method-choice');
    const first = includeArtefact(doc, a, NOW);
    includeArtefact(doc, artefact('comparison'), NOW);
    const edited = { ...a, revision: 9, title: 'Renamed', data: { ...a.data, primary: 'des' as const, alternative: 'system-dynamics' as const } };
    const second = includeArtefact(doc, edited, LATER);
    expect(second.inclusionId).toBe(first.inclusionId);
    expect(second.replaced).toMatchObject({ id: first.inclusionId, sourceRevision: 3 });
    expect(doc.artefacts.map((i) => i.kind)).toEqual(['method-choice', 'comparison']); // same place in the list
    expect(doc.artefacts[0]).toMatchObject({ sourceRevision: 9, title: 'Renamed', addedAt: LATER });
    expect(doc.passport.representation.primaryMethod).toBe('des');
  });
  it('method choice: writes the decision and the chooser record', () => {
    const doc = project();
    const a = artefact('method-choice');
    includeArtefact(doc, a, LATER);
    expect(doc.passport.representation).toMatchObject({
      primaryMethod: 'system-dynamics', alternativeMethod: 'des', justification: 'An aggregate that builds up over weeks.', alternativeJustification: 'Only if individual waits matter.',
    });
    expect(doc.methods).toEqual({ ruleVersion: RULE_VERSION, answers: a.data.answers, answersKey: answersKey(a.data.answers), shortlist: ['system-dynamics', 'des'], decidedAt: LATER });
    expect(doc.methods.answers).not.toBe(a.data.answers);
    const ids = compassWarnings(doc).map((w) => w.id);
    for (const id of ['primary', 'primary-why', 'alternative', 'alt-why', 'advice-outdated']) expect(ids, id).not.toContain(id);
  });
  it('data model: one input row per copy, owned by it', () => {
    const doc = project();
    doc.passport.inputs.push({ id: 'in-manual', name: 'Typed by hand', value: '5', unit: 'x', sourceType: 'expert', provenance: '', uncertainty: '' });
    const fitted = artefact('data-model');
    const described = artefact('data-model', { data: { ...data(), name: 'Service time', family: 'exponential', params: [0.5], origin: 'described', availability: 'obtainable', plan: 'Ask the office by Friday.', keepData: false } });
    const a = includeArtefact(doc, fitted, NOW), b = includeArtefact(doc, described, NOW);
    expect(doc.artefacts.map((i) => i.kind)).toEqual(['data-model', 'data-model']);
    expect(doc.passport.inputs).toHaveLength(3);
    const [, rowA, rowB] = doc.passport.inputs;
    expect(rowA).toEqual({
      id: rowA.id, inclusion: a.inclusionId, name: 'Daily arrivals', value: 'Gamma(shape 2, scale 3)', unit: 'requests/day', sourceType: 'observed',
      provenance: 'Ticket system, September.', uncertainty: 'Daily range 8 to 16', availability: 'have',
    });
    expect(rowB).toMatchObject({ inclusion: b.inclusionId, name: 'Service time', value: 'Exponential(rate per unit 0.5)', sourceType: 'assumed', availability: 'obtainable', plan: 'Ask the office by Friday.' });
    expect(rowA.id).not.toBe(rowB.id);
    // Raw data travels into the project only when it was meant to be kept.
    expect((doc.artefacts[0].data as DataModel).data).toEqual([8, 9, 12, 16]);
    expect((doc.artefacts[1].data as DataModel).data).toEqual([]);
  });
  it('data model: an update changes its own row, and removing the copy removes only that row', () => {
    const doc = project();
    doc.passport.inputs.push({ id: 'in-manual', name: 'Typed by hand', value: '5', unit: 'x', sourceType: 'expert', provenance: '', uncertainty: '' });
    const a = artefact('data-model'), other = artefact('data-model', { data: { ...data(), name: 'Other' } });
    const first = includeArtefact(doc, a, NOW);
    includeArtefact(doc, other, NOW);
    const rowId = doc.passport.inputs[1].id;
    includeArtefact(doc, { ...a, revision: 4, data: { ...a.data, name: 'Arrivals per day', family: 'normal', params: [12, 2], availability: '', origin: 'manual' } }, LATER);
    expect(doc.passport.inputs).toHaveLength(3);
    expect(doc.passport.inputs[1]).toMatchObject({ id: rowId, inclusion: first.inclusionId, name: 'Arrivals per day', value: 'Normal(mean 12, standard deviation 2)', sourceType: 'assumed' });
    expect('availability' in doc.passport.inputs[1]).toBe(false);
    const removed = removeInclusion(doc, first.inclusionId);
    expect(removed).toMatchObject({ id: first.inclusionId, kind: 'data-model' });
    expect(doc.passport.inputs.map((r) => r.name)).toEqual(['Typed by hand', 'Other']);
    expect(doc.artefacts).toHaveLength(1);
    expect(removeInclusion(doc, 'inc-unknown')).toBeNull();
    expect(removeInclusion(doc, first.inclusionId)).toBeNull();
  });
  it('check plan: writes numbered lines per group, with status and evidence', () => {
    const doc = project();
    doc.passport.evaluation.calibration = 'Written by hand';
    const plan = { ...checks(), calibration: { parameters: '', tunedOn: '', validatedOn: '' } };
    includeArtefact(doc, artefact('check-plan', { data: plan }), LATER);
    expect(doc.passport.evaluation.verification).toBe('1. Conservation holds every day. — passed. Evidence: Residual 0 in all runs.\n2. Same seed, same result. — planned');
    expect(doc.passport.evaluation.validation).toBe('1. Compare with held-out records. — failed. Evidence: Mean off by 31%.\nMeasure: Mean end-of-day backlog; tolerance set beforehand ±20%');
    // A group with nothing in it leaves the project's own text alone.
    expect(doc.passport.evaluation.calibration).toBe('Written by hand');
    expect(checkLines(checks(), 'calibration')).toEqual(['Parameters tuned: Arrival rate', 'Tuned on: First 30 days', 'Validated on: Next 30 days']);
    const multi = { ...checks(), checks: [{ id: 'c1', group: 'verification' as const, text: 'Line one\nline two', status: 'done' as const, evidence: '  ' }, { id: 'c2', group: 'verification' as const, text: '   ', status: 'done' as const, evidence: '' }] };
    expect(checkLines(multi, 'verification')).toEqual(['1. Line one line two — done']);
    expect(compassWarnings(doc).some((w) => w.id === 'verification' || w.id === 'validation')).toBe(false);
  });
  it('comparison: the copy is the record; no project field changes, and a project holds several', () => {
    const doc = project();
    const before = JSON.stringify(doc.passport);
    includeArtefact(doc, artefact('comparison'), NOW);
    includeArtefact(doc, artefact('comparison', { title: 'Second run' }), NOW);
    expect(JSON.stringify(doc.passport)).toBe(before);
    expect(doc.artefacts.map((i) => i.title)).toEqual(['My comparison', 'Second run']);
    expect(new Set(doc.artefacts.map((i) => i.id)).size).toBe(2);
  });
  it('removing a copy that is not a data model leaves the project fields as they are', () => {
    const doc = project();
    const { inclusionId } = includeArtefact(doc, artefact('concept-model'), NOW);
    removeInclusion(doc, inclusionId);
    expect(doc.artefacts).toEqual([]);
    expect(doc.passport.representation.nodes).toHaveLength(6);
  });
  it('copies are found by step and by source, and know whether their source has moved on', () => {
    const doc = project();
    const a = artefact('data-model'), c = artefact('comparison');
    for (const k of KIND_ORDER) includeArtefact(doc, k === 'data-model' ? a : k === 'comparison' ? c : artefact(k), NOW);
    expect(inclusionsFor(doc, 'scope').map((i) => i.kind)).toEqual(['concept-model']);
    expect(inclusionsFor(doc, 'method').map((i) => i.kind)).toEqual(['method-choice']);
    expect(inclusionsFor(doc, 'inputs').map((i) => i.kind)).toEqual(['data-model']);
    expect(inclusionsFor(doc, 'evaluation').map((i) => i.kind)).toEqual(['check-plan']);
    expect(inclusionsFor(doc, 'experiment').map((i) => i.kind)).toEqual(['comparison']);
    expect(inclusionsFor(doc, 'frame')).toEqual([]);
    expect(inclusionsFor(doc, 'conclude')).toEqual([]);
    const copy = inclusionOf(doc, a.id)!;
    expect(copy.kind).toBe('data-model');
    expect(inclusionOf(doc, 'art-unknown')).toBeUndefined();
    expect(inclusionState(copy, a)).toBe('current');
    expect(inclusionState(copy, { ...a, revision: 4 })).toBe('outdated');
    expect(inclusionState(copy, undefined)).toBe('source-missing');
  });
  it('works on a project that has no artefacts list yet', () => {
    const doc = project() as Partial<ProjectDoc> as ProjectDoc;
    delete (doc as Partial<ProjectDoc>).artefacts;
    expect(inclusionsFor(doc, 'scope')).toEqual([]);
    expect(removeInclusion(doc, 'x')).toBeNull();
    includeArtefact(doc, artefact('comparison'), NOW);
    expect(doc.artefacts).toHaveLength(1);
  });
});

describe('project files with artefacts (schema version 3)', () => {
  const withAll = () => {
    const doc = createProject({ title: 'Round trip', now: NOW });
    for (const k of KIND_ORDER) includeArtefact(doc, artefact(k), NOW);
    includeArtefact(doc, artefact('data-model', { data: { ...data(), name: 'Second input' } }), NOW);
    return doc;
  };
  it('a project is created at version 3 with an empty list, and so is the worked example for now', () => {
    expect(PASSPORT_SCHEMA_VERSION).toBe(3);
    expect(createProject()).toMatchObject({ schemaVersion: 3, artefacts: [] });
    expect(workedExample()).toMatchObject({ schemaVersion: 3, artefacts: [] });
    expect(compassWarnings(workedExample())).toEqual([]);
  });
  it('included artefacts and the rows they own survive a round trip, without warnings', () => {
    const doc = withAll();
    const res = parseProjectJson(projectJson(doc));
    if (!res.ok) throw new Error(res.error);
    expect(res.warnings).toEqual([]);
    expect(res.project.artefacts).toEqual(doc.artefacts);
    expect(res.project.passport.inputs).toEqual(doc.passport.inputs);
    expect(res.project.passport.inputs.map((r) => r.inclusion)).toEqual(doc.artefacts.filter((i) => i.kind === 'data-model').map((i) => i.id));
    expect(res.summary).toContain('6 artefacts');
    expect(res.project.preservedUnknown).toBeUndefined();
  });
  it('an invalid copy is left out with a warning; the rest of the project still imports', () => {
    const r = JSON.parse(projectJson(withAll()));
    r.artefacts[0].data.nodes = 'none';                 // concept model: wrong structure
    r.artefacts[1].kind = 'constructor';                // unknown kind
    r.artefacts[2].id = '<script>';                     // bad id (first data model)
    r.artefacts[3].sourceRevision = '3';                // bad revision
    r.artefacts[4].data.baseline = [1, 'x'];            // comparison: not numbers
    r.artefacts.push('text', null, { ...r.artefacts[5] }); // junk, and a repeated id
    const res = importProjectObject(r);
    if (!res.ok) throw new Error(res.error);
    expect(res.project.artefacts.map((i) => i.title)).toEqual(['My data-model']);
    expect((res.project.artefacts[0].data as DataModel).name).toBe('Second input');
    expect(res.warnings.filter((w) => /^artefacts\[\d+\]: .*left out\.$/.test(w))).toHaveLength(8);
    // The row of the data model that was left out no longer claims an owner; it stays as an ordinary row.
    expect(res.project.passport.inputs.map((row) => !!row.inclusion)).toEqual([false, true]);
    expect(res.project.passport.inputs).toHaveLength(2);
  });
  it('cleans inside a copy with the sanitizer of its kind and drops unknown fields of the copy', () => {
    const r = JSON.parse(projectJson(withAll()));
    r.artefacts[0].data.nodes[0].type = 'weapon'; r.artefacts[0].extra = '<script>'; r.artefacts[0].title = 9; r.artefacts[0].addedAt = 'soon';
    const res = importProjectObject(r, { now: LATER });
    if (!res.ok) throw new Error(res.error);
    const copy = res.project.artefacts[0];
    expect(copy.kind === 'concept-model' && copy.data.nodes.map((n) => n.id)).toEqual(['n2', 'n3', 'n4', 'n5', 'n6', 'n7']);
    expect(Object.keys(copy).sort()).toEqual(['addedAt', 'data', 'id', 'kind', 'sourceId', 'sourceRevision', 'title']);
    expect(copy).toMatchObject({ title: '', addedAt: LATER });
    expect(res.warnings.join('\n')).toMatch(/artefacts\[0\]\.nodes\[0\]: not a valid element/);
  });
  it('keeps one copy of a kind a project holds once, and removes a row link that points nowhere', () => {
    const r = JSON.parse(projectJson(withAll()));
    r.artefacts.push({ ...r.artefacts[0], id: 'inc-second' });
    r.passport.inputs[0].inclusion = 'inc-nowhere';
    r.passport.inputs[1].inclusion = r.artefacts[0].id; // not a data model
    const res = importProjectObject(r);
    if (!res.ok) throw new Error(res.error);
    expect(res.project.artefacts.filter((i) => i.kind === 'concept-model')).toHaveLength(1);
    expect(res.warnings.join('\n')).toMatch(/a project holds one conceptual model/);
    expect(res.project.passport.inputs.some((row) => 'inclusion' in row)).toBe(false);
  });
  it('a list that is not a list imports as none', () => {
    const r = JSON.parse(projectJson(withAll()));
    r.artefacts = { 0: r.artefacts[0] };
    const res = importProjectObject(r);
    expect(res.ok && res.project.artefacts).toEqual([]);
    expect(res.ok && res.warnings.join(' ')).toMatch(/artefacts: expected a list/);
  });
});

describe('upgrading older projects', () => {
  /** The worked example as an older version of the app stored it. */
  const old = (version = 2): ProjectDoc => {
    const d = workedExample() as Partial<ProjectDoc>;
    delete d.artefacts;
    d.schemaVersion = version;
    return d as ProjectDoc;
  };
  it('a project at the current version is returned untouched', () => {
    const d = createProject();
    expect(upgradeProject(d)).toBe(d);
    const example = workedExample();
    expect(upgradeProject(example)).toBe(example);
    expect(example.artefacts).toEqual([]); // no copies are invented for a version 3 project
  });
  it('a version 2 project gets a copy of its sketch, its method decision and its sandbox run', () => {
    const before = old();
    const snapshot = JSON.stringify(before);
    const notes: string[] = [];
    const d = upgradeProject(before, (m) => notes.push(m));
    expect(JSON.stringify(before)).toBe(snapshot); // the stored object is not changed
    expect(d.schemaVersion).toBe(3);
    expect(d.passport).toBe(before.passport); // the project's own fields are exactly as they were
    expect(d.artefacts.map((i) => [i.kind, i.id, i.sourceId, i.sourceRevision])).toEqual([
      ['concept-model', 'inc-from-sketch', 'project-sketch', 0], ['method-choice', 'inc-from-method', 'project-method', 0], ['comparison', 'inc-from-sandbox', 'project-sandbox', 0],
    ]);
    expect(notes).toEqual(['Kept as artefacts of the project: conceptual model, method choice, comparison.']);
    const example = workedExample();
    const [sketch, choice, run] = d.artefacts;
    if (sketch.kind !== 'concept-model' || choice.kind !== 'method-choice' || run.kind !== 'comparison') throw new Error('unexpected kinds');
    expect(sketch.data.nodes.map((n) => [n.id, n.label, n.x, n.y])).toEqual(example.passport.representation.nodes.map((n) => [n.id, n.label, n.x, n.y]));
    expect(sketch.data.nodes.every((n) => n.zone === 'content' && ['actor', 'entity', 'variable'].includes(n.type))).toBe(true);
    expect(sketch.data.edges.map((e) => [e.from, e.to, e.label, e.kind, e.sign])).toEqual(example.passport.representation.relations.map((r) => [r.from, r.to, r.label, 'influence', '']));
    expect(choice.data).toMatchObject({ primary: 'system-dynamics', alternative: 'des', justification: example.passport.representation.justification, shortlist: example.methods.shortlist });
    expect(choice.data.answers).toEqual(example.methods.answers);
    const summaries = example.sandbox.lastRun!;
    expect(run.data.baseline).toEqual(summaries.baseline.summaries.map((s) => s.averageEndBacklog));
    expect(run.data.alternative).toEqual(summaries.alternative!.summaries.map((s) => s.averageEndBacklog));
    expect(run.data).toMatchObject({ paired: true, direction: 'lower', origin: 'imported', outcome: 'Average end-of-day backlog', baselineLabel: summaries.baseline.label });
    expect(run.data.baseline).toHaveLength(100);
    expect(run.data.note).toMatch(/backlog sandbox run of this project \(seed .+, 100 replications\)/);
    for (const i of d.artefacts) { expect(i.id).toMatch(ID_PATTERN); expect(i.sourceId).toMatch(ID_PATTERN); expect(i.addedAt).toBe(before.updatedAt); }
    // Every copy is valid data of its kind, and no Toolbox artefact claims to be its source.
    for (const i of d.artefacts) expect(kindDef(i.kind).sanitize(JSON.parse(JSON.stringify(i.data)), () => { throw new Error('unexpected warning'); })).toEqual(i.data);
    expect(inclusionState(d.artefacts[0], undefined)).toBe('source-missing');
    expect(compassWarnings(d)).toEqual([]);
  });
  it('is idempotent: upgrading twice changes nothing, and two upgrades of the same project are equal', () => {
    const once = upgradeProject(old());
    expect(upgradeProject(once)).toBe(once);
    expect(upgradeProject(old())).toEqual(once);
    expect(upgradeProject(old(1))).toEqual(once);
  });
  it('a project with nothing to copy gets an empty list', () => {
    const d = createProject({ title: 'Old and empty' }) as Partial<ProjectDoc>;
    delete d.artefacts; d.schemaVersion = 2;
    const up = upgradeProject(d as ProjectDoc);
    expect(up).toMatchObject({ schemaVersion: 3, artefacts: [] });
    expect(UPGRADE_COPIES.comparison.id).toBe('inc-from-sandbox');
  });
  it('copies only what is there: a single policy, a cancelled run, a method without a sketch', () => {
    const d = old();
    d.passport = { ...d.passport, representation: { ...d.passport.representation, nodes: [], relations: [] } };
    const run = d.sandbox.lastRun!;
    d.sandbox = { ...d.sandbox, lastRun: { ...run, alternative: null, comparisonKind: 'none', status: 'partial' } };
    const up = upgradeProject(d);
    expect(up.artefacts.map((i) => i.kind)).toEqual(['method-choice', 'comparison']);
    const c = up.artefacts[1];
    expect(c.kind === 'comparison' && c.data).toMatchObject({ alternative: [], paired: false, alternativeLabel: 'Alternative' });
    expect(c.kind === 'comparison' && c.data.note).toMatch(/cancelled, so the results are partial/);
  });
  it('gives unsafe ids of an old sketch new ones, and the arrows follow', () => {
    const d = old();
    const rep = d.passport.representation;
    d.passport = { ...d.passport, representation: { ...rep,
      nodes: [{ id: 'a b', type: 'entity', label: 'A', x: 0, y: 0 }, { id: '<x>', type: 'stakeholder', label: 'B', x: 1, y: 1 }, { id: 'ok', type: 'variable', label: 'C', x: 2, y: 2 }],
      relations: [{ id: 'r 1', from: 'a b', to: '<x>', label: 'feeds', directed: true }, { id: 'r2', from: 'ok', to: 'gone', label: 'dangling', directed: true }],
    } };
    const copy = upgradeProject(d).artefacts[0];
    if (copy.kind !== 'concept-model') throw new Error('expected the sketch');
    expect(copy.data.nodes.map((n) => [n.id, n.type, n.label])).toEqual([['n-1', 'entity', 'A'], ['n-2', 'actor', 'B'], ['ok', 'variable', 'C']]);
    expect(copy.data.edges).toEqual([{ id: 'r-1', from: 'n-1', to: 'n-2', kind: 'influence', sign: '', label: 'feeds' }]);
  });
  it('a damaged stored project still opens: what cannot be copied is skipped', () => {
    const broken = { ...old(), passport: undefined, sandbox: { lastRun: { baseline: { summaries: [{ averageEndBacklog: 'x' }] } } }, methods: null } as unknown as ProjectDoc;
    expect(() => upgradeProject(broken)).not.toThrow();
    expect(upgradeProject(broken).artefacts).toEqual([]);
    const noList = { ...createProject(), artefacts: undefined } as unknown as ProjectDoc;
    expect(upgradeProject(noList).artefacts).toEqual([]);
  });
  it('the importer upgrades version 1 and 2 files the same way and says what it kept', () => {
    for (const v of [1, 2]) {
      const file = JSON.parse(projectJson(workedExample()));
      delete file.artefacts; file.schemaVersion = v;
      const res = importProjectObject(file);
      if (!res.ok) throw new Error(res.error);
      expect(res.project.schemaVersion).toBe(3);
      expect(res.project.artefacts.map((i) => i.kind)).toEqual(['concept-model', 'method-choice', 'comparison']);
      expect(res.warnings.join('\n')).toMatch(new RegExp(`schema version ${v} upgraded to version 3`));
      expect(res.warnings.join('\n')).toMatch(/Kept as artefacts of the project: conceptual model, method choice, comparison\./);
      expect(res.project.passport).toEqual(workedExample().passport);
      expect(res.project.sandbox).toEqual(workedExample().sandbox);
      expect(compassWarnings(res.project)).toEqual([]);
    }
  });
});

describe('storage: database version 2', () => {
  const openV1 = (factory: IDBFactory) => new Promise<IDBDatabase>((resolve, reject) => {
    const r = factory.open(DB_NAME, 1);
    r.onupgradeneeded = () => { for (const s of ['projects', 'trash', 'backups', 'progress']) r.result.createObjectStore(s, { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const put = (db: IDBDatabase, store: string, value: unknown) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  it('opening a version 1 database adds the artefacts store and leaves projects, trash and backups as they are', async () => {
    const factory = new IDBFactory();
    const v1 = await openV1(factory);
    expect([...v1.objectStoreNames].sort()).toEqual(['backups', 'progress', 'projects', 'trash']);
    // What the earlier version of the app stored: a version 2 project without an artefacts list.
    const stored = workedExample() as Partial<ProjectDoc>;
    delete stored.artefacts; stored.schemaVersion = 2;
    const second = { ...createProject({ title: 'Second', id: 'prj-second', now: NOW }), schemaVersion: 2 };
    const deleted = createProject({ title: 'Deleted', id: 'prj-deleted', now: NOW });
    await put(v1, 'projects', stored);
    await put(v1, 'projects', second);
    await put(v1, 'trash', { id: deleted.id, deletedAt: NOW, project: deleted });
    await put(v1, 'backups', { id: second.id, savedAt: NOW, project: second, keptAt: 1 });
    await put(v1, 'progress', { id: 'legacy', value: 1 });
    v1.close();

    expect(DB_VERSION).toBe(2);
    const repo = await createRepo(factory);
    expect(repo.kind).toBe('indexeddb');
    const projects = await repo.listProjects();
    expect(projects).toHaveLength(2);
    expect(projects.find((p) => p.id === 'worked-example')).toEqual(stored); // byte for byte what was stored
    expect(await repo.getProject('prj-second')).toEqual(second);
    expect((await repo.listTrash()).map((t) => t.project.passport.identity.title)).toEqual(['Deleted']);
    expect((await repo.getBackup('prj-second'))!.project).toEqual(second);
    expect(await repo.listArtefacts()).toEqual([]);

    // The store upgrades stored projects when it loads them; saving writes version 3.
    const upgraded = upgradeProject(projects.find((p) => p.id === 'worked-example')!);
    expect(upgraded.artefacts).toHaveLength(3);
    expect(await repo.saveProject({ ...upgraded, projectRevision: upgraded.projectRevision + 1 }, upgraded.projectRevision)).toEqual({ ok: true });
    expect((await repo.getProject('worked-example'))!.artefacts).toHaveLength(3);
    expect((await repo.restoreProject('prj-deleted'))!.passport.identity.title).toBe('Deleted');
  });
  it('the upgraded database and a fresh one both have the new store, at version 2', async () => {
    const upgradedFactory = new IDBFactory();
    (await openV1(upgradedFactory)).close();
    for (const factory of [upgradedFactory, new IDBFactory()]) {
      const repo = await createRepo(factory);
      await repo.saveArtefact(artefact('comparison'));
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = factory.open(DB_NAME); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      expect(db.version).toBe(2);
      expect([...db.objectStoreNames].sort()).toEqual(['artefacts', 'backups', 'progress', 'projects', 'trash']);
      db.close();
    }
  });
  it('artefacts are saved, read, replaced and deleted, in IndexedDB and in the memory fallback', async () => {
    for (const repo of [await createRepo(new IDBFactory()), new MemoryRepo()]) {
      const a = artefact('concept-model'), b = artefact('data-model');
      await repo.saveArtefact(a);
      await repo.saveArtefact(b);
      expect((await repo.listArtefacts()).map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
      expect(await repo.getArtefact(a.id)).toEqual(a);
      expect(await repo.getArtefact('art-unknown')).toBeNull();
      await repo.saveArtefact({ ...a, title: 'Renamed', revision: 4 });
      expect(await repo.getArtefact(a.id)).toMatchObject({ title: 'Renamed', revision: 4 });
      expect(await repo.listArtefacts()).toHaveLength(2);
      await repo.deleteArtefact(a.id);
      await repo.deleteArtefact('art-unknown');
      expect((await repo.listArtefacts()).map((x) => x.id)).toEqual([b.id]);
      // Projects and artefacts do not see each other.
      const p = createProject({ title: 'P' });
      await repo.saveProject(p, null);
      expect(await repo.listArtefacts()).toHaveLength(1);
      expect((await repo.listProjects()).map((x) => x.id)).toEqual([p.id]);
    }
  });
  it('what a caller keeps is not what the memory fallback stores', async () => {
    const repo = new MemoryRepo();
    const a = artefact('comparison');
    await repo.saveArtefact(a);
    a.data.baseline.push(99);
    expect((await repo.getArtefact(a.id))!.data).toEqual(compare());
  });
});

describe('pictures: only a plain, self-contained SVG is shown', () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><path id="p" d="M0 0h10"/></defs>'
    + '<rect width="10" height="10" fill="url(#g)" style="stroke: var(--border, #ccc)"/><use href="#p"/><use xlink:href="#p"/><text x="1" y="5">Capacity &lt;10&gt; once more</text></svg>';
  it('accepts a picture that refers only to itself', () => {
    expect(isSafeSvg(ok)).toBe(true);
    expect(isSafeSvg(`\n  ${ok}\n`)).toBe(true);
    expect(isSafeSvg('<svg viewBox="0 0 1 1"></svg>')).toBe(true);
  });
  const inside = (extra: string) => ok.replace('</svg>', `${extra}</svg>`);
  const refused: [string, unknown][] = [
    ['nothing', null], ['a number', 5], ['an object', { svg: ok }], ['empty text', ''],
    ['text that is not a picture', 'hello <svg></svg>'], ['other markup first', `<div>${ok}</div>`], ['an HTML page', '<html><body></body></html>'],
    ['markup after the picture', `${ok}<p>more</p>`], ['an unclosed picture', '<svg viewBox="0 0 1 1"><rect/>'],
    ['a script', inside('<script>alert(1)</script>')], ['a script in capitals', inside('<SCRIPT>alert(1)</SCRIPT>')], ['a script with a space', inside('< script>alert(1)</script>')],
    ['foreign content', inside('<foreignObject><div>x</div></foreignObject>')], ['foreign content in lower case', inside('<foreignobject></foreignobject>')],
    ['an event attribute', ok.replace('<rect ', '<rect onclick="alert(1)" ')], ['an event attribute on the root', ok.replace('<svg ', '<svg onload=alert(1) ')],
    ['an event attribute after a slash', inside('<g/onclick="alert(1)"></g>')], ['an event attribute after a line break', ok.replace('<rect ', '<rect\nONMOUSEOVER = "x" ')],
    ['an event attribute after a quote', ok.replace('height="10"', 'height="10"onfocus="x"')],
    ['a javascript address', inside('<a href="javascript:alert(1)"><text>x</text></a>')], ['a javascript address in capitals', inside('<set to="JavaScript:alert(1)"/>')],
    ['a link to a web address', inside('<a href="https://example.org"><text>x</text></a>')], ['a link without quotes', inside('<a href=//example.org><text>x</text></a>')],
    ['a picture loaded from elsewhere', inside('<use xlink:href="https://example.org/a.svg#x"/>')], ['a data address', inside('<use href="data:image/svg+xml;base64,AAAA"/>')],
    ['a link with single quotes', inside("<a href='http://example.org'>x</a>")], ['an empty link', inside('<a href="">x</a>')],
    ['an embedded image', inside('<image width="1" height="1"/>')], ['an HTML image', inside('<img src="x">')], ['a frame', inside('<iframe></iframe>')],
    ['a style that loads a file', inside('<style>@import "https://example.org/a.css";</style>')], ['a fill loaded from elsewhere', ok.replace('url(#g)', 'url(https://example.org/g.svg#g)')],
    ['a quoted fill from elsewhere', ok.replace('url(#g)', "url('//example.org/g.svg#g')")],
    ['an animation that rewrites a link', inside('<animate attributeName="href" to="#p"/>')], ['an animation that rewrites an xlink', inside("<set attributeName='xlink:href' to='#p'/>")],
  ];
  for (const [name, value] of refused) it(`shows nothing for ${name}`, () => { expect(isSafeSvg(value)).toBe(false); });
  it('no kind draws a picture yet, so nothing is injected', () => {
    for (const k of KIND_ORDER) expect(kindDef(k).figure(SAMPLE[k]() as never)).toBeNull();
  });
});

describe('old addresses', () => {
  it('the earlier Tools pages lead to where their content lives now', () => {
    const table: Record<string, string> = {
      '/tools': '/toolbox', '/tools/distributions': '/toolbox/data', '/tools/distributions/gamma': '/toolbox/data', '/tools/choose': '/toolbox/data', '/tools/fitting': '/toolbox/data',
      '/tools/sampling': '/learn/ideas', '/tools/regression': '/learn/ideas', '/tools/sandbox': '/toolbox/compare', '/tools/apps': '/learn/methods', '/tools/unknown': '/toolbox',
      '/tools/constructor': '/toolbox',
    };
    for (const [from, to] of Object.entries(table)) expect(redirectFor(from), from).toBe(to);
  });
  it('earlier redirects keep working, straight to the final address', () => {
    const table: Record<string, string> = {
      '/start': '/', '/projects': '/', '/glossary': '/', '/methods': '/project/method', '/sandbox': '/toolbox/compare', '/labs': '/toolbox', '/legacy': '/toolbox',
      '/labs/linear-model': '/learn/ideas', '/legacy/linear-model': '/learn/ideas', '/labs/fitting': '/toolbox/data', '/legacy/sampling': '/learn/ideas',
      '/lenses': '/', '/detective/x': '/', '/lectures/1': '/',
    };
    for (const [from, to] of Object.entries(table)) expect(redirectFor(from), from).toBe(to);
  });
  it('the new addresses are not redirected', () => {
    for (const p of ['/', '/learn', '/learn/process', '/learn/methods/des', '/toolbox', '/toolbox/concept', '/toolbox/data/art-12345678', '/toolbox/artefacts', '/project', '/project/scope', '/project/checkpoints', '/example', '/settings', '/help', '/toolsmith']) {
      expect(redirectFor(p), p).toBeNull();
    }
  });
});
