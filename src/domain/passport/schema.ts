import type { MethodId } from '../methods/registry';
import type { MethodAnswers } from '../methods/rules';
import type { RunRecord, SandboxConfig } from '../sandbox/types';
import { defaultConfig } from '../sandbox/engine';

/** Versioned model passport (PLAN §9). Completeness ≠ validity ≠ review status. */
export const PASSPORT_SCHEMA = 'modsim-essentials/project';
export const PASSPORT_SCHEMA_VERSION = 2;

export type EvidenceKind = 'observed' | 'literature' | 'expert' | 'assumed' | 'synthetic' | 'unspecified';
export const EVIDENCE_KINDS: { value: EvidenceKind; label: string }[] = [
  { value: 'unspecified', label: 'Not yet specified' },
  { value: 'observed', label: 'Observed data' },
  { value: 'literature', label: 'Literature' },
  { value: 'expert', label: 'Expert judgement' },
  { value: 'assumed', label: 'Declared assumption' },
  { value: 'synthetic', label: 'Synthetic / teaching fixture' },
];

export type ClaimType = '' | 'descriptive' | 'explanatory' | 'predictive' | 'exploratory' | 'decision-support';
export type ReviewStatus = 'draft' | 'self-reviewed' | 'teacher-reviewed' | 'needs-revision';
export type CheckpointId = 'proposal' | 'design' | 'baseline' | 'evaluation' | 'final';

export interface Assumption {
  id: string; statement: string; rationale: string;
  consequenceIfWrong: string; plannedCheck: string;
  evidenceKind: EvidenceKind; sourceNote: string;
}
export interface InputRow { id: string; name: string; value: string; unit: string; sourceType: EvidenceKind; provenance: string; uncertainty: string }
export interface OutcomeRow { id: string; metric: string; definition: string; unit: string; direction: '' | 'lower' | 'higher' | 'target'; aggregation: string; criterion: string }
export interface MapNode { id: string; type: 'entity' | 'variable' | 'stakeholder'; label: string; x: number; y: number }
export interface MapRelation { id: string; from: string; to: string; label: string; directed: boolean }
export interface Checkpoint { status: ReviewStatus; notes: string; reviewer: string; feedbackSource: '' | 'self' | 'teacher'; rubric: Record<string, number>; /** Target date, ISO yyyy-mm-dd or ''. */ due: string }
export interface LensNote { id: string; lensId: string; text: string; createdAt: string }

export interface Passport {
  identity: { title: string; author: string };
  decision: { stakeholder: string; problem: string; levers: string; question: string; claimType: ClaimType; outcome: string };
  scope: { boundary: string; exclusions: string; horizon: string; timeUnit: string; detail: string; constraints: string };
  representation: {
    primaryMethod: MethodId | ''; alternativeMethod: MethodId | '';
    justification: string; alternativeJustification: string;
    nodes: MapNode[]; relations: MapRelation[]; notes: string;
  };
  inputs: InputRow[];
  assumptions: Assumption[];
  outcomes: OutcomeRow[];
  evaluation: { verification: string; validation: string; calibration: string };
  experiment: { baseline: string; alternatives: string; comparison: string; runSettings: string };
  conclusion: { results: string; recommendation: string; limitations: string; changeConditions: string };
  review: Record<CheckpointId, Checkpoint>;
  /** Self-check answers keyed by question id (schema v2). Never auto-graded. */
  selfChecks: Record<string, string>;
}

export interface MethodDecision {
  ruleVersion: string | null;
  answers: MethodAnswers | null;
  answersKey: string | null;
  shortlist: MethodId[];
  decidedAt: string | null;
}

export interface StartProgress {
  step: number; // 0..6 brief step index
  classification: Record<string, string>; // phrase id → category chosen
  prediction: string;
  predictionNote: string;
  firstSessionDone: Record<string, boolean>;
}

export interface ProjectDoc {
  schema: typeof PASSPORT_SCHEMA;
  schemaVersion: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Increments on every saved edit. */
  projectRevision: number;
  /** Increments only when scientific sandbox inputs change. */
  modelRevision: number;
  origin: { kind: 'blank' | 'first-problem' | 'example' | 'import' | 'copy'; ref?: string };
  passport: Passport;
  start: StartProgress;
  sandbox: { baseline: SandboxConfig; alternative: SandboxConfig | null; lastRun: RunRecord | null };
  methods: MethodDecision;
  lensNotes: LensNote[];
  /** Unknown fields preserved from an import, never silently discarded. */
  preservedUnknown?: Record<string, unknown>;
}

export const SECTIONS = [
  { id: 'identity', label: 'Identity' },
  { id: 'decision', label: 'Decision' },
  { id: 'scope', label: 'Scope' },
  { id: 'representation', label: 'Representation' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'experiment', label: 'Experiment' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'review', label: 'Review' },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];

export const CHECKPOINTS: { id: CheckpointId; label: string; expected: string }[] = [
  { id: 'proposal', label: 'Proposal', expected: 'Stakeholder, decision, precise question, boundary and horizon.' },
  { id: 'design', label: 'Design', expected: 'Selected method with a justified alternative, conceptual elements, inputs with provenance, key assumptions.' },
  { id: 'baseline', label: 'Baseline', expected: 'A working baseline model, verification checks and the outcome definitions it reports.' },
  { id: 'evaluation', label: 'Evaluation', expected: 'Validation evidence for the intended use, calibration kept separate, experiment design with replications.' },
  { id: 'final', label: 'Final', expected: 'Results with uncertainty, conditional recommendation, limitations and conditions that would change the decision.' },
];

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  draft: 'Draft', 'self-reviewed': 'Self-reviewed', 'teacher-reviewed': 'Reviewed', 'needs-revision': 'Needs revision',
};

export function emptyPassport(): Passport {
  const cp = (): Checkpoint => ({ status: 'draft', notes: '', reviewer: '', feedbackSource: '', rubric: {}, due: '' });
  return {
    identity: { title: '', author: '' },
    decision: { stakeholder: '', problem: '', levers: '', question: '', claimType: '', outcome: '' },
    scope: { boundary: '', exclusions: '', horizon: '', timeUnit: '', detail: '', constraints: '' },
    representation: { primaryMethod: '', alternativeMethod: '', justification: '', alternativeJustification: '', nodes: [], relations: [], notes: '' },
    inputs: [],
    assumptions: [],
    outcomes: [],
    evaluation: { verification: '', validation: '', calibration: '' },
    experiment: { baseline: '', alternatives: '', comparison: '', runSettings: '' },
    conclusion: { results: '', recommendation: '', limitations: '', changeConditions: '' },
    review: { proposal: cp(), design: cp(), baseline: cp(), evaluation: cp(), final: cp() },
    selfChecks: {},
  };
}

export function newId(prefix = 'id'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  return `${prefix}-${rnd}`;
}

export function createProject(opts: { title?: string; origin?: ProjectDoc['origin']; now?: string; id?: string } = {}): ProjectDoc {
  const now = opts.now ?? new Date().toISOString();
  const p = emptyPassport();
  p.identity.title = opts.title ?? 'Untitled project';
  return {
    schema: PASSPORT_SCHEMA,
    schemaVersion: PASSPORT_SCHEMA_VERSION,
    id: opts.id ?? newId('prj'),
    createdAt: now,
    updatedAt: now,
    projectRevision: 1,
    modelRevision: 1,
    origin: opts.origin ?? { kind: 'blank' },
    passport: p,
    start: { step: 0, classification: {}, prediction: '', predictionNote: '', firstSessionDone: {} },
    sandbox: { baseline: defaultConfig(), alternative: null, lastRun: null },
    methods: { ruleVersion: null, answers: null, answersKey: null, shortlist: [], decidedAt: null },
    lensNotes: [],
  };
}

// ── Completeness (started sections) — never presented as validity ─────────

const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

export function sectionStarted(p: Passport, id: SectionId): boolean {
  switch (id) {
    case 'identity': return filled(p.identity.title) && p.identity.title !== 'Untitled project';
    case 'decision': return Object.values(p.decision).some(filled);
    case 'scope': return Object.values(p.scope).some(filled);
    case 'representation': return filled(p.representation.primaryMethod) || filled(p.representation.justification) || p.representation.nodes.length > 0;
    case 'inputs': return p.inputs.length > 0;
    case 'assumptions': return p.assumptions.length > 0;
    case 'outcomes': return p.outcomes.length > 0;
    case 'evaluation': return Object.values(p.evaluation).some(filled);
    case 'experiment': return Object.values(p.experiment).some(filled);
    case 'conclusion': return Object.values(p.conclusion).some(filled);
    case 'review': return Object.values(p.review).some((c) => c.status !== 'draft' || filled(c.notes));
  }
}

export function completeness(p: Passport): { started: number; total: number; startedIds: SectionId[] } {
  const startedIds = SECTIONS.filter((s) => sectionStarted(p, s.id)).map((s) => s.id);
  return { started: startedIds.length, total: SECTIONS.length, startedIds };
}

/** Specific gaps, phrased neutrally (STYLE §15 “Incomplete passport”). Used by EX12/C12 audits. */
export function passportGaps(doc: ProjectDoc): { id: string; section: SectionId; message: string }[] {
  const p = doc.passport;
  const gaps: { id: string; section: SectionId; message: string }[] = [];
  const add = (id: string, section: SectionId, message: string) => gaps.push({ id, section, message });
  if (!filled(p.decision.stakeholder)) add('stakeholder', 'decision', 'The stakeholder has not been specified yet.');
  if (!filled(p.decision.question)) add('question', 'decision', 'The precise question has not been written yet.');
  if (!p.decision.claimType) add('claim', 'decision', 'The claim type (descriptive, predictive, decision support…) is not stated.');
  if (!filled(p.scope.boundary)) add('boundary', 'scope', 'The system boundary has not been specified yet.');
  if (!filled(p.scope.horizon)) add('horizon', 'scope', 'The time horizon has not been specified yet.');
  if (!filled(p.scope.timeUnit)) add('timeunit', 'scope', 'The time unit is not stated.');
  if (!p.representation.primaryMethod) add('method', 'representation', 'No primary method selected.');
  if (p.representation.primaryMethod && !filled(p.representation.justification)) add('method-just', 'representation', 'The primary method has no written justification.');
  if (!p.representation.alternativeMethod) add('alt', 'representation', 'No alternative method recorded.');
  if (p.inputs.length === 0) add('inputs', 'inputs', 'No inputs listed.');
  p.inputs.forEach((r, i) => {
    if (!filled(r.unit)) add(`in-unit-${r.id}`, 'inputs', `Input ${i + 1} (“${r.name || 'unnamed'}”) has no unit.`);
    if (r.sourceType === 'unspecified') add(`in-src-${r.id}`, 'inputs', `Input ${i + 1} (“${r.name || 'unnamed'}”) has no source type.`);
  });
  if (p.assumptions.length === 0) add('assumptions', 'assumptions', 'No assumptions recorded. Every model has some.');
  p.assumptions.forEach((a, i) => {
    if (!filled(a.consequenceIfWrong)) add(`as-cons-${a.id}`, 'assumptions', `Assumption ${i + 1} has no stated consequence if wrong.`);
    if (!filled(a.plannedCheck)) add(`as-check-${a.id}`, 'assumptions', `Assumption ${i + 1} has no planned check.`);
  });
  if (p.outcomes.length === 0) add('outcomes', 'outcomes', 'No outcome metric defined.');
  p.outcomes.forEach((o, i) => { if (!filled(o.unit)) add(`out-unit-${o.id}`, 'outcomes', `Outcome ${i + 1} (“${o.metric || 'unnamed'}”) has no unit.`); });
  if (!filled(p.evaluation.verification)) add('verification', 'evaluation', 'No verification checks planned.');
  if (!filled(p.evaluation.validation)) add('validation', 'evaluation', 'No validation evidence plan.');
  if (!filled(p.experiment.runSettings)) add('runsettings', 'experiment', 'Run settings (horizon, replications, seed) are not recorded.');
  if (!filled(p.conclusion.limitations)) add('limitations', 'conclusion', 'Limitations are not stated.');
  return gaps;
}
