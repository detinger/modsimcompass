import { FAMILIES, METHODS, type MethodFamily } from '../../domain/methods/registry';
import { STEPS } from '../../domain/passport/compass';
import { CHECKPOINTS, type CheckpointId } from '../../domain/passport/schema';
import type { DiagramId, DiagramSpec, StepCaptions } from './types';

/* ── 1 · Compass journey ─────────────────────────────────────────────── */

const CHECKPOINT_LABEL = Object.fromEntries(CHECKPOINTS.map((c) => [c.id, c.label])) as Record<CheckpointId, string>;

export interface JourneyStop { number: number; title: string; question: string; /** Checkpoint reached once this step is done. */ checkpoint: string | null }

/** A checkpoint flag stands after the last step that belongs to it. */
export const JOURNEY_STOPS: JourneyStop[] = STEPS.map((s, i) => ({
  number: s.number, title: s.title, question: s.short,
  checkpoint: STEPS[i + 1]?.checkpoint === s.checkpoint ? null : CHECKPOINT_LABEL[s.checkpoint],
}));

export const JOURNEY = {
  loopFrom: 6, loopTo: 3,
  loopTitle: 'Evidence fails?',
  loopText: 'Loop back and revise.',
  loopCaption: 'When the evidence fails, loop back to an earlier step and revise. That is progress, not failure.',
  summary: 'Seven steps, five checkpoints. Select a step to see its guiding question.',
  legendCheckpoint: 'Checkpoint',
  legendLoop: 'Loop back when evidence fails',
};

/* ── 2 · Conceptual model ────────────────────────────────────────────── */

export const CONCEPT = {
  real: { label: 'Real system', sub: 'messy and detailed' },
  model: { label: 'Conceptual model', sub: 'the bridge' },
  computer: { label: 'Computer model', sub: 'code that runs' },
  objectives: { label: 'Objectives', sub: 'what it must answer' },
  inputs: { label: 'Inputs', sub: 'what you change' },
  content: { label: 'Content', sub: 'scope and detail' },
  outputs: { label: 'Outputs', sub: 'what you judge' },
  assumptions: { label: 'Assumptions', sub: 'what you believe' },
  simplifications: { label: 'Simplifications', sub: 'what you leave out' },
  steps: [
    'Start from the real system: messy, detailed and only partly known.',
    'State the objectives: what must the model answer?',
    'Choose the inputs you can change and the outputs you will judge.',
    'Set the content: what is in scope, and at what level of detail.',
    'Write down what you assume and what you simplify.',
    'Only then build the computer model from the concept.',
  ] as StepCaptions,
  summary: 'The conceptual model is the bridge: decide it on paper before you write any code.',
};

/* ── 3 · Method families ─────────────────────────────────────────────── */

export const FAMILY_ORDER: MethodFamily[] = ['relationships', 'uncertainty', 'processes', 'emergence'];

const FAMILY_EXAMPLE: Record<MethodFamily, string> = {
  relationships: 'Does training raise satisfaction directly, or through skills?',
  uncertainty: 'How likely is the project to overrun its budget?',
  processes: 'How long will requests wait if demand grows by a fifth?',
  emergence: 'How do individual route choices add up to a traffic jam?',
};

export const FAMILY_CARDS = FAMILY_ORDER.map((id) => ({
  id, label: FAMILIES[id].label.replace('&', 'and'), question: FAMILIES[id].question, example: FAMILY_EXAMPLE[id],
  methods: METHODS.filter((m) => m.family === id).map((m) => m.name),
}));

export const FAMILIES_HINT = 'Select the question closest to yours to see an example.';

/* ── 4 · Verification and validation ─────────────────────────────────── */

export type CheckId = 'verification' | 'validation' | 'calibration';

export const VV = {
  real: { label: 'Real system', sub: 'what actually happens' },
  concept: { label: 'Conceptual model', sub: 'what you intend' },
  computer: { label: 'Computer model', sub: 'what you built' },
  abstract: 'abstract',
  implement: 'implement',
  hint: 'Select a check to see what it compares.',
  checks: [
    { id: 'verification', label: 'Verification', question: 'Is it built right?', text: 'Check the computer model against the conceptual model.' },
    { id: 'validation', label: 'Validation', question: 'Is it the right model?', text: 'Compare the model with the real system, using data and expert judgement.' },
    { id: 'calibration', label: 'Calibration', question: 'Which values fit?', text: 'Tune parameters to data. Tuning is not validation: test on evidence you did not tune on.' },
  ] as { id: CheckId; label: string; question: string; text: string }[],
};

/* ── 5 · Paired comparison ───────────────────────────────────────────── */

export type PairMode = 'paired' | 'unpaired';

export const PAIRED = {
  replications: 20,
  modes: [
    { id: 'paired', label: 'Same inputs', tag: 'fair' },
    { id: 'unpaired', label: 'Different inputs', tag: 'unfair' },
  ] as { id: PairMode; label: string; tag: string }[],
  source: 'Arrivals',
  baseline: 'Baseline',
  alternative: 'Alternative',
  outcome: 'mean backlog',
  difference: 'Difference',
  differenceSub: 'alternative − baseline',
  distribution: 'differences',
  distributionOne: 'difference',
  verdict: 'favour the alternative',
  steps: {
    paired: [
      'Draw one random arrival sequence.',
      'Feed the same sequence to both policies.',
      'Each policy gives an outcome. Subtract: one difference per replication.',
      'Repeat with new sequences. The differences form a distribution.',
    ],
    unpaired: [
      'Draw a separate arrival sequence for each policy.',
      'Each policy now faces different arrivals.',
      'Subtract the outcomes: the difference mixes policy and luck.',
      'Repeat. The differences scatter widely.',
    ],
  } as Record<PairMode, StepCaptions>,
  summary: {
    paired: 'Same inputs: luck cancels out, so the difference shows the policy.',
    unpaired: 'Different inputs: input noise is mixed into every difference and hides the policy.',
  } as Record<PairMode, string>,
};

/* ── Titles, captions and text equivalents ───────────────────────────── */

export const DIAGRAMS: Record<DiagramId, DiagramSpec> = {
  'compass-journey': {
    id: 'compass-journey', title: 'The project compass', caption: 'Seven steps from a problem to a recommendation you can defend.',
    text: [
      ...JOURNEY_STOPS.map((s) => `Step ${s.number}, ${s.title}: ${s.question}${s.checkpoint ? ` Checkpoint after this step: ${s.checkpoint}.` : ''}`),
      JOURNEY.loopCaption,
    ],
  },
  'concept-components': {
    id: 'concept-components', title: 'Parts of a conceptual model', caption: 'The bridge between the real system and the computer model.',
    text: [
      'Real system → conceptual model → computer model. The conceptual model is decided before any code is written.',
      ...(['objectives', 'inputs', 'content', 'outputs', 'assumptions', 'simplifications'] as const).map((k) => `${CONCEPT[k].label}: ${CONCEPT[k].sub}.`),
      'Inside the conceptual model, inputs feed the content, and the content produces the outputs.',
    ],
  },
  'method-families': {
    id: 'method-families', title: 'Four families of methods', caption: 'Start from your question, not from a tool.',
    text: FAMILY_CARDS.map((f) => `${f.label}: ${f.question} Methods: ${f.methods.join(', ')}. Example: ${f.example}`),
  },
  'vv-cycle': {
    id: 'vv-cycle', title: 'Verification, validation, calibration', caption: 'Three different checks on three different links.',
    text: [
      'Real system → (abstract) → conceptual model → (implement) → computer model.',
      ...VV.checks.map((c) => `${c.label}: ${c.question} ${c.text}`),
    ],
  },
  'paired-comparison': {
    id: 'paired-comparison', title: 'A fair comparison', caption: 'Both policies face the same random inputs.',
    text: [
      'Fair: one arrival sequence feeds the baseline and the alternative. Each gives an outcome; their difference is one data point per replication.',
      'Many replications give a distribution of differences.',
      PAIRED.summary.paired,
      PAIRED.summary.unpaired,
    ],
  },
};
