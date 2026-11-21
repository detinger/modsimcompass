import type { ArtefactKind } from '../../domain/artefacts/types';
import type { StepId } from '../../domain/passport/compass';
import type { MethodProfile } from '../../domain/methods/profiles';

/** The three kinds of model in the method profiles: run, estimated from data, or solved. */
export type ModelKind = MethodProfile['model'];
export const MODEL_KINDS: { id: ModelKind; label: string }[] = [
  { id: 'simulation', label: 'Simulation' },
  { id: 'statistical', label: 'Statistical' },
  { id: 'analytic', label: 'Analytic' },
];

/**
 * The simulation process, one short card per compass stop.
 * Titles and numbers come from STEPS (domain/passport/compass), so the names match the Project section.
 */
export interface ProcessStop {
  step: StepId;
  /** What you do at this stop: one or two sentences. */
  does: string;
  /** What usually goes wrong: one line. */
  wrong: string;
  /** The Toolbox tool for this stop, where one exists. */
  tool: ArtefactKind | null;
  /** How this stop differs for each kind of model: a few words each. */
  byKind: Record<ModelKind, string>;
}

export const PROCESS_STOPS: ProcessStop[] = [
  {
    step: 'frame', tool: null,
    does: 'Name who decides, what they can change and how success will be measured. Turn the worry into one precise question.',
    wrong: 'A solution is assumed before the problem is stated.',
    byKind: {
      simulation: 'A decision to test: options someone can choose between.',
      statistical: 'A question about why things relate: which constructs, and how.',
      analytic: 'A question a formula can answer: long run, blocking, waiting.',
    },
  },
  {
    step: 'scope', tool: 'concept-model',
    does: 'Draw the boundary: what is inside the model, in how much detail, and what is left out on purpose. On paper, before any code.',
    wrong: 'Everything is included, so nothing can be explained.',
    byKind: {
      simulation: 'Entities, resources, stocks and flows inside the boundary.',
      statistical: 'Constructs and their indicators. Theory draws the boundary.',
      analytic: 'States, transitions or places. Small enough to solve.',
    },
  },
  {
    step: 'method', tool: 'method-choice',
    does: 'Pick the representation that fits the question, and name the one that almost does.',
    wrong: 'The method is chosen because the software is familiar.',
    byKind: {
      simulation: 'DES, agents, system dynamics, Monte Carlo, cellular automata.',
      statistical: 'Path analysis, CB-SEM or PLS-SEM: explain, or predict?',
      analytic: 'Markov chains, queueing formulas or Petri nets.',
    },
  },
  {
    step: 'inputs', tool: 'data-model',
    does: 'List what goes in, each with its unit, source and uncertainty. Give every assumption a way to be checked.',
    wrong: 'Convenient numbers quietly become facts.',
    byKind: {
      simulation: 'Uncertain inputs as distributions, each with a source.',
      statistical: 'One dataset of measured items, grouped into constructs.',
      analytic: 'Rates and probabilities, each with a source.',
    },
  },
  {
    step: 'evaluation', tool: 'check-plan',
    does: 'Check that the model is built right, and that it is the right model for the purpose. Keep some evidence aside for validation.',
    wrong: 'A good fit to the tuning data is taken as proof.',
    byKind: {
      simulation: 'Verify the code, tune on some data, validate on other data.',
      statistical: 'No tuning; check the measurement model, then the paths, and predict held-out cases.',
      analytic: 'Check the formula’s assumptions; test it on cases you can count.',
    },
  },
  {
    step: 'experiment', tool: 'comparison',
    does: 'Compare the options on the same random inputs, with enough replications to tell an effect from chance.',
    wrong: 'Each option is run once and the better number wins.',
    byKind: {
      simulation: 'Policies on the same random inputs, over many replications.',
      statistical: 'An analysis plan: hypotheses, bootstrap intervals, rival models.',
      analytic: 'Scenarios: solve once per setting and compare.',
    },
  },
  {
    step: 'conclude', tool: null,
    does: 'Say what you recommend, under which conditions, and what stays uncertain.',
    wrong: 'The result is presented as proof, with no limits.',
    byKind: {
      simulation: 'Recommend a policy, with its interval and its conditions.',
      statistical: 'Say which relationships the data support, and how strongly.',
      analytic: 'State the answer and the assumptions it rests on.',
    },
  },
];

/** The process is a loop, not a line. Stop numbers match the loop on the compass diagram. */
export const PROCESS_LOOP = {
  from: 'experiment' as StepId,
  to: 'method' as StepId,
  title: 'Evidence fails? Loop back.',
  text: 'A failed check or a surprising result sends you back to an earlier stop. Revise, then come forward again. That is progress, not failure.',
};
