import { METHOD_BY_ID, type MethodId } from './registry';

/**
 * Authored, versioned rule table for method advice (PLAN §8).
 * Every matched rule emits a human-readable reason, caveat or missing-information
 * request. There is no hidden weighting and no confidence percentage: candidates are
 * ordered only by how many reasons matched, which is disclosed as a navigation aid.
 */
export const RULE_VERSION = 'method-rules-v1';

export type Tri = 'yes' | 'no' | 'unsure';
export interface MethodAnswers {
  claim: 'describe' | 'explain' | 'predict' | 'compare' | 'explore' | 'unsure';
  latent: Tri;
  observedRelations: Tri;
  concurrency: Tri;
  uncertainInputs: Tri;
  finiteStates: Tri;
  feedback: Tri;
  queues: 'none' | 'simple' | 'detailed' | 'unsure';
  spatial: Tri;
  heterogeneous: Tri;
  granularity: 'aggregate' | 'individual' | 'unsure';
  time: 'static' | 'dynamic' | 'unsure';
  evidence: 'survey' | 'event-log' | 'time-series' | 'expert' | 'little' | 'unsure';
}

export function emptyAnswers(): MethodAnswers {
  return {
    claim: 'unsure', latent: 'unsure', observedRelations: 'unsure', concurrency: 'unsure', uncertainInputs: 'unsure',
    finiteStates: 'unsure', feedback: 'unsure', queues: 'unsure', spatial: 'unsure', heterogeneous: 'unsure',
    granularity: 'unsure', time: 'unsure', evidence: 'unsure',
  };
}

export interface QuestionOption { value: string; label: string }
export interface Question {
  key: keyof MethodAnswers;
  group: 'Question' | 'System' | 'Evidence' | 'Constraints';
  prompt: string;
  help: string;
  options: QuestionOption[];
}

const tri = (yes: string, no: string): QuestionOption[] => [
  { value: 'yes', label: yes }, { value: 'no', label: no }, { value: 'unsure', label: 'Not sure yet' },
];

export const QUESTIONS: Question[] = [
  { key: 'claim', group: 'Question', prompt: 'What kind of claim do you want to make?', help: 'Descriptive, explanatory, predictive and decision-support claims need different evidence.',
    options: [{ value: 'describe', label: 'Describe what happens' }, { value: 'explain', label: 'Explain why variables are related' }, { value: 'predict', label: 'Predict a future outcome' }, { value: 'compare', label: 'Compare policies or decisions' }, { value: 'explore', label: 'Explore plausible behaviour' }, { value: 'unsure', label: 'Not sure yet' }] },
  { key: 'time', group: 'Question', prompt: 'Does the question concern change over time?', help: 'Static questions concern one point or period; dynamic questions follow a trajectory.',
    options: [{ value: 'static', label: 'No — a static relationship or snapshot' }, { value: 'dynamic', label: 'Yes — behaviour over time' }, { value: 'unsure', label: 'Not sure yet' }] },
  { key: 'latent', group: 'System', prompt: 'Does the question involve concepts that cannot be measured directly (e.g. satisfaction, trust)?', help: 'Latent constructs are usually measured through several survey indicators.', options: tri('Yes, measured by indicators', 'No') },
  { key: 'observedRelations', group: 'System', prompt: 'Is the core of the question how measured variables relate to each other?', help: 'For example, whether response time is associated with complaint rates.', options: tri('Yes', 'No') },
  { key: 'concurrency', group: 'System', prompt: 'Do concurrent steps, approvals or synchronisation constraints matter?', help: 'Think of processes that can block, deadlock or require several conditions at once.', options: tri('Yes', 'No') },
  { key: 'uncertainInputs', group: 'System', prompt: 'Are important input values uncertain, and do you need the resulting outcome uncertainty?', help: 'For example, uncertain demand or costs propagated into a budget.', options: tri('Yes', 'No') },
  { key: 'finiteStates', group: 'System', prompt: 'Can the system be described as movement between a small set of states?', help: 'For example, a request that is new, in progress, waiting or closed.', options: tri('Yes', 'No') },
  { key: 'feedback', group: 'System', prompt: 'Do accumulation and feedback (e.g. backlog affecting productivity) matter?', help: 'Stocks accumulate flows; feedback means a stock influences its own flows.', options: tri('Yes', 'No') },
  { key: 'queues', group: 'System', prompt: 'Are queues and resources central?', help: 'Simple stationary systems may suit formulas; schedules, priorities and routing usually need simulation.',
    options: [{ value: 'none', label: 'No queues of interest' }, { value: 'simple', label: 'Yes — simple and roughly stationary' }, { value: 'detailed', label: 'Yes — schedules, priorities or routing matter' }, { value: 'unsure', label: 'Not sure yet' }] },
  { key: 'spatial', group: 'System', prompt: 'Does physical or spatial location drive the behaviour?', help: 'For example, spread between neighbouring locations.', options: tri('Yes', 'No') },
  { key: 'heterogeneous', group: 'System', prompt: 'Do different individuals behave differently and interact or adapt?', help: 'For example, people choosing a channel based on what others tell them.', options: tri('Yes', 'No') },
  { key: 'granularity', group: 'Constraints', prompt: 'At what level must the outcome be reported?', help: 'Individual waiting times or fairness need individual-level representation.',
    options: [{ value: 'aggregate', label: 'Aggregate totals or averages' }, { value: 'individual', label: 'Individual experiences or distributions across people' }, { value: 'unsure', label: 'Not sure yet' }] },
  { key: 'evidence', group: 'Evidence', prompt: 'What evidence is most likely available?', help: 'Method choice should fit what you can realistically observe or justify.',
    options: [{ value: 'survey', label: 'Survey responses' }, { value: 'event-log', label: 'Event logs with timestamps' }, { value: 'time-series', label: 'Aggregate time series' }, { value: 'expert', label: 'Expert judgement' }, { value: 'little', label: 'Very little yet' }, { value: 'unsure', label: 'Not sure yet' }] },
];

/** Step 1 claim type → the matching answer to the first chooser question, so it is not asked twice. */
export const CLAIM_TO_CHOOSER: Record<string, string> = { descriptive: 'describe', explanatory: 'explain', predictive: 'predict', exploratory: 'explore', 'decision-support': 'compare' };

export type RuleKind = 'reason' | 'caveat' | 'missing';
export interface Rule {
  id: string;
  method: MethodId | null; // null = general advice
  kind: RuleKind;
  when: (a: MethodAnswers) => boolean;
  text: string;
}

export const RULES: Rule[] = [
  // Relationships
  { id: 'R-lat-cb', method: 'cb-sem', kind: 'reason', when: (a) => a.latent === 'yes', text: 'CB-SEM may fit because latent constructs are measured by indicators.' },
  { id: 'R-lat-pls', method: 'pls-sem', kind: 'reason', when: (a) => a.latent === 'yes', text: 'PLS-SEM may fit because constructs are measured by indicators.' },
  { id: 'C-lat', method: 'cb-sem', kind: 'caveat', when: (a) => a.latent === 'yes', text: 'Establish the measurement model, analytical purpose and data suitability before choosing between CB-SEM and PLS-SEM.' },
  { id: 'C-lat-pls-m', method: 'pls-sem', kind: 'caveat', when: (a) => a.latent === 'yes', text: 'Establish the measurement model, analytical purpose and data suitability before choosing between CB-SEM and PLS-SEM.' },
  { id: 'C-lat-pls', method: 'pls-sem', kind: 'caveat', when: (a) => a.latent === 'yes', text: 'Do not choose PLS-SEM only because the sample is small; predictive claims need out-of-sample evaluation.' },
  { id: 'R-pls-pred', method: 'pls-sem', kind: 'reason', when: (a) => a.latent === 'yes' && a.claim === 'predict', text: 'Your predictive aim is compatible with PLS-SEM, provided you evaluate prediction out of sample.' },
  { id: 'R-cb-explain', method: 'cb-sem', kind: 'reason', when: (a) => a.latent === 'yes' && a.claim === 'explain', text: 'Testing a theory-specified measurement and structural model fits a covariance-based approach.' },
  { id: 'R-path', method: 'path-analysis', kind: 'reason', when: (a) => a.observedRelations === 'yes', text: 'Path analysis may fit because the question concerns relationships among observed variables.' },
  { id: 'C-path', method: 'path-analysis', kind: 'caveat', when: (a) => a.observedRelations === 'yes' || a.latent === 'yes', text: 'Associations do not establish causality; an intervention claim needs an identification strategy.' },
  { id: 'C-rel-compare', method: 'path-analysis', kind: 'caveat', when: (a) => a.claim === 'compare' && (a.observedRelations === 'yes' || a.latent === 'yes'), text: 'Comparing policies from a fitted relationship assumes the relationship holds under intervention.' },
  { id: 'R-survey', method: 'pls-sem', kind: 'reason', when: (a) => a.evidence === 'survey' && a.latent !== 'no', text: 'Survey evidence is typical for measurement models of constructs.' },
  // Processes
  { id: 'R-petri', method: 'petri-nets', kind: 'reason', when: (a) => a.concurrency === 'yes', text: 'Petri nets may fit because concurrency, approvals or blocking matter.' },
  { id: 'C-petri', method: 'petri-nets', kind: 'caveat', when: (a) => a.concurrency === 'yes', text: 'Logical behaviour (can it deadlock?) differs from timed performance (how long does it take?).' },
  { id: 'R-sd', method: 'system-dynamics', kind: 'reason', when: (a) => a.feedback === 'yes', text: 'System dynamics may fit because accumulation and feedback matter.' },
  { id: 'R-sd-agg', method: 'system-dynamics', kind: 'reason', when: (a) => a.feedback === 'yes' && a.granularity === 'aggregate', text: 'Aggregate reporting is consistent with a stock-and-flow representation.' },
  { id: 'C-sd', method: 'system-dynamics', kind: 'caveat', when: (a) => a.feedback === 'yes', text: 'Explain the aggregate mechanisms and check units; feedback rules require evidence.' },
  { id: 'R-queue', method: 'queueing-theory', kind: 'reason', when: (a) => a.queues === 'simple', text: 'Queueing theory may fit a simple, roughly stationary service system.' },
  { id: 'C-queue', method: 'queueing-theory', kind: 'caveat', when: (a) => a.queues === 'simple', text: 'Verify arrival/service assumptions and stability (utilisation below one).' },
  { id: 'R-des', method: 'des', kind: 'reason', when: (a) => a.queues === 'detailed', text: 'DES may fit because resources, schedules and event timing matter.' },
  { id: 'R-des-ind', method: 'des', kind: 'reason', when: (a) => a.queues !== 'none' && a.queues !== 'unsure' && a.granularity === 'individual', text: 'Individual waiting times require an individual-level representation such as DES.' },
  { id: 'R-des-logs', method: 'des', kind: 'reason', when: (a) => a.evidence === 'event-log' && a.queues !== 'none', text: 'Timestamped event logs can supply arrival and service inputs for DES.' },
  { id: 'C-des', method: 'des', kind: 'caveat', when: (a) => a.queues === 'detailed' || a.granularity === 'individual', text: 'DES needs event, routing and service-time inputs, plus replications.' },
  { id: 'R-queue-des-alt', method: 'des', kind: 'reason', when: (a) => a.queues === 'simple', text: 'DES is a complementary check when queueing assumptions are doubtful.' },
  // Uncertainty
  { id: 'R-mc', method: 'monte-carlo', kind: 'reason', when: (a) => a.uncertainInputs === 'yes', text: 'Monte Carlo may fit because uncertain inputs must be propagated into an outcome.' },
  { id: 'C-mc', method: 'monte-carlo', kind: 'caveat', when: (a) => a.uncertainInputs === 'yes', text: 'Specify input distributions and their dependence; outcome spread is not uncertainty about a mean.' },
  { id: 'R-markov', method: 'markov-chains', kind: 'reason', when: (a) => a.finiteStates === 'yes', text: 'Markov chains may fit because the system moves between a finite set of states.' },
  { id: 'C-markov', method: 'markov-chains', kind: 'caveat', when: (a) => a.finiteStates === 'yes', text: 'State definitions must make the memoryless assumption plausible.' },
  // Emergence
  { id: 'R-ca', method: 'cellular-automata', kind: 'reason', when: (a) => a.spatial === 'yes', text: 'Cellular automata may fit because local spatial interactions drive the behaviour.' },
  { id: 'C-ca', method: 'cellular-automata', kind: 'caveat', when: (a) => a.spatial === 'yes', text: 'Grid, neighbourhood and boundary choices can change results.' },
  { id: 'R-abm', method: 'abm', kind: 'reason', when: (a) => a.heterogeneous === 'yes', text: 'ABM may fit because heterogeneous actors interact or adapt.' },
  { id: 'R-abm-ind', method: 'abm', kind: 'reason', when: (a) => a.heterogeneous === 'yes' && a.granularity === 'individual', text: 'Distributional outcomes across individuals are a strength of agent-based models.' },
  { id: 'C-abm', method: 'abm', kind: 'caveat', when: (a) => a.heterogeneous === 'yes', text: 'Behavioural assumptions require scrutiny and evidence.' },
  { id: 'C-abm-little', method: 'abm', kind: 'caveat', when: (a) => a.heterogeneous === 'yes' && a.evidence === 'little', text: 'With little behavioural evidence, ABM results are exploratory at best.' },
  // Missing information
  { id: 'M-claim', method: null, kind: 'missing', when: (a) => a.claim === 'unsure', text: 'State the claim type: the same system supports descriptive, predictive and decision claims with different evidence.' },
  { id: 'M-gran', method: null, kind: 'missing', when: (a) => a.granularity === 'unsure', text: 'Decide whether you need aggregate or individual-level outcomes; it separates aggregate from individual methods.' },
  { id: 'M-queues', method: null, kind: 'missing', when: (a) => a.queues === 'unsure', text: 'Clarify whether queues are central and whether schedules or priorities matter.' },
  { id: 'M-evidence', method: null, kind: 'missing', when: (a) => a.evidence === 'unsure' || a.evidence === 'little', text: 'Identify the evidence you can obtain; it constrains what any model can support.' },
  { id: 'M-time', method: null, kind: 'missing', when: (a) => a.time === 'unsure', text: 'Specify whether the question concerns a snapshot or behaviour over time.' },
  { id: 'G-static-dyn', method: null, kind: 'caveat', when: (a) => a.time === 'static' && (a.feedback === 'yes' || a.queues === 'detailed'), text: 'You marked the question as static but also described dynamic mechanisms; revisit the time dimension.' },
  { id: 'G-agg-ind', method: null, kind: 'caveat', when: (a) => a.granularity === 'aggregate' && a.heterogeneous === 'yes', text: 'Aggregate outcomes with heterogeneous actors: consider whether heterogeneity changes the aggregate answer.' },
];

export interface Candidate {
  method: MethodId;
  reasons: string[];
  caveats: string[];
  ruleIds: string[];
}

export interface Advice {
  ruleVersion: string;
  candidates: Candidate[];
  missing: string[];
  general: string[];
  status: 'shortlist' | 'more-information-needed';
}

export function evaluateRules(a: MethodAnswers): Advice {
  const map = new Map<MethodId, Candidate>();
  const missing: string[] = [];
  const general: string[] = [];
  for (const r of RULES) {
    if (!r.when(a)) continue;
    if (r.method === null) {
      (r.kind === 'missing' ? missing : general).push(r.text);
      continue;
    }
    const c = map.get(r.method) ?? { method: r.method, reasons: [], caveats: [], ruleIds: [] };
    if (r.kind === 'reason') c.reasons.push(r.text);
    else c.caveats.push(r.text);
    c.ruleIds.push(r.id);
    map.set(r.method, c);
  }
  // Only methods with at least one reason are candidates.
  const candidates = [...map.values()].filter((c) => c.reasons.length > 0);
  candidates.sort((x, y) => y.reasons.length - x.reasons.length || METHOD_BY_ID[x.method].name.localeCompare(METHOD_BY_ID[y.method].name));
  return {
    ruleVersion: RULE_VERSION,
    candidates,
    missing,
    general,
    status: candidates.length === 0 ? 'more-information-needed' : 'shortlist',
  };
}

export function answersKey(a: MethodAnswers): string {
  return (Object.keys(a) as (keyof MethodAnswers)[]).sort().map((k) => `${k}=${a[k]}`).join('&');
}
