import { METHOD_BY_ID, type MethodId } from '../methods/registry';
import { answersKey } from '../methods/rules';
import { runHash } from '../sandbox/experiment';
import type { CheckpointId, Passport, ProjectDoc } from './schema';

/**
 * The Project Compass (docs/COMPASS-SPEC.md): seven steps over the model passport, with
 * guidance, self-check questions, deterministic warnings and checkpoint rubrics.
 * Warnings explain themselves and never mark written reasoning right or wrong.
 */
export const COMPASS_RULES_VERSION = 'compass-rules-v1';

export type StepId = 'frame' | 'scope' | 'method' | 'inputs' | 'evaluation' | 'experiment' | 'conclude';

export interface StepDef {
  id: StepId;
  number: number;
  title: string;
  short: string;            // one-line purpose
  why: string;              // why it matters (≤ 2 sentences)
  good: string;             // a good example
  weak: string;             // a weak example
  selfChecks: { id: string; question: string }[];
  checkpoint: CheckpointId;
}

export const STEPS: StepDef[] = [
  {
    id: 'frame', number: 1, title: 'Frame', short: 'Who decides what, and how will you know it worked?', checkpoint: 'proposal',
    why: 'A model answers someone’s question. If the question is vague, any model will look like an answer.',
    good: 'For the head of student support: how does the average end-of-day backlog over 30 days change if daily capacity rises from 10 to 12 requests, within the current budget?',
    weak: 'We should simulate the support office to see if hiring helps.',
    selfChecks: [
      { id: 'frame-proposal', question: 'Which sentence in your problem is an observed concern, and which is only a proposed solution?' },
      { id: 'frame-decide', question: 'What would the stakeholder do differently depending on the answer?' },
    ],
  },
  {
    id: 'scope', number: 2, title: 'Scope and concept', short: 'What is inside the model, and what is left out on purpose?', checkpoint: 'proposal',
    why: 'The boundary decides which demands and resources count. What you leave out can change the answer more than any parameter.',
    good: 'Included: requests reaching the central office by e-mail, web form and walk-in, including those forwarded by the library. Excluded: the IT helpdesk, because it has its own staff and queue.',
    weak: 'The model covers the whole university.',
    selfChecks: [
      { id: 'scope-omitted', question: 'Name one thing you excluded. How could it change the result if it mattered?' },
      { id: 'scope-detail', question: 'Do you need individuals, groups or totals to answer the question? Why?' },
    ],
  },
  {
    id: 'method', number: 3, title: 'Choose a method', short: 'Which representation fits the question — and which one almost does?', checkpoint: 'design',
    why: 'Each method reveals some things and hides others. A justified choice names what the alternative would have shown.',
    good: 'System dynamics: the question is about aggregate backlog over weeks. Discrete-event simulation is the alternative if individual waiting times turn out to matter.',
    weak: 'Agent-based modelling, because the app is easy to use.',
    selfChecks: [
      { id: 'method-omits', question: 'What does your chosen method leave out that the alternative would show?' },
      { id: 'method-claim', question: 'What kind of claim will you make: description, prediction, or support for a decision?' },
    ],
  },
  {
    id: 'inputs', number: 4, title: 'Inputs and assumptions', short: 'What goes in, where does it come from, and what are you assuming?', checkpoint: 'design',
    why: 'Convenient numbers become “facts” unless their unit, source and uncertainty are written down. Every assumption needs a way to be checked.',
    good: 'Arrivals: 12 requests/day (ticket system, September 2026; daily range 8–16). Assumption: unused capacity is lost — check by asking how slack time is used.',
    weak: 'Arrivals: 12. Staff work efficiently.',
    selfChecks: [
      { id: 'inputs-fragile', question: 'Which input are you least sure about, and how much could it move the result?' },
      { id: 'inputs-assume', question: 'Which assumption, if wrong, would change your recommendation?' },
    ],
  },
  {
    id: 'evaluation', number: 5, title: 'Verification and validation', short: 'How will you know the model is built right — and is the right model?', checkpoint: 'baseline',
    why: 'Verification checks the model against its own specification. Validation checks it against the real system for its purpose. Fitting the data you tuned on is neither.',
    good: 'Verification: daily conservation of requests; a balanced case stays at zero. Validation: compare simulated backlog with October records that were not used for tuning.',
    weak: 'The model fits last month’s data very well, so it is valid.',
    selfChecks: [
      { id: 'eval-simple', question: 'Which simple case has a known answer that your model must reproduce?' },
      { id: 'eval-heldout', question: 'Which data or expert judgement will you keep aside for validation?' },
    ],
  },
  {
    id: 'experiment', number: 6, title: 'Outcomes and experiment', short: 'What exactly will you measure and compare, and how fairly?', checkpoint: 'evaluation',
    why: 'A fair comparison changes one thing at a time and separates a real effect from random variation.',
    good: 'Baseline 10 vs alternative 12 requests/day; 100 replications; both policies face the same arrival sequences; outcome: mean end-of-day backlog with a 95% interval for the difference.',
    weak: 'We ran each policy once and the new one looked better.',
    selfChecks: [
      { id: 'exp-fair', question: 'What is identical between your baseline and the alternative, and what differs?' },
      { id: 'exp-noise', question: 'How will you tell a real difference from random variation?' },
    ],
  },
  {
    id: 'conclude', number: 7, title: 'Conclude and share', short: 'What do you recommend, under which conditions, and what remains uncertain?', checkpoint: 'final',
    why: 'A recommendation is only as strong as its conditions. Stating limits is what makes it trustworthy.',
    good: 'Raise capacity to 12/day if arrivals stay near 12/day. If abandonment exceeds 5% or arrivals pass 14/day, revisit. The model says nothing about individual waiting times.',
    weak: 'The simulation proves we must hire one more employee.',
    selfChecks: [
      { id: 'conclude-change', question: 'What new evidence would make you change the recommendation?' },
      { id: 'conclude-repro', question: 'Could someone else reproduce your result from this passport alone? What is missing?' },
    ],
  },
];
export const STEP_BY_ID: Record<StepId, StepDef> = Object.fromEntries(STEPS.map((s) => [s.id, s])) as Record<StepId, StepDef>;
export const isStepId = (s: string): s is StepId => s in STEP_BY_ID;

const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

/** A step counts as started when any of its own fields has content. Completeness ≠ validity. */
export function stepStarted(p: Passport, id: StepId): boolean {
  switch (id) {
    case 'frame': return [p.decision.stakeholder, p.decision.problem, p.decision.levers, p.decision.outcome, p.decision.question].some(filled) || !!p.decision.claimType;
    case 'scope': return Object.values(p.scope).some(filled) || p.representation.nodes.length > 0;
    case 'method': return !!p.representation.primaryMethod || !!p.representation.alternativeMethod || filled(p.representation.justification);
    case 'inputs': return p.inputs.length > 0 || p.assumptions.length > 0;
    case 'evaluation': return Object.values(p.evaluation).some(filled);
    case 'experiment': return p.outcomes.length > 0 || Object.values(p.experiment).some(filled);
    case 'conclude': return Object.values(p.conclusion).some(filled);
  }
}
export function stepsStarted(p: Passport): StepId[] { return STEPS.filter((s) => stepStarted(p, s.id)).map((s) => s.id); }

export type Severity = 'gap' | 'check' | 'tip';
export interface Warning { id: string; step: StepId; severity: Severity; message: string }

const STOCHASTIC_METHODS: MethodId[] = ['monte-carlo', 'des', 'abm', 'markov-chains', 'queueing-theory'];
const WAITING_METHODS: MethodId[] = ['des', 'queueing-theory', 'abm'];
const RELATIONSHIP_METHODS: MethodId[] = ['path-analysis', 'cb-sem', 'pls-sem'];

/** Deterministic compass rules. Order: gaps first within each step, then checks, then tips. */
export function compassWarnings(doc: ProjectDoc): Warning[] {
  const p = doc.passport, out: Warning[] = [];
  const add = (step: StepId, severity: Severity, id: string, message: string) => out.push({ id, step, severity, message });
  const primary = p.representation.primaryMethod, alt = p.representation.alternativeMethod;

  // 1 Frame
  if (!filled(p.decision.stakeholder)) add('frame', 'gap', 'stakeholder', 'No stakeholder yet: who will use the result?');
  if (!filled(p.decision.problem)) add('frame', 'gap', 'problem', 'The observed problem is not described.');
  if (!filled(p.decision.levers)) add('frame', 'gap', 'levers', 'No decision levers: what can the stakeholder actually change?');
  if (!filled(p.decision.question)) add('frame', 'gap', 'question', 'The precise question is not written yet.');
  if (filled(p.decision.question) && !filled(p.decision.outcome)) add('frame', 'check', 'question-outcome', 'Your question has no measurable outcome. Say what you will measure, in which unit.');
  if (!p.decision.claimType) add('frame', 'gap', 'claim', 'Choose the type of claim: description, prediction or decision support need different evidence.');
  if (filled(p.decision.question) && !p.decision.question.includes('?')) add('frame', 'tip', 'question-mark', 'Suggestion: phrase the question as a question a model could answer.');
  if (filled(p.decision.levers) && filled(p.decision.problem) && p.decision.levers.trim().toLowerCase() === p.decision.problem.trim().toLowerCase()) add('frame', 'check', 'lever-is-problem', 'The problem and the lever are the same text. A proposed solution is not the problem.');

  // 2 Scope
  if (!filled(p.scope.boundary)) add('scope', 'gap', 'boundary', 'The system boundary is not specified.');
  if (!filled(p.scope.horizon)) add('scope', 'gap', 'horizon', 'No time horizon: over what period does the question matter?');
  if (filled(p.scope.horizon) && !filled(p.scope.timeUnit)) add('scope', 'check', 'timeunit', 'You gave a horizon but no time unit (day, hour, event-driven…).');
  if (filled(p.scope.boundary) && !filled(p.scope.exclusions)) add('scope', 'check', 'exclusions', 'Nothing is listed as excluded. Every model leaves something out: name it.');
  if (!filled(p.scope.detail)) add('scope', 'gap', 'detail', 'Level of detail not stated: individuals, groups or totals?');
  if (p.representation.nodes.length === 0) add('scope', 'tip', 'sketch', 'Suggestion: sketch the main elements and how they relate.');

  // 3 Method
  if (!primary) add('method', 'gap', 'primary', 'No primary method selected.');
  if (primary && !filled(p.representation.justification)) add('method', 'gap', 'primary-why', 'The primary method has no written justification.');
  if (!alt) add('method', 'gap', 'alternative', 'No alternative method recorded. Which method almost fits?');
  if (alt && !filled(p.representation.alternativeJustification)) add('method', 'gap', 'alt-why', 'Explain why the alternative is less suitable, or how it complements the primary method.');
  if (primary && alt && primary === alt) add('method', 'check', 'same-method', 'Primary and alternative are the same method.');
  if (doc.methods.answers && doc.methods.answersKey && answersKey(doc.methods.answers) !== doc.methods.answersKey) add('method', 'check', 'advice-outdated', 'Your answers in the method chooser changed after you decided. Review the choice.');
  if (primary && /wait/i.test(`${p.decision.question} ${p.decision.outcome}`) && !WAITING_METHODS.includes(primary)) add('method', 'check', 'waiting', `Your question mentions waiting, but ${METHOD_BY_ID[primary].name} does not estimate individual waiting times. Consider discrete-event simulation or queueing theory.`);
  if (primary && RELATIONSHIP_METHODS.includes(primary) && p.decision.claimType === 'decision-support') add('method', 'check', 'causal', 'A fitted relationship describes an association. Using it to choose an intervention needs a causal argument.');

  // 4 Inputs and assumptions
  if (p.inputs.length === 0) add('inputs', 'gap', 'inputs', 'No inputs listed.');
  p.inputs.forEach((r, i) => {
    const name = r.name.trim() || `Input ${i + 1}`;
    if (!filled(r.unit)) add('inputs', 'check', `in-unit-${r.id}`, `“${name}” has no unit.`);
    if (r.sourceType === 'unspecified' || !filled(r.provenance)) add('inputs', 'check', `in-src-${r.id}`, `“${name}” has no clear source.`);
    if (!filled(r.value)) add('inputs', 'gap', `in-val-${r.id}`, `“${name}” has no value or range.`);
  });
  if (p.assumptions.length === 0) add('inputs', 'gap', 'assumptions', 'No assumptions recorded. Every model makes some.');
  p.assumptions.forEach((a, i) => {
    if (!filled(a.consequenceIfWrong)) add('inputs', 'check', `as-cons-${a.id}`, `Assumption ${i + 1} does not say what happens if it fails.`);
    if (!filled(a.plannedCheck)) add('inputs', 'check', `as-check-${a.id}`, `Assumption ${i + 1} has no planned check.`);
  });

  // 5 Verification and validation
  if (!filled(p.evaluation.verification)) add('evaluation', 'gap', 'verification', 'No verification checks planned (units, conservation, known simple cases).');
  if (!filled(p.evaluation.validation)) add('evaluation', 'gap', 'validation', 'No validation evidence planned.');
  if (filled(p.evaluation.calibration) && !filled(p.evaluation.validation)) add('evaluation', 'check', 'calibration-only', 'You describe calibration but no validation. Fitting the tuning data is not validation: keep some evidence aside.');

  // 6 Outcomes and experiment
  if (p.outcomes.length === 0) add('experiment', 'gap', 'outcomes', 'No outcome metric defined.');
  p.outcomes.forEach((o, i) => {
    const name = o.metric.trim() || `Outcome ${i + 1}`;
    if (!filled(o.unit)) add('experiment', 'check', `out-unit-${o.id}`, `“${name}” has no unit.`);
    if (!filled(o.definition)) add('experiment', 'gap', `out-def-${o.id}`, `“${name}” has no definition someone else could compute.`);
    if (!o.direction) add('experiment', 'check', `out-dir-${o.id}`, `“${name}”: is lower or higher better?`);
  });
  if (!filled(p.experiment.baseline)) add('experiment', 'gap', 'baseline', 'No baseline described.');
  if (!filled(p.experiment.alternatives)) add('experiment', 'gap', 'alternatives', 'No alternative to compare with the baseline.');
  if (!filled(p.experiment.comparison)) add('experiment', 'gap', 'comparison', 'Comparison logic not described: what stays identical between policies?');
  if (!filled(p.experiment.runSettings)) add('experiment', 'gap', 'run-settings', 'Run settings (horizon, replications, seed) are not recorded.');
  // Random elements come from a stochastic method or from random demand in a sandbox run.
  const stochasticMethod = !!primary && STOCHASTIC_METHODS.includes(primary);
  const randomSandbox = !!doc.sandbox.lastRun && doc.sandbox.baseline.demand.mode === 'random';
  const who = stochasticMethod ? `${METHOD_BY_ID[primary as MethodId].name} is stochastic` : 'Your sandbox model has random demand';
  if ((stochasticMethod || randomSandbox) && filled(p.experiment.runSettings) && !/replic|run/i.test(p.experiment.runSettings)) add('experiment', 'check', 'replications', `${who}, but the run settings mention no replications. One run cannot compare policies.`);
  if ((stochasticMethod || randomSandbox) && filled(p.experiment.runSettings) && !/seed/i.test(p.experiment.runSettings)) add('experiment', 'tip', 'seed', 'Suggestion: record the random seed so the result can be reproduced.');
  const run = doc.sandbox.lastRun;
  if (run && run.modelHash !== runHash(doc.sandbox.baseline, doc.sandbox.alternative)) add('experiment', 'check', 'stale-run', 'The sandbox results use earlier settings. Run again before reporting them.');
  if (run && run.status === 'partial') add('experiment', 'check', 'partial-run', 'The last sandbox run was cancelled: its results are partial.');

  // 7 Conclude
  if (!filled(p.conclusion.results)) add('conclude', 'gap', 'results', 'No results summary.');
  if (!filled(p.conclusion.recommendation)) add('conclude', 'gap', 'recommendation', 'No recommendation.');
  if (!filled(p.conclusion.limitations)) add('conclude', 'gap', 'limitations', 'Limitations are not stated.');
  if (filled(p.conclusion.recommendation) && !filled(p.conclusion.changeConditions)) add('conclude', 'check', 'conditions', 'The recommendation has no conditions that would change it. When does it stop holding?');
  if (/\b(prove[sd]?|guarantee[sd]?|certainly|always)\b/i.test(p.conclusion.recommendation)) add('conclude', 'tip', 'overclaim', 'Suggestion: a model supports a recommendation under assumptions; check words such as “proves” or “guarantees”.');

  const rank: Record<Severity, number> = { gap: 0, check: 1, tip: 2 };
  const order = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));
  return out.sort((a, b) => order[a.step] - order[b.step] || rank[a.severity] - rank[b.severity]);
}

export function warningsFor(doc: ProjectDoc, step: StepId): Warning[] { return compassWarnings(doc).filter((w) => w.step === step); }

// ── Checkpoints and rubrics ──────────────────────────────────────────────

export const RUBRIC_LEVELS = ['Not yet', 'Emerging', 'Developing', 'Strong'];

export interface RubricCriterion { id: string; criterion: string; strong: string }
export interface CheckpointDef { id: CheckpointId; label: string; steps: StepId[]; expected: string; rubric: RubricCriterion[] }

export const CHECKPOINT_DEFS: CheckpointDef[] = [
  { id: 'proposal', label: 'Proposal', steps: ['frame', 'scope'], expected: 'A decision question with stakeholder, lever and measurable outcome; a justified boundary and horizon.',
    rubric: [
      { id: 'question', criterion: 'Answerable question', strong: 'Names the lever, the outcome with its unit, the horizon and the constraint.' },
      { id: 'problem', criterion: 'Problem versus proposal', strong: 'Separates the observed concern from proposed solutions and lists alternative levers.' },
      { id: 'boundary', criterion: 'Boundary and exclusions', strong: 'States what is in, what is out and how an exclusion could matter.' },
    ] },
  { id: 'design', label: 'Design', steps: ['method', 'inputs'], expected: 'A justified method with an alternative; inputs with units and sources; assumptions with planned checks.',
    rubric: [
      { id: 'method', criterion: 'Method justification', strong: 'Explains fit to the question and what the method omits; a credible alternative is discussed.' },
      { id: 'inputs', criterion: 'Input quality', strong: 'Every input has value, unit, source and stated uncertainty.' },
      { id: 'assumptions', criterion: 'Assumptions register', strong: 'Each key assumption has a rationale, a consequence if wrong and a feasible check.' },
    ] },
  { id: 'baseline', label: 'Baseline', steps: ['evaluation'], expected: 'A working baseline with verification checks and a validation plan that is separate from calibration.',
    rubric: [
      { id: 'verification', criterion: 'Verification', strong: 'Concrete checks: units, conservation, and simple cases with known answers.' },
      { id: 'validation', criterion: 'Validation plan', strong: 'Names evidence not used for tuning and what agreement would count as adequate.' },
      { id: 'separation', criterion: 'Calibration kept separate', strong: 'Tuned parameters and tuning data are stated; validation uses other evidence.' },
    ] },
  { id: 'evaluation', label: 'Evaluation', steps: ['experiment'], expected: 'Defined outcomes and a fair experiment: baseline, alternatives, comparison logic and reproducible run settings.',
    rubric: [
      { id: 'outcomes', criterion: 'Outcome definitions', strong: 'Each metric has a computable definition, unit, direction and aggregation.' },
      { id: 'fairness', criterion: 'Fair comparison', strong: 'One factor changes; policies face the same inputs; variation is handled with replications.' },
      { id: 'reproducible', criterion: 'Reproducibility', strong: 'Horizon, replications, seed and software version are recorded.' },
    ] },
  { id: 'final', label: 'Final', steps: ['conclude'], expected: 'Results with uncertainty, a conditional recommendation, limitations and what would change the decision.',
    rubric: [
      { id: 'results', criterion: 'Results with uncertainty', strong: 'Reports effect sizes with intervals and the settings that produced them.' },
      { id: 'conditional', criterion: 'Conditional recommendation', strong: 'States the conditions under which it holds and those that would change it.' },
      { id: 'limits', criterion: 'Limitations', strong: 'Names what the model cannot say and how that affects the decision.' },
    ] },
];
export const CHECKPOINT_BY_ID: Record<CheckpointId, CheckpointDef> = Object.fromEntries(CHECKPOINT_DEFS.map((c) => [c.id, c])) as Record<CheckpointId, CheckpointDef>;

/** Open gaps and checks for a checkpoint’s steps (tips excluded). */
export function checkpointReadiness(doc: ProjectDoc, id: CheckpointId): Warning[] {
  const steps = CHECKPOINT_BY_ID[id].steps;
  return compassWarnings(doc).filter((w) => steps.includes(w.step) && w.severity !== 'tip');
}
