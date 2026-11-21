import { describe, expect, it } from 'vitest';
import { match } from '../src/app/router';
import { legacyProject } from '../src/content/fixtures';
import { workedExample } from '../src/content/workedExample';
import { isStepId } from '../src/domain/passport/compass';
import { importProjectObject, isIsoDate } from '../src/domain/passport/importer';
import type { ProjectDoc } from '../src/domain/passport/schema';
import { upgradeProject } from '../src/domain/passport/upgrade';
import { projectJson } from '../src/exports/bundle';
import { passportHtml } from '../src/exports/html';
import { passportMarkdown } from '../src/exports/markdown';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';

/** A fresh, plain-JSON copy of the worked example, as it would arrive from a file. */
const raw = () => JSON.parse(projectJson(workedExample()));
/** A version 2 file with a backlog sandbox run, as the earlier app wrote it. */
const rawLegacy = () => JSON.parse(JSON.stringify(legacyProject()));
const imported = (r: unknown): ProjectDoc => { const res = importProjectObject(r); if (!res.ok) throw new Error(res.error); return res.project; };
/** Everything a screen or an export does with a project must work on whatever the importer lets through. */
const exportsWork = (d: ProjectDoc) => {
  expect(() => passportMarkdown(d, { includeAuthor: true })).not.toThrow();
  const html = passportHtml(d, { includeAuthor: true });
  expect(html).not.toMatch(/<(script|img|iframe|object|embed|foreignObject)\b/i);
  // Pictures of included artefacts are the only markup that is not escaped, and each one passes the safety check.
  for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) ?? []) expect(isSafeSvg(svg)).toBe(true);
  return html;
};
const kinds = (d: ProjectDoc) => d.artefacts.map((i) => i.kind);

describe('a backlog sandbox run in an older file becomes a comparison only when every field has the expected type', () => {
  it('the earlier app’s own file upgrades: the run is kept as a comparison and the sandbox is not imported', () => {
    const d = imported(rawLegacy());
    expect(kinds(d)).toEqual(['concept-model', 'method-choice', 'comparison']);
    expect(d.artefacts).toEqual(upgradeProject(legacyProject()).artefacts);
    expect('sandbox' in d).toBe(false);
    exportsWork(d);
  });

  const tamper: [string, (r: ReturnType<typeof rawLegacy>) => void][] = [
    ['seed is a number', (r) => { r.sandbox.lastRun.seed = 5; }],
    ['engine version missing', (r) => { delete r.sandbox.lastRun.engineVersion; }],
    ['model revision is markup', (r) => { r.sandbox.lastRun.modelRevision = '<script>alert(1)</script>'; }],
    ['policy label is not text', (r) => { r.sandbox.lastRun.baseline.label = { a: 1 }; }],
    ['trace without rows', (r) => { r.sandbox.lastRun.baseline.retainedTrace = { replication: 0 }; }],
    ['day is markup', (r) => { r.sandbox.lastRun.baseline.retainedTrace.rows[0].day = '<img src=x onerror=alert(1)>'; }],
    ['day is a formula', (r) => { r.sandbox.lastRun.baseline.retainedTrace.rows[0].day = '=HYPERLINK("http://x","y")'; }],
    ['replication is a formula', (r) => { r.sandbox.lastRun.baseline.summaries[0].replication = '=1+1'; }],
    ['a metric is text', (r) => { r.sandbox.lastRun.baseline.summaries[3].averageEndBacklog = '12'; }],
    ['a metric is not finite', (r) => { r.sandbox.lastRun.baseline.summaries[3].totalServed = 'Infinity'; }],
    ['partial alternative', (r) => { r.sandbox.lastRun.alternative = { summaries: r.sandbox.lastRun.alternative.summaries }; }],
    ['arrival preview is not a list of number lists', (r) => { r.sandbox.lastRun.arrivalPreview = [['a']]; }],
    ['unknown comparison kind', (r) => { r.sandbox.lastRun.comparisonKind = 'whatever'; }],
    ['unknown status', (r) => { r.sandbox.lastRun.status = 'done'; }],
    ['not an object', (r) => { r.sandbox.lastRun = 'results'; }],
    ['too many replications', (r) => { r.sandbox.lastRun.baseline.summaries = new Array(100_001).fill(r.sandbox.lastRun.baseline.summaries[0]); }],
  ];
  for (const [name, change] of tamper) {
    it(`makes no comparison when ${name}, and says so`, () => {
      const r = rawLegacy(); change(r);
      const res = importProjectObject(r);
      if (!res.ok) throw new Error(res.error);
      expect(kinds(res.project)).toEqual(['concept-model', 'method-choice']);
      expect('sandbox' in res.project).toBe(false);
      expect(res.warnings.join(' ')).toMatch(/sandbox results were not in a recognised format, so no comparison was made from them/);
      const html = exportsWork(res.project);
      expect(html).not.toMatch(/Comparison:|Appendix|alert\(1\)<|HYPERLINK\("/);
    });
  }

  it('keeps only known fields of a valid run', () => {
    const r = rawLegacy();
    r.sandbox.lastRun.extra = '<script>'; r.sandbox.lastRun.baseline.extra = 1; r.sandbox.lastRun.baseline.summaries[0].extra = 'x';
    const d = imported(r);
    expect(d.artefacts).toEqual(upgradeProject(legacyProject()).artefacts);
    expect(JSON.stringify(d)).not.toMatch(/"extra"|<script>/);
  });
  it('a version 3 file’s sandbox field is ignored, whatever it holds', () => {
    for (const junk of [{ lastRun: rawLegacy().sandbox.lastRun }, { lastRun: '<script>alert(1)</script>' }, '<b>x</b>', [1, 2], null]) {
      const r = raw(); r.sandbox = junk;
      const res = importProjectObject(r);
      if (!res.ok) throw new Error(res.error);
      expect(res.project.artefacts).toEqual(workedExample().artefacts);
      expect('sandbox' in res.project).toBe(false);
      expect(res.project.preservedUnknown).toBeUndefined();
      expect(res.warnings).toEqual([]);
    }
  });
  it('the settings of the sandbox are never read: hostile settings change nothing', () => {
    const r = rawLegacy();
    r.sandbox.baseline = { horizon: '<script>', __proto__: { polluted: true } }; r.sandbox.alternative = 'x';
    const d = imported(r);
    expect(kinds(d)).toEqual(['concept-model', 'method-choice', 'comparison']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(JSON.stringify(d)).not.toMatch(/<script>/);
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

describe('the retired sandbox in reports', () => {
  it('an older project’s run is reported as its comparison, under step 6, and nothing else of the sandbox appears', () => {
    const d = imported(rawLegacy());
    const md = passportMarkdown(d);
    const step6 = md.slice(md.indexOf('## Step 6'), md.indexOf('## Step 7'));
    expect(step6).toContain('### Included artefact — Comparison: Backlog sandbox results');
    expect(step6).toMatch(/Copied from the backlog sandbox run of this project \(seed compass-example, 100 replications\)/);
    expect(md).not.toMatch(/Appendix|Baseline daily table|run-example/i);
    expect(passportHtml(d)).not.toMatch(/Appendix|Baseline daily table/i);
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
