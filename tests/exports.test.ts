import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workedExample } from '../src/content/workedExample';
import { isSafeSvg } from '../src/features/toolbox/SvgFigure';
import { KINDS, kindDef } from '../src/domain/artefacts/kinds';
import { CHECKPOINT_DEFS, COMPASS_RULES_VERSION, RUBRIC_LEVELS, STEPS, compassWarnings } from '../src/domain/passport/compass';
import { createProject, newId, type Inclusion, type ProjectDoc } from '../src/domain/passport/schema';
import { parseProjectJson, importProjectObject } from '../src/domain/passport/importer';
import { APP_VERSION, EXPORT_PARTS, artefactFiles, buildExportZip, buildManifest, projectJson, renderPart, slugify } from '../src/exports/bundle';
import { csvText } from '../src/exports/csv';
import { markdownToHtml, passportHtml } from '../src/exports/html';
import { APP_NAME, briefMarkdown, humanDate, passportMarkdown, stepHeading } from '../src/exports/markdown';
import { crc32 } from '../src/exports/zip';

function sampleDoc() {
  const d = createProject({ title: 'Support <script>alert(1)</script> | test' });
  d.passport.decision.question = 'How does backlog change?';
  d.passport.inputs.push({ id: newId('in'), name: 'Arrivals', value: '12', unit: 'req-eq/day', sourceType: 'synthetic', provenance: 'fixture', uncertainty: '' });
  d.passport.assumptions.push({ id: newId('as'), statement: 'Unused capacity is lost', rationale: '', consequenceIfWrong: '', plannedCheck: '', evidenceKind: 'assumed', sourceNote: '' });
  return d;
}
/** The worked example's copy of one kind. */
const copyOf = (d: ProjectDoc, kind: Inclusion['kind']) => d.artefacts.find((i) => i.kind === kind)!;
/** Every picture embedded in a report. */
const svgsIn = (html: string) => html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];

/** The part of a Markdown export that belongs to one `##` section. */
function section(md: string, heading: string): string {
  const start = md.indexOf(`## ${heading}`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const next = md.indexOf('\n## ', start + 1);
  return md.slice(start, next === -1 ? undefined : next);
}
const OPTS = { includeAuthor: false, generatedAt: '2026-11-20T12:00:00.000Z' };

describe('JSON round-trip and import validation', () => {
  it('export → import preserves the project fields and the included artefacts', () => {
    const d = sampleDoc();
    d.passport.selfChecks['frame-decide'] = 'Hire or not.';
    d.passport.review.proposal.rubric = { question: 2 };
    d.artefacts = [copyOf(workedExample(), 'comparison'), copyOf(workedExample(), 'check-plan')];
    const res = parseProjectJson(projectJson(d));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.project;
    expect(p.passport).toEqual(d.passport);
    expect(p.artefacts).toEqual(d.artefacts);
    expect(p.preservedUnknown).toBeUndefined();
    expect(res.warnings).toEqual([]);
    expect(JSON.parse(projectJson(d))).not.toHaveProperty('sandbox'); // the retired sandbox is not written
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
    evil.passport.scope.horizon = ['many'];
    evil.sandbox = { lastRun: '<script>alert(1)</script>', baseline: { horizon: 'many' } }; // a version 3 file: ignored
    const r = importProjectObject(evil);
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (r.ok) {
      expect(r.project.passport.inputs[0].unit).toBe('');
      expect(r.project.passport.scope.horizon).toBe('');
      expect(r.warnings.length).toBeGreaterThan(0);
      expect('sandbox' in r.project).toBe(false);
      expect(r.project.preservedUnknown).toBeUndefined();
      expect(r.warnings.join(' ')).not.toMatch(/sandbox/i);
    }
  });
  it('the JSON export records the app name and version 3.0.0', () => {
    expect(APP_VERSION).toBe('3.0.0');
    expect(JSON.parse(projectJson(sampleDoc())).exportedBy).toEqual({ app: 'ModSimCompass', version: '3.0.0' });
    expect(APP_NAME).toBe('ModSimCompass');
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
    expect(md).toMatch(/Conceptual model: _Not yet specified_/);
    expect(md).not.toMatch(/sandbox|Included artefact/i);
  });
  it('lists the seven steps in order with their titles, then open items, then checkpoints', () => {
    for (const doc of [createProject(), sampleDoc(), workedExample()]) {
      const md = passportMarkdown(doc);
      const h2 = md.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
      expect(h2).toEqual([...STEPS.map((s) => `Step ${s.number} — ${s.title}`), 'Open items at export time', 'Checkpoints']);
      expect(md.split('\n').filter((l) => l.startsWith('# '))).toHaveLength(1);
    }
    expect(STEPS.map(stepHeading)).toEqual(['Step 1 — Frame', 'Step 2 — Concept and scope', 'Step 3 — Choose a method', 'Step 4 — Inputs and assumptions', 'Step 5 — Verification and validation', 'Step 6 — Outcomes and experiment', 'Step 7 — Conclude and share']);
  });
  it('reports step progress from stepsStarted, separately for each step', () => {
    const d = sampleDoc(); // question (step 1), one input and one assumption (step 4)
    const md = passportMarkdown(d);
    expect(md).toMatch(/> 2 of 7 steps started\./);
    expect(section(md, 'Step 1 — Frame')).toMatch(/Step status: started\./);
    expect(section(md, 'Step 4 — Inputs and assumptions')).toMatch(/Step status: started\./);
    expect(section(md, 'Step 2 — Concept and scope')).toMatch(/Step status: not started\./);
    expect(passportMarkdown(workedExample())).toMatch(/> 7 of 7 steps started\./);
  });
  it('puts each passport field under its own step', () => {
    const md = passportMarkdown(workedExample());
    const p = workedExample().passport;
    expect(section(md, 'Step 1 — Frame')).toContain(`- **Stakeholder:** ${p.decision.stakeholder}`);
    expect(section(md, 'Step 1 — Frame')).toContain('- **Claim type:** Decision support');
    expect(section(md, 'Step 1 — Frame')).toContain(`- **Precise question:** ${p.decision.question}`);
    // The included conceptual model is the record of the concept: the earlier sketch table is not repeated.
    expect(section(md, 'Step 2 — Concept and scope')).toContain('### Included artefact — Conceptual model: Student support backlog: conceptual model');
    expect(section(md, 'Step 2 — Concept and scope')).not.toContain('| Library desk | forwards requests | Daily arrivals | yes |');
    expect(section(md, 'Step 2 — Concept and scope')).toContain('- **Time unit:** day');
    expect(section(md, 'Step 3 — Choose a method')).toContain('- **Primary method:** System dynamics');
    expect(section(md, 'Step 3 — Choose a method')).toContain('- **Alternative method:** Discrete-event simulation');
    expect(section(md, 'Step 3 — Choose a method')).toMatch(/rule table method-rules-v1; shortlist: System dynamics, Discrete-event simulation/);
    expect(section(md, 'Step 3 — Choose a method')).toContain('| At what level must the outcome be reported? | Aggregate totals or averages |');
    expect(section(md, 'Step 3 — Choose a method')).not.toMatch(/granularity: aggregate/);
    // Without an included method choice, the project's own record of the answers is reported instead.
    const bare = workedExample(); bare.artefacts = [];
    expect(section(passportMarkdown(bare), 'Step 3 — Choose a method')).toContain('| At what level must the outcome be reported? | Aggregate totals or averages |');
    expect(section(passportMarkdown(bare), 'Step 2 — Concept and scope')).toContain('| Library desk | forwards requests | Daily arrivals | yes |');
    expect(section(md, 'Step 4 — Inputs and assumptions')).toMatch(/\| Daily arrivals \| 8, 12 or 16 .* \| request-equivalents\/day \| Synthetic \/ illustrative \| Synthetic teaching data/);
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
    expect(md.split('\n').filter((l) => /^#+ /.test(l))).toHaveLength(1 + 9 + 3 + 5 + d.artefacts.length);
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
    expect(md).toMatch(/the app never scores them/);
    expect(md).not.toMatch(/grade/i);
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
    expect(open).toContain('compass-rules-v4');
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
    expect(group('Suggestion')).toContain('- Step 2 — Concept and scope: Draw the conceptual model in the Toolbox and add it to this step.');
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
    d.passport.review.baseline = { status: 'draft', notes: '', reviewer: '', feedbackSource: '', due: '', rubric: {} };
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
    // Proposal: boundary. Design: two invalid levels. Baseline: all three. Evaluation and Final keep the example’s own ratings.
    expect(cps.match(/\| Not rated \|/g)).toHaveLength(1 + 2 + 3);
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
  it('reports each included artefact under its step, as it was added, with the kind’s own section', () => {
    const d = workedExample();
    const md = passportMarkdown(d);
    for (const inc of d.artefacts) {
      const def = kindDef(inc.kind);
      const part = section(md, stepHeading(STEPS.find((s) => s.id === def.step)!));
      const head = `### Included artefact — ${def.label}: ${inc.title}`;
      expect(part, inc.kind).toContain(head);
      expect(part.slice(part.indexOf(head)), inc.kind).toContain('Added 21 Nov 2026, 00:00 UTC. This is the copy kept in the project, as it was when it was added.');
      for (const line of def.markdown(inc.data).filter((l) => l.trim())) expect(part, `${inc.kind}: ${line}`).toContain(line);
      // A copy appears under its own step only.
      expect(md.split(head)).toHaveLength(2);
    }
    expect(md).not.toMatch(/sandbox|Appendix/i);
  });
  it('a copy whose kind cannot write its section leaves a line instead of breaking the report', () => {
    const d = workedExample();
    (copyOf(d, 'comparison') as { data: unknown }).data = { baseline: 'not a list' };
    expect(() => passportMarkdown(d)).not.toThrow();
    expect(() => passportHtml(d)).not.toThrow();
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
    expect(html).toMatch(/No external resources are loaded/);
  });
  it('places each picture an artefact draws after its section, and only pictures that pass the safety check', () => {
    const d = workedExample();
    const html = passportHtml(d);
    const drawn = d.artefacts.filter((i) => isSafeSvg(kindDef(i.kind).figure(i.data)));
    expect(svgsIn(html)).toHaveLength(drawn.length);
    for (const svg of svgsIn(html)) expect(isSafeSvg(svg), svg.slice(0, 80)).toBe(true);
    for (const inc of drawn) expect(html).toContain(`<div class="fig" role="img" aria-label="Picture of ${inc.title}">`);
    // Nothing is loaded from outside: a picture may refer only to itself.
    expect(html).not.toMatch(/(src|href)=["']https?:/);
    expect(html.replace(/url\(#[^)]*\)/g, '')).not.toMatch(/@import|url\(/);
    expect(html).not.toMatch(/<(script|link|img|iframe|object|embed|foreignObject)\b/i);
    // A picture that is refused is simply left out.
    const bad = workedExample();
    const original = KINDS.comparison.figure;
    try {
      (KINDS.comparison as { figure: unknown }).figure = () => '<svg><script>alert(1)</script></svg>';
      expect(passportHtml(bad)).not.toMatch(/<script>alert/);
    } finally { (KINDS.comparison as { figure: unknown }).figure = original; }
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
    // An included copy: its title, its own text and the date it was added.
    const cmp = structuredClone(copyOf(workedExample(), 'comparison'));
    if (cmp.kind !== 'comparison') throw new Error('expected a comparison');
    Object.assign(cmp, { title: `C ${X}`, addedAt: X });
    Object.assign(cmp.data, { outcome: X, unit: X, baselineLabel: X, alternativeLabel: X, note: X });
    d.artefacts = [cmp];
    const html = passportHtml(d, { includeAuthor: true, generatedAt: X });
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain('onerror=alert(1)>');
    expect(html.match(/&lt;img src=x onerror=alert\(1\)&gt;/g)!.length).toBeGreaterThanOrEqual(25);
    for (const marker of ['T ', 'A ', 'S ', 'I ', 'As ', 'R ', 'M ', 'N ', 'SC ', 'Note ', 'Rev ', 'C ']) expect(html, marker).toContain(`${marker}&lt;img src=x onerror=alert(1)&gt;`);
    for (const svg of svgsIn(html)) expect(isSafeSvg(svg)).toBe(true);
    // The open-items message that quotes the input name is escaped too.
    expect(html).toContain('“I &lt;img src=x onerror=alert(1)&gt;” has no unit.');
    expect(html).not.toMatch(/(src|href)=["']https?:/);
  });
  it('follows the compass structure: step headings, artefacts, self-checks, open items, checkpoints', () => {
    const d = workedExample();
    d.passport.review.proposal.rubric = { question: 3 };
    delete d.passport.review.final.rubric.limits;
    d.passport.selfChecks['conclude-repro'] = '';
    const html = passportHtml(d, OPTS);
    const h2 = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(h2).toEqual([...STEPS.map((s) => `Step ${s.number} — ${s.title}`), 'Open items at export time', 'Checkpoints']);
    expect(html.match(/<div class="artefact">/g)).toHaveLength(d.artefacts.length);
    for (const inc of d.artefacts) expect(html).toContain(`<h3>Included artefact — ${KINDS[inc.kind].label}: ${inc.title}</h3>`);
    expect(html).toMatch(/<p class="note">7 of 7 steps started\. .*not a measure of model validity or of review status\.<\/p>/);
    expect(html).toContain('<title>Student support backlog (worked example) — project report</title>');
    expect(html.match(/<th scope="col">Self-check question<\/th>/g)).toHaveLength(7);
    expect(html).toContain(`<td>${STEPS[0].selfChecks[0].question}</td><td>Observed concern:`);
    expect(html).toContain('<td><em>Not yet answered</em></td>');
    expect(html).toContain('<code>compass-rules-v4</code>');
    expect(html).toContain('<h3>Missing (0)</h3>');
    expect(html).toContain('<h3>Check (0)</h3>');
    expect(html).toContain('<h3>Suggestion (0)</h3>');
    expect(html).toContain('<h3>Proposal checkpoint (steps 1 and 2)</h3>');
    expect(html).toContain('<td>Answerable question</td><td>Strong (level 3 of 3)</td>');
    expect(html).toContain('<td>Limitations</td><td>Not rated</td>');
    expect(html).toMatch(/<em>Reviewer feedback is a manual label: .*not authenticated by this app\.<\/em>/);
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
    for (const id of ['open-items', 'checkpoints']) { expect(html).toContain(`href="#${id}"`); expect(html).toContain(`<section id="${id}" class="sec">`); }
    expect(html).toContain(`<li>Artefacts: <b>${d.artefacts.length}</b></li>`);
    expect(html).not.toMatch(/appendix|sandbox/i);
    expect(html.match(/<section /g)!.length).toBe(html.match(/<\/section>/g)!.length);
    expect(html).toContain('created 21 Nov 2026, 00:00 UTC');
    expect(html).toMatch(/<em>For reference: project ID <code>worked-example<\/code> · schema v3 · project revision 1\.<\/em>/);
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
    expect(html).not.toMatch(/Appendix|Sandbox results/);
  });
  it('the Markdown renderer keeps tables, nested lists and continuation lines apart', () => {
    const html = markdownToHtml(['- **A:** one', '  two', '- **B:** three', '', '1. **S** (x)', '   - Rationale: r1', '     r2', '   - Check: c', '2. **T**', '', '| h1 | h2 |', '| --- | --- |', '| a \\| b | c |', '', '> note', 'plain <b>'].join('\n'));
    expect(html).toBe([
      '<ul><li><strong>A:</strong> one<br>two</li><li><strong>B:</strong> three</li></ul>',
      '<ol><li><strong>S</strong> (x)<ul><li>Rationale: r1<br>r2</li><li>Check: c</li></ul></li><li><strong>T</strong></li></ol>',
      '<div class="table-wrap" tabindex="0"><table><thead><tr><th scope="col">h1</th><th scope="col">h2</th></tr></thead><tbody><tr><td>a | b</td><td>c</td></tr></tbody></table></div>',
      '<p class="note">note</p>',
      '<p>plain &lt;b&gt;</p>',
    ].join('\n'));
  });
});

describe('CSV helper and ZIP exports', () => {
  it('a CSV text cell neutralises spreadsheet formulas and quotes what needs quoting', () => {
    expect(csvText('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvText('+1')).toBe(`'+1`);
    expect(csvText('@cmd')).toBe(`'@cmd`);
    expect(csvText('-2')).toBe(`'-2`);
    expect(csvText('a,b')).toBe('"a,b"');
    expect(csvText('plain')).toBe('plain');
  });
  it('ZIP is valid (verified with unzip -t) and contains a manifest with the compass rules version', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const zip = buildExportZip(sampleDoc(), ['passport-md', 'project-json', 'report-html'], OPTS);
    const dir = mkdtempSync(join(tmpdir(), 'modsim-zip-'));
    const f = join(dir, 'x.zip');
    writeFileSync(f, zip);
    const out = execFileSync('unzip', ['-t', f]).toString();
    expect(out).toMatch(/No errors detected/);
    const manifest = JSON.parse(execFileSync('unzip', ['-p', f, 'manifest.json']).toString());
    expect(manifest.files).toHaveLength(3);
    expect(manifest).not.toHaveProperty('sandboxRun');
    expect(manifest).toMatchObject({ artefactsIncluded: 0, artefacts: [] });
    expect(manifest.app).toBe('ModSimCompass');
    expect(manifest.appVersion).toBe('3.0.0');
    expect(manifest.compassRulesVersion).toBe('compass-rules-v4');
    expect(manifest.compassRulesVersion).toBe(COMPASS_RULES_VERSION);
    expect(manifest.methodRuleVersion).toBe('method-rules-v1');
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.stepsStarted).toEqual({ started: 2, total: 7 });
    expect(manifest.generatedAt).toBe(OPTS.generatedAt);
    // The files in the archive are the same text the single-file exports produce.
    const slug = slugify(sampleDoc().passport.identity.title);
    expect(manifest.files.map((x: { path: string }) => x.path)).toEqual([`${slug}-report.md`, `${slug}.modsim.json`, `${slug}-report.html`]);
    const md = execFileSync('unzip', ['-p', f, `${slug}-report.md`]).toString();
    expect(md).toMatch(/^# Support <script>alert\(1\)<\/script> \| test — project report/);
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
    expect(EXPORT_PARTS.map((p) => p.id)).toEqual(['brief-md', 'passport-md', 'project-json', 'report-html']);
    const manifest = buildManifest(d, [], OPTS.generatedAt);
    expect(manifest).toMatchObject({ compassRulesVersion: 'compass-rules-v4', stepsStarted: { started: 7, total: 7 }, openItems: { missing: 0, check: 0, suggestion: 0 }, projectId: 'worked-example', artefactsIncluded: 5 });
    expect(manifest).not.toHaveProperty('sandboxRun');
    expect(buildManifest(createProject(), [], OPTS.generatedAt)).toMatchObject({ openItems: { missing: 22, check: 0, suggestion: 1 }, artefactsIncluded: 0 });
    const zip = buildExportZip(d, EXPORT_PARTS.map((p) => p.id), OPTS);
    const f = join(mkdtempSync(join(tmpdir(), 'modsim-zip-')), 'example.zip');
    writeFileSync(f, zip);
    expect(execFileSync('unzip', ['-t', f]).toString()).toMatch(/No errors detected/);
    const listed = JSON.parse(execFileSync('unzip', ['-p', f, 'manifest.json']).toString());
    expect(listed.files).toHaveLength(4);
    expect(slugify(d.passport.identity.title)).toBe('student-support-backlog-worked-example');
    // Each included copy as its own artefact file (and its picture, when its kind draws one), listed with its step.
    const files = artefactFiles(d, OPTS.generatedAt);
    expect(listed.artefacts.map((a: { kind: string; step: string; file: string }) => [a.kind, a.step, a.file])).toEqual(files.map((a) => [a.kind, KINDS[a.kind].step, a.file]));
    const names = execFileSync('unzip', ['-Z1', f]).toString().trim().split('\n');
    for (const a of files) {
      expect(names).toContain(a.file);
      const back = JSON.parse(execFileSync('unzip', ['-p', f, a.file]).toString());
      expect(back).toMatchObject({ schema: 'modsimcompass/artefact', kind: a.kind, title: a.title });
      if (a.figure) { expect(names).toContain(a.figure); expect(isSafeSvg(execFileSync('unzip', ['-p', f, a.figure]).toString().replace(/^<\?xml[^>]*>\s*/, ''))).toBe(true); }
    }
    // They can be left out; the reports and the project file still hold every copy.
    const lean = buildExportZip(d, ['report-html'], { ...OPTS, includeArtefacts: false });
    const g = join(mkdtempSync(join(tmpdir(), 'modsim-zip-')), 'lean.zip');
    writeFileSync(g, lean);
    expect(execFileSync('unzip', ['-Z1', g]).toString().trim().split('\n').sort()).toEqual(['manifest.json', 'student-support-backlog-worked-example-report.html']);
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

import { includeArtefact as include } from '../src/domain/artefacts/include';
import { createArtefact } from '../src/domain/artefacts/file';
import { kindDef as kd } from '../src/domain/artefacts/kinds';
import type { Artefact as Art, MeasurementData } from '../src/domain/artefacts/types';

describe('the report speaks the project’s method', () => {
  const NOW = '2026-11-21T10:00:00.000Z';
  const pls = () => {
    const d = createProject({ title: 'Service quality and loyalty', now: NOW });
    d.passport.representation.primaryMethod = 'pls-sem';
    d.passport.experiment = { baseline: 'H1: quality → loyalty (+)', alternatives: 'Model without the mediator', comparison: '5,000 bootstrap resamples, 95% intervals', runSettings: 'Path weighting, seed 7' };
    const a = { ...createArtefact('measurement-data', { now: NOW }), revision: 1, data: { ...kd('measurement-data').empty(), source: 'Client survey, May 2026', cases: 180, items: [{ id: 'i1', column: 'q1', label: '', reverse: false, summary: null }, { id: 'i2', column: 'q2', label: '', reverse: false, summary: null }], constructs: [{ id: 'c1', name: 'Loyalty', mode: 'reflective', items: ['i1', 'i2'], alpha: 0.8 }] } as MeasurementData } as Art<'measurement-data'>;
    include(d, a, NOW);
    return d;
  };
  it('step 4, 5 and 6 labels, self-checks and the checkpoint rubric follow a statistical model', () => {
    const md = passportMarkdown(pls());
    const step = (h: string) => md.slice(md.indexOf(`## ${h}`), md.indexOf('\n## ', md.indexOf(`## ${h}`) + 1));
    expect(step('Step 4 — Inputs and assumptions')).toMatch(/^Measured variables:$/m);
    expect(step('Step 4 — Inputs and assumptions')).toContain('| Loyalty |');
    expect(step('Step 5 — Verification and validation')).toContain('- **Estimation (kept separate from validation):**');
    expect(step('Step 5 — Verification and validation')).toContain('| Which cases will you keep aside to test prediction? |');
    const six = step('Step 6 — Outcomes and experiment');
    for (const l of ['- **Hypotheses and their paths:** H1: quality → loyalty (+)', '- **Rival models or groups:** Model without the mediator', '- **How effects are tested:** 5,000 bootstrap resamples, 95% intervals', '- **Estimation settings:** Path weighting, seed 7']) expect(six).toContain(l);
    expect(six).not.toMatch(/\*\*(Baseline|Run settings):\*\*/);
    expect(six).toContain('| Which result would contradict each hypothesis? |');
    expect(md).toContain('| Analysis plan | Not rated |');
    expect(md).toContain('| Measurement quality | Not rated |');
    expect(md).toContain('rule table `compass-rules-v4`');
    // The worked example keeps the general labels.
    const ex = passportMarkdown(workedExample());
    expect(ex).toMatch(/^Inputs:$/m);
    expect(ex).toContain('- **Calibration (kept separate from validation):**');
    expect(ex).toContain('| Fair comparison |');
  });
});

import { artefactJson, parseArtefactJson } from '../src/domain/artefacts/file';
import { ARTEFACT_SCHEMA } from '../src/domain/artefacts/types';
import { PASSPORT_SCHEMA } from '../src/domain/passport/schema';

describe('the app is called ModSimCompass; files written under its earlier names still open', () => {
  it('a new project file and a new artefact file carry the new name', () => {
    expect(PASSPORT_SCHEMA).toBe('modsimcompass/project');
    expect(ARTEFACT_SCHEMA).toBe('modsimcompass/artefact');
    const file = JSON.parse(projectJson(sampleDoc()));
    expect(file).toMatchObject({ schema: 'modsimcompass/project', exportedBy: { app: 'ModSimCompass' } });
    // A project stored on the device under an earlier name is written under the current one.
    expect(JSON.parse(projectJson({ ...sampleDoc(), schema: 'modsim-essentials/project' as typeof PASSPORT_SCHEMA })).schema).toBe('modsimcompass/project');
    const art = JSON.parse(artefactJson(copyAsArtefact()));
    expect(art).toMatchObject({ schema: 'modsimcompass/artefact', exportedBy: { app: 'ModSimCompass' } });
    expect(passportMarkdown(workedExample())).toContain('Generated by ModSimCompass');
    expect(passportHtml(workedExample())).toContain('<meta name="generator" content="ModSimCompass">');
  });
  it('project files named modsim-essentials/project and modsim101/project import as before, under the new name', () => {
    for (const old of ['modsim-essentials/project', 'modsim101/project']) {
      const raw = { ...JSON.parse(projectJson(workedExample())), schema: old, exportedBy: { app: 'ModSim Essentials', version: '3.0.0' } };
      const res = importProjectObject(raw);
      if (!res.ok) throw new Error(res.error);
      expect(res.project.schema, old).toBe('modsimcompass/project');
      expect(res.project.passport).toEqual(workedExample().passport);
      expect(res.project.artefacts).toEqual(workedExample().artefacts);
      expect(res.warnings, old).toEqual([]);
    }
    expect(importProjectObject({ ...JSON.parse(projectJson(workedExample())), schema: 'modsimcompass/other' }).ok).toBe(false);
  });
  it('an artefact file named modsim-essentials/artefact imports as before; any project file is turned away', () => {
    const a = copyAsArtefact();
    const old = JSON.stringify({ ...JSON.parse(artefactJson(a)), schema: 'modsim-essentials/artefact' });
    const res = parseArtefactJson(old);
    if (!res.ok) throw new Error(res.error);
    expect(res.artefact).toMatchObject({ schema: 'modsimcompass/artefact', kind: a.kind, title: a.title, data: a.data });
    for (const schema of ['modsimcompass/project', 'modsim-essentials/project', 'modsim101/project']) {
      const r = parseArtefactJson(JSON.stringify({ ...JSON.parse(artefactJson(a)), schema }));
      expect(r.ok, schema).toBe(false);
      expect(!r.ok && r.error, schema).toMatch(/This is a project file, not an artefact file/);
    }
    expect(parseArtefactJson(JSON.stringify({ ...JSON.parse(artefactJson(a)), schema: 'modsim101/artefact' })).ok).toBe(false);
  });
});

/** The worked example's comparison as a Toolbox artefact, for the file tests. */
function copyAsArtefact() {
  const c = workedExample().artefacts.find((i) => i.kind === 'comparison')!;
  return { schema: ARTEFACT_SCHEMA, schemaVersion: 1, id: 'art-test', kind: c.kind, title: c.title, createdAt: '2026-11-21T00:00:00.000Z', updatedAt: '2026-11-21T00:00:00.000Z', revision: 2, data: c.data } as Parameters<typeof artefactJson>[0];
}
