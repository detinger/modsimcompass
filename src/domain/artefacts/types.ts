import type { Kind } from '../distributions/laws';
import type { MethodId } from '../methods/registry';
import type { MethodAnswers } from '../methods/rules';
import type { Availability } from '../passport/schema';

/**
 * Artefacts: what the Toolbox tools produce (docs/TOOLBOX-SPEC.md §2.1).
 * An artefact lives on the device in its own store, independent of any project.
 */
export const ARTEFACT_SCHEMA = 'modsim-essentials/artefact';
export const ARTEFACT_SCHEMA_VERSION = 1;
export type ArtefactKind = 'concept-model' | 'method-choice' | 'data-model' | 'check-plan' | 'comparison';

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
export type CheckStatus = 'planned' | 'done' | 'passed' | 'failed';
export interface PlannedCheck { id: string; group: 'verification' | 'validation' | 'calibration'; text: string; status: CheckStatus; evidence: string }
export interface CheckPlan {
  method: MethodId | '';
  checks: PlannedCheck[];
  validation: { measure: string; tolerancePct: number | null; observed: number[]; simulated: number[] };
  calibration: { parameters: string; tunedOn: string; validatedOn: string };
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
  'concept-model': ConceptModel; 'method-choice': MethodChoice; 'data-model': DataModel; 'check-plan': CheckPlan; 'comparison': Comparison;
}
export type Artefact<K extends ArtefactKind = ArtefactKind> = { [P in K]: ArtefactMeta & { kind: P; data: ArtefactData[P] } }[K];
