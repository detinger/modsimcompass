import type { CheckPlan, ConceptModel } from '../../domain/artefacts/types';
import type { Kind } from '../../domain/distributions/laws';
import type { MethodId } from '../../domain/methods/registry';
import type { MethodAnswers } from '../../domain/methods/rules';
import type { Assumption, Availability, InputRow, OutcomeRow, Passport } from '../../domain/passport/schema';

/**
 * A project template: a planned project from IT or information systems that a reader starts from (the Project page).
 * Steps 1 to 6 are written the way a good plan would write them; step 7 (results and recommendation) is left to the
 * reader, so a project made from a template is in the planning stage. All numbers are synthetic or illustrative and
 * are labelled as such in each input's provenance.
 *
 * Starting from a template also makes its artefacts (build.ts): a conceptual model, a method choice, its data and a
 * check plan. They go to My artefacts and into the project, as if the reader had made each one in the Toolbox.
 */
export interface ProjectTemplate {
  /** Stable id, kebab-case. Never changes once published. */
  id: string;
  /** Card and project title, 2 to 5 words. */
  title: string;
  /** Area of IT or information systems, 1 to 3 words, for example “DevOps”. */
  area: string;
  /** One sentence for the card: the problem in plain words, at most about 110 characters. */
  pitch: string;
  /** What the project works with, 2 to 5 words, for example “Survey, Likert items”. */
  data: string;
  /** Two or three short points (at most about 60 characters each): what this template shows a learner. */
  shows: string[];
  /** The passport of steps 1 to 6. `representation.primaryMethod` is the template's method. */
  content: TemplateContent;
  /** The artefacts of steps 2 to 5. */
  artefacts: TemplateArtefacts;
}

export interface TemplateContent {
  decision: Passport['decision'];
  scope: Passport['scope'];
  /** The method and its reasons. The step-2 sketch (`nodes`, `relations`) is written by the conceptual model. */
  representation: Omit<Passport['representation'], 'primaryMethod' | 'alternativeMethod' | 'nodes' | 'relations'> & { primaryMethod: MethodId; alternativeMethod: MethodId };
  /**
   * Input rows written by hand: design settings, horizons and anything that is not a data model or a construct.
   * The rows of the data models and of the survey are written by those artefacts; never repeat them here.
   */
  inputs: InputRow[];
  assumptions: Assumption[];
  outcomes: OutcomeRow[];
  /** Overwritten by the check plan's lines when the project is made; kept as the plan's summary in words. */
  evaluation: Passport['evaluation'];
  experiment: Passport['experiment'];
}

/**
 * What a template makes besides its passport. Each artefact's title is how it is listed in My artefacts, for example
 * “ERP go-live risk: conceptual model”.
 */
export interface TemplateArtefacts {
  /** Step 2. Every element of type `external` is in the `outside` zone and its label appears in `scope.exclusions`. */
  concept: { title: string; data: ConceptModel };
  /**
   * Step 3. The method chooser's answers. The shortlist is computed from them and must contain the primary method; the
   * method and both justifications are those of `content.representation`.
   */
  method: { title: string; answers: MethodAnswers };
  /** Step 4 for a simulation or analytic method: one data model per uncertain input, each one input row. */
  data: DataSpec[];
  /** Step 4 for a statistical method: the survey, one input row per construct. */
  survey?: SurveySpec;
  /** Step 5. Every check `planned`; no observed or simulated values yet. */
  checks: { title: string; data: CheckPlan };
}

/** One uncertain input as a data model (the Data and inputs tool). */
export type DataSpec = {
  /** Artefact title in My artefacts. */
  title: string;
  /** Input row name and unit, as in step 4. */
  name: string; unit: string;
  provenance: string; uncertainty: string; availability: Availability; plan: string;
} & (
  /**
   * Synthetic records: `n` values (30 to 500) drawn from `truth` with `seed`, rounded to `decimals`, then every candidate
   * law fitted as the Data tool does; the best by AIC is kept, with its fit record and the data. The row is labelled
   * synthetic. The best fit may differ from `truth`; that is fine, and worth a sentence in `uncertainty`.
   */
  | { source: 'synthetic'; truth: { family: Kind; params: number[] }; seed: string; n: number; decimals: number }
  /**
   * No data: a law described from expert judgement or a design choice (origin “described”). `evidence` labels its row:
   * `expert` for an estimate someone gave, `assumed` (the default) for a declared assumption or a design value.
   */
  | { source: 'described'; family: Kind; params: number[]; evidence?: 'expert' | 'assumed' }
);

/**
 * A synthetic survey on a 1–7 agreement scale (the Measurement data tool), generated from a known structure so that the
 * reliability screen and a later analysis behave like real data. Never responses from real people.
 */
export interface SurveySpec {
  title: string;
  /** Where the data come from, in words; written into each construct's row. */
  source: string;
  seed: string;
  /** Number of respondents (100 to 600). */
  cases: number;
  /**
   * Constructs in order. Item columns share one prefix per construct and end in a number (PU1, PU2, …); a single-item
   * construct may use a column without a number. `loading` (0.4 to 0.95) is how strongly the item reflects its construct.
   */
  constructs: { name: string; mode: 'reflective' | 'formative' | 'single'; items: { column: string; label: string; reverse?: boolean; loading: number }[] }[];
  /** The structure the answers are generated from: standardised effects between construct names. */
  paths: { from: string; to: string; beta: number }[];
  /** Correlation between the constructs no path points to (0 to 0.6). */
  exogenousCorrelation: number;
  /** Share of answers left blank (0 to 0.05). */
  missingRate: number;
  /** Respondents who give the same answer to every item (0 to 10). */
  straightLiners: number;
  /** How missing answers will be handled in the analysis. */
  missing: 'listwise' | 'pairwise' | 'imputed';
  note: string;
}
