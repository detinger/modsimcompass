import type { ArtefactKind } from '../artefacts/types';
import { profileFor, type MethodProfile } from '../methods/profiles';
import { METHOD_BY_ID, type MethodId } from '../methods/registry';
import { answersKey } from '../methods/rules';
import { fnv1a, stableStringify } from '../sandbox/engine';
import type { CheckpointId, Inclusion, Passport, ProjectDoc } from './schema';

/**
 * The Project Compass (docs/COMPASS-SPEC.md): seven steps over the model passport, with
 * guidance, self-check questions, deterministic warnings and checkpoint rubrics.
 * Warnings explain themselves and never mark written reasoning right or wrong.
 *
 * Version 3 (docs/TOOLBOX-SPEC.md §7) knows the artefacts a project includes: no conceptual model in step 2, a data
 * model with no source, a check plan with a failed check, a comparison with too few replications, and a copy whose
 * Toolbox original has changed since (a suggestion). The backlog sandbox is no longer part of a project and has no rules.
 *
 * Only the last rule needs more than the project: the revisions of the Toolbox artefacts on this device. Screens pass
 * them; the exports do not, so a report's open items depend on the project file alone.
 *
 * Version 4 knows the method (src/domain/methods/profiles.ts). A statistical model is estimated from measured data and
 * tested by an analysis plan; an analytic model is solved for each scenario; a simulation is run, with replications when
 * it is stochastic. Every rule that assumed a simulation now reads `effectiveProfile(doc)`, and so do the step texts,
 * the field labels, the checkpoint rubric and the report. With no method chosen, the wording is that of version 3.
 */
export const COMPASS_RULES_VERSION = 'compass-rules-v4';

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

/** Short names of the steps for menus, links and narrow screens. The one place they are written. */
export const STEP_LABEL: Record<StepId, string> = { frame: 'Frame', scope: 'Concept', method: 'Method', inputs: 'Inputs', evaluation: 'Check', experiment: 'Experiment', conclude: 'Conclude' };

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
    id: 'scope', number: 2, title: 'Concept and scope', short: 'What is inside the model, and what is left out on purpose?', checkpoint: 'proposal',
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
      { id: 'conclude-repro', question: 'Could someone else reproduce your result from this project alone? What is missing?' },
    ],
  },
];
export const STEP_BY_ID: Record<StepId, StepDef> = Object.fromEntries(STEPS.map((s) => [s.id, s])) as Record<StepId, StepDef>;
export const isStepId = (s: string): s is StepId => Object.hasOwn(STEP_BY_ID, s);

const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

/** The step each kind of artefact belongs to (the same as `KINDS[kind].step`; kept here so the rules stay free of the kind files). */
export const KIND_STEP: Record<ArtefactKind, StepId> = {
  'concept-model': 'scope', 'method-choice': 'method', 'data-model': 'inputs', 'measurement-data': 'inputs', 'check-plan': 'evaluation', 'comparison': 'experiment',
};

// ── What the steps mean for this project's method ───────────────────────

/** The parts of a method's profile the steps read, and whether a method is chosen at all. */
export interface StepProfile {
  model: MethodProfile['model']; stochastic: boolean;
  inputs: MethodProfile['inputs']; calibration: MethodProfile['calibration']; experiment: MethodProfile['experiment'];
  /** False while no primary method is chosen: the steps keep their general wording. */
  known: boolean;
}
/** No method yet: the general reading, which is how the steps were written before methods had profiles. */
const GENERAL: StepProfile = { model: 'simulation', stochastic: false, inputs: 'distributions', calibration: 'tuning', experiment: 'policy-experiment', known: false };

/**
 * What the steps mean for this project: the profile of its primary method, with what the project includes taking
 * precedence (the rule documented in profiles.ts). An included comparison makes step 6 a policy experiment; included
 * measurement data makes step 4 read as measurement, an included data model as distributions. The screens, the rules
 * and the report all ask this one function, so they cannot disagree.
 */
export function effectiveProfile(doc: Pick<ProjectDoc, 'passport' | 'artefacts'>): StepProfile {
  const base = profileFor(doc.passport?.representation?.primaryMethod);
  const out: StepProfile = base
    ? { model: base.model, stochastic: base.stochastic, inputs: base.inputs, calibration: base.calibration, experiment: base.experiment, known: true }
    : { ...GENERAL };
  const kinds = new Set((Array.isArray(doc.artefacts) ? doc.artefacts : []).map((i) => i?.kind));
  if (kinds.has('comparison')) out.experiment = 'policy-experiment';
  if (kinds.has('measurement-data')) out.inputs = 'measurement';
  else if (kinds.has('data-model')) out.inputs = 'distributions';
  return out;
}

type StepText = Pick<StepDef, 'short' | 'why' | 'good' | 'weak'> & { questions?: Record<string, string> };
/** Steps 4, 5 and 6 read differently per profile. The general reading is the step's own text in `STEPS`. */
const INPUT_TEXT: Partial<Record<StepProfile['inputs'], StepText>> = {
  measurement: {
    short: 'Measured variables: which constructs, which items, and from whom?',
    why: 'A construct is only as good as its items. Name the items, the scale, where the answers come from and how missing answers are handled.',
    good: 'Service quality: four reflective items on a 1–7 scale (client survey, 212 answers, May 2026; 3% missing, removed listwise). Assumption: answers are honest — checked with an attention item.',
    weak: 'We measured satisfaction with a survey.',
    questions: { 'inputs-fragile': 'Which construct is measured least well, and how could that bias its paths?' },
  },
  parameters: {
    short: 'Parameters: which values go in, where does each come from, and what are you assuming?',
    why: 'Rates, initial values and settings drive every result. Each needs a value, a unit and a source; a guessed one needs a range.',
    good: 'Arrival rate 12 per hour (ticket logs, May 2026; range 10–14). Assumption: arrivals are independent — check the gaps between them.',
    weak: 'Arrival rate 12.',
    questions: { 'inputs-fragile': 'Which parameter are you least sure about, and how much could it move the result?' },
  },
};
const CHECK_TEXT: Partial<Record<StepProfile['calibration'], StepText>> = {
  estimation: {
    short: 'How will you know the model is specified right, and that it predicts?',
    why: 'Verification checks the data and the model as specified. Validation asks whether it predicts cases it has not seen. Nothing is tuned: a good fit to the estimation data is not validation.',
    good: 'Verification: missing answers and outliers screened; reliability and validity of each construct checked; the estimation converged. Validation: predict the outcome for 30% of cases kept aside.',
    weak: 'The R² is high, so the model is valid.',
    questions: { 'eval-simple': 'Which check would show that a construct is not measured well?', 'eval-heldout': 'Which cases will you keep aside to test prediction?' },
  },
  parameters: {
    short: 'How will you know the model is built right, and that its parameters hold?',
    why: 'Verification checks the model against its own specification. Validation checks it against the real system. Parameters come from data or the design; list anything you tune.',
    good: 'Verification: the model reproduces a textbook case with a known answer. Validation: compare the predicted mean wait with two weeks of logs not used for any parameter.',
    weak: 'The numbers look reasonable.',
    questions: { 'eval-heldout': 'Which data will you keep aside to check the parameters?' },
  },
};
const EXPERIMENT_TEXT: Partial<Record<StepProfile['experiment'], StepText>> = {
  'scenario-analysis': {
    short: 'Scenario analysis: which settings change, and how is each scenario solved or run?',
    why: 'Scenarios differ in stated settings and nothing else. Each one is solved or run the same way, so the differences come from the settings.',
    good: 'Base: two advisors, 12 arrivals per hour. Scenario B: three advisors. Compared: mean waiting time at steady state, solved with the same formulas in both.',
    weak: 'We tried some settings and picked the best one.',
    questions: { 'exp-fair': 'What is identical between your scenarios, and what differs?', 'exp-noise': 'How sensitive is the answer to the settings you are least sure of?' },
  },
  'analysis-plan': {
    short: 'Analysis plan: which hypotheses, which paths, and how are effects tested?',
    why: 'A plan written before estimation keeps the test honest: each hypothesis maps to a path, and the way effects are tested is fixed in advance.',
    good: 'H1: service quality → satisfaction (positive). H2: satisfaction mediates quality → loyalty. Effects tested with 5,000 bootstrap resamples and 95% intervals; a rival model drops the mediator.',
    weak: 'We will see which paths come out significant.',
    questions: { 'exp-fair': 'Which result would contradict each hypothesis?', 'exp-noise': 'How will you tell a real effect from sampling noise?' },
  },
};

/** A step as this project's method reads it: same id, number, title and self-check ids; its texts follow the profile. */
export function stepFor(id: StepId, profile: StepProfile): StepDef {
  const base = STEP_BY_ID[id];
  const text = id === 'inputs' ? INPUT_TEXT[profile.inputs] : id === 'evaluation' ? CHECK_TEXT[profile.calibration] : id === 'experiment' ? EXPERIMENT_TEXT[profile.experiment] : undefined;
  if (!text) return base;
  const { questions, ...words } = text;
  return { ...base, ...words, selfChecks: base.selfChecks.map((q) => ({ ...q, question: questions?.[q.id] ?? q.question })) };
}

/** Labels and hints of the fields of step 6 (`passport.experiment`), per profile. The stored fields never change. */
export interface ExperimentFieldText { title: string; sub: string; label: Record<'baseline' | 'alternatives' | 'comparison' | 'runSettings', string>; hint: Record<'baseline' | 'alternatives' | 'comparison' | 'runSettings', string> }
export function experimentFields(profile: StepProfile): ExperimentFieldText {
  if (profile.experiment === 'analysis-plan') return {
    title: 'Analysis plan', sub: 'Hypotheses first. Tests fixed in advance.',
    label: { baseline: 'Hypotheses and their paths', alternatives: 'Rival models or groups', comparison: 'How effects are tested', runSettings: 'Estimation settings' },
    hint: { baseline: 'One line per hypothesis: the path and its expected sign.', alternatives: 'A model without a path, or a comparison of groups.', comparison: 'Bootstrap intervals, mediation, moderation.', runSettings: 'Software, weighting, resamples, seed.' },
  };
  if (profile.experiment === 'scenario-analysis') return {
    title: 'Scenario analysis', sub: 'Change the settings. Solve each scenario the same way.',
    label: { baseline: 'Base scenario', alternatives: 'Other scenarios', comparison: 'What is compared', runSettings: 'How each scenario is solved or run' },
    hint: { baseline: 'The settings of the reference case.', alternatives: 'Which settings differ from the base?', comparison: 'Which outcome, at which point or over which period?', runSettings: profile.stochastic ? 'Software, horizon, replications, seed.' : 'Software or formulas, horizon, time step.' },
  };
  return {
    title: 'Experiment', sub: 'Change one thing. Keep the rest identical.',
    label: { baseline: 'Baseline', alternatives: 'Alternatives', comparison: 'Comparison logic', runSettings: 'Run settings' },
    hint: { baseline: '', alternatives: '', comparison: 'What stays identical? Which outcome decides?', runSettings: 'Horizon, replications, seed, software version.' },
  };
}

/** Labels and hints of the fields of step 5 (`passport.evaluation`), per profile. */
export interface EvaluationFieldText { field: 'verification' | 'validation' | 'calibration'; title: string; sub: string; label: string; hint: string }
export function evaluationFields(profile: StepProfile): EvaluationFieldText[] {
  const statistical = profile.calibration === 'estimation';
  return [
    { field: 'verification', title: 'Verification', sub: statistical ? 'Are the data and the model as specified?' : 'Is the model built as specified?', label: 'Verification checks',
      hint: statistical ? 'Data screening, measurement quality, estimation converged.' : 'Units, conservation, simple cases with known answers.' },
    { field: 'validation', title: 'Validation', sub: statistical ? 'Does it predict cases it has not seen?' : 'Is it adequate for its purpose?', label: 'Validation evidence plan',
      hint: statistical ? 'Prediction on cases kept aside; agreement with other evidence.' : 'Evidence that was not used for tuning.' },
    profile.calibration === 'estimation'
      ? { field: 'calibration', title: 'Estimation', sub: 'What is estimated, on which cases.', label: 'Estimation (kept separate)', hint: 'Which cases are used for estimation, which are kept for prediction?' }
      : profile.calibration === 'parameters'
        ? { field: 'calibration', title: 'Parameters', sub: 'Where each value comes from.', label: 'Parameter sources (and anything tuned)', hint: 'Which values come from data, which from the design, which were tuned?' }
        : { field: 'calibration', title: 'Calibration', sub: 'Tuning — kept separate from validation.', label: 'Calibration (kept separate)', hint: 'Which parameters, on which data period?' },
  ];
}

/** What step 4's list of rows is called in the report and on screen. */
export function inputsTitle(profile: StepProfile): string {
  return profile.inputs === 'measurement' ? 'Measured variables' : profile.inputs === 'parameters' ? 'Parameters' : 'Inputs';
}

/**
 * A step counts as started when any of its own fields has content, or when an artefact is included in it.
 * Completeness ≠ validity. `artefacts` is the project's list of copies; without it only the fields count.
 */
export function stepStarted(p: Passport, id: StepId, artefacts: readonly Inclusion[] = []): boolean {
  if (artefacts.some((i) => KIND_STEP[i.kind] === id)) return true;
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
export function stepsStarted(p: Passport, artefacts: readonly Inclusion[] = []): StepId[] { return STEPS.filter((s) => stepStarted(p, s.id, artefacts)).map((s) => s.id); }

export type Severity = 'gap' | 'check' | 'tip';
export interface Warning { id: string; step: StepId; severity: Severity; message: string }
/** The revision of each Toolbox artefact on this device, by artefact id. */
export type ToolboxRevisions = ReadonlyMap<string, number>;

const WAITING_METHODS: MethodId[] = ['des', 'queueing-theory', 'abm'];
const RELATIONSHIP_METHODS: MethodId[] = ['path-analysis', 'cb-sem', 'pls-sem'];
const PERIOD_WORDS = /\b(hour|day|week|month|quarter|year|shift|term|season|period|horizon)s?\b/i;
const SOLUTION_OPENING = /^(we|they|you|the \w+)\s+(should|must|need to|needs to|have to|has to|ought to)\b|^(hire|buy|add|build|implement|install|introduce|open|replace)\b/i;
const GUESS_WORDS = /\b(guess|guessed|my estimate|made up|rough estimate|assumed|assumption)\b/i;

/**
 * Deterministic compass rules. Order: gaps first within each step, then checks, then tips.
 * `toolbox`: the revisions of the Toolbox artefacts on this device. Without it, copies are not compared with their originals.
 */
export function compassWarnings(doc: ProjectDoc, toolbox?: ToolboxRevisions): Warning[] {
  const p = doc.passport, out: Warning[] = [];
  const add = (step: StepId, severity: Severity, id: string, message: string) => out.push({ id, step, severity, message });
  const primary = p.representation.primaryMethod, alt = p.representation.alternativeMethod;
  // A project stored on the device never passed the importer, so every copy is read defensively.
  const copies = (Array.isArray(doc.artefacts) ? doc.artefacts : []).filter((i) => !!i && Object.hasOwn(KIND_STEP, i.kind));
  const quote = (t: string, fallback: string) => `“${t.trim() || fallback}”`;
  const titleOf = (i: Inclusion) => quote(typeof i.title === 'string' ? i.title : '', 'Untitled');
  // What the steps mean for this method. With no method chosen this is the general reading, the wording of version 3.
  const prof = effectiveProfile(doc);
  const statistical = prof.known && prof.model === 'statistical';

  // 1 Frame
  if (!filled(p.decision.stakeholder)) add('frame', 'gap', 'stakeholder', 'No stakeholder yet: who will use the result?');
  if (!filled(p.decision.problem)) add('frame', 'gap', 'problem', 'The observed problem is not described.');
  if (!filled(p.decision.levers)) add('frame', 'gap', 'levers', 'No decision levers: what can the stakeholder actually change?');
  if (!filled(p.decision.question)) add('frame', 'gap', 'question', 'The precise question is not written yet.');
  if (filled(p.decision.question) && !filled(p.decision.outcome)) add('frame', 'check', 'question-outcome', 'Your question has no measurable outcome. Say what you will measure, in which unit.');
  if (!p.decision.claimType) add('frame', 'gap', 'claim', 'Choose the type of claim: description, prediction or decision support need different evidence.');
  if (filled(p.decision.question) && !p.decision.question.includes('?')) add('frame', 'tip', 'question-mark', 'Suggestion: phrase the question as a question a model could answer.');
  // Prompts for entries that are present but too thin to plan with. Suggestions only: wording is never judged.
  if (filled(p.decision.question) && !/\d/.test(p.decision.question) && !PERIOD_WORDS.test(p.decision.question)) add('frame', 'tip', 'question-vague', 'Suggestion: the question names no amount and no period. By how much does the lever change, and over what time?');
  if (filled(p.decision.problem) && SOLUTION_OPENING.test(p.decision.problem.trim())) add('frame', 'tip', 'problem-solution', 'Suggestion: the problem starts like a solution. Describe what is observed first; the solution is one of the levers.');
  if (filled(p.decision.outcome) && p.decision.outcome.trim().split(/\s+/).length < 3) add('frame', 'tip', 'outcome-thin', 'Suggestion: name the measure and its unit, for example “average waiting time in minutes”.');
  if (filled(p.decision.levers) && filled(p.decision.problem) && p.decision.levers.trim().toLowerCase() === p.decision.problem.trim().toLowerCase()) add('frame', 'check', 'lever-is-problem', 'The problem and the lever are the same text. A proposed solution is not the problem.');

  // 2 Scope
  if (!filled(p.scope.boundary)) add('scope', 'gap', 'boundary', 'The system boundary is not specified.');
  // A statistical model has a time frame (when the data were collected, when the answer holds) but no time step.
  if (!filled(p.scope.horizon)) add('scope', 'gap', 'horizon', statistical ? 'No time frame: when are the data collected, and for which period does the answer hold?' : 'No time horizon: over what period does the question matter?');
  if (!statistical && filled(p.scope.horizon) && !filled(p.scope.timeUnit)) add('scope', 'check', 'timeunit', 'You gave a horizon but no time unit (day, hour, event-driven…).');
  if (filled(p.scope.boundary) && !filled(p.scope.exclusions)) add('scope', 'check', 'exclusions', 'Nothing is listed as excluded. Every model leaves something out: name it.');
  if (!filled(p.scope.detail)) add('scope', 'gap', 'detail', statistical ? 'Unit of analysis not stated: individuals, teams or organisations?' : 'Level of detail not stated: individuals, groups or totals?');
  if (p.representation.nodes.length === 0 && !copies.some((i) => i.kind === 'concept-model')) add('scope', 'tip', 'sketch', 'Suggestion: draw the conceptual model in the Toolbox and add it to this step.');
  const bare = p.representation.relations.filter((r) => !filled(r.label)).length;
  if (bare > 0) add('scope', 'tip', 'relation-label', `Suggestion: ${bare} arrow${bare === 1 ? '' : 's'} in the sketch ${bare === 1 ? 'has' : 'have'} no label. An arrow means only what its label says.`);

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
  if (p.inputs.length === 0) add('inputs', 'gap', 'inputs', prof.inputs === 'measurement' ? 'No measured variables listed: name the constructs and their items.' : prof.inputs === 'parameters' ? 'No parameters listed: rates, initial values and settings, each with a source.' : 'No inputs listed.');
  // An included data model or measurement data that does not say where its numbers come from. Its input rows say the
  // same, so the rows are not reported twice.
  const unsourced = new Set<string>(), measured = new Set<string>();
  for (const c of copies) {
    if (c.kind === 'data-model' && !filled(c.data?.provenance)) {
      unsourced.add(c.id);
      add('inputs', 'check', `dm-src-${c.id}`, `The data model ${titleOf(c)} has no source. Say where its numbers come from, then update it here.`);
    }
    if (c.kind !== 'measurement-data') continue;
    measured.add(c.id);
    if (!filled(c.data?.source)) {
      unsourced.add(c.id);
      add('inputs', 'check', `md-src-${c.id}`, `The measurement data ${titleOf(c)} has no source. Say where the answers come from, then update it here.`);
    }
    // A reflective construct is measured by items that should agree; one item cannot show that.
    for (const k of Array.isArray(c.data?.constructs) ? c.data.constructs : []) {
      if (k?.mode === 'reflective' && Array.isArray(k.items) && k.items.length === 1) add('inputs', 'check', `md-one-${c.id}-${k.id}`, `${quote(String(k.name ?? ''), 'A construct')} is reflective but has one item. Add items, or mark it as a single-item measure.`);
    }
  }
  if (prof.inputs === 'measurement' && measured.size === 0) add('inputs', 'tip', 'md-none', 'Suggestion: bring your survey data into Data and inputs and include it here: one row per construct, with its items.');
  p.inputs.forEach((r, i) => {
    const name = r.name.trim() || `Input ${i + 1}`;
    // A construct is measured by its items on their scale; it has no unit of its own. When step 4 reads as measured
    // variables, no row is asked for a unit, whether it came from measurement data or was written by hand.
    if (!filled(r.unit) && prof.inputs !== 'measurement' && !(r.inclusion && measured.has(r.inclusion))) add('inputs', 'check', `in-unit-${r.id}`, `“${name}” has no unit.`);
    if ((r.sourceType === 'unspecified' || !filled(r.provenance)) && !(r.inclusion && unsourced.has(r.inclusion))) add('inputs', 'check', `in-src-${r.id}`, `“${name}” has no clear source.`);
    if (!filled(r.value)) add('inputs', 'gap', `in-val-${r.id}`, `“${name}” has no value or range.`);
    if (r.availability === 'obtainable' && !filled(r.plan)) add('inputs', 'check', `in-plan-${r.id}`, `“${name}” still has to be obtained, but there is no plan: who gets it, and by when?`);
    if (r.availability === 'assume' && r.sourceType === 'observed') add('inputs', 'check', `in-assume-${r.id}`, `“${name}” is marked as observed data, but its data status is “must assume”.`);
    if (r.sourceType === 'observed' && GUESS_WORDS.test(r.provenance)) add('inputs', 'check', `in-guess-${r.id}`, `“${name}” is marked as observed data, but its source reads like an estimate.`);
  });
  const undecided = p.inputs.filter((r) => !r.availability).length;
  if (undecided > 0) add('inputs', 'tip', 'in-status', `Suggestion: ${undecided} input${undecided === 1 ? ' has' : 's have'} no data status. Do you have the data, can you get it, or must you assume it?`);
  if (p.assumptions.length === 0) add('inputs', 'gap', 'assumptions', 'No assumptions recorded. Every model makes some.');
  p.assumptions.forEach((a, i) => {
    if (!filled(a.consequenceIfWrong)) add('inputs', 'check', `as-cons-${a.id}`, `Assumption ${i + 1} does not say what happens if it fails.`);
    if (!filled(a.plannedCheck)) add('inputs', 'check', `as-check-${a.id}`, `Assumption ${i + 1} has no planned check.`);
  });

  // 5 Verification and validation
  if (!filled(p.evaluation.verification)) add('evaluation', 'gap', 'verification', prof.calibration === 'estimation' && prof.known ? 'No verification checks planned (data screening, measurement quality, estimation converged).' : 'No verification checks planned (units, conservation, known simple cases).');
  if (!filled(p.evaluation.validation)) add('evaluation', 'gap', 'validation', 'No validation evidence planned.');
  if (filled(p.evaluation.calibration) && !filled(p.evaluation.validation)) {
    add('evaluation', 'check', 'calibration-only', prof.calibration === 'estimation' && prof.known
      ? 'You describe the estimation but no validation. A good fit to the estimation data is not validation: test prediction on cases the model has not seen.'
      : prof.calibration === 'parameters' && prof.known
        ? 'You describe where the parameters come from but no validation. Plan a comparison with evidence that set no parameter.'
        : 'You describe calibration but no validation. Fitting the tuning data is not validation: keep some evidence aside.');
  }
  // An included check plan records what the checks showed. A failed one needs an answer, not silence.
  // A check with no text is not counted, as the plan itself does not count it.
  const failed = copies.reduce((n, i) => n + (i.kind === 'check-plan' && Array.isArray(i.data?.checks) ? i.data.checks.filter((c) => c?.status === 'failed' && typeof c.text === 'string' && c.text.trim() !== '').length : 0), 0);
  if (failed > 0) add('evaluation', 'check', 'plan-failed', `Your check plan has ${failed} failed check${failed === 1 ? '' : 's'}. Say what you changed, or why the model is still fit for the question.`);

  // 6 Outcomes and experiment
  // What step 6 is: a policy experiment (run, compared over replications), a scenario analysis (each setting solved or
  // run once) or an analysis plan (hypotheses tested on estimated paths).
  const plan = prof.experiment === 'analysis-plan', scenarios = prof.experiment === 'scenario-analysis';
  if (p.outcomes.length === 0) add('experiment', 'gap', 'outcomes', plan ? 'No outcome defined: which constructs or effects will you report?' : 'No outcome metric defined.');
  p.outcomes.forEach((o, i) => {
    const name = o.metric.trim() || `Outcome ${i + 1}`;
    // An effect or a construct score has no unit of its own and no better direction: a hypothesis states its sign.
    if (!plan && !filled(o.unit)) add('experiment', 'check', `out-unit-${o.id}`, `“${name}” has no unit.`);
    if (!filled(o.definition)) add('experiment', 'gap', `out-def-${o.id}`, `“${name}” has no definition someone else could compute.`);
    if (!plan && !o.direction) add('experiment', 'check', `out-dir-${o.id}`, `“${name}”: is lower or higher better?`);
  });
  const x = p.experiment;
  if (!filled(x.baseline)) add('experiment', 'gap', 'baseline', plan ? 'No hypotheses yet: which paths do you expect, and with which sign?' : scenarios ? 'No base scenario described.' : 'No baseline described.');
  if (!filled(x.alternatives)) {
    if (plan) add('experiment', 'tip', 'alternatives', 'Suggestion: name a rival model or a comparison of groups, or say why there is none.');
    else add('experiment', 'gap', 'alternatives', scenarios ? 'No other scenario: which settings differ from the base?' : 'No alternative to compare with the baseline.');
  }
  if (!filled(x.comparison)) add('experiment', 'gap', 'comparison', plan ? 'Not said how effects are tested: bootstrap intervals, mediation, moderation?' : scenarios ? 'Not said what is compared: which outcome, at which point, between the scenarios?' : 'Comparison logic not described: what stays identical between policies?');
  if (!filled(x.runSettings)) {
    add('experiment', 'gap', 'run-settings', plan ? 'Estimation settings are not recorded (software, weighting, resamples, seed).'
      : scenarios && !prof.stochastic ? 'Not said how each scenario is solved or run (software or formulas, horizon, time step).' : 'Run settings (horizon, replications, seed) are not recorded.');
  }
  // A stochastic model needs replications and a seed; one run cannot compare policies or scenarios. A bootstrap needs a seed too.
  if (prof.stochastic && !plan && filled(x.runSettings) && !/replic|run/i.test(x.runSettings)) add('experiment', 'check', 'replications', `${primary ? METHOD_BY_ID[primary].name : 'The model'} is stochastic, but the run settings mention no replications. One run cannot compare ${scenarios ? 'scenarios' : 'policies'}.`);
  if (prof.stochastic && !plan && filled(x.runSettings) && !/seed/i.test(x.runSettings)) add('experiment', 'tip', 'seed', 'Suggestion: record the random seed so the result can be reproduced.');
  if (plan && filled(x.runSettings) && /bootstrap|resampl/i.test(`${x.runSettings} ${x.comparison}`) && !/seed/i.test(x.runSettings)) add('experiment', 'tip', 'seed', 'Suggestion: record the seed of the bootstrap so the intervals can be reproduced.');
  // Included comparisons: each policy needs at least two replications before a difference means anything.
  const comparisons = copies.filter((i) => i.kind === 'comparison');
  const runs = (xs: unknown) => (Array.isArray(xs) ? xs.length : 0);
  for (const c of comparisons) {
    if (runs(c.data?.baseline) < 2 || runs(c.data?.alternative) < 2) add('experiment', 'check', `cmp-reps-${c.id}`, `The comparison ${quote(String(c.title ?? ''), 'Untitled')} has fewer than two replications for a policy. One run cannot tell a real difference from chance.`);
  }
  if (prof.experiment === 'policy-experiment' && comparisons.length === 0 && filled(p.conclusion.results)) add('experiment', 'tip', 'no-comparison', 'Suggestion: step 7 reports results, but no comparison is included here. Add one from the Toolbox so a reader can check the numbers.');

  // 7 Conclude
  // While a project is being planned, results are not expected: they are due later, not missing.
  const planning = p.identity.stage === 'planning';
  const after = !prof.known || prof.model === 'simulation' ? 'the runs' : prof.model === 'statistical' ? 'the analysis' : 'the model is solved';
  if (planning && !stepStarted(p, 'conclude')) add('conclude', 'tip', 'planning', `Planning stage: results, recommendation and limitations come after ${after}.`);
  else {
    if (!filled(p.conclusion.results)) add('conclude', 'gap', 'results', 'No results summary.');
    if (!filled(p.conclusion.recommendation)) add('conclude', 'gap', 'recommendation', 'No recommendation.');
    if (!filled(p.conclusion.limitations)) add('conclude', 'gap', 'limitations', 'Limitations are not stated.');
  }
  if (filled(p.conclusion.recommendation) && !filled(p.conclusion.changeConditions)) add('conclude', 'check', 'conditions', 'The recommendation has no conditions that would change it. When does it stop holding?');
  if (/\b(prove[sd]?|guarantee[sd]?|certainly|always)\b/i.test(p.conclusion.recommendation)) add('conclude', 'tip', 'overclaim', 'Suggestion: a model supports a recommendation under assumptions; check words such as “proves” or “guarantees”.');

  // A copy whose Toolbox original has moved on. The project never changes silently: updating is the author's choice.
  if (toolbox) {
    for (const c of copies) {
      const revision = toolbox.get(c.sourceId);
      if (revision !== undefined && revision !== c.sourceRevision) add(KIND_STEP[c.kind], 'tip', `copy-outdated-${c.id}`, `Suggestion: ${titleOf(c)} has changed in the Toolbox since you added it. Update it here, or keep this version.`);
    }
  }

  const rank: Record<Severity, number> = { gap: 0, check: 1, tip: 2 };
  const order = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));
  return out.sort((a, b) => order[a.step] - order[b.step] || rank[a.severity] - rank[b.severity]);
}

/** How many inputs are in hand, still to be obtained, assumed, or undecided. */
export function dataReadiness(p: Passport): { have: number; obtainable: number; assume: number; undecided: number; total: number } {
  const count = (k: string) => p.inputs.filter((r) => (r.availability ?? '') === k).length;
  return { have: count('have'), obtainable: count('obtainable'), assume: count('assume'), undecided: count(''), total: p.inputs.length };
}

export function warningsFor(doc: ProjectDoc, step: StepId, toolbox?: ToolboxRevisions): Warning[] { return compassWarnings(doc, toolbox).filter((w) => w.step === step); }

// ── Checkpoints and rubrics ──────────────────────────────────────────────

export const RUBRIC_LEVELS = ['Not yet', 'Emerging', 'Developing', 'Strong'];
/** What each level means for any criterion. “Strong” is spelled out per criterion. */
export const RUBRIC_LEVEL_MEANING = ['Not addressed yet.', 'Mentioned, but the key parts are missing or vague.', 'Mostly there: one part is missing or not justified.', 'Meets the description of “Strong” below.'] as const;

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

/**
 * The checkpoints as this project's method reads them. Ids, steps and rubric ids are those of `CHECKPOINT_DEFS`, so
 * recorded levels keep their meaning; the expected evidence and the wording of a criterion follow the profile, field by
 * field (inputs, calibration, experiment), so they also follow what the project includes when no method is chosen. The
 * general reading of every field gives `CHECKPOINT_DEFS` itself.
 */
export function checkpointDefsFor(profile: StepProfile): CheckpointDef[] {
  const word: Partial<Record<CheckpointId, { expected?: string; rubric: Record<string, Partial<RubricCriterion>> }>> = {};
  if (profile.inputs === 'measurement') word.design = {
    expected: 'A justified method with an alternative; constructs with their items, scale and source; assumptions with planned checks.',
    rubric: { inputs: { criterion: 'Measurement quality', strong: 'Each construct has its items, its mode (reflective or formative) and a source; reliability is reported.' } },
  };
  if (profile.inputs === 'parameters') word.design = {
    expected: 'A justified method with an alternative; parameters with values, units and sources; assumptions with planned checks.',
    rubric: { inputs: { criterion: 'Parameter quality', strong: 'Every parameter has a value, a unit and a source; uncertain ones have a range.' } },
  };
  if (profile.calibration === 'estimation') word.baseline = {
    expected: 'A specified model with verification checks on the data and the measurement, and a validation plan that tests prediction on cases kept aside.',
    rubric: {
      verification: { strong: 'Concrete checks: data screening, measurement quality (reliability, validity) and an estimation that converged.' },
      validation: { strong: 'Names how prediction is tested on cases not used for estimation, and what would count as adequate.' },
      separation: { criterion: 'Estimation kept separate', strong: 'Says what was estimated on which cases; prediction is checked on other cases.' },
    },
  };
  if (profile.calibration === 'parameters') word.baseline = {
    expected: 'A working model with verification checks, a source for every parameter, and a validation plan with evidence that set no parameter.',
    rubric: { separation: { criterion: 'Parameter sources', strong: 'The source of each parameter is stated; anything tuned is listed, and validation uses other evidence.' } },
  };
  if (profile.experiment === 'analysis-plan') word.evaluation = {
    expected: 'An analysis plan: hypotheses mapped to paths, rival models or groups, how effects are tested, and reproducible estimation settings.',
    rubric: {
      outcomes: { criterion: 'Outcomes and effects', strong: 'Each reported construct or effect is defined, with how it is measured.' },
      fairness: { criterion: 'Analysis plan', strong: 'Each hypothesis maps to a path with an expected sign; effects are tested with intervals, and mediation or moderation is planned where relevant.' },
      reproducible: { strong: 'Software, weighting scheme, resamples and seed are recorded.' },
    },
  };
  if (profile.experiment === 'scenario-analysis') word.evaluation = {
    expected: 'Defined outcomes and a clear scenario design: a base, the settings that differ, what is compared, and how each scenario is solved or run.',
    rubric: {
      fairness: { criterion: 'Scenario design', strong: 'Scenarios differ only in stated settings; each one is solved or run the same way.' },
      reproducible: { strong: profile.stochastic ? 'Software, settings, replications and seed are recorded for every scenario.' : 'Software or formulas and the settings of every scenario are recorded.' },
    },
  };
  if (!Object.keys(word).length) return CHECKPOINT_DEFS;
  return CHECKPOINT_DEFS.map((def) => {
    const w = word[def.id];
    return w ? { ...def, expected: w.expected ?? def.expected, rubric: def.rubric.map((c) => ({ ...c, ...w.rubric[c.id] })) } : def;
  });
}

/** A copy as a review sees it: its content only, so renaming it is not a change. */
export const copyHash = (data: unknown): string => fnv1a(stableStringify(data ?? null));
const copiesAt = (doc: Pick<ProjectDoc, 'artefacts'>, id: CheckpointId): Inclusion[] => {
  const steps = CHECKPOINT_BY_ID[id].steps;
  return (Array.isArray(doc.artefacts) ? doc.artefacts : []).filter((i) => !!i && Object.hasOwn(KIND_STEP, i.kind) && steps.includes(KIND_STEP[i.kind]));
};
const reviewTime = (doc: ProjectDoc, id: CheckpointId): string => {
  const cp = doc.passport?.review?.[id];
  return cp && cp.status !== 'draft' && typeof cp.reviewedAt === 'string' ? cp.reviewedAt : '';
};

/** Records a review: when it was made, and what the copies of its steps held then. Mutates the draft. */
export function markReviewed(doc: ProjectDoc, id: CheckpointId, now: string): void {
  const cp = doc.passport.review[id];
  cp.reviewedAt = now;
  cp.reviewedCopies = copiesAt(doc, id).map((i) => ({ id: i.id, title: typeof i.title === 'string' ? i.title : '', hash: copyHash(i.data) }));
}

/**
 * The included copies of a checkpoint's steps whose content changed after its review, and copies added since. A
 * project is live, so a copy follows its original; a review records what it saw, and this says when that is no longer
 * what the project holds. A rename alone changes nothing. Empty for a checkpoint in draft, or one whose review time
 * was never recorded. A review recorded before content was remembered falls back to the time a copy was refreshed.
 */
export function changedSinceReview(doc: ProjectDoc, id: CheckpointId): Inclusion[] {
  const at = reviewTime(doc, id);
  if (!at) return [];
  const seen = doc.passport.review[id].reviewedCopies;
  const copies = copiesAt(doc, id);
  if (!Array.isArray(seen)) return copies.filter((i) => typeof i.addedAt === 'string' && i.addedAt > at);
  const hashes = new Map(seen.map((c) => [c.id, c.hash]));
  return copies.filter((i) => hashes.get(i.id) !== copyHash(i.data));
}

/** The titles of copies that were in the checkpoint's steps at its review and have been removed since. */
export function removedSinceReview(doc: ProjectDoc, id: CheckpointId): string[] {
  const seen = reviewTime(doc, id) ? doc.passport.review[id].reviewedCopies : undefined;
  if (!Array.isArray(seen)) return [];
  const here = new Set(copiesAt(doc, id).map((i) => i.id));
  return seen.filter((c) => !here.has(c.id)).map((c) => c.title);
}

/** Open gaps and checks for a checkpoint’s steps (tips excluded). */
export function checkpointReadiness(doc: ProjectDoc, id: CheckpointId): Warning[] {
  const steps = CHECKPOINT_BY_ID[id].steps;
  return compassWarnings(doc).filter((w) => steps.includes(w.step) && w.severity !== 'tip');
}
