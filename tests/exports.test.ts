import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workedExample } from '../src/content/workedExample';
import { CHECKPOINT_DEFS, COMPASS_RULES_VERSION, RUBRIC_LEVELS, STEPS, compassWarnings } from '../src/domain/passport/compass';
import { createProject, newId } from '../src/domain/passport/schema';
import { parseProjectJson, importProjectObject } from '../src/domain/passport/importer';
import { runAll } from '../src/domain/sandbox/experiment';
import { defaultConfig } from '../src/domain/sandbox/engine';
import { APP_VERSION, EXPORT_PARTS, buildExportZip, buildManifest, projectJson, renderPart, slugify } from '../src/exports/bundle';
import { csvText, runToCsv } from '../src/exports/csv';
import { markdownToHtml, passportHtml } from '../src/exports/html';
import { APP_NAME, briefMarkdown, humanDate, passportMarkdown, stepHeading } from '../src/exports/markdown';
import { crc32 } from '../src/exports/zip';

function sampleDoc() {
  const d = createProject({ title: 'Support <script>alert(1)</script> | test' });
  d.passport.decision.question = 'How does backlog change?';
  d.passport.inputs.push({ id: newId('in'), name: 'Arrivals', value: '12', unit: 'req-eq/day', sourceType: 'synthetic', provenance: 'fixture', uncertainty: '' });
  d.passport.assumptions.push({ id: newId('as'), statement: 'Unused capacity is lost', rationale: '', consequenceIfWrong: '', plannedCheck: '', evidenceKind: 'assumed', sourceNote: '' });
  d.sandbox.baseline.demand.mode = 'random';
  d.sandbox.baseline.replications = 5;
  const alt = structuredClone(d.sandbox.baseline); alt.capacity.direct = 12; d.sandbox.alternative = alt;
  d.sandbox.lastRun = runAll(d.sandbox.baseline, alt, { id: 'run-1', projectId: d.id, modelRevision: 1, createdAt: 'x' });
  return d;
}

/** The part of a Markdown export that belongs to one `##` section. */
function section(md: string, heading: string): string {
  const start = md.indexOf(`## ${heading}`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const next = md.indexOf('\n## ', start + 1);
  return md.slice(start, next === -1 ? undefined : next);
}
const OPTS = { includeAuthor: false, generatedAt: '2026-11-20T12:00:00.000Z' };

describe('JSON round-trip and import validation', () => {
  it('export → import preserves semantic fields, scenarios and results', () => {
    const d = sampleDoc();
    d.passport.selfChecks['frame-decide'] = 'Hire or not.';
    d.passport.review.proposal.rubric = { question: 2 };
    const res = parseProjectJson(projectJson(d));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.project;
    expect(p.passport).toEqual(d.passport);
    expect(p.sandbox.baseline).toEqual(d.sandbox.baseline);
    expect(p.sandbox.alternative).toEqual(d.sandbox.alternative);
    expect(p.sandbox.lastRun!.baseline.summaries).toEqual(d.sandbox.lastRun!.baseline.summaries);
    expect(p.preservedUnknown).toBeUndefined();
  });
  it('rejects future schemas, foreign files and corrupt JSON; preserves unknown fields', () => {
    const d = sampleDoc();
    const future = { ...JSON.parse(projectJson(d)), schemaVersion: 7 };
    const r1 = importProjectObject(future);
    expect(r1.ok).toBe(false);
    expect(!r1.ok && r1.error).toMatch(/newer schema/);
    expect(parseProjectJson('{"foo":1}').ok).toBe(false);
    expect(parseProjectJson('{"schema":').ok).toBe(false);
    const extra = importProjectObject({ ...JSON.parse(projectJson(d)), instructorNote: 'keep me' });
    expect(extra.ok && extra.project.preservedUnknown).toEqual({ instructorNote: 'keep me' });
  });
  it('blocks prototype pollution and coerces wrong types to safe defaults', () => {
    const raw = JSON.parse(projectJson(sampleDoc()));
    const evil = JSON.parse(JSON.stringify(raw).replace('"passport":{', '"passport":{"__proto__":{"polluted":true},'));
    evil.passport.inputs[0].unit = 42;
    evil.sandbox.baseline.horizon = 'many';
    const r = importProjectObject(evil);
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (r.ok) {
      expect(r.project.passport.inputs[0].unit).toBe('');
      expect(r.project.sandbox.baseline.horizon).toBe(defaultConfig().horizon);
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });
  it('the JSON export records the app name and version 3.0.0', () => {
    expect(APP_VERSION).toBe('3.0.0');
    expect(JSON.parse(projectJson(sampleDoc())).exportedBy).toEqual({ app: 'ModSim Essentials', version: '3.0.0' });
    expect(APP_NAME).toBe('ModSim Essentials');
  });
});

describe('Markdown passport: organised around the seven compass steps', () => {
  it('marks unknown fields “Not yet specified”, reports 0 of 7 steps and never invents prose', () => {
    const md = passportMarkdown(createProject());
    expect(md).toMatch(/Not yet specified/);
    expect(md).toMatch(/> 0 of 7 steps started\./);
    expect(md).toMatch(/not a measure of model validity or of review status/);
    expect(md).not.toMatch(/sections started/);
    // Every field line of an empty project is a placeholder, a fixed label or a rule message.
    const fieldLines = md.split('\n').filter((l) => /^- \*\*(Stakeholder|Observed problem|Boundary|Justification|Verification checks|Baseline|Recommendation|Limitations):\*\*/.test(l));
    expect(fieldLines).toHaveLength(8);
    for (const l of fieldLines) expect(l).toMatch(/_Not yet specified_$/);
    expect(md).toMatch(/Inputs: _Not yet specified_/);
    expect(md).toMatch(/Assumptions: _Not yet specified_/);
    expect(md).toMatch(/Outcome metrics: _Not yet specified_/);
    expect(md).toMatch(/Conceptual sketch: _Not yet specified_/);
    expect(md).toMatch(/Sandbox run: none included\./);
  });
  it('lists the seven steps in order with their titles, then open items, then checkpoints', () => {
    for (const doc of [createProject(), sampleDoc(), workedExample()]) {
      const md = passportMarkdown(doc);
      const h2 = md.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
      expect(h2).toEqual([...STEPS.map((s) => `Step ${s.number} — ${s.title}`), 'Open items at export time', 'Checkpoints']);
      expect(md.split('\n').filter((l) => l.startsWith('# '))).toHaveLength(1);
    }
    expect(STEPS.map(stepHeading)).toEqual(['Step 1 — Frame', 'Step 2 — Scope and concept', 'Step 3 — Choose a method', 'Step 4 — Inputs and assumptions', 'Step 5 — Verification and validation', 'Step 6 — Outcomes and experiment', 'Step 7 — Conclude and share']);
  });
  it('reports step progress from stepsStarted, separately for each step', () => {
    const d = sampleDoc(); // question (step 1), one input and one assumption (step 4)
    const md = passportMarkdown(d);
    expect(md).toMatch(/> 2 of 7 steps started\./);
    expect(section(md, 'Step 1 — Frame')).toMatch(/Step status: started\./);
    expect(section(md, 'Step 4 — Inputs and assumptions')).toMatch(/Step status: started\./);
    expect(section(md, 'Step 2 — Scope and concept')).toMatch(/Step status: not started\./);
    expect(passportMarkdown(workedExample())).toMatch(/> 7 of 7 steps started\./);
  });
  it('puts each passport field under its own step', () => {
    const md = passportMarkdown(workedExample());
    const p = workedExample().passport;
    expect(section(md, 'Step 1 — Frame')).toContain(`- **Stakeholder:** ${p.decision.stakeholder}`);
    expect(section(md, 'Step 1 — Frame')).toContain('- **Claim type:** Decision support');
    expect(section(md, 'Step 1 — Frame')).toContain(`- **Precise question:** ${p.decision.question}`);
    expect(section(md, 'Step 2 — Scope and concept')).toContain('| Library desk | forwards requests | Daily arrivals | yes |');
    expect(section(md, 'Step 2 — Scope and concept')).toContain('- **Time unit:** day');
    expect(section(md, 'Step 3 — Choose a method')).toContain('- **Primary method:** System dynamics');
    expect(section(md, 'Step 3 — Choose a method')).toContain('- **Alternative method:** Discrete-event simulation');
    expect(section(md, 'Step 3 — Choose a method')).toMatch(/rule table method-rules-v1; shortlist: System dynamics, Discrete-event simulation/);
    expect(section(md, 'Step 3 — Choose a method')).toContain('| At what level must the outcome be reported? | Aggregate totals or averages |');
    expect(section(md, 'Step 3 — Choose a method')).not.toMatch(/granularity: aggregate/);
    expect(section(md, 'Step 4 — Inputs and assumptions')).toMatch(/\| Daily arrivals \| 8, 12 or 16 .* \| request-equivalents\/day \| Synthetic \/ teaching fixture \| Synthetic teaching data/);
    expect(section(md, 'Step 4 — Inputs and assumptions')).toMatch(/1\. \*\*Unused capacity is lost.*\*\* \(Declared assumption\)\n {3}- Rationale: /);
    expect(section(md, 'Step 5 — Verification and validation')).toMatch(/- \*\*Calibration \(kept separate from validation\):\*\* Kept separate/);
    expect(section(md, 'Step 6 — Outcomes and experiment')).toMatch(/\| Average end-of-day backlog \| Mean of the 30 end-of-day backlog values/);
    expect(section(md, 'Step 6 — Outcomes and experiment')).toContain(`- **Run settings:** ${p.experiment.runSettings}`);
    expect(section(md, 'Step 7 — Conclude and share')).toContain(`- **Conditions that change the decision:** ${p.conclusion.changeConditions}`);
  });
  it('keeps multi-line answers inside their list item', () => {
    const d = workedExample();
    d.passport.evaluation.verification = 'First check\n\n  # not a heading\n| not | a table |\n- not a new field';
    const md = passportMarkdown(d);
    expect(md).toContain('- **Verification checks:** First check\n  # not a heading\n  | not | a table |\n  - not a new field\n- **Validation evidence plan:**');
    // No learner line can start at column 0, so it cannot open a heading or a table of its own.
    expect(md.split('\n').filter((l) => /^#+ /.test(l))).toHaveLength(1 + 9 + 3 + 5);
    const html = passportHtml(d);
    expect(html).toContain('<li><strong>Verification checks:</strong> First check<br># not a heading<br>| not | a table |<br>- not a new field</li>');
    expect(html).not.toMatch(/<h\d># not a heading/);
  });
  it('shows the self-check questions of each step with the student’s answers', () => {
    const d = sampleDoc();
    d.passport.selfChecks['frame-decide'] = 'Hire a part-time advisor,\nor invest in | triage.';
    d.passport.selfChecks['exp-noise'] = '   ';
    const md = passportMarkdown(d);
    for (const s of STEPS) {
      const part = section(md, stepHeading(s));
      expect(part).toMatch(/\| Self-check question \| Answer in the author’s own words \|/);
      for (const q of s.selfChecks) expect(part, q.id).toContain(`| ${q.question} |`);
    }
    expect(section(md, 'Step 1 — Frame')).toContain('| What would the stakeholder do differently depending on the answer? | Hire a part-time advisor, or invest in \\| triage. |');
    expect(section(md, 'Step 1 — Frame')).toContain('| Which sentence in your problem is an observed concern, and which is only a proposed solution? | _Not yet answered_ |');
    expect(section(md, 'Step 6 — Outcomes and experiment')).toContain('| How will you tell a real difference from random variation? | _Not yet answered_ |');
    expect(md.match(/_Not yet answered_/g)).toHaveLength(13);
    expect(md).toMatch(/never graded by the app/);
    // The worked example answers all fourteen.
    const example = workedExample();
    const exampleMd = passportMarkdown(example);
    expect(exampleMd).not.toMatch(/Not yet answered/);
    for (const s of STEPS) for (const q of s.selfChecks) expect(section(exampleMd, stepHeading(s)), q.id).toContain(`| ${q.question} | ${example.passport.selfChecks[q.id]} |`);
  });
  it('lists the open items at export time, grouped by severity, with the rules version', () => {
    const d = sampleDoc();
    d.passport.decision.question = 'Describe the backlog'; // check: no outcome; suggestion: no question mark
    const md = passportMarkdown(d);
    const open = section(md, 'Open items at export time');
    const warnings = compassWarnings(d);
    const n = (sev: string) => warnings.filter((w) => w.severity === sev).length;
    expect(open).toContain(`rule table \`${COMPASS_RULES_VERSION}\``);
    expect(open).toContain('compass-rules-v1');
    expect(open).toContain(`Missing ${n('gap')} · Check ${n('check')} · Suggestion ${n('tip')}.`);
    expect(open.split('\n').filter((l) => l.startsWith('### '))).toEqual([`### Missing (${n('gap')})`, `### Check (${n('check')})`, `### Suggestion (${n('tip')})`]);
    expect(open.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(warnings.length);
    const group = (label: string) => open.slice(open.indexOf(`### ${label}`), open.indexOf('\n### ', open.indexOf(`### ${label}`) + 1) === -1 ? undefined : open.indexOf('\n### ', open.indexOf(`### ${label}`) + 1));
    expect(group('Missing')).toContain('- Step 1 — Frame: No stakeholder yet: who will use the result?');
    expect(group('Missing')).toContain('- Step 7 — Conclude and share: Limitations are not stated.');
    expect(group('Check')).toContain('- Step 1 — Frame: Your question has no measurable outcome. Say what you will measure, in which unit.');
    expect(group('Check')).toContain('- Step 4 — Inputs and assumptions: Assumption 1 has no planned check.');
    expect(group('Check')).not.toContain('No stakeholder yet');
    expect(group('Suggestion')).toContain('- Step 1 — Frame: Phrase the question as a question a model could answer.');
    expect(group('Suggestion')).toContain('- Step 2 — Scope and concept: Sketch the main elements and how they relate.');
    expect(open).toMatch(/do not judge whether the written reasoning is correct/);
    // Nothing open: every group says so.
    const clean = section(passportMarkdown(workedExample()), 'Open items at export time');
    expect(clean).toContain('Missing 0 · Check 0 · Suggestion 0.');
    expect(clean.match(/^None\.$/gm)).toHaveLength(3);
  });
  it('records each checkpoint: status, feedback source, reviewer, notes and rubric levels', () => {
    const d = workedExample();
    d.passport.review.proposal = { status: 'teacher-reviewed', notes: 'Clear question.\nSay more about the boundary.', reviewer: 'Reviewer A', feedbackSource: 'teacher', due: '2026-12-01', rubric: { question: 3, problem: 1, unknown: 2 } };
    d.passport.review.design = { status: 'self-reviewed', notes: '', reviewer: '', feedbackSource: 'self', due: '', rubric: { method: 0, inputs: 9, assumptions: 1.5 } };
    d.passport.review.final.status = 'needs-revision';
    const md = passportMarkdown(d);
    const cps = section(md, 'Checkpoints');
    expect(cps.split('\n').filter((l) => l.startsWith('### '))).toEqual(['### Proposal checkpoint (steps 1 and 2)', '### Design checkpoint (steps 3 and 4)', '### Baseline checkpoint (step 5)', '### Evaluation checkpoint (step 6)', '### Final checkpoint (step 7)']);
    const cp = (label: string) => cps.slice(cps.indexOf(`### ${label} checkpoint`), cps.indexOf('\n### ', cps.indexOf(`### ${label} checkpoint`) + 1) === -1 ? undefined : cps.indexOf('\n### ', cps.indexOf(`### ${label} checkpoint`) + 1));
    expect(cp('Proposal')).toContain('- **Status:** Reviewed');
    expect(cp('Proposal')).toContain('- **Feedback source:** Reviewer feedback (manual label)');
    expect(cp('Proposal')).toContain('- **Reviewer:** Reviewer A');
    expect(cp('Proposal')).toContain('- **Notes:** Clear question.\n  Say more about the boundary.');
    expect(cp('Proposal')).toContain('| Answerable question | Strong (level 3 of 3) |');
    expect(cp('Proposal')).toContain('| Problem versus proposal | Emerging (level 1 of 3) |');
    expect(cp('Proposal')).toContain('| Boundary and exclusions | Not rated |');
    expect(cp('Design')).toContain('- **Status:** Self-reviewed');
    expect(cp('Design')).toContain('- **Feedback source:** Self-assessment');
    expect(cp('Design')).toContain('- **Reviewer:** Not recorded');
    expect(cp('Design')).toContain('- **Notes:** None');
    expect(cp('Design')).toContain('| Method justification | Not yet (level 0 of 3) |');
    expect(cp('Design')).toContain('| Input quality | Not rated |'); // out of range
    expect(cp('Design')).toContain('| Assumptions register | Not rated |'); // not an integer
    expect(cp('Baseline')).toContain('- **Status:** Draft');
    expect(cp('Baseline')).toContain('- **Feedback source:** Not recorded');
    expect(cp('Final')).toContain('- **Status:** Needs revision');
    // Every criterion of every checkpoint has a row; levels use the RUBRIC_LEVELS labels.
    for (const def of CHECKPOINT_DEFS) for (const c of def.rubric) expect(cp(def.label), c.id).toMatch(new RegExp(`\\| ${c.criterion} \\| (Not rated|(${RUBRIC_LEVELS.join('|')}) \\(level \\d of 3\\)) \\|`));
    expect(cps.match(/\| Not rated \|/g)).toHaveLength(15 - 3);
    expect(cps).toContain(`Rubric levels, lowest to highest: ${RUBRIC_LEVELS.join(', ')}.`);
    expect(cps).toMatch(/Reviewer feedback is a manual label: .* not authenticated by this app/);
    // Readiness per checkpoint is reported next to its record.
    expect(cp('Proposal')).toContain('- **Open items for its steps (missing or check):** 0');
    expect(section(passportMarkdown(createProject()), 'Checkpoints')).toContain('- **Open items for its steps (missing or check):** 8');
    // An unrecognised feedback source or status never prints an object member.
    const odd = workedExample();
    Object.assign(odd.passport.review.baseline, { feedbackSource: 'constructor', status: 'toString' });
    expect(section(passportMarkdown(odd), 'Checkpoints')).not.toMatch(/function|native code/);
  });
  it('labels stale and partial sandbox results and keeps the waiting-time disclaimer', () => {
    const d = sampleDoc();
    const fresh = section(passportMarkdown(d), 'Step 6 — Outcomes and experiment');
    expect(fresh).toMatch(/Sandbox run `run-1`: 5 replications completed\./);
    expect(fresh).not.toMatch(/From earlier settings/);
    expect(fresh).toMatch(/does not estimate individual waiting times/);
    expect(fresh).toMatch(/Same arrival traces in each policy pair\./);
    expect(fresh).toMatch(/\| Average end-of-day backlog \| Baseline \| [\d.]+ \| [\d.]+ to [\d.]+ \| [\d.]+ to [\d.]+ \| 5 \|/);
    expect(fresh).toMatch(/- Paired difference in terminal backlog \(alternative − baseline\): mean -?[\d.]+; approximate 95% t interval -?[\d.]+ to -?[\d.]+ \(n = 5\)\./);
    d.sandbox.baseline.capacity.direct = 99;
    expect(section(passportMarkdown(d), 'Step 6 — Outcomes and experiment')).toMatch(/\*\*From earlier settings: inputs have changed since this run\.\*\*/);
    expect(section(passportMarkdown(d), 'Open items at export time')).toMatch(/The sandbox results use earlier settings/);
    const partial = sampleDoc();
    Object.assign(partial.sandbox.lastRun!, { status: 'partial', completedReplications: 3, requestedReplications: 5 });
    expect(passportMarkdown(partial)).toMatch(/3 of 5 replications completed\. Results are partial\./);
    expect(passportHtml(partial)).toMatch(/3 of 5 replications completed\. Results are partial\./);
    // A scenario comparison (different demand) is not presented as a paired policy effect.
    const scenario = sampleDoc();
    scenario.sandbox.alternative!.demand.values = [10, 14, 18];
    scenario.sandbox.lastRun = runAll(scenario.sandbox.baseline, scenario.sandbox.alternative, { id: 'run-2', projectId: scenario.id, modelRevision: 1, createdAt: 'x' });
    const sc = section(passportMarkdown(scenario), 'Step 6 — Outcomes and experiment');
    expect(sc).toMatch(/\*\*Scenario comparison: inputs differ\.\*\*/);
    expect(sc).not.toMatch(/Paired difference|Same arrival traces/);
    // One deterministic run: no interval is invented.
    const single = createProject();
    single.sandbox.lastRun = runAll(single.sandbox.baseline, null, { id: 'run-3', projectId: single.id, modelRevision: 1, createdAt: 'x' });
    expect(section(passportMarkdown(single), 'Step 6 — Outcomes and experiment')).toMatch(/\| Terminal backlog \| Baseline \| 60 \| — \| Interval unavailable: one replication\. \| 1 \|/);
  });
  it('the worked-example run table agrees with the numbers quoted in its conclusion', () => {
    const md = section(passportMarkdown(workedExample()), 'Step 6 — Outcomes and experiment');
    expect(md).toContain('| Average end-of-day backlog | Baseline | 29.92 | 18.19 to 43.42 | 28.31 to 31.53 | 100 |');
    expect(md).toContain('| Average end-of-day backlog | Alternative | 6.09 | 1.07 to 15.09 | 5.18 to 7 | 100 |');
    expect(md).toContain('- Paired difference in average end-of-day backlog (alternative − baseline): mean -23.83; approximate 95% t interval -24.87 to -22.8 (n = 100).');
  });
  it('includes the author only when asked', () => {
    const d = sampleDoc();
    d.passport.identity.author = 'Ana Student';
    expect(passportMarkdown(d)).not.toMatch(/Ana Student/);
    expect(passportMarkdown(d, { includeAuthor: false })).not.toMatch(/Ana Student/);
    expect(passportMarkdown(d, { includeAuthor: true })).toMatch(/^Author: Ana Student$/m);
    expect(passportHtml(d, { includeAuthor: false })).not.toMatch(/Ana Student/);
    expect(passportHtml(d, { includeAuthor: true })).toMatch(/Author: Ana Student/);
  });
  it('the brief stays a short Frame summary', () => {
    const md = briefMarkdown(workedExample());
    expect(md).toMatch(/^# Student support backlog \(worked example\) — problem brief/);
    expect(md).toContain(`- **Question:** ${workedExample().passport.decision.question}`);
    expect(md).not.toMatch(/Checkpoints|Open items/);
    expect(briefMarkdown(createProject())).toMatch(/- \*\*Stakeholder:\*\* _Not yet specified_/);
  });
});

describe('HTML report', () => {
  it('is standalone, escapes user text and loads no external resources', () => {
    const html = passportHtml(sampleDoc());
    expect(html).not.toMatch(/<script>alert/);
    expect(html).toMatch(/&lt;script&gt;/);
    expect(html).not.toMatch(/(src|href)=["']https?:/);
    expect(html).not.toMatch(/<(script|link|img|iframe|object|embed)\b/i);
    expect(html).not.toMatch(/@import|url\(/);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toMatch(/<style>/);
    expect(html).toMatch(/does not estimate individual waiting times/);
    expect(html).toMatch(/No external resources are loaded/);
  });
  it('escapes hostile text in every learner-controlled place', () => {
    const X = '<img src=x onerror=alert(1)>';
    const d = sampleDoc();
    const p = d.passport;
    p.identity.title = `T ${X}`;
    p.identity.author = `A ${X}`;
    p.decision.stakeholder = `S ${X}\nsecond line ${X}`;
    p.inputs[0].name = `I ${X}`; p.inputs[0].unit = ''; // the name is quoted by an open-items message
    p.assumptions[0].statement = `As ${X}`; p.assumptions[0].rationale = `R ${X}\nmore ${X}`;
    p.outcomes.push({ id: 'o1', metric: `M ${X}`, definition: X, unit: X, direction: 'lower', aggregation: X, criterion: X });
    p.representation.nodes.push({ id: 'n1', type: 'entity', label: `N ${X}`, x: 0, y: 0 });
    p.representation.notes = X;
    p.selfChecks['frame-decide'] = `SC ${X}`;
    p.review.proposal = { status: 'teacher-reviewed', notes: `Note ${X}\n${X}`, reviewer: `Rev ${X}`, feedbackSource: 'teacher', due: '2026-12-01', rubric: {} };
    d.methods.ruleVersion = X;
    d.lensNotes.push({ id: 'l1', lensId: X, text: X, createdAt: 'x' });
    d.sandbox.lastRun!.id = X; d.sandbox.lastRun!.seed = X; d.sandbox.lastRun!.engineVersion = X; d.sandbox.lastRun!.rngVersion = X;
    d.sandbox.lastRun!.baseline.label = X;
    const html = passportHtml(d, { includeAuthor: true, generatedAt: X });
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain('onerror=alert(1)>');
    expect(html.match(/&lt;img src=x onerror=alert\(1\)&gt;/g)!.length).toBeGreaterThanOrEqual(25);
    for (const marker of ['T ', 'A ', 'S ', 'I ', 'As ', 'R ', 'M ', 'N ', 'SC ', 'Note ', 'Rev ']) expect(html, marker).toContain(`${marker}&lt;img src=x onerror=alert(1)&gt;`);
    // The open-items message that quotes the input name is escaped too.
    expect(html).toContain('“I &lt;img src=x onerror=alert(1)&gt;” has no unit.');
    expect(html).not.toMatch(/(src|href)=["']https?:/);
  });
  it('labels stale results in HTML and Markdown', () => {
    const d = sampleDoc();
    expect(passportHtml(d)).not.toMatch(/From earlier settings/);
    d.sandbox.baseline.capacity.direct = 99;
    expect(passportHtml(d)).toMatch(/From earlier settings/);
    expect(passportMarkdown(d)).toMatch(/From earlier settings/);
  });
  it('follows the compass structure: step headings, self-checks, open items, checkpoints, appendix', () => {
    const d = workedExample();
    d.passport.review.proposal.rubric = { question: 3 };
    d.passport.selfChecks['conclude-repro'] = '';
    const html = passportHtml(d, OPTS);
    const h2 = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(h2).toEqual([...STEPS.map((s) => `Step ${s.number} — ${s.title}`), 'Open items at export time', 'Checkpoints', 'Appendix — sandbox results in detail']);
    expect(html).toMatch(/<p class="note">7 of 7 steps started\. .*not a measure of model validity or of review status\.<\/p>/);
    expect(html).toContain('<title>Student support backlog (worked example) — model passport</title>');
    expect(html.match(/<th scope="col">Self-check question<\/th>/g)).toHaveLength(7);
    expect(html).toContain(`<td>${STEPS[0].selfChecks[0].question}</td><td>Observed concern:`);
    expect(html).toContain('<td><em>Not yet answered</em></td>');
    expect(html).toContain('<code>compass-rules-v1</code>');
    expect(html).toContain('<h3>Missing (0)</h3>');
    expect(html).toContain('<h3>Check (0)</h3>');
    expect(html).toContain('<h3>Suggestion (0)</h3>');
    expect(html).toContain('<h3>Proposal checkpoint (steps 1 and 2)</h3>');
    expect(html).toContain('<td>Answerable question</td><td>Strong (level 3 of 3)</td>');
    expect(html).toContain('<td>Limitations</td><td>Not rated</td>');
    expect(html).toMatch(/<em>Reviewer feedback is a manual label: .*not authenticated by this app\.<\/em>/);
    expect(html).toMatch(/Baseline daily table, replication 1/);
    expect(html).toContain('on 2026-11-20T12:00:00.000Z');
    // Balanced markup for the block elements the renderer emits.
    for (const tag of ['table', 'ul', 'ol', 'li', 'p', 'tr', 'h2', 'h3']) expect(html.match(new RegExp(`<${tag}[ >]`, 'g'))!.length, tag).toBe(html.match(new RegExp(`</${tag}>`, 'g'))!.length);
  });
  it('opens with a cover (question, counts), a contents list and one section per heading', () => {
    const d = workedExample();
    const html = passportHtml(d, OPTS);
    expect(html).toContain(`<div class="lead"><span>Question</span><p>${d.passport.decision.question}</p></div>`);
    expect(html).toContain('<li><b>7 of 7</b> steps started</li><li>Method: <b>System dynamics</b></li><li>Open items: <b>0</b> missing · <b>0</b> to check</li>');
    for (const s of STEPS) {
      expect(html).toContain(`<li class="t${s.number}"><a href="#step-${s.number}"><i>${s.number}</i>${s.title}</a></li>`);
      expect(html).toContain(`<section id="step-${s.number}" class="sec t${s.number}">\n<h2>Step ${s.number} — ${s.title}</h2>`);
    }
    for (const id of ['open-items', 'checkpoints', 'appendix']) { expect(html).toContain(`href="#${id}"`); expect(html).toContain(`<section id="${id}" class="sec">`); }
    expect(html.match(/<section /g)!.length).toBe(html.match(/<\/section>/g)!.length);
    expect(html).toContain('Created 21 Nov 2026, 00:00 UTC');
    // an unframed project has no question block, and the hostile-text test above covers escaping of the question
    expect(passportHtml(createProject())).not.toContain('class="lead"');
  });
  it('formats ISO timestamps and passes anything else through on one line', () => {
    expect(humanDate('2026-03-05T09:07:11.000Z')).toBe('5 Mar 2026, 09:07 UTC');
    expect(humanDate('not a date\nsecond')).toBe('not a date second');
    expect(humanDate('2026-13-05T09:07:11.000Z')).toBe('2026-13-05T09:07:11.000Z');
  });
  it('an empty project renders every placeholder and all open items', () => {
    const html = passportHtml(createProject());
    expect(html).toMatch(/0 of 7 steps started/);
    expect(html).toContain('<em>Not yet specified</em>');
    expect(html.match(/<em>Not yet answered<\/em>/g)).toHaveLength(14);
    expect(html).toContain('<h3>Missing (22)</h3>');
    expect(html).toContain('<li>Step 1 — Frame: No stakeholder yet: who will use the result?</li>');
    expect(html).toContain('No sandbox run included.');
  });
  it('the Markdown renderer keeps tables, nested lists and continuation lines apart', () => {
    const html = markdownToHtml(['- **A:** one', '  two', '- **B:** three', '', '1. **S** (x)', '   - Rationale: r1', '     r2', '   - Check: c', '2. **T**', '', '| h1 | h2 |', '| --- | --- |', '| a \\| b | c |', '', '> note', 'plain <b>'].join('\n'));
    expect(html).toBe([
      '<ul><li><strong>A:</strong> one<br>two</li><li><strong>B:</strong> three</li></ul>',
      '<ol><li><strong>S</strong> (x)<ul><li>Rationale: r1<br>r2</li><li>Check: c</li></ul></li><li><strong>T</strong></li></ol>',
      '<div class="table-wrap"><table><thead><tr><th scope="col">h1</th><th scope="col">h2</th></tr></thead><tbody><tr><td>a | b</td><td>c</td></tr></tbody></table></div>',
      '<p class="note">note</p>',
      '<p>plain &lt;b&gt;</p>',
    ].join('\n'));
  });
});

describe('CSV and ZIP exports', () => {
  it('CSV: unlocalised numbers, run id and status on every row, formula injection neutralised', () => {
    const d = sampleDoc();
    const csv = runToCsv(d, d.sandbox.lastRun!);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toMatch(/^run_id,run_status,stale,row_type/);
    expect(lines.slice(1).every((l) => l.startsWith('run-1,complete,false,'))).toBe(true);
    expect(lines.slice(1).filter((l) => l.includes(',replication,')).length).toBe(10);
    expect(lines.slice(1).filter((l) => l.includes(',daily,')).length).toBe(60);
    expect(lines.every((l) => l.split(',').length === lines[0].split(',').length)).toBe(true);
    // Every numeric cell is a plain dot-decimal number: no thousands separators, no decimal commas, no spaces.
    for (const l of lines.slice(1)) for (const c of l.split(',').slice(5)) expect(c, l).toMatch(/^(|-?\d+(\.\d+)?(e-?\d+)?)$/);
    expect(csvText('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvText('+1')).toBe(`'+1`);
    expect(csvText('@cmd')).toBe(`'@cmd`);
    d.sandbox.baseline.capacity.direct = 99;
    expect(runToCsv(d, d.sandbox.lastRun!).trim().split('\r\n').slice(1).every((l) => l.startsWith('run-1,complete,true,'))).toBe(true);
  });
  it('the worked example exports 100 replication rows per policy', () => {
    const d = workedExample();
    const lines = runToCsv(d, d.sandbox.lastRun!).trim().split('\r\n');
    expect(lines.filter((l) => l.startsWith('run-example,complete,false,replication,Baseline,'))).toHaveLength(100);
    expect(lines.filter((l) => l.startsWith('run-example,complete,false,replication,Alternative,'))).toHaveLength(100);
  });
  it('ZIP is valid (verified with unzip -t) and contains a manifest with the compass rules version', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const zip = buildExportZip(sampleDoc(), ['passport-md', 'project-json', 'report-html', 'results-csv'], OPTS);
    const dir = mkdtempSync(join(tmpdir(), 'modsim-zip-'));
    const f = join(dir, 'x.zip');
    writeFileSync(f, zip);
    const out = execFileSync('unzip', ['-t', f]).toString();
    expect(out).toMatch(/No errors detected/);
    const manifest = JSON.parse(execFileSync('unzip', ['-p', f, 'manifest.json']).toString());
    expect(manifest.files).toHaveLength(4);
    expect(manifest.sandboxRun.completedReplications).toBe(5);
    expect(manifest.sandboxRun.stale).toBe(false);
    expect(manifest.app).toBe('ModSim Essentials');
    expect(manifest.appVersion).toBe('3.0.0');
    expect(manifest.compassRulesVersion).toBe('compass-rules-v1');
    expect(manifest.compassRulesVersion).toBe(COMPASS_RULES_VERSION);
    expect(manifest.methodRuleVersion).toBe('method-rules-v1');
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.stepsStarted).toEqual({ started: 2, total: 7 });
    expect(manifest.generatedAt).toBe(OPTS.generatedAt);
    // The files in the archive are the same text the single-file exports produce.
    const slug = slugify(sampleDoc().passport.identity.title);
    expect(manifest.files.map((x: { path: string }) => x.path)).toEqual([`${slug}-passport.md`, `${slug}.modsim.json`, `${slug}-report.html`, `${slug}-sandbox-results.csv`]);
    const md = execFileSync('unzip', ['-p', f, `${slug}-passport.md`]).toString();
    expect(md).toMatch(/^# Support <script>alert\(1\)<\/script> \| test — model passport/);
    expect(md).toMatch(/## Step 7 — Conclude and share/);
    expect(md).toMatch(/## Open items at export time/);
    expect(md).toMatch(/## Checkpoints/);
  });
  it('a worked-example export contains all seven step titles in every text format, and a clean manifest', () => {
    const d = workedExample();
    const md = renderPart(d, 'passport-md', OPTS)!;
    const html = renderPart(d, 'report-html', OPTS)!;
    let last = -1;
    for (const s of STEPS) {
      const at = md.indexOf(`## Step ${s.number} — ${s.title}\n`);
      expect(at, s.title).toBeGreaterThan(last);
      last = at;
      expect(html, s.title).toContain(`<h2>Step ${s.number} — ${s.title}</h2>`);
    }
    expect(renderPart(d, 'brief-md', OPTS)).toMatch(/problem brief/);
    expect(renderPart(d, 'results-csv', OPTS)).toMatch(/^run_id,/);
    expect(renderPart(createProject(), 'results-csv', OPTS)).toBeNull();
    const manifest = buildManifest(d, [], OPTS.generatedAt);
    expect(manifest).toMatchObject({ compassRulesVersion: 'compass-rules-v1', stepsStarted: { started: 7, total: 7 }, openItems: { missing: 0, check: 0, suggestion: 0 }, projectId: 'worked-example' });
    expect(manifest.sandboxRun).toMatchObject({ id: 'run-example', status: 'complete', stale: false, seed: 'compass-example', completedReplications: 100 });
    expect(buildManifest(createProject(), [], OPTS.generatedAt)).toMatchObject({ openItems: { missing: 22, check: 0, suggestion: 1 }, sandboxRun: null });
    const zip = buildExportZip(d, EXPORT_PARTS.map((p) => p.id), OPTS);
    const f = join(mkdtempSync(join(tmpdir(), 'modsim-zip-')), 'example.zip');
    writeFileSync(f, zip);
    expect(execFileSync('unzip', ['-t', f]).toString()).toMatch(/No errors detected/);
    expect(JSON.parse(execFileSync('unzip', ['-p', f, 'manifest.json']).toString()).files).toHaveLength(5);
    expect(slugify(d.passport.identity.title)).toBe('student-support-backlog-worked-example');
  });
  it('author is excluded from the JSON export unless included', () => {
    const d = sampleDoc();
    d.passport.identity.author = 'Ana Student';
    const zip = buildExportZip(d, ['project-json', 'passport-md', 'report-html', 'brief-md'], OPTS);
    expect(new TextDecoder().decode(zip)).not.toMatch(/Ana Student/);
    const withAuthor = buildExportZip(d, ['project-json', 'passport-md', 'report-html'], { ...OPTS, includeAuthor: true });
    expect(new TextDecoder().decode(withAuthor).match(/Ana Student/g)!.length).toBe(3);
  });
});
