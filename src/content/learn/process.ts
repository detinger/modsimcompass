import type { ArtefactKind } from '../../domain/artefacts/types';
import type { StepId } from '../../domain/passport/compass';

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
}

export const PROCESS_STOPS: ProcessStop[] = [
  {
    step: 'frame', tool: null,
    does: 'Name who decides, what they can change and how success will be measured. Turn the worry into one precise question.',
    wrong: 'A solution is assumed before the problem is stated.',
  },
  {
    step: 'scope', tool: 'concept-model',
    does: 'Draw the boundary: what is inside the model, in how much detail, and what is left out on purpose. On paper, before any code.',
    wrong: 'Everything is included, so nothing can be explained.',
  },
  {
    step: 'method', tool: 'method-choice',
    does: 'Pick the representation that fits the question, and name the one that almost does.',
    wrong: 'The method is chosen because the software is familiar.',
  },
  {
    step: 'inputs', tool: 'data-model',
    does: 'List what goes in, each with its unit, source and uncertainty. Give every assumption a way to be checked.',
    wrong: 'Convenient numbers quietly become facts.',
  },
  {
    step: 'evaluation', tool: 'check-plan',
    does: 'Check that the model is built right, and that it is the right model for the purpose. Keep some evidence aside for validation.',
    wrong: 'A good fit to the tuning data is taken as proof.',
  },
  {
    step: 'experiment', tool: 'comparison',
    does: 'Compare the options on the same random inputs, with enough replications to tell an effect from chance.',
    wrong: 'Each option is run once and the better number wins.',
  },
  {
    step: 'conclude', tool: null,
    does: 'Say what you recommend, under which conditions, and what stays uncertain.',
    wrong: 'The result is presented as proof, with no limits.',
  },
];

/** The process is a loop, not a line. Stop numbers match the loop on the compass diagram. */
export const PROCESS_LOOP = {
  from: 'experiment' as StepId,
  to: 'method' as StepId,
  title: 'Evidence fails? Loop back.',
  text: 'A failed check or a surprising result sends you back to an earlier stop. Revise, then come forward again. That is progress, not failure.',
};
