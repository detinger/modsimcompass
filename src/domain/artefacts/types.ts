import type { Kind } from '../distributions/laws';
import type { MethodId } from '../methods/registry';
import type { MethodAnswers } from '../methods/rules';
import type { Availability } from '../passport/schema';

/**
 * Artefacts: what the Toolbox tools produce (docs/TOOLBOX-SPEC.md §2.1).
 * An artefact lives on the device in its own store, independent of any project.
 */
export const ARTEFACT_SCHEMA = 'modsimcompass/artefact';
/** The schema name of artefact files written under the app's earlier name (ModSim Essentials). They import as before. */
export const LEGACY_ARTEFACT_SCHEMAS: readonly string[] = ['modsim-essentials/artefact'];
export const ARTEFACT_SCHEMA_VERSION = 1;
export type ArtefactKind = 'concept-model' | 'method-choice' | 'data-model' | 'measurement-data' | 'check-plan' | 'comparison';

export interface ArtefactMeta {
  schema: typeof ARTEFACT_SCHEMA; schemaVersion: number;
  id: string; kind: ArtefactKind; title: string;
  createdAt: string; updatedAt: string;
  /** Increments on every saved change. */
  revision: number;
}

// ── Conceptual model ──
export type CMNodeType = 'actor' | 'entity' | 'resource' | 'activity' | 'stock' | 'variable' | 'lever' | 'outcome' | 'external' | 'note';
export type CMZone = 'inputs' | 'content' | 'outputs' | 'outside';
export interface CMNode { id: string; type: CMNodeType; label: string; x: number; y: number; zone: CMZone }
export type CMEdgeKind = 'flow' | 'influence' | 'information' | 'decides';
export interface CMEdge { id: string; from: string; to: string; kind: CMEdgeKind; sign: '' | '+' | '-'; label: string }
export interface ConceptModel { objectives: string; assumptions: string; simplifications: string; nodes: CMNode[]; edges: CMEdge[] }

// ── Method choice ──
export interface MethodChoice {
  answers: MethodAnswers; ruleVersion: string; shortlist: MethodId[];
  primary: MethodId | ''; alternative: MethodId | '';
  justification: string; alternativeJustification: string;
}

// ── Data model (one uncertain input) ──
export interface DataModel {
  name: string; unit: string;
  family: Kind; params: number[];
  /** How the model was arrived at. */
  origin: 'fitted' | 'described' | 'manual';
  provenance: string; uncertainty: string;
  availability: Availability; plan: string;
  summary: { n: number; mean: number; sd: number; min: number; max: number } | null;
  fit: { rank: number; candidates: { family: Kind; aic: number }[]; ksD: number | null } | null;
  generator: { seed: string; n: number };
  /** Raw data is stored only when the user asks for it. */
  keepData: boolean; data: number[];
}

// ── Check plan ──
/** `na`: does not apply to this model; the evidence says why. Never counts as open or failed. */
export type CheckStatus = 'planned' | 'done' | 'passed' | 'failed' | 'na';
export interface PlannedCheck { id: string; group: 'verification' | 'validation' | 'calibration'; text: string; status: CheckStatus; evidence: string }
export interface CheckPlan {
  method: MethodId | '';
  checks: PlannedCheck[];
  validation: {
    measure: string; tolerancePct: number | null;
    /** What the tolerance is judged on: `pairs` the mean absolute percentage error of row-matched values, `means` the difference of the two means. */
    toleranceOn: 'means' | 'pairs';
    observed: number[]; simulated: number[];
  };
  calibration: { parameters: string; tunedOn: string; validatedOn: string };
}

// ── Measurement data (measured variables or survey items, grouped into constructs) ──
/** `reflective`: the items reflect the construct and should agree. `formative`: the items make it up. `single`: one item. */
export type ConstructMode = 'reflective' | 'formative' | 'single';
/** How missing values are handled in the analysis. */
export type MissingHandling = 'undecided' | 'none' | 'listwise' | 'pairwise' | 'imputed';
/** Summary of one item, after reverse coding. `skew` is the sample skewness; null with fewer than three values or no spread. */
export interface ItemSummary { n: number; missing: number; mean: number; sd: number; min: number; max: number; skew: number | null }
export interface MeasuredItem {
  id: string;
  /** Column name in the source file. */
  column: string;
  /** Wording or short label. */
  label: string;
  /** Reverse-coded: recoded on the scale (min + max − value) before any summary. */
  reverse: boolean;
  summary: ItemSummary | null;
}
export interface MeasuredConstruct {
  id: string; name: string; mode: ConstructMode;
  /** Ids of its items, in order. */
  items: string[];
  /** Cronbach's alpha of its items, for two or more items; null otherwise. A screen of internal consistency, not validation. */
  alpha: number | null;
}
export interface MeasurementData {
  /** Where the data come from. */
  source: string;
  /** `example`: the app's seeded example survey, never responses from real people. */
  origin: 'imported' | 'example';
  /** Number of cases (respondents, rows). */
  cases: number;
  /** The answer scale, for example a 1–7 Likert scale; null when the items are not on one fixed scale. */
  scale: { min: number; max: number } | null;
  missing: MissingHandling;
  items: MeasuredItem[];
  constructs: MeasuredConstruct[];
  /** The largest number of arrows into one construct of the structural model, when known (for the sample-size note). */
  maxArrows: number | null;
  note: string;
  /** Raw data is stored only when the user asks for it: one row per case, one value per item in `items` order, null when missing. */
  keepData: boolean; data: (number | null)[][];
}

// ── Comparison of two policies ──
export interface Comparison {
  outcome: string; unit: string; direction: 'lower' | 'higher';
  baselineLabel: string; alternativeLabel: string;
  /** One value per replication. Paired: row i of both lists used the same random inputs. */
  baseline: number[]; alternative: number[]; paired: boolean;
  minimumDifference: number | null; targetHalfWidth: number | null;
  origin: 'pasted' | 'imported' | 'example';
  note: string;
}

export interface ArtefactData {
  'concept-model': ConceptModel; 'method-choice': MethodChoice; 'data-model': DataModel; 'measurement-data': MeasurementData; 'check-plan': CheckPlan; 'comparison': Comparison;
}
export type Artefact<K extends ArtefactKind = ArtefactKind> = { [P in K]: ArtefactMeta & { kind: P; data: ArtefactData[P] } }[K];
