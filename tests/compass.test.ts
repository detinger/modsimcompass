import { describe, expect, it } from 'vitest';
import { EXAMPLE_COPIES, exampleConfigs, workedExample } from '../src/content/workedExample';
import { describeModel, lawFields } from '../src/domain/artefacts/dataModel';
import { inclusionState, inclusionsFor } from '../src/domain/artefacts/include';
import { lawFor } from '../src/domain/distributions/laws';
import { KIND_ORDER, KINDS, kindDef } from '../src/domain/artefacts/kinds';
import type { ArtefactKind } from '../src/domain/artefacts/types';
import type { MethodId } from '../src/domain/methods/registry';
import { RULE_VERSION, answersKey, evaluateRules } from '../src/domain/methods/rules';
import {
  CHECKPOINT_DEFS, COMPASS_RULES_VERSION, KIND_STEP, STEPS, checkpointReadiness, compassWarnings, dataReadiness, stepStarted, stepsStarted, warningsFor,
  type StepId,
} from '../src/domain/passport/compass';
import { importProjectObject, parseProjectJson } from '../src/domain/passport/importer';
import { PASSPORT_SCHEMA_VERSION, createProject, type Inclusion, type ProjectDoc } from '../src/domain/passport/schema';
import { simulateTrace } from '../src/domain/sandbox/engine';
import { runAll } from '../src/domain/sandbox/experiment';
import { mean, pairedDifferences, tInterval } from '../src/domain/sandbox/stats';
import { projectJson } from '../src/exports/bundle';

const ids = (doc: ProjectDoc) => compassWarnings(doc).map((w) => w.id);
const has = (doc: ProjectDoc, id: string) => ids(doc).includes(id);
const severityOf = (doc: ProjectDoc, id: string) => compassWarnings(doc).find((w) => w.id === id)?.severity;
/** The worked example with one change: the cleanest way to see a single rule fire. */
const mutated = (change: (d: ProjectDoc) => void) => { const d = workedExample(); change(d); return d; };
const doc0 = workedExample();
/** The copy of one kind in a project (the worked example holds exactly one of each). */
const copyOf = <K extends ArtefactKind>(d: ProjectDoc, kind: K) => d.artefacts.find((i): i is Extract<Inclusion, { kind: K }> => i.kind === kind)!;
const without = (d: ProjectDoc, kind: ArtefactKind) => { d.artefacts = d.artefacts.filter((i) => i.kind !== kind); };

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
  it('is a fixed, read-only-friendly document: stable id, timestamps and origin; self-reviewed', () => {
    expect(doc.id).toBe('worked-example');
    expect(doc.origin).toEqual({ kind: 'example', ref: 'worked-example' });
    expect(doc.createdAt).toBe(doc.updatedAt);
    expect(doc.schemaVersion).toBe(PASSPORT_SCHEMA_VERSION);
    expect(workedExample()).toEqual(doc);
    // Callers get their own copy, down to the lists of numbers.
    expect(copyOf(workedExample(), 'comparison').data.baseline).not.toBe(copyOf(doc, 'comparison').data.baseline);
    expect(p.identity.author).toBe('');
    // Reviewed by its own author only: no reviewer is named, every criterion is rated, and not everything is Strong.
    for (const def of CHECKPOINT_DEFS) {
      const cp = p.review[def.id];
      expect(cp).toMatchObject({ status: 'self-reviewed', feedbackSource: 'self', reviewer: '', due: '' });
      expect(Object.keys(cp.rubric).sort()).toEqual(def.rubric.map((c) => c.id).sort());
      expect(cp.notes.length).toBeGreaterThan(80);
    }
    const levels = CHECKPOINT_DEFS.flatMap((def) => Object.values(p.review[def.id].rubric));
    expect(levels.every((l) => l === 2 || l === 3)).toBe(true);
    expect(levels.filter((l) => l === 2)).toHaveLength(4);
    // Each Developing rating is argued in the notes.
    for (const def of CHECKPOINT_DEFS) if (Object.values(p.review[def.id].rubric).includes(2)) expect(p.review[def.id].notes).toMatch(/rated Developing/);
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
  it('includes one copy of each kind, with fixed ids and sources that are in no Toolbox', () => {
    // One of each kind the backlog case uses; measurement data belongs to statistical models.
    const exampleKinds = Object.keys(EXAMPLE_COPIES) as (keyof typeof EXAMPLE_COPIES)[];
    expect(doc.artefacts.map((i) => i.kind)).toEqual(KIND_ORDER.filter((k) => k !== 'measurement-data'));
    expect(exampleKinds).toEqual(doc.artefacts.map((i) => i.kind));
    for (const kind of exampleKinds) {
      const c = copyOf(doc, kind);
      expect(c).toMatchObject({ ...EXAMPLE_COPIES[kind], sourceRevision: 1, addedAt: doc.createdAt });
      expect(c.id).toMatch(/^inc-example-/);
      expect(c.sourceId).toMatch(/^example-/);
      expect(c.title.trim().length, kind).toBeGreaterThan(8);
      expect(inclusionState(c, undefined)).toBe('source-missing');
      expect(inclusionsFor(doc, KINDS[kind].step)).toEqual([c]);
      expect(KINDS[kind].isEmpty(c.data as never), kind).toBe(false);
    }
    // The example is a project of this version: nothing of the earlier sandbox is carried along.
    expect((doc as { sandbox?: { lastRun?: unknown } }).sandbox?.lastRun ?? null).toBeNull();
  });
  it('every copy passes the sanitizer of its kind unchanged, and its card and report text can be made', () => {
    for (const c of doc.artefacts) {
      const def = kindDef(c.kind);
      expect(def.sanitize(JSON.parse(JSON.stringify(c.data)), (m) => { throw new Error(`${c.kind}: ${m}`); }), c.kind).toEqual(c.data);
      expect(def.summary(c.data).join('').trim(), c.kind).not.toBe('');
      expect(def.markdown(c.data).join('').trim(), c.kind).not.toBe('');
      expect(() => def.figure(c.data), c.kind).not.toThrow();
    }
  });
  it('the conceptual model places its elements in zones: levers and inputs, content, outcomes, and what is left out', () => {
    const m = copyOf(doc, 'concept-model').data;
    const ofType = (t: string) => m.nodes.filter((n) => n.type === t);
    expect(ofType('lever').map((n) => n.zone)).toEqual(['inputs']);
    expect(ofType('outcome').length).toBeGreaterThanOrEqual(2);
    expect(ofType('outcome').every((n) => n.zone === 'outputs')).toBe(true);
    expect(ofType('stock').map((n) => n.zone)).toEqual(['content']);
    expect(ofType('external').length).toBeGreaterThanOrEqual(1);
    expect(ofType('external').every((n) => n.zone === 'outside')).toBe(true);
    expect(new Set(m.nodes.map((n) => n.zone))).toEqual(new Set(['inputs', 'content', 'outputs', 'outside']));
    const idsOf = new Set(m.nodes.map((n) => n.id));
    expect(idsOf.size).toBe(m.nodes.length);
    for (const e of m.edges) { expect(idsOf.has(e.from) && idsOf.has(e.to), e.id).toBe(true); expect(e.label).not.toBe(''); }
    for (const t of [m.objectives, m.assumptions, m.simplifications]) expect(t.trim().length).toBeGreaterThan(40);
    // What is outside the boundary in the picture is what the scope lists as excluded.
    for (const n of ofType('external')) expect(p.scope.exclusions).toContain(n.label);
  });
  it('the method choice is the decision the project records', () => {
    const c = copyOf(doc, 'method-choice').data;
    expect(c).toMatchObject({ primary: p.representation.primaryMethod, alternative: p.representation.alternativeMethod, ruleVersion: RULE_VERSION });
    expect(c.justification).toBe(p.representation.justification);
    expect(c.alternativeJustification).toBe(p.representation.alternativeJustification);
    expect(c.answers).toEqual(doc.methods.answers);
    expect(c.answers).not.toBe(doc.methods.answers);
    expect(c.shortlist).toEqual(doc.methods.shortlist);
  });
  it('the data model owns the arrivals row and describes it without inventing data', () => {
    const c = copyOf(doc, 'data-model');
    const rows = p.inputs.filter((r) => r.inclusion);
    expect(rows.map((r) => [r.id, r.inclusion])).toEqual([['in-arrivals', c.id]]);
    expect(c.data).toMatchObject({ name: rows[0].name, unit: rows[0].unit, family: 'empirical', origin: 'described', availability: rows[0].availability, plan: rows[0].plan });
    expect(c.data).toMatchObject({ summary: null, fit: null, keepData: false, data: [] });
    // The law is the input's law exactly: 8, 12 or 16 with probabilities 0.25, 0.5 and 0.25 (mean 12), as the sandbox draws it.
    const law = lawFor('empirical', lawFields('empirical', c.data.params));
    expect([8, 12, 16].map((x) => law.pdf(x))).toEqual([0.25, 0.5, 0.25]);
    expect(c.data.params.reduce((a, b) => a + b, 0) / c.data.params.length).toBe(12);
    expect(describeModel(c.data)).toMatch(/8, 12, 12, 16/);
    expect(c.data.provenance).toMatch(/synthetic/i);
    expect(c.data.provenance).toMatch(/not observations/i);
  });
  it('the check plan mirrors the six verification checks, with honest statuses and nothing failed', () => {
    const c = copyOf(doc, 'check-plan').data;
    const group = (g: string) => c.checks.filter((k) => k.group === g);
    expect(group('verification')).toHaveLength(6);
    expect(p.evaluation.verification.split('\n')).toHaveLength(6);
    for (const k of group('verification')) { expect(k.status).toBe('passed'); expect(k.evidence.trim()).not.toBe(''); }
    // Validation and calibration are plans in this teaching case: nothing is claimed that was not done.
    expect(group('validation').length).toBeGreaterThanOrEqual(2);
    for (const k of [...group('validation'), ...group('calibration')]) { expect(k.status).toBe('planned'); expect(k.evidence).toBe(''); }
    expect(c.checks.some((k) => k.status === 'failed')).toBe(false);
    expect(new Set(c.checks.map((k) => k.id)).size).toBe(c.checks.length);
    expect(c.validation).toEqual({ measure: expect.stringMatching(/held-out/), tolerancePct: 20, toleranceOn: 'means', observed: [], simulated: [] });
    expect(p.evaluation.validation).toMatch(/within 20%/);
    for (const t of Object.values(c.calibration)) expect(t.trim()).not.toBe('');
    expect(c.method).toBe(p.representation.primaryMethod);
  });
  it('the verification evidence is true of the daily backlog model', () => {
    const { baseline } = exampleConfigs();
    const run = (change: (c: typeof baseline) => void) => { const c = structuredClone(baseline); c.demand.mode = 'constant'; change(c); return simulateTrace(c, new Array(c.horizon).fill(c.demand.constant)).rows.map((r) => r.endBacklog); };
    // Balanced case: arrivals 10, capacity 10, empty start → 0 on each of the 30 days.
    expect(run((c) => { c.demand.constant = 10; })).toEqual(new Array(30).fill(0));
    // Drain case: start 20, arrivals 5, capacity 10 → 15, 10, 5, 0, then 0.
    const drain = run((c) => { c.initialBacklog = 20; c.demand.constant = 5; });
    expect(drain.slice(0, 5)).toEqual([15, 10, 5, 0, 0]);
    expect(drain[29]).toBe(0);
    // Accumulation case: arrivals 12, capacity 10 → 2 × day.
    expect(run((c) => { c.demand.constant = 12; })).toEqual(Array.from({ length: 30 }, (_, i) => 2 * (i + 1)));
    const text = copyOf(doc, 'check-plan').data.checks.map((k) => k.evidence).join(' ');
    expect(text).toMatch(/Backlog 15, 10, 5, 0/);
    expect(text).toMatch(/Backlog 2 on day 1 and 60 on day 30/);
  });
  it('the comparison is the paired run of the daily backlog model, and it reproduces', () => {
    const c = copyOf(doc, 'comparison').data;
    const { baseline, alternative } = exampleConfigs();
    expect(baseline.demand).toMatchObject({ mode: 'random', values: [8, 12, 16], probs: [0.25, 0.5, 0.25] });
    expect(baseline).toMatchObject({ horizon: 30, replications: 100, seed: 'compass-example', capacity: { mode: 'direct', direct: 10 } });
    expect(alternative).toEqual({ ...baseline, capacity: { ...baseline.capacity, direct: 12 } });
    const run = runAll(baseline, alternative, { id: 'r', projectId: doc.id, modelRevision: 1, createdAt: doc.createdAt });
    expect(run.comparisonKind).toBe('paired-policy');
    expect(c.baseline).toEqual(run.baseline.summaries.map((s) => s.averageEndBacklog));
    expect(c.alternative).toEqual(run.alternative!.summaries.map((s) => s.averageEndBacklog));
    // Repeatability, as the check plan says: a second run with the same seed agrees in every replication.
    expect(runAll(baseline, alternative, { id: 'r2', projectId: doc.id, modelRevision: 1, createdAt: doc.createdAt }).baseline.summaries).toEqual(run.baseline.summaries);
    expect(c).toMatchObject({ paired: true, direction: 'lower', unit: 'request-equivalents', baselineLabel: 'Capacity 10', alternativeLabel: 'Capacity 12', minimumDifference: 10 });
    expect(c.baseline).toHaveLength(100);
    expect(c.alternative).toHaveLength(100);
    expect(c.note).toMatch(/seed “compass-example”/);
    expect(c.note).toMatch(/same sequence of daily arrivals/);
    expect(p.experiment.runSettings).toMatch(/100 replications, seed “compass-example”/);
    expect(has(doc, 'no-comparison')).toBe(false);
    expect(has(doc, `cmp-reps-${copyOf(doc, 'comparison').id}`)).toBe(false);
  });
  it('quotes results that match what the comparison holds', () => {
    const { baseline: avgB, alternative: avgA } = copyOf(doc, 'comparison').data;
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
    // The funding criterion: the interval of the paired difference lies below zero and the reduction is at least 10.
    expect(tInterval(diff).upper!).toBeLessThan(-10);
    // “averaged about 59 on day 30; at capacity 12 it averaged about 10”: from the same run, which the copy does not store.
    const { baseline, alternative } = exampleConfigs();
    const run = runAll(baseline, alternative, { id: 'r', projectId: doc.id, modelRevision: 1, createdAt: doc.createdAt });
    const base = run.baseline.summaries, alt = run.alternative!.summaries;
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
    expect(w.map((x) => `${x.step}/${x.severity}/${x.id}`)).toEqual(['frame/gap/stakeholder', 'frame/check/question-outcome', 'frame/tip/question-mark', 'frame/tip/question-vague', 'conclude/gap/results']);
    const stepOrder = STEPS.map((s) => s.id);
    const all = compassWarnings(doc).map((x) => stepOrder.indexOf(x.step));
    expect(all).toEqual([...all].sort((a, b) => a - b));
  });
  it('every warning has a non-empty message and a known step', () => {
    for (const w of compassWarnings(doc)) { expect(w.message.trim()).not.toBe(''); expect(STEPS.some((s) => s.id === w.step)).toBe(true); }
    expect(COMPASS_RULES_VERSION).toBe('compass-rules-v4');
  });
  it('a step counts as started as soon as one of its fields has content', () => {
    const d = createProject();
    d.passport.scope.boundary = 'The central office';
    d.passport.selfChecks['frame-decide'] = 'An answer alone does not start a step.';
    expect(stepsStarted(d.passport)).toEqual(['scope']);
  });
  it('an included artefact starts its step, even when it writes no field', () => {
    const d = createProject();
    d.artefacts = [copyOf(doc0, 'comparison')];
    expect(stepsStarted(d.passport)).toEqual([]);
    expect(stepStarted(d.passport, 'experiment', d.artefacts)).toBe(true);
    expect(stepsStarted(d.passport, d.artefacts)).toEqual(['experiment']);
    expect(stepsStarted(doc0.passport, doc0.artefacts)).toHaveLength(7);
    // The rules place each kind at the step its definition names.
    for (const k of KIND_ORDER) expect(KIND_STEP[k], k).toBe(KINDS[k].step);
    expect(Object.keys(KIND_STEP).sort()).toEqual([...KIND_ORDER].sort());
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
    expect(compassWarnings(mutated((x) => { x.passport.representation.primaryMethod = 'des'; x.passport.representation.alternativeMethod = 'system-dynamics'; x.passport.experiment.runSettings = 'Horizon 30 days.'; })).find((w) => w.id === 'replications')!.message).toMatch(/^Discrete-event simulation is stochastic/);
    // A method that is not stochastic by nature is not asked for replications or a seed.
    const sd = mutated((x) => { x.passport.experiment.runSettings = 'Horizon 30 days.'; });
    expect(has(sd, 'replications')).toBe(false);
    expect(has(sd, 'seed')).toBe(false);
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
  });
  it('problem and lever with the same text', () => {
    const d = mutated((x) => { x.passport.decision.problem = 'Hire more staff'; x.passport.decision.levers = '  hire more STAFF '; });
    expect(severityOf(d, 'lever-is-problem')).toBe('check');
  });
});

describe('rules added in compass-rules-v3: included artefacts', () => {
  it('a failed check in the included check plan asks for an answer', () => {
    const d = mutated((x) => { copyOf(x, 'check-plan').data.checks[0].status = 'failed'; });
    expect(severityOf(d, 'plan-failed')).toBe('check');
    expect(compassWarnings(d).find((w) => w.id === 'plan-failed')).toMatchObject({ step: 'evaluation', message: 'Your check plan has 1 failed check. Say what you changed, or why the model is still fit for the question.' });
    expect(checkpointReadiness(d, 'baseline').map((w) => w.id)).toEqual(['plan-failed']);
    copyOf(d, 'check-plan').data.checks[7].status = 'failed';
    expect(compassWarnings(d).find((w) => w.id === 'plan-failed')!.message).toMatch(/^Your check plan has 2 failed checks\. /);
    // Planned, done and passed checks are not open items; neither is a plan that is no longer included.
    for (const c of copyOf(d, 'check-plan').data.checks) c.status = c.status === 'failed' ? 'done' : c.status;
    expect(has(d, 'plan-failed')).toBe(false);
    const removed = mutated((x) => { copyOf(x, 'check-plan').data.checks[0].status = 'failed'; without(x, 'check-plan'); });
    expect(has(removed, 'plan-failed')).toBe(false);
    expect(compassWarnings(removed)).toEqual([]); // the step's own text still stands
  });
  it('a comparison with fewer than two replications in either policy', () => {
    const id = `cmp-reps-${EXAMPLE_COPIES.comparison.id}`;
    const one = mutated((x) => { copyOf(x, 'comparison').data.alternative = [6]; copyOf(x, 'comparison').data.paired = false; });
    expect(severityOf(one, id)).toBe('check');
    expect(compassWarnings(one).find((w) => w.id === id)).toMatchObject({ step: 'experiment', message: 'The comparison “Capacity 10 versus 12” has fewer than two replications for a policy. One run cannot tell a real difference from chance.' });
    expect(checkpointReadiness(one, 'evaluation').map((w) => w.id)).toEqual([id]);
    copyOf(one, 'comparison').data.alternative = [6, 7];
    expect(has(one, id)).toBe(false);
    expect(has(mutated((x) => { copyOf(x, 'comparison').data.baseline = [30]; }), id)).toBe(true);
    expect(has(mutated((x) => { Object.assign(copyOf(x, 'comparison').data, { baseline: [], alternative: [] }); }), id)).toBe(true);
    // Every included comparison is looked at on its own; an untitled one is still named.
    const two = mutated((x) => { x.artefacts.push({ ...structuredClone(copyOf(x, 'comparison')), id: 'inc-second', title: '  ', data: { ...copyOf(x, 'comparison').data, baseline: [1], alternative: [2] } }); });
    expect(ids(two).filter((i) => i.startsWith('cmp-reps-'))).toEqual(['cmp-reps-inc-second']);
    expect(compassWarnings(two).find((w) => w.id === 'cmp-reps-inc-second')!.message).toMatch(/^The comparison “Untitled” has fewer/);
  });
  it('results without an included comparison are a suggestion, never a missing item (for a policy experiment)', () => {
    // A discrete-event model compares policies; without its comparison the project is still a policy experiment.
    const d = mutated((x) => { without(x, 'comparison'); x.passport.representation.primaryMethod = 'des'; x.passport.representation.alternativeMethod = 'system-dynamics'; });
    expect(severityOf(d, 'no-comparison')).toBe('tip');
    expect(compassWarnings(d).find((w) => w.id === 'no-comparison')).toMatchObject({ step: 'experiment', message: expect.stringMatching(/^Suggestion: step 7 reports results, but no comparison is included here\. Add one from the Toolbox/) });
    expect(compassWarnings(d).filter((w) => w.severity !== 'tip')).toEqual([]);
    expect(checkpointReadiness(d, 'evaluation')).toEqual([]);
    d.passport.conclusion.results = ' ';
    expect(has(d, 'no-comparison')).toBe(false); // nothing is reported yet, so nothing needs backing
    expect(has(createProject(), 'no-comparison')).toBe(false);
    // System dynamics without a comparison is a scenario analysis: the Fair comparison is not suggested.
    expect(has(mutated((x) => { without(x, 'comparison'); }), 'no-comparison')).toBe(false);
  });
  it('step 2 with neither a conceptual model nor an earlier sketch points to the Toolbox', () => {
    const neither = mutated((x) => { without(x, 'concept-model'); x.passport.representation.nodes = []; x.passport.representation.relations = []; });
    expect(severityOf(neither, 'sketch')).toBe('tip');
    expect(compassWarnings(neither).find((w) => w.id === 'sketch')!.message).toBe('Suggestion: draw the conceptual model in the Toolbox and add it to this step.');
    // Either one is enough.
    expect(has(mutated((x) => { without(x, 'concept-model'); }), 'sketch')).toBe(false);
    expect(has(mutated((x) => { x.passport.representation.nodes = []; x.passport.representation.relations = []; }), 'sketch')).toBe(false);
  });
  it('a data model with no source is a check, reported once for the model and not again for the row it owns', () => {
    const model = copyOf(doc0, 'data-model');
    const id = `dm-src-${model.id}`;
    const d = mutated((x) => {
      copyOf(x, 'data-model').data.provenance = '  ';
      x.passport.inputs.find((r) => r.inclusion === model.id)!.provenance = ''; // the row says the same, as the copy wrote it
    });
    expect(severityOf(d, id)).toBe('check');
    expect(compassWarnings(d).find((w) => w.id === id)).toMatchObject({ step: 'inputs', message: 'The data model “Daily arrivals” has no source. Say where its numbers come from, then update it here.' });
    expect(has(d, 'in-src-in-arrivals')).toBe(false);
    expect(checkpointReadiness(d, 'design').map((w) => w.id)).toEqual([id]);
    // With a source in the model, the row is judged on its own again.
    copyOf(d, 'data-model').data.provenance = 'Ticket system export, September.';
    expect(has(d, id)).toBe(false);
    expect(severityOf(d, 'in-src-in-arrivals')).toBe('check');
    // A row typed by hand is never covered by a model.
    expect(severityOf(mutated((x) => { x.passport.inputs[1].provenance = ''; }), `in-src-${doc0.passport.inputs[1].id}`)).toBe('check');
  });
  it('a copy whose Toolbox original has changed is a suggestion, and only when the device’s artefacts are given', () => {
    const plan = copyOf(doc0, 'check-plan');
    const id = `copy-outdated-${plan.id}`;
    const toolbox = new Map([[plan.sourceId, plan.sourceRevision + 2]]);
    expect(severityOf(doc0, id)).toBeUndefined(); // the report: from the project file alone
    const w = compassWarnings(doc0, toolbox).find((x) => x.id === id);
    expect(w).toMatchObject({ step: 'evaluation', severity: 'tip', message: 'Suggestion: “Checks for the backlog model” has changed in the Toolbox since you added it. Update it here, or keep this version.' });
    expect(compassWarnings(doc0, toolbox).filter((x) => x.severity !== 'tip')).toEqual([]);
    expect(warningsFor(doc0, 'evaluation', toolbox).map((x) => x.id)).toEqual([id]);
    // Up to date, or no longer on this device: nothing to suggest (the card says where the original is).
    expect(compassWarnings(doc0, new Map([[plan.sourceId, plan.sourceRevision]]))).toEqual([]);
    expect(compassWarnings(doc0, new Map())).toEqual([]);
    // One suggestion per changed copy, at the copy's own step.
    const all = new Map(doc0.artefacts.map((i) => [i.sourceId, i.sourceRevision + 1]));
    expect(compassWarnings(doc0, all).map((x) => [x.step, x.id])).toEqual(doc0.artefacts.map((i) => [KINDS[i.kind].step, `copy-outdated-${i.id}`]));
    expect(CHECKPOINT_DEFS.every((cp) => checkpointReadiness(doc0, cp.id).length === 0)).toBe(true);
  });
  it('the rules never look at the earlier sandbox, and survive a copy that is not what its kind promises', () => {
    const d = workedExample() as Partial<ProjectDoc> as ProjectDoc;
    delete (d as Partial<ProjectDoc>).sandbox;
    expect(compassWarnings(d)).toEqual([]);
    for (const id of ['stale-run', 'partial-run']) expect(ids(mutated((x) => { x.passport.experiment.runSettings = 'Horizon 30 days.'; })), id).not.toContain(id);
    // A project stored on the device never passed the importer: a damaged copy must not stop the rules.
    const damaged = mutated((x) => {
      x.artefacts = [
        { ...copyOf(x, 'check-plan'), data: null }, { ...copyOf(x, 'check-plan'), id: 'b', data: { checks: [null, { status: 'failed', text: 'Units' }] } },
        { ...copyOf(x, 'comparison'), id: 'c', title: undefined, data: {} }, { ...copyOf(x, 'comparison'), id: 'd', data: null },
      ] as unknown as Inclusion[];
    });
    expect(() => compassWarnings(damaged)).not.toThrow();
    expect(ids(damaged)).toEqual(expect.arrayContaining(['plan-failed', 'cmp-reps-c', 'cmp-reps-d']));
    const noList = mutated((x) => { (x as Partial<ProjectDoc>).artefacts = undefined; });
    expect(() => compassWarnings(noList)).not.toThrow();
    expect(ids(noList)).toEqual([]); // system dynamics with no comparison: a scenario analysis, fully written
    const noListDes = mutated((x) => { (x as Partial<ProjectDoc>).artefacts = undefined; x.passport.representation.primaryMethod = 'des'; x.passport.representation.alternativeMethod = 'system-dynamics'; });
    expect(ids(noListDes)).toEqual(['no-comparison']);
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

describe('importer: schema v1 → v3, self-checks and rubrics', () => {
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
    expect(res.project.schemaVersion).toBe(3);
    expect(res.project.passport.selfChecks).toEqual({});
    for (const cp of Object.values(res.project.passport.review)) expect(cp.rubric).toEqual({});
    expect(res.project.passport.review.proposal).toMatchObject({ status: 'teacher-reviewed', notes: 'Clear question.', reviewer: 'Reviewer A', feedbackSource: 'teacher' });
    expect(res.warnings.join('\n')).toMatch(/schema version 1 upgraded to version 3/);
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
  it('a v3 round trip preserves selfChecks, rubric and the included artefacts, with no upgrade note', () => {
    const d = graded();
    const res = parseProjectJson(projectJson(d));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.project.passport.selfChecks).toEqual(d.passport.selfChecks);
    expect(res.project.passport.review).toEqual(d.passport.review);
    expect(res.project.passport).toEqual(d.passport);
    expect(res.project.methods).toEqual(d.methods);
    expect(res.project.artefacts).toEqual(d.artefacts);
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
  it('schema version 4 is rejected with an explanation and nothing is imported', () => {
    const raw = { ...JSON.parse(projectJson(workedExample())), schemaVersion: 4 };
    const res = importProjectObject(raw);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/newer schema \(version 4\)/);
    expect(!res.ok && res.error).toMatch(/supports version 3/);
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

describe('rules added in compass-rules-v2: planning stage, data status and thin entries', () => {
  it('a project marked as still planning is not told its results are missing', () => {
    const d = mutated((x) => { x.passport.conclusion = { results: '', recommendation: '', limitations: '', changeConditions: '' }; });
    expect(ids(d)).toEqual(expect.arrayContaining(['results', 'recommendation', 'limitations']));
    expect(checkpointReadiness(d, 'final').length).toBe(3);
    d.passport.identity.stage = 'planning';
    expect(ids(d).filter((i) => ['results', 'recommendation', 'limitations'].includes(i))).toEqual([]);
    expect(severityOf(d, 'planning')).toBe('tip');
    expect(checkpointReadiness(d, 'final')).toEqual([]);
    // once something is written in step 7 the usual rules apply again
    d.passport.conclusion.results = 'About 24 fewer open requests.';
    expect(has(d, 'planning')).toBe(false);
    expect(has(d, 'recommendation')).toBe(true);
  });
  it('data still to be obtained needs a plan; assumed data cannot be called observed', () => {
    const d = mutated((x) => { x.passport.inputs[0].plan = ''; });
    expect(severityOf(d, 'in-plan-in-arrivals')).toBe('check');
    const e = mutated((x) => { x.passport.inputs[2].sourceType = 'observed'; });
    expect(severityOf(e, 'in-assume-in-capacity-alt')).toBe('check');
    const f = mutated((x) => { x.passport.inputs[1].sourceType = 'observed'; x.passport.inputs[1].provenance = 'my guess from one visit'; });
    expect(severityOf(f, 'in-guess-in-capacity')).toBe('check');
    const g = mutated((x) => { delete x.passport.inputs[0].availability; delete x.passport.inputs[4].availability; });
    expect(severityOf(g, 'in-status')).toBe('tip');
    expect(compassWarnings(g).find((w) => w.id === 'in-status')!.message).toMatch(/^Suggestion: 2 inputs have no data status/);
  });
  it('counts data readiness', () => {
    expect(dataReadiness(workedExample().passport)).toEqual({ have: 1, obtainable: 3, assume: 1, undecided: 0, total: 5 });
    expect(dataReadiness(createProject().passport)).toEqual({ have: 0, obtainable: 0, assume: 0, undecided: 0, total: 0 });
  });
  it('prompts, as suggestions only, for a question without amount or period, a problem that opens like a solution, a one-word outcome and unlabelled arrows', () => {
    const d = mutated((x) => {
      x.passport.decision.question = 'Can we simulate the canteen to make queues shorter?';
      x.passport.decision.problem = 'We should open a third cash register.';
      x.passport.decision.outcome = 'waiting';
      x.passport.representation.relations[0].label = '';
      x.passport.representation.relations[1].label = ' ';
    });
    for (const id of ['question-vague', 'problem-solution', 'outcome-thin', 'relation-label']) expect(severityOf(d, id), id).toBe('tip');
    expect(compassWarnings(d).find((w) => w.id === 'relation-label')!.message).toMatch(/2 arrows in the sketch have no label/);
    // none of these stops a checkpoint from being ready
    expect(checkpointReadiness(d, 'proposal').map((w) => w.id).filter((i) => ['question-vague', 'problem-solution', 'outcome-thin', 'relation-label'].includes(i))).toEqual([]);
    // sound entries are left alone
    for (const id of ['question-vague', 'problem-solution', 'outcome-thin', 'relation-label', 'in-status']) expect(has(doc0, id), id).toBe(false);
    const fine = mutated((x) => { x.passport.decision.problem = 'The office should be able to answer within two days, but requests stay open for a week.'; });
    expect(has(fine, 'problem-solution')).toBe(true); // “The office should …” still opens like a solution: the prompt is a suggestion, not a verdict
  });
  it('the stage survives an import, and unknown stages are dropped', () => {
    const raw = JSON.parse(projectJson(workedExample()));
    raw.passport.identity.stage = 'planning';
    const a = importProjectObject(raw);
    expect(a.ok && a.project.passport.identity.stage).toBe('planning');
    raw.passport.identity.stage = 'finished';
    const b = importProjectObject(raw);
    expect(b.ok && b.project.passport.identity.stage).toBe('');
    raw.passport.inputs[0].availability = 'somewhere';
    const c = importProjectObject(raw);
    expect(c.ok && c.project.passport.inputs[0].availability).toBeUndefined();
  });
});

describe('review fix: the failed-check open item counts what the plan counts', () => {
  it('a failed check with no text is not reported as a failed check', () => {
    const doc = createProject({ now: '2026-11-21T10:00:00.000Z' });
    const plan = KINDS['check-plan'].empty();
    plan.checks = [
      { id: 'blank', group: 'verification', text: '   ', status: 'failed', evidence: '' },
      { id: 'units', group: 'verification', text: 'Units on every equation', status: 'planned', evidence: '' },
    ];
    doc.artefacts = [{ id: 'inc-plan', sourceId: 'art-plan', sourceRevision: 1, kind: 'check-plan', title: 'Plan', addedAt: '2026-11-21T10:00:00.000Z', data: plan }];
    expect(compassWarnings(doc).some((w) => w.id === 'plan-failed')).toBe(false);
    plan.checks[1].status = 'failed';
    expect(compassWarnings(doc).find((w) => w.id === 'plan-failed')?.message).toMatch(/1 failed check\b/);
  });
});

import { createArtefact } from '../src/domain/artefacts/file';
import { includeArtefact } from '../src/domain/artefacts/include';
import type { Artefact, MeasurementData } from '../src/domain/artefacts/types';
import {
  CHECKPOINT_DEFS as DEFS, STEP_BY_ID, checkpointDefsFor, effectiveProfile, experimentFields, stepFor,
} from '../src/domain/passport/compass';

describe('compass-rules-v4: the steps read the project’s method', () => {
  const NOW = '2026-11-21T10:00:00.000Z';
  /** A fresh project with a primary method and, optionally, a few fields. */
  const project = (method: MethodId | '', change: (d: ProjectDoc) => void = () => {}) => { const d = createProject({ now: NOW }); d.passport.representation.primaryMethod = method; change(d); return d; };
  const warn = (d: ProjectDoc, id: string) => compassWarnings(d).find((w) => w.id === id);
  const measurement = (data: Partial<MeasurementData>): Artefact<'measurement-data'> => ({ ...createArtefact('measurement-data', { now: NOW }), revision: 1, data: { ...kindDef('measurement-data').empty(), ...data } as MeasurementData });
  const survey = () => measurement({
    source: '', cases: 180, scale: { min: 1, max: 7 },
    items: ['q1', 'q2', 'q3', 'q4'].map((c, i) => ({ id: `i${i + 1}`, column: c, label: '', reverse: false, summary: null })),
    constructs: [{ id: 'c1', name: 'Service quality', mode: 'reflective', items: ['i1'], alpha: null }, { id: 'c2', name: 'Loyalty', mode: 'reflective', items: ['i2', 'i3'], alpha: 0.81 }, { id: 'c3', name: 'Price', mode: 'single', items: ['i4'], alpha: null }],
  });

  it('the profile follows the primary method; with no method the general reading stays', () => {
    expect(effectiveProfile(project(''))).toEqual({ model: 'simulation', stochastic: false, inputs: 'distributions', calibration: 'tuning', experiment: 'policy-experiment', known: false });
    expect(effectiveProfile(project('pls-sem'))).toMatchObject({ model: 'statistical', inputs: 'measurement', calibration: 'estimation', experiment: 'analysis-plan', known: true });
    expect(effectiveProfile(project('queueing-theory'))).toMatchObject({ model: 'analytic', stochastic: false, inputs: 'distributions', calibration: 'parameters', experiment: 'scenario-analysis' });
    expect(effectiveProfile(project('des'))).toMatchObject({ model: 'simulation', stochastic: true, inputs: 'distributions', calibration: 'tuning', experiment: 'policy-experiment' });
  });
  it('what a project includes takes precedence over its method', () => {
    const sd = () => project('system-dynamics');
    expect(effectiveProfile(sd())).toMatchObject({ inputs: 'parameters', experiment: 'scenario-analysis' });
    const withComparison = sd(); withComparison.artefacts = [copyOf(doc0, 'comparison')];
    expect(effectiveProfile(withComparison)).toMatchObject({ experiment: 'policy-experiment', inputs: 'parameters' });
    const withModel = sd(); withModel.artefacts = [copyOf(doc0, 'data-model')];
    expect(effectiveProfile(withModel)).toMatchObject({ inputs: 'distributions', experiment: 'scenario-analysis' });
    // Measured data wins over a data model, and works for any method, even with none.
    const both = project('des'); includeArtefact(both, survey(), NOW); both.artefacts.push(copyOf(doc0, 'data-model'));
    expect(effectiveProfile(both).inputs).toBe('measurement');
    const none = project(''); includeArtefact(none, survey(), NOW);
    expect(effectiveProfile(none)).toMatchObject({ inputs: 'measurement', known: false });
    // The worked example is system dynamics with a comparison and a data model: it reads as a policy experiment on distributions.
    expect(effectiveProfile(doc0)).toMatchObject({ known: true, model: 'simulation', inputs: 'distributions', calibration: 'tuning', experiment: 'policy-experiment' });
  });
  it('the worked example reads exactly as before: step texts, labels, checkpoints and open items', () => {
    const prof = effectiveProfile(doc0);
    for (const s of STEPS) expect(stepFor(s.id, prof), s.id).toEqual(STEP_BY_ID[s.id]);
    expect(checkpointDefsFor(prof)).toEqual(DEFS);
    expect(experimentFields(prof).label).toEqual({ baseline: 'Baseline', alternatives: 'Alternatives', comparison: 'Comparison logic', runSettings: 'Run settings' });
    expect(compassWarnings(doc0)).toEqual([]);
    // With no method at all nothing changes either: the same objects.
    expect(checkpointDefsFor(effectiveProfile(project('')))).toBe(DEFS);
    for (const s of STEPS) expect(stepFor(s.id, effectiveProfile(project(''))), s.id).toBe(STEP_BY_ID[s.id]);
  });
  it('a statistical model: an analysis plan in step 6, its own words in steps 2 and 5, no replications', () => {
    const d = project('pls-sem', (x) => { x.passport.scope.horizon = 'Survey of May 2026'; x.passport.outcomes.push({ id: 'o1', metric: 'Loyalty', definition: 'Mean of three items', unit: '', direction: '', aggregation: '', criterion: '' }); });
    expect(warn(d, 'baseline')).toMatchObject({ severity: 'gap', message: 'No hypotheses yet: which paths do you expect, and with which sign?' });
    expect(warn(d, 'alternatives')).toMatchObject({ severity: 'tip', message: expect.stringMatching(/rival model or a comparison of groups/) });
    expect(warn(d, 'comparison')!.message).toMatch(/how effects are tested/);
    expect(warn(d, 'run-settings')!.message).toBe('Estimation settings are not recorded (software, weighting, resamples, seed).');
    expect(warn(d, 'out-unit-o1')).toBeUndefined(); // a construct has no unit of its own
    expect(warn(d, 'out-dir-o1')).toBeUndefined(); // a hypothesis states its sign
    expect(warn(d, 'timeunit')).toBeUndefined(); // no time step in an estimated model
    expect(warn(d, 'detail')!.message).toMatch(/^Unit of analysis not stated/);
    expect(warn(d, 'verification')!.message).toMatch(/data screening, measurement quality, estimation converged/);
    d.passport.experiment.runSettings = 'SmartPLS 4, path weighting, 5,000 bootstrap resamples';
    expect(warn(d, 'replications')).toBeUndefined();
    expect(warn(d, 'seed')).toMatchObject({ severity: 'tip', message: 'Suggestion: record the seed of the bootstrap so the intervals can be reproduced.' });
    d.passport.evaluation.calibration = 'All paths estimated on the full sample.';
    expect(warn(d, 'calibration-only')!.message).toMatch(/^You describe the estimation but no validation/);
    d.passport.conclusion.results = 'Quality → loyalty 0.42 [0.31, 0.53].';
    expect(warn(d, 'no-comparison')).toBeUndefined();
    expect(STEPS.map((s) => s.id)).toContain('experiment');
  });
  it('a statistical model in step 4: measured data, its constructs and its source', () => {
    const d = project('pls-sem');
    expect(warn(d, 'inputs')!.message).toBe('No measured variables listed: name the constructs and their items.');
    expect(warn(d, 'md-none')).toMatchObject({ severity: 'tip', step: 'inputs' });
    const a = survey();
    const { inclusionId } = includeArtefact(d, a, NOW);
    expect(d.passport.inputs.filter((r) => r.inclusion === inclusionId).map((r) => r.name)).toEqual(['Service quality', 'Loyalty', 'Price']);
    expect(warn(d, 'md-none')).toBeUndefined();
    expect(warn(d, `md-src-${inclusionId}`)).toMatchObject({ severity: 'check', message: expect.stringMatching(/has no source/) });
    expect(warn(d, `md-one-${inclusionId}-c1`)).toMatchObject({ severity: 'check', message: '“Service quality” is reflective but has one item. Add items, or mark it as a single-item measure.' });
    expect(warn(d, `md-one-${inclusionId}-c3`)).toBeUndefined(); // a single-item measure says so
    expect(warn(d, `md-one-${inclusionId}-c2`)).toBeUndefined();
    // The rows a measurement owns are not asked for a unit, and their missing source is reported once, for the data.
    for (const r of d.passport.inputs) { expect(warn(d, `in-unit-${r.id}`), r.name).toBeUndefined(); expect(warn(d, `in-src-${r.id}`), r.name).toBeUndefined(); }
    expect(checkpointReadiness(d, 'design').map((w) => w.id)).toEqual(expect.arrayContaining([`md-src-${inclusionId}`, `md-one-${inclusionId}-c1`]));
  });
  it('an analytic model: a scenario analysis, solved rather than replicated', () => {
    const d = project('queueing-theory');
    expect(warn(d, 'baseline')!.message).toBe('No base scenario described.');
    expect(warn(d, 'alternatives')).toMatchObject({ severity: 'gap', message: 'No other scenario: which settings differ from the base?' });
    expect(warn(d, 'run-settings')!.message).toMatch(/^Not said how each scenario is solved or run/);
    d.passport.experiment.runSettings = 'Erlang C formulas, steady state.';
    expect(warn(d, 'replications')).toBeUndefined();
    expect(warn(d, 'seed')).toBeUndefined();
    d.passport.conclusion.results = 'Three advisors cut the mean wait to 4 minutes.';
    expect(warn(d, 'no-comparison')).toBeUndefined(); // the Fair comparison is not suggested
    d.passport.evaluation.calibration = 'Arrival rate from May logs.';
    expect(warn(d, 'calibration-only')!.message).toMatch(/where the parameters come from/);
    expect(warn(createProject(), 'planning')).toBeUndefined();
    const planning = project('queueing-theory', (x) => { x.passport.identity.stage = 'planning'; });
    expect(warn(planning, 'planning')!.message).toBe('Planning stage: results, recommendation and limitations come after the model is solved.');
  });
  it('a stochastic simulation keeps the policy experiment and its replications', () => {
    const d = project('des', (x) => { x.passport.experiment.runSettings = 'Horizon 30 days.'; });
    expect(warn(d, 'baseline')!.message).toBe('No baseline described.');
    expect(warn(d, 'replications')!.message).toBe('Discrete-event simulation is stochastic, but the run settings mention no replications. One run cannot compare policies.');
    expect(warn(d, 'seed')!.severity).toBe('tip');
    expect(checkpointDefsFor(effectiveProfile(d))).toEqual(DEFS);
  });
  it('the checkpoint rubric speaks the method, and keeps its ids so recorded levels keep their meaning', () => {
    const pls = checkpointDefsFor(effectiveProfile(project('pls-sem')));
    const crit = (defs: typeof DEFS, cp: string, id: string) => defs.find((c) => c.id === cp)!.rubric.find((r) => r.id === id)!;
    expect(crit(pls, 'evaluation', 'fairness').criterion).toBe('Analysis plan');
    expect(crit(pls, 'design', 'inputs').criterion).toBe('Measurement quality');
    expect(crit(pls, 'baseline', 'separation').criterion).toBe('Estimation kept separate');
    expect(pls.map((c) => [c.id, c.steps, c.rubric.map((r) => r.id)])).toEqual(DEFS.map((c) => [c.id, c.steps, c.rubric.map((r) => r.id)]));
    const queue = checkpointDefsFor(effectiveProfile(project('queueing-theory')));
    expect(crit(queue, 'evaluation', 'fairness').criterion).toBe('Scenario design');
    expect(crit(queue, 'baseline', 'separation').criterion).toBe('Parameter sources');
  });
  it('a check marked not applicable is neither open nor failed', () => {
    const d = mutated((x) => { for (const c of copyOf(x, 'check-plan').data.checks.slice(0, 3)) c.status = 'na'; });
    expect(warn(d, 'plan-failed')).toBeUndefined();
    expect(compassWarnings(d)).toEqual([]);
    copyOf(d, 'check-plan').data.checks[4].status = 'failed';
    expect(warn(d, 'plan-failed')!.message).toMatch(/^Your check plan has 1 failed check\./);
  });
  it('step texts follow the profile; the self-check ids stay, so answers keep their place', () => {
    const plan = stepFor('experiment', effectiveProfile(project('pls-sem')));
    expect(plan).toMatchObject({ id: 'experiment', number: 6, title: 'Outcomes and experiment' });
    expect(plan.short).toMatch(/^Analysis plan:/);
    expect(plan.selfChecks.map((q) => q.id)).toEqual(STEP_BY_ID.experiment.selfChecks.map((q) => q.id));
    expect(stepFor('experiment', effectiveProfile(project('queueing-theory'))).short).toMatch(/^Scenario analysis:/);
    expect(stepFor('inputs', effectiveProfile(project('pls-sem'))).short).toMatch(/^Measured variables:/);
    expect(stepFor('evaluation', effectiveProfile(project('pls-sem'))).weak).toBe('The R² is high, so the model is valid.');
  });
});

import {
  CHECKPOINT_DEFS as CP_DEFS, changedSinceReview as changedSince, checkpointDefsFor as cpFor, compassWarnings as warningsOf, effectiveProfile as profileOf,
  markReviewed, removedSinceReview,
} from '../src/domain/passport/compass';
import { includeArtefact as include, removeInclusion as dropCopy } from '../src/domain/artefacts/include';
import { checkPlan as planKind } from '../src/domain/artefacts/checkPlan';
import { buildFromSurvey } from '../src/domain/measurement/build';
import { exampleSurvey } from '../src/domain/measurement/example';

describe('review fixes: one reading of the method everywhere', () => {
  const NOW_ = '2026-11-21T10:00:00.000Z';
  const survey = () => { const s = exampleSurvey(); return buildFromSurvey({ columns: s.columns, rows: s.rows }, { source: 'Example', origin: 'example', reverse: s.reverse }).data; };
  it('checkpoint wording follows each field of the profile, also with no method chosen', () => {
    const doc = createProject({ now: NOW_ });
    expect(cpFor(profileOf(doc))).toEqual(CP_DEFS); // the general reading of every field is the general wording
    include(doc, { ...createArtefact('measurement-data', { now: NOW_ }), data: survey(), revision: 1 } as Artefact, NOW_);
    const prof = profileOf(doc);
    expect([prof.known, prof.inputs]).toEqual([false, 'measurement']);
    expect(cpFor(prof).find((c) => c.id === 'design')!.expected).toMatch(/constructs with their items/);
    expect(cpFor(prof).find((c) => c.id === 'baseline')).toEqual(CP_DEFS.find((c) => c.id === 'baseline'));
  });
  it('no unit is asked of a row when step 4 reads as measured variables', () => {
    const doc = createProject({ now: NOW_ });
    doc.passport.inputs.push({ id: 'in-x', name: 'Perceived usefulness', value: '4 items', unit: '', sourceType: 'observed', provenance: 'Survey', uncertainty: '', availability: 'have' });
    expect(warningsOf(doc).map((w) => w.id)).toContain('in-unit-in-x'); // no method: an input needs a unit
    doc.passport.representation.primaryMethod = 'pls-sem';
    expect(warningsOf(doc).map((w) => w.id)).not.toContain('in-unit-in-x');
  });
  it('a check plan with no method is written and reported in the words of the project’s method', () => {
    const doc = createProject({ now: NOW_ });
    doc.passport.representation.primaryMethod = 'pls-sem';
    const plan = { ...planKind.empty(), calibration: { parameters: 'Path weights', tunedOn: 'Wave 1', validatedOn: 'Wave 2' } };
    include(doc, { ...createArtefact('check-plan', { now: NOW_ }), data: plan, revision: 1 } as Artefact, NOW_);
    expect(doc.passport.evaluation.calibration).toBe('Parameters estimated: Path weights\nEstimated on: Wave 1\nPredicted on: Wave 2');
    const md = toMd(doc);
    expect(md).toMatch(/\*\*Estimation \(kept separate from validation\):\*\* Parameters estimated: Path weights/);
    expect(md).toMatch(/\*\*Estimation:\*\* no checks recorded\./);
    expect(md).not.toMatch(/Tuned on|Parameters tuned|\*\*Calibration:\*\*/);
    // A plan with a method of its own keeps its own words.
    expect(planKind.markdown({ ...plan, method: 'des' }).join('\n')).toMatch(/Parameters tuned/);
  });
});

describe('review fix: changed since review compares content', () => {
  const T1 = '2026-11-21T10:00:00.000Z', T2 = '2026-11-21T11:00:00.000Z', T3 = '2026-11-21T12:00:00.000Z';
  const setup = () => {
    const doc = createProject({ now: T1 });
    const a = { ...createArtefact('concept-model', { now: T1, title: 'Sketch' }), revision: 1 } as Artefact<'concept-model'>;
    a.data.objectives = 'Shorter backlog';
    include(doc, a, T1);
    doc.passport.review.proposal.status = 'self-reviewed';
    markReviewed(doc, 'proposal', T2);
    return { doc, a };
  };
  it('a rename alone is not a change; new content is', () => {
    const { doc, a } = setup();
    expect(doc.passport.review.proposal.reviewedCopies).toHaveLength(1);
    include(doc, { ...a, title: 'Renamed sketch', revision: 2 }, T3);
    expect(changedSince(doc, 'proposal')).toEqual([]);
    include(doc, { ...a, title: 'Renamed sketch', revision: 3, data: { ...a.data, objectives: 'Fewer complaints' } }, T3);
    expect(changedSince(doc, 'proposal').map((i) => i.title)).toEqual(['Renamed sketch']);
    expect(toMd(doc)).toMatch(/Changed since review:\*\* “Renamed sketch” changed after the review/);
  });
  it('removing a copy that was there at the review is reported too', () => {
    const { doc } = setup();
    dropCopy(doc, doc.artefacts[0].id);
    expect(changedSince(doc, 'proposal')).toEqual([]);
    expect(removedSinceReview(doc, 'proposal')).toEqual(['Sketch']);
    expect(toMd(doc)).toMatch(/“Sketch” was removed since the review/);
  });
  it('the record survives a project file; a review from before it was kept falls back to the refresh time', () => {
    const { doc, a } = setup();
    const res = parseProjectJson(projectJson(doc));
    if (!res.ok) throw new Error(res.error);
    expect(res.project.passport.review.proposal.reviewedCopies).toEqual(doc.passport.review.proposal.reviewedCopies);
    const r = JSON.parse(projectJson(doc));
    r.passport.review.proposal.reviewedCopies = [{ id: 'x', title: 'y', hash: '<script>' }, 'junk'];
    const bad = importProjectObject(r);
    expect(bad.ok && bad.project.passport.review.proposal.reviewedCopies).toEqual([]);
    delete doc.passport.review.proposal.reviewedCopies;
    include(doc, { ...a, title: 'Renamed', revision: 2 }, T3);
    expect(changedSince(doc, 'proposal')).toHaveLength(1);
  });
});
