import { describe, expect, it } from 'vitest';
import { workedExample } from '../src/content/workedExample';
import type { MethodId } from '../src/domain/methods/registry';
import { RULE_VERSION, answersKey, evaluateRules } from '../src/domain/methods/rules';
import {
  CHECKPOINT_DEFS, COMPASS_RULES_VERSION, STEPS, checkpointReadiness, compassWarnings, stepStarted, stepsStarted, warningsFor,
  type StepId,
} from '../src/domain/passport/compass';
import { importProjectObject, parseProjectJson } from '../src/domain/passport/importer';
import { PASSPORT_SCHEMA_VERSION, createProject, type ProjectDoc } from '../src/domain/passport/schema';
import { runHash } from '../src/domain/sandbox/experiment';
import { mean, pairedDifferences, tInterval } from '../src/domain/sandbox/stats';
import { projectJson } from '../src/exports/bundle';

const ids = (doc: ProjectDoc) => compassWarnings(doc).map((w) => w.id);
const has = (doc: ProjectDoc, id: string) => ids(doc).includes(id);
const severityOf = (doc: ProjectDoc, id: string) => compassWarnings(doc).find((w) => w.id === id)?.severity;
/** The worked example with one change: the cleanest way to see a single rule fire. */
const mutated = (change: (d: ProjectDoc) => void) => { const d = workedExample(); change(d); return d; };

describe('worked example', () => {
  const doc = workedExample();
  const p = doc.passport;

  it('has no gap or check warnings (and no tips)', () => {
    expect(compassWarnings(doc).filter((w) => w.severity !== 'tip')).toEqual([]);
    expect(compassWarnings(doc)).toEqual([]);
    for (const cp of CHECKPOINT_DEFS) expect(checkpointReadiness(doc, cp.id)).toEqual([]);
  });
  it('has 7 of 7 steps started', () => {
    expect(stepsStarted(p)).toEqual(STEPS.map((s) => s.id));
    expect(stepsStarted(p)).toHaveLength(7);
  });
  it('answers every self-check question in a sentence or two', () => {
    const questionIds = STEPS.flatMap((s) => s.selfChecks.map((q) => q.id));
    expect(Object.keys(p.selfChecks).sort()).toEqual([...questionIds].sort());
    for (const id of questionIds) expect(p.selfChecks[id].trim().length, id).toBeGreaterThan(40);
  });
  it('is a fixed, read-only-friendly document: stable id, timestamps and origin; not pre-graded', () => {
    expect(doc.id).toBe('worked-example');
    expect(doc.origin).toEqual({ kind: 'example', ref: 'worked-example' });
    expect(doc.createdAt).toBe(doc.updatedAt);
    expect(doc.schemaVersion).toBe(PASSPORT_SCHEMA_VERSION);
    expect(workedExample()).toEqual(doc);
    expect(workedExample().sandbox.lastRun).not.toBe(doc.sandbox.lastRun); // callers get their own copy
    expect(p.identity.author).toBe('');
    for (const cp of Object.values(p.review)) expect(cp).toEqual({ status: 'draft', notes: '', reviewer: '', feedbackSource: '', rubric: {}, due: '' });
  });
  it('frames a decision question with several levers and a method that fits it', () => {
    expect(p.decision.claimType).toBe('decision-support');
    expect(p.decision.question).toMatch(/\?/);
    expect(p.decision.levers.split('\n').length).toBeGreaterThanOrEqual(4);
    expect(p.scope.timeUnit).toBe('day');
    expect(p.representation.primaryMethod).toBe('system-dynamics');
    expect(p.representation.alternativeMethod).toBe('des');
    expect(p.representation.nodes.length).toBeGreaterThanOrEqual(5);
    expect(p.representation.nodes.length).toBeLessThanOrEqual(7);
    const nodeIds = new Set(p.representation.nodes.map((n) => n.id));
    for (const r of p.representation.relations) { expect(nodeIds.has(r.from) && nodeIds.has(r.to)).toBe(true); expect(r.label).not.toBe(''); }
  });
  it('records method advice that is current and consistent with the rule table', () => {
    const m = doc.methods;
    expect(m.ruleVersion).toBe(RULE_VERSION);
    expect(m.answers).not.toBeNull();
    expect(m.answersKey).toBe(answersKey(m.answers!));
    expect(m.shortlist).toEqual(evaluateRules(m.answers!).candidates.map((c) => c.method));
    expect(m.shortlist).toContain(p.representation.primaryMethod);
    expect(m.shortlist).toContain(p.representation.alternativeMethod);
    expect(Object.values(m.answers!)).not.toContain('unsure');
    expect(has(doc, 'advice-outdated')).toBe(false);
  });
  it('labels every input and assumption honestly and completely', () => {
    expect(p.inputs.length).toBeGreaterThanOrEqual(4);
    for (const r of p.inputs) {
      for (const field of [r.name, r.value, r.unit, r.provenance, r.uncertainty]) expect(field.trim(), r.id).not.toBe('');
      expect(r.sourceType).not.toBe('unspecified');
      expect(r.provenance).toMatch(/synthetic/i);
    }
    expect(p.inputs.some((r) => r.sourceType === 'synthetic')).toBe(true);
    expect(p.assumptions.length).toBeGreaterThanOrEqual(3);
    for (const a of p.assumptions) for (const field of [a.statement, a.rationale, a.consequenceIfWrong, a.plannedCheck]) expect(field.trim(), a.id).not.toBe('');
    expect(p.outcomes).toHaveLength(2);
    expect(p.experiment.runSettings).toMatch(/horizon/i);
    expect(p.experiment.runSettings).toMatch(/replications/i);
    expect(p.experiment.runSettings).toMatch(/seed/i);
  });
  it('carries a complete sandbox run that is not stale', () => {
    const { baseline, alternative, lastRun: run } = doc.sandbox;
    expect(baseline.demand).toMatchObject({ mode: 'random', values: [8, 12, 16], probs: [0.25, 0.5, 0.25] });
    expect(baseline).toMatchObject({ horizon: 30, replications: 100, seed: 'compass-example', capacity: { mode: 'direct', direct: 10 } });
    expect(alternative).toEqual({ ...baseline, capacity: { ...baseline.capacity, direct: 12 } });
    expect(run).not.toBeNull();
    expect(run!.status).toBe('complete');
    expect(run!.completedReplications).toBe(100);
    expect(run!.requestedReplications).toBe(100);
    expect(run!.comparisonKind).toBe('paired-policy');
    expect(run!.modelHash).toBe(runHash(baseline, alternative));
    expect(run!.modelRevision).toBe(doc.modelRevision);
    expect(run!.projectId).toBe(doc.id);
    expect(has(doc, 'stale-run')).toBe(false);
    expect(has(doc, 'partial-run')).toBe(false);
  });
  it('quotes results that match what the run actually produces', () => {
    const run = doc.sandbox.lastRun!;
    const base = run.baseline.summaries, alt = run.alternative!.summaries;
    const avgB = base.map((s) => s.averageEndBacklog), avgA = alt.map((s) => s.averageEndBacklog);
    const diff = pairedDifferences(avgB, avgA);
    const round = (x: number | null) => Math.round(x!);
    const text = p.conclusion.results;
    // “about 30 … at capacity 10 (… roughly 28 to 32) and about 6 at capacity 12 (roughly 5 to 7)”
    expect(round(mean(avgB))).toBe(30);
    expect(Math.floor(tInterval(avgB).lower!)).toBe(28);
    expect(Math.ceil(tInterval(avgB).upper!)).toBe(32);
    expect(round(mean(avgA))).toBe(6);
    expect(round(tInterval(avgA).lower)).toBe(5);
    expect(round(tInterval(avgA).upper)).toBe(7);
    expect(text).toMatch(/about 30 request-equivalents at capacity 10 \(95% interval of the mean roughly 28 to 32\) and about 6 at capacity 12 \(roughly 5 to 7\)/);
    // “paired difference was about −24 (95% interval roughly −25 to −23) … lower in all 100 pairs”
    expect(round(mean(diff))).toBe(-24);
    expect(round(tInterval(diff).lower)).toBe(-25);
    expect(round(tInterval(diff).upper)).toBe(-23);
    expect(diff.every((d) => d < 0)).toBe(true);
    expect(text).toMatch(/about −24 request-equivalents \(95% interval roughly −25 to −23\), and the alternative was lower in all 100 pairs/);
    // “averaged about 59 on day 30; at capacity 12 it averaged about 10”
    expect(round(mean(base.map((s) => s.terminalBacklog)))).toBe(59);
    expect(round(mean(alt.map((s) => s.terminalBacklog)))).toBe(10);
    expect(text).toMatch(/about 59 on day 30; at capacity 12 it averaged about 10 on day 30/);
    // Verification claim: conservation holds in every replication.
    expect(Math.max(...base.map((s) => s.maxAbsResidual), ...alt.map((s) => s.maxAbsResidual))).toBeLessThan(1e-9);
  });
  it('states uncertainty, limits and change conditions without overclaiming', () => {
    expect(p.conclusion.results).toMatch(/95% interval/);
    expect(p.conclusion.recommendation).toMatch(/^If /);
    expect(p.conclusion.limitations).toMatch(/nothing about individual waiting times/);
    expect(p.conclusion.changeConditions.trim()).not.toBe('');
    const prose = JSON.stringify(p);
    expect(prose).not.toMatch(/\b(prove[sd]?|guarantee[sd]?|certainly|always)\b/i);
    expect(`${p.decision.question} ${p.decision.outcome}`).not.toMatch(/wait/i);
  });
});

describe('empty project', () => {
  const doc = createProject({ now: '2026-11-21T00:00:00.000Z', id: 'prj-empty' });
  const EXPECTED_GAPS: Record<StepId, string[]> = {
    frame: ['stakeholder', 'problem', 'levers', 'question', 'claim'],
    scope: ['boundary', 'horizon', 'detail'],
    method: ['primary', 'alternative'],
    inputs: ['inputs', 'assumptions'],
    evaluation: ['verification', 'validation'],
    experiment: ['outcomes', 'baseline', 'alternatives', 'comparison', 'run-settings'],
    conclude: ['results', 'recommendation', 'limitations'],
  };
  it('has no step started', () => {
    expect(stepsStarted(doc.passport)).toEqual([]);
    for (const s of STEPS) expect(stepStarted(doc.passport, s.id)).toBe(false);
  });
  it('yields the expected gaps for every step, and nothing else but the sketch tip', () => {
    for (const s of STEPS) {
      const w = warningsFor(doc, s.id);
      expect(w.filter((x) => x.severity === 'gap').map((x) => x.id), s.id).toEqual(EXPECTED_GAPS[s.id]);
      expect(w.filter((x) => x.severity === 'check'), s.id).toEqual([]);
      expect(w.every((x) => x.step === s.id)).toBe(true);
    }
    expect(compassWarnings(doc).filter((w) => w.severity === 'tip').map((w) => w.id)).toEqual(['sketch']);
  });
  it('orders warnings by step, then gaps before checks before tips', () => {
    const d = mutated((x) => { x.passport.decision.stakeholder = ''; x.passport.decision.outcome = ''; x.passport.decision.question = 'How large is the backlog'; x.passport.conclusion.results = ''; });
    const w = compassWarnings(d);
    expect(w.map((x) => `${x.step}/${x.severity}/${x.id}`)).toEqual(['frame/gap/stakeholder', 'frame/check/question-outcome', 'frame/tip/question-mark', 'conclude/gap/results']);
    const stepOrder = STEPS.map((s) => s.id);
    const all = compassWarnings(doc).map((x) => stepOrder.indexOf(x.step));
    expect(all).toEqual([...all].sort((a, b) => a - b));
  });
  it('every warning has a non-empty message and a known step', () => {
    for (const w of compassWarnings(doc)) { expect(w.message.trim()).not.toBe(''); expect(STEPS.some((s) => s.id === w.step)).toBe(true); }
    expect(COMPASS_RULES_VERSION).toBe('compass-rules-v1');
  });
  it('a step counts as started as soon as one of its fields has content', () => {
    const d = createProject();
    d.passport.scope.boundary = 'The central office';
    d.passport.selfChecks['frame-decide'] = 'An answer alone does not start a step.';
    expect(stepsStarted(d.passport)).toEqual(['scope']);
  });
});

describe('compass rules fire and clear', () => {
  it('question without a measurable outcome', () => {
    const d = mutated((x) => { x.passport.decision.outcome = '  '; });
    expect(severityOf(d, 'question-outcome')).toBe('check');
    d.passport.decision.outcome = 'Average end-of-day backlog (request-equivalents)';
    expect(has(d, 'question-outcome')).toBe(false);
    // No question at all is a gap, not this check.
    const none = mutated((x) => { x.passport.decision.question = ''; x.passport.decision.outcome = ''; });
    expect(has(none, 'question-outcome')).toBe(false);
    expect(severityOf(none, 'question')).toBe('gap');
  });
  it('horizon without a time unit', () => {
    const d = mutated((x) => { x.passport.scope.timeUnit = ''; });
    expect(severityOf(d, 'timeunit')).toBe('check');
    d.passport.scope.timeUnit = 'day';
    expect(has(d, 'timeunit')).toBe(false);
    const noHorizon = mutated((x) => { x.passport.scope.timeUnit = ''; x.passport.scope.horizon = ''; });
    expect(has(noHorizon, 'timeunit')).toBe(false);
    expect(severityOf(noHorizon, 'horizon')).toBe('gap');
  });
  it('boundary without exclusions', () => {
    const d = mutated((x) => { x.passport.scope.exclusions = ''; });
    expect(severityOf(d, 'exclusions')).toBe('check');
    d.passport.scope.exclusions = 'IT helpdesk: separate staff and queue.';
    expect(has(d, 'exclusions')).toBe(false);
  });
  it('calibration without validation', () => {
    const d = mutated((x) => { x.passport.evaluation.validation = ''; });
    expect(severityOf(d, 'calibration-only')).toBe('check');
    expect(severityOf(d, 'validation')).toBe('gap');
    d.passport.evaluation.calibration = '';
    expect(has(d, 'calibration-only')).toBe(false);
    expect(has(d, 'validation')).toBe(true);
    d.passport.evaluation.calibration = 'Capacity tuned on the first period.';
    d.passport.evaluation.validation = 'Compare with the held-out period.';
    expect(has(d, 'calibration-only')).toBe(false);
    expect(has(d, 'validation')).toBe(false);
  });
  it('waiting-time question with a method that cannot estimate individual waiting times', () => {
    const d = mutated((x) => { x.passport.decision.question = 'How long do students wait for an answer if capacity rises from 10 to 12 per day?'; });
    expect(severityOf(d, 'waiting')).toBe('check');
    expect(compassWarnings(d).find((w) => w.id === 'waiting')!.message).toMatch(/System dynamics/);
    // Also triggered from the outcome field.
    const viaOutcome = mutated((x) => { x.passport.decision.outcome = 'Mean waiting time in days'; });
    expect(has(viaOutcome, 'waiting')).toBe(true);
    // Clears for each method that represents individual waits.
    for (const m of ['des', 'queueing-theory', 'abm'] as MethodId[]) {
      d.passport.representation.primaryMethod = m;
      d.passport.representation.alternativeMethod = 'system-dynamics';
      expect(has(d, 'waiting'), m).toBe(false);
    }
  });
  it('same primary and alternative method', () => {
    const d = mutated((x) => { x.passport.representation.alternativeMethod = 'system-dynamics'; });
    expect(severityOf(d, 'same-method')).toBe('check');
    d.passport.representation.alternativeMethod = 'des';
    expect(has(d, 'same-method')).toBe(false);
  });
  it('method gaps: missing justification for the primary or the alternative', () => {
    const d = mutated((x) => { x.passport.representation.justification = ''; x.passport.representation.alternativeJustification = ''; });
    expect(severityOf(d, 'primary-why')).toBe('gap');
    expect(severityOf(d, 'alt-why')).toBe('gap');
  });
  it('method advice recorded before the chooser answers changed', () => {
    const d = mutated((x) => { x.methods.answers!.granularity = 'individual'; });
    expect(severityOf(d, 'advice-outdated')).toBe('check');
    d.methods.answersKey = answersKey(d.methods.answers!);
    expect(has(d, 'advice-outdated')).toBe(false);
  });
  it('fitted relationship used for decision support needs a causal argument', () => {
    const d = mutated((x) => { x.passport.representation.primaryMethod = 'path-analysis'; });
    expect(severityOf(d, 'causal')).toBe('check');
    d.passport.decision.claimType = 'descriptive';
    expect(has(d, 'causal')).toBe(false);
  });
  it('stochastic method without replications (or seed) in the run settings', () => {
    const d = mutated((x) => { x.passport.representation.primaryMethod = 'des'; x.passport.representation.alternativeMethod = 'system-dynamics'; x.passport.experiment.runSettings = 'Horizon 30 days, time step 1 day.'; });
    expect(severityOf(d, 'replications')).toBe('check');
    expect(severityOf(d, 'seed')).toBe('tip');
    d.passport.experiment.runSettings = 'Horizon 30 days, 100 replications.';
    expect(has(d, 'replications')).toBe(false);
    expect(has(d, 'seed')).toBe(true);
    d.passport.experiment.runSettings = 'Horizon 30 days, 100 replications, seed “a”.';
    expect(has(d, 'replications')).toBe(false);
    expect(has(d, 'seed')).toBe(false);
    // Random demand in a sandbox run also counts as stochastic, whatever the chosen method.
    const randomSandbox = mutated((x) => { x.passport.experiment.runSettings = 'Horizon 30 days.'; });
    expect(severityOf(randomSandbox, 'replications')).toBe('check');
    // A deterministic representation without a random sandbox run is not asked for replications.
    const sd = mutated((x) => { x.passport.experiment.runSettings = 'Horizon 30 days.'; x.sandbox.lastRun = null; });
    expect(has(sd, 'replications')).toBe(false);
    const empty = mutated((x) => { x.passport.representation.primaryMethod = 'des'; x.passport.representation.alternativeMethod = 'abm'; x.passport.experiment.runSettings = ''; });
    expect(has(empty, 'replications')).toBe(false);
    expect(severityOf(empty, 'run-settings')).toBe('gap');
  });
  it('input without unit, source or value', () => {
    const d = mutated((x) => { x.passport.inputs[0].unit = ''; });
    const id = d.passport.inputs[0].id;
    expect(severityOf(d, `in-unit-${id}`)).toBe('check');
    expect(compassWarnings(d).find((w) => w.id === `in-unit-${id}`)!.message).toContain(d.passport.inputs[0].name);
    d.passport.inputs[0].unit = 'request-equivalents/day';
    expect(has(d, `in-unit-${id}`)).toBe(false);

    d.passport.inputs[0].sourceType = 'unspecified';
    expect(severityOf(d, `in-src-${id}`)).toBe('check');
    d.passport.inputs[0].sourceType = 'synthetic';
    expect(has(d, `in-src-${id}`)).toBe(false);
    d.passport.inputs[0].provenance = '';
    expect(has(d, `in-src-${id}`)).toBe(true);
    d.passport.inputs[0].provenance = 'Synthetic teaching data';
    expect(has(d, `in-src-${id}`)).toBe(false);

    d.passport.inputs[0].value = '';
    expect(severityOf(d, `in-val-${id}`)).toBe('gap');
    // Only the affected row is reported.
    expect(ids(d).filter((w) => w.startsWith('in-'))).toEqual([`in-val-${id}`]);
  });
  it('assumption without a planned check or a consequence', () => {
    const d = mutated((x) => { x.passport.assumptions[1].plannedCheck = ''; });
    const id = d.passport.assumptions[1].id;
    expect(severityOf(d, `as-check-${id}`)).toBe('check');
    expect(compassWarnings(d).find((w) => w.id === `as-check-${id}`)!.message).toMatch(/Assumption 2/);
    d.passport.assumptions[1].plannedCheck = 'Plot daily counts by weekday.';
    expect(has(d, `as-check-${id}`)).toBe(false);
    d.passport.assumptions[1].consequenceIfWrong = '';
    expect(severityOf(d, `as-cons-${id}`)).toBe('check');
  });
  it('outcome without unit, definition or direction', () => {
    const d = mutated((x) => { Object.assign(x.passport.outcomes[0], { unit: '', definition: '', direction: '' }); });
    const id = d.passport.outcomes[0].id;
    expect(severityOf(d, `out-unit-${id}`)).toBe('check');
    expect(severityOf(d, `out-def-${id}`)).toBe('gap');
    expect(severityOf(d, `out-dir-${id}`)).toBe('check');
  });
  it('recommendation without conditions that would change it', () => {
    const d = mutated((x) => { x.passport.conclusion.changeConditions = ''; });
    expect(severityOf(d, 'conditions')).toBe('check');
    d.passport.conclusion.changeConditions = 'Revisit if arrivals exceed 14 per day.';
    expect(has(d, 'conditions')).toBe(false);
    const noRec = mutated((x) => { x.passport.conclusion.changeConditions = ''; x.passport.conclusion.recommendation = ''; });
    expect(has(noRec, 'conditions')).toBe(false);
    expect(severityOf(noRec, 'recommendation')).toBe('gap');
  });
  it('overclaiming words and a question without a question mark are suggestions only', () => {
    const d = mutated((x) => { x.passport.conclusion.recommendation = 'The simulation proves that one more advisor is needed.'; x.passport.decision.question = 'Find out whether hiring helps.'; });
    expect(severityOf(d, 'overclaim')).toBe('tip');
    expect(severityOf(d, 'question-mark')).toBe('tip');
    expect(compassWarnings(d).filter((w) => w.severity !== 'tip')).toEqual([]);
    const noSketch = mutated((x) => { x.passport.representation.nodes = []; x.passport.representation.relations = []; });
    expect(severityOf(noSketch, 'sketch')).toBe('tip');
  });
  it('problem and lever with the same text', () => {
    const d = mutated((x) => { x.passport.decision.problem = 'Hire more staff'; x.passport.decision.levers = '  hire more STAFF '; });
    expect(severityOf(d, 'lever-is-problem')).toBe('check');
  });
  it('stale or partial sandbox run', () => {
    const d = mutated((x) => { x.sandbox.baseline.capacity.direct = 11; });
    expect(severityOf(d, 'stale-run')).toBe('check');
    d.sandbox.baseline.capacity.direct = 10;
    expect(has(d, 'stale-run')).toBe(false);
    // Changing the alternative, or removing it, also makes the run stale.
    expect(has(mutated((x) => { x.sandbox.alternative!.capacity.direct = 13; }), 'stale-run')).toBe(true);
    expect(has(mutated((x) => { x.sandbox.alternative = null; }), 'stale-run')).toBe(true);
    // No run at all is not an error.
    expect(has(mutated((x) => { x.sandbox.baseline.capacity.direct = 11; x.sandbox.lastRun = null; }), 'stale-run')).toBe(false);
    const partial = mutated((x) => { x.sandbox.lastRun!.status = 'partial'; });
    expect(severityOf(partial, 'partial-run')).toBe('check');
  });
});

describe('checkpoint readiness', () => {
  it('covers exactly the steps of each checkpoint and excludes tips', () => {
    const doc = createProject();
    doc.passport.decision.question = 'Describe the backlog'; // adds a tip (no question mark) and a check (no outcome) to step 1
    const all = compassWarnings(doc);
    expect(all.some((w) => w.severity === 'tip')).toBe(true);
    for (const cp of CHECKPOINT_DEFS) {
      const ready = checkpointReadiness(doc, cp.id);
      expect(ready.length, cp.id).toBeGreaterThan(0);
      expect(ready.every((w) => cp.steps.includes(w.step)), cp.id).toBe(true);
      expect(ready.every((w) => w.severity !== 'tip'), cp.id).toBe(true);
      expect(ready).toEqual(all.filter((w) => cp.steps.includes(w.step) && w.severity !== 'tip'));
    }
    expect(checkpointReadiness(doc, 'proposal').map((w) => w.id)).toEqual(['stakeholder', 'problem', 'levers', 'claim', 'question-outcome', 'boundary', 'horizon', 'detail']);
    expect(checkpointReadiness(doc, 'baseline').map((w) => w.id)).toEqual(['verification', 'validation']);
  });
  it('every step belongs to exactly one checkpoint, matching the step definition', () => {
    for (const s of STEPS) {
      const owners = CHECKPOINT_DEFS.filter((cp) => cp.steps.includes(s.id));
      expect(owners.map((cp) => cp.id), s.id).toEqual([s.checkpoint]);
    }
    const total = CHECKPOINT_DEFS.reduce((n, cp) => n + checkpointReadiness(createProject(), cp.id).length, 0);
    expect(total).toBe(compassWarnings(createProject()).filter((w) => w.severity !== 'tip').length);
  });
  it('a problem in one step only affects its own checkpoint', () => {
    const d = mutated((x) => { x.passport.conclusion.changeConditions = ''; x.passport.conclusion.recommendation += ' This always holds.'; });
    expect(checkpointReadiness(d, 'final').map((w) => w.id)).toEqual(['conditions']); // the overclaim tip is excluded
    for (const id of ['proposal', 'design', 'baseline', 'evaluation'] as const) expect(checkpointReadiness(d, id)).toEqual([]);
  });
});

describe('importer: schema v1 → v2, self-checks and rubrics', () => {
  const graded = () => {
    const d = workedExample();
    d.passport.review.proposal = { status: 'teacher-reviewed', notes: 'Clear question.', reviewer: 'Reviewer A', feedbackSource: 'teacher', due: '2026-12-01', rubric: { question: 3, problem: 2, boundary: 0 } };
    d.passport.review.final.rubric = { limits: 1 };
    return d;
  };

  it('a v1 file (no selfChecks, no rubric) imports with defaults and an upgrade note', () => {
    const raw = JSON.parse(projectJson(graded()));
    raw.schemaVersion = 1;
    delete raw.passport.selfChecks;
    for (const cp of Object.values(raw.passport.review) as Record<string, unknown>[]) delete cp.rubric;
    const res = importProjectObject(raw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.project.schemaVersion).toBe(2);
    expect(res.project.passport.selfChecks).toEqual({});
    for (const cp of Object.values(res.project.passport.review)) expect(cp.rubric).toEqual({});
    expect(res.project.passport.review.proposal).toMatchObject({ status: 'teacher-reviewed', notes: 'Clear question.', reviewer: 'Reviewer A', feedbackSource: 'teacher' });
    expect(res.warnings.join('\n')).toMatch(/schema version 1 upgraded to version 2/);
    // Everything else survives the upgrade, and the upgraded project only lacks the self-check answers.
    expect(res.project.passport.decision).toEqual(graded().passport.decision);
    expect(res.project.passport.inputs).toEqual(graded().passport.inputs);
    expect(compassWarnings(res.project)).toEqual([]);
    expect(stepsStarted(res.project.passport)).toHaveLength(7);
  });
  it('a v1 file under the legacy schema name is also accepted', () => {
    const raw = JSON.parse(projectJson(createProject({ title: 'Old project' })));
    raw.schema = 'modsim101/project';
    raw.schemaVersion = 1;
    delete raw.passport.selfChecks;
    const res = importProjectObject(raw);
    expect(res.ok && res.project.passport.identity.title).toBe('Old project');
    expect(res.ok && res.project.passport.selfChecks).toEqual({});
  });
  it('a v2 round trip preserves selfChecks, rubric and the sandbox run, with no upgrade note', () => {
    const d = graded();
    const res = parseProjectJson(projectJson(d));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.project.passport.selfChecks).toEqual(d.passport.selfChecks);
    expect(res.project.passport.review).toEqual(d.passport.review);
    expect(res.project.passport).toEqual(d.passport);
    expect(res.project.methods).toEqual(d.methods);
    expect(res.project.sandbox).toEqual(d.sandbox);
    expect(res.project.id).toBe('worked-example');
    expect(res.project.origin.kind).toBe('example'); // origin.ref is not carried by the importer (reported to the domain owner)
    expect(res.warnings).toEqual([]);
    expect(res.project.preservedUnknown).toBeUndefined();
    expect(compassWarnings(res.project)).toEqual([]);
  });
  it('hostile keys and values in selfChecks and rubric are dropped', () => {
    const raw = JSON.parse(projectJson(graded()));
    const longKey = 'k'.repeat(49);
    raw.passport.selfChecks = { 'frame-decide': 'kept', [longKey]: 'too long', 'Bad Key': 'spaces and capitals', '-leading': 'bad start', 'frame-proposal': 42, 'scope-detail': { nested: true }, ['x'.repeat(48)]: 'longest allowed key' };
    raw.passport.review.proposal.rubric = { question: 2, problem: 2.5, boundary: 7, negative: -1, text: '3', [longKey]: 1, 'Bad Key': 1, ok: 0 };
    // JSON.parse turns "__proto__" into an own key, which is how a hostile file would carry it.
    const text = JSON.stringify(raw)
      .replace('"selfChecks":{', '"selfChecks":{"__proto__":"polluted","constructor ":"x",')
      .replace('"rubric":{"question":2', '"rubric":{"__proto__":3,"question":2');
    expect(text).toMatch(/"selfChecks":\{"__proto__"/);
    expect(text).toMatch(/"rubric":\{"__proto__":3/);
    const res = parseProjectJson(text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const sc = res.project.passport.selfChecks;
    expect(sc).toEqual({ 'frame-decide': 'kept', ['x'.repeat(48)]: 'longest allowed key' });
    expect(Object.getPrototypeOf(sc)).toBe(Object.prototype);
    const rubric = res.project.passport.review.proposal.rubric;
    expect(rubric).toEqual({ question: 2, ok: 0 });
    expect(Object.getPrototypeOf(rubric)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'question')).toBe(false);
    // Non-object containers fall back to empty maps.
    const odd = JSON.parse(projectJson(graded()));
    odd.passport.selfChecks = ['frame-decide', 'x'];
    odd.passport.review.proposal.rubric = 'Strong';
    odd.passport.review.design = null;
    const res2 = importProjectObject(odd);
    expect(res2.ok && res2.project.passport.selfChecks).toEqual({});
    expect(res2.ok && res2.project.passport.review.proposal.rubric).toEqual({});
    expect(res2.ok && res2.project.passport.review.design).toEqual({ status: 'draft', notes: '', reviewer: '', feedbackSource: '', rubric: {}, due: '' });
  });
  it('very long self-check answers are truncated, and the number of entries is bounded', () => {
    const raw = JSON.parse(projectJson(createProject()));
    raw.passport.selfChecks = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`key-${i}`, 'a']));
    raw.passport.selfChecks['frame-decide'] = 'x'.repeat(30_000);
    const res = importProjectObject(raw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.project.passport.selfChecks).length).toBeLessThanOrEqual(200);
    for (const val of Object.values(res.project.passport.selfChecks)) expect(val.length).toBeLessThanOrEqual(20_000);
  });
  it('schema version 3 is rejected with an explanation and nothing is imported', () => {
    const raw = { ...JSON.parse(projectJson(workedExample())), schemaVersion: 3 };
    const res = importProjectObject(raw);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/newer schema \(version 3\)/);
    expect(!res.ok && res.error).toMatch(/supports version 2/);
    for (const bad of [0, 1.5, '2', null]) expect(importProjectObject({ ...raw, schemaVersion: bad }).ok, String(bad)).toBe(false);
  });
});

import { importProjectObject as importObj } from '../src/domain/passport/importer';
import { projectJson as toJson } from '../src/exports/bundle';
import { passportMarkdown as toMd } from '../src/exports/markdown';
import { workedExample as example } from '../src/content/workedExample';

describe('importer hardening and checkpoint target dates', () => {
  it('keeps origin.ref, validates origin.kind, feedbackSource and due date', () => {
    const raw = JSON.parse(toJson(example()));
    raw.passport.review.proposal.due = '2026-12-01';
    raw.passport.review.design.due = 'next week';
    raw.passport.review.design.feedbackSource = 'robot';
    const ok = importObj(raw);
    if (!ok.ok) throw new Error(ok.error);
    expect(ok.project.origin).toEqual({ kind: 'example', ref: 'worked-example' });
    expect(ok.project.passport.review.proposal.due).toBe('2026-12-01');
    expect(ok.project.passport.review.design.due).toBe('');
    expect(ok.project.passport.review.design.feedbackSource).toBe('');
    raw.origin = { kind: 'made-up', ref: 42 };
    const odd = importObj(raw);
    expect(odd.ok && odd.project.origin).toEqual({ kind: 'blank' });
  });
  it('exports the target date, or “Not set”', () => {
    const d = example();
    d.passport.review.proposal.due = '2026-12-01';
    const md = toMd(d);
    expect(md).toContain('- **Target date:** 2026-12-01');
    expect(md).toContain('- **Target date:** Not set');
  });
});
