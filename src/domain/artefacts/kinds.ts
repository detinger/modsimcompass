import type { StepId } from '../passport/compass';
import type { ProjectDoc } from '../passport/schema';
import type { ArtefactData, ArtefactKind } from './types';
import { conceptModel } from './conceptModel';
import { methodChoice } from './methodChoice';
import { dataModel } from './dataModel';
import { measurementData } from './measurementData';
import { checkPlan } from './checkPlan';
import { comparison } from './comparison';

/** What the app knows about one kind of artefact (docs/TOOLBOX-SPEC.md §2.2). */
export interface KindDef<K extends ArtefactKind> {
  kind: K;
  /** Name of the artefact, for example “Conceptual model”. */
  label: string;
  /** Address of the tool that makes it, for example “/toolbox/concept”. */
  toolPath: string;
  /** The project step it belongs to. */
  step: StepId;
  /** false: a project holds one of this kind; adding another replaces it. */
  many: boolean;
  /** true: each copy owns the project input rows whose `inclusion` is the copy's id. Removing the copy removes them;
   *  refreshing it rewrites them. Other kinds write ordinary project fields. */
  ownsRows?: boolean;
  empty(): ArtefactData[K];
  /** Clean copy with only known, well-typed fields, or null when the shape is wrong. */
  sanitize(raw: unknown, warn: (m: string) => void): ArtefactData[K] | null;
  /** True when there is nothing worth saving yet. */
  isEmpty(data: ArtefactData[K]): boolean;
  /** Two to five short plain-text lines for a card. */
  summary(data: ArtefactData[K]): string[];
  /** Report section in the Markdown subset of `src/exports/html.ts` (lists, tables, paragraphs; no headings). User text must go through the escaping helpers of `src/exports/markdown.ts`. */
  markdown(data: ArtefactData[K]): string[];
  /** Standalone SVG markup for cards and the report, or null. All text escaped; no scripts, no external references; colours via CSS variables with fallbacks. */
  figure(data: ArtefactData[K]): string | null;
  /** Writes the matching project fields (docs/TOOLBOX-SPEC.md §3.2). Mutates the draft. */
  applyToProject(doc: ProjectDoc, data: ArtefactData[K], inclusionId: string): void;
}

export const KINDS: { [K in ArtefactKind]: KindDef<K> } = {
  'concept-model': conceptModel,
  'method-choice': methodChoice,
  'data-model': dataModel,
  'measurement-data': measurementData,
  'check-plan': checkPlan,
  'comparison': comparison,
};

/** The kinds in the order of the project steps they belong to. Two kinds can share one tool (Data and inputs). */
export const KIND_ORDER: ArtefactKind[] = ['concept-model', 'method-choice', 'data-model', 'measurement-data', 'check-plan', 'comparison'];
/** The five tools, each named by the kind it makes first. Lists of tools (menu, hub, page titles) use this; lists of artefacts use `KIND_ORDER`. */
export const TOOL_ORDER: ArtefactKind[] = ['concept-model', 'method-choice', 'data-model', 'check-plan', 'comparison'];
export const isArtefactKind = (k: unknown): k is ArtefactKind => typeof k === 'string' && Object.hasOwn(KINDS, k);
/** The definition of a kind that is only known at run time. */
export const kindDef = (k: ArtefactKind): KindDef<ArtefactKind> => KINDS[k] as unknown as KindDef<ArtefactKind>;
