import { describe, expect, it } from 'vitest';
import { match } from '../src/app/router';
import { workedExample } from '../src/content/workedExample';
import { isStepId } from '../src/domain/passport/compass';
import { importProjectObject, isIsoDate } from '../src/domain/passport/importer';
import type { ProjectDoc } from '../src/domain/passport/schema';
import { projectJson } from '../src/exports/bundle';
import { runToCsv } from '../src/exports/csv';
import { passportHtml } from '../src/exports/html';
import { passportMarkdown } from '../src/exports/markdown';

/** A fresh, plain-JSON copy of the worked example, as it would arrive from a file. */
const raw = () => JSON.parse(projectJson(workedExample()));
const imported = (r: unknown): ProjectDoc => { const res = importProjectObject(r); if (!res.ok) throw new Error(res.error); return res.project; };
/** Everything a screen or an export does with a project must work on whatever the importer lets through. */
const exportsWork = (d: ProjectDoc) => {
  expect(() => passportMarkdown(d, { includeAuthor: true })).not.toThrow();
  const html = passportHtml(d, { includeAuthor: true });
  expect(html).not.toMatch(/<(script|img|iframe|object|embed|svg)\b/i);
  if (d.sandbox.lastRun) expect(() => runToCsv(d, d.sandbox.lastRun!)).not.toThrow();
  return html;
};

describe('imported sandbox results are accepted only when every field has the expected type', () => {
  it('the app’s own export round-trips unchanged', () => {
    const d = imported(raw());
    expect(d.sandbox.lastRun).toEqual(workedExample().sandbox.lastRun);
    exportsWork(d);
  });

  const tamper: [string, (r: ReturnType<typeof raw>) => void][] = [
    ['seed is a number', (r) => { r.sandbox.lastRun.seed = 5; }],
    ['engine version missing', (r) => { delete r.sandbox.lastRun.engineVersion; }],
    ['model revision is markup', (r) => { r.sandbox.lastRun.modelRevision = '<script>alert(1)</script>'; }],
    ['policy label is not text', (r) => { r.sandbox.lastRun.baseline.label = { a: 1 }; }],
    ['trace without rows', (r) => { r.sandbox.lastRun.baseline.retainedTrace = { replication: 0 }; }],
    ['day is markup', (r) => { r.sandbox.lastRun.baseline.retainedTrace.rows[0].day = '<img src=x onerror=alert(1)>'; }],
    ['day is a formula', (r) => { r.sandbox.lastRun.baseline.retainedTrace.rows[0].day = '=HYPERLINK("http://x","y")'; }],
    ['replication is a formula', (r) => { r.sandbox.lastRun.baseline.summaries[0].replication = '=1+1'; }],
    ['a metric is text', (r) => { r.sandbox.lastRun.baseline.summaries[3].totalServed = '12'; }],
    ['partial alternative', (r) => { r.sandbox.lastRun.alternative = { summaries: r.sandbox.lastRun.alternative.summaries }; }],
    ['arrival preview is not a list of number lists', (r) => { r.sandbox.lastRun.arrivalPreview = [['a']]; }],
    ['unknown comparison kind', (r) => { r.sandbox.lastRun.comparisonKind = 'whatever'; }],
    ['unknown status', (r) => { r.sandbox.lastRun.status = 'done'; }],
    ['not an object', (r) => { r.sandbox.lastRun = 'results'; }],
  ];
  for (const [name, change] of tamper) {
    it(`drops the results when ${name}, and says so`, () => {
      const r = raw(); change(r);
      const res = importProjectObject(r);
      if (!res.ok) throw new Error(res.error);
      expect(res.project.sandbox.lastRun).toBeNull();
      expect(res.warnings.join(' ')).toMatch(/sandbox results were not in a recognised format/);
      const html = exportsWork(res.project);
      expect(html).toContain('No sandbox run included.');
    });
  }

  it('keeps only known fields of a valid run', () => {
    const r = raw();
    r.sandbox.lastRun.extra = '<script>'; r.sandbox.lastRun.baseline.extra = 1; r.sandbox.lastRun.baseline.summaries[0].extra = 'x';
    const run = imported(r).sandbox.lastRun!;
    expect(run).toEqual(workedExample().sandbox.lastRun);
  });
});

describe('other tampered fields', () => {
  it('method ids that are only inherited object keys are removed', () => {
    const r = raw();
    r.passport.representation.primaryMethod = 'constructor';
    r.passport.representation.alternativeMethod = 'toString';
    r.methods.shortlist = ['__proto__', 'hasOwnProperty', 'des'];
    const d = imported(r);
    expect(d.passport.representation.primaryMethod).toBe('');
    expect(d.passport.representation.alternativeMethod).toBe('');
    expect(d.methods.shortlist).toEqual(['des']);
    expect(passportMarkdown(d)).not.toMatch(/Primary method:\*\* Object/);
    exportsWork(d);
  });
  it('nullable text fields of the method decision are text or nothing', () => {
    const r = raw();
    r.methods.ruleVersion = 5; r.methods.answersKey = { a: 1 }; r.methods.decidedAt = ['x'];
    const d = imported(r);
    expect(d.methods).toMatchObject({ ruleVersion: null, answersKey: null, decidedAt: null });
    exportsWork(d);
  });
  it('rows with missing or repeated ids get distinct ids, and unknown element types are reset', () => {
    const r = raw();
    r.passport.inputs[1].id = r.passport.inputs[0].id; r.passport.inputs[2].id = '';
    r.passport.assumptions[1].id = r.passport.assumptions[0].id;
    r.passport.representation.nodes[0].type = 'entity\n## Fake section';
    const d = imported(r);
    for (const rows of [d.passport.inputs, d.passport.assumptions, d.passport.outcomes, d.passport.representation.nodes]) expect(new Set(rows.map((x) => x.id)).size).toBe(rows.length);
    expect(d.passport.inputs[0].id).toBe(r.passport.inputs[0].id);
    expect(d.passport.representation.nodes[0].type).toBe('entity');
    expect(passportMarkdown(d).split('\n').filter((l) => l.startsWith('## Fake'))).toHaveLength(0);
  });
  it('target dates must exist in the calendar', () => {
    expect(isIsoDate('2026-12-01')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    for (const bad of ['2026-13-45', '2026-02-30', '2027-02-29', '26-12-01', '2026-12-01T00:00', '', null, 20261201]) expect(isIsoDate(bad), String(bad)).toBe(false);
    const r = raw(); r.passport.review.final.due = '2026-13-45';
    expect(imported(r).passport.review.final.due).toBe('');
  });
  it('unknown fields survive any number of export/import cycles without nesting deeper', () => {
    const r = raw(); r.futureField = { a: [1, 2] }; r.__proto__danger = 1;
    let d = imported(r);
    for (let i = 0; i < 30; i++) d = imported(JSON.parse(projectJson(d)));
    expect(d.preservedUnknown).toEqual({ futureField: { a: [1, 2] }, __proto__danger: 1 });
  });
});

describe('exports of a scenario comparison and of numbering', () => {
  it('call it a difference, not a paired difference, when the inputs differ', () => {
    const d = workedExample();
    expect(passportHtml(d)).toMatch(/<p>Paired difference in terminal backlog/);
    d.sandbox.lastRun!.comparisonKind = 'scenario';
    const html = passportHtml(d);
    expect(html).toMatch(/<p>Difference in terminal backlog/);
    expect(html).not.toMatch(/Paired difference/);
    d.sandbox.lastRun!.alternative!.summaries = [];
    expect(passportHtml(d)).not.toMatch(/ifference in terminal backlog/);
  });
  it('CSV replications are numbered from 1, as on screen', () => {
    const d = workedExample();
    const lines = runToCsv(d, d.sandbox.lastRun!).trim().split('\r\n');
    const reps = lines.filter((l) => l.includes(',replication,Baseline,')).map((l) => Number(l.split(',')[5]));
    expect(reps[0]).toBe(1);
    expect(reps[reps.length - 1]).toBe(100);
    expect(lines.find((l) => l.includes(',daily,Baseline,'))!.split(',')[5]).toBe('1');
  });
});

describe('addresses typed by hand', () => {
  it('only the seven real step ids are steps', () => {
    for (const s of ['frame', 'scope', 'method', 'inputs', 'evaluation', 'experiment', 'conclude']) expect(isStepId(s)).toBe(true);
    for (const s of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'checkpoints', '']) expect(isStepId(s), s).toBe(false);
  });
  it('a malformed percent sequence matches no route instead of throwing', () => {
    expect(match('/project/:step', '/project/%')).toBeNull();
    expect(match('/tools/:id', '/tools/%E0%A4%A')).toBeNull();
    expect(match('/tools/:id', '/tools/a%20b')).toEqual({ id: 'a b' });
  });
});
