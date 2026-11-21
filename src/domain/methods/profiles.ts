import type { MethodId } from './registry';

/**
 * What each compass stop means for a method. The seven stops are the same for every project, but a statistical model,
 * a simulation and an analytic model are checked, fed and used differently. Screens, open items, standard checks and
 * the checkpoint wording read this table, so they cannot disagree.
 *
 * - `model`: how results are produced. Statistical models are estimated from data; simulations are run; analytic
 *   models are solved or their state space is analysed.
 * - `stochastic`: results depend on random numbers, so seeds and replications matter.
 * - `inputs`: what step 4 collects. `distributions` are uncertain inputs fitted or described as probability laws
 *   (Data and inputs, one data model per input); `measurement` is a dataset of measured variables or survey items
 *   grouped into constructs (one measurement data artefact); `parameters` are rates, initial values and design
 *   settings with a source each.
 * - `calibration`: `tuning` adjusts parameters until output matches data, so validation must use other data;
 *   `estimation` fits parameters to data by a statistical criterion, so nothing is tuned and the guard against
 *   overfitting is prediction on held-out cases; `parameters` takes values from data or the design, and tuning is rare.
 * - `experiment`: what step 6 is. `policy-experiment` compares policies over replications with shared random inputs
 *   (the Fair comparison tool); `scenario-analysis` compares settings by solving or running the model once per
 *   setting; `analysis-plan` maps hypotheses to estimated paths and plans robustness checks.
 * - `skipGeneral`: ids of general standard checks (src/content/checks.ts) that do not apply to the method.
 *
 * These are defaults. What a project actually includes takes precedence: an included comparison makes step 6 a
 * policy experiment, and an included data model makes step 4 read as distributions, whatever the method (for
 * example a system dynamics model with random inputs compared over replications).
 */
export interface MethodProfile {
  model: 'statistical' | 'simulation' | 'analytic';
  stochastic: boolean;
  inputs: 'distributions' | 'measurement' | 'parameters';
  calibration: 'tuning' | 'estimation' | 'parameters';
  experiment: 'policy-experiment' | 'scenario-analysis' | 'analysis-plan';
  skipGeneral: string[];
}

/** General checks that make no sense for a model estimated from data. Their intent is covered by the method's own checks. */
const STATISTICAL_SKIP = ['g-units', 'g-known-answer', 'g-extreme', 'g-same-seed', 'g-walk-through', 'g-direction', 'g-plausible-range', 'g-tuned-list', 'g-held-out'];

const statistical: MethodProfile = { model: 'statistical', stochastic: false, inputs: 'measurement', calibration: 'estimation', experiment: 'analysis-plan', skipGeneral: STATISTICAL_SKIP };

export const METHOD_PROFILES: Record<MethodId, MethodProfile> = {
  'path-analysis': statistical,
  'cb-sem': statistical,
  'pls-sem': statistical,
  'monte-carlo': { model: 'simulation', stochastic: true, inputs: 'distributions', calibration: 'parameters', experiment: 'policy-experiment', skipGeneral: [] },
  des: { model: 'simulation', stochastic: true, inputs: 'distributions', calibration: 'tuning', experiment: 'policy-experiment', skipGeneral: [] },
  abm: { model: 'simulation', stochastic: true, inputs: 'distributions', calibration: 'tuning', experiment: 'policy-experiment', skipGeneral: [] },
  'cellular-automata': { model: 'simulation', stochastic: true, inputs: 'parameters', calibration: 'tuning', experiment: 'policy-experiment', skipGeneral: [] },
  'system-dynamics': { model: 'simulation', stochastic: false, inputs: 'parameters', calibration: 'tuning', experiment: 'scenario-analysis', skipGeneral: ['g-same-seed'] },
  'markov-chains': { model: 'analytic', stochastic: false, inputs: 'parameters', calibration: 'estimation', experiment: 'scenario-analysis', skipGeneral: ['g-same-seed', 'g-tuned-list'] },
  'queueing-theory': { model: 'analytic', stochastic: false, inputs: 'distributions', calibration: 'parameters', experiment: 'scenario-analysis', skipGeneral: ['g-same-seed', 'g-walk-through'] },
  'petri-nets': { model: 'analytic', stochastic: false, inputs: 'parameters', calibration: 'parameters', experiment: 'scenario-analysis', skipGeneral: ['g-same-seed', 'g-plausible-range', 'g-tuned-list'] },
};

export const profileFor = (method: MethodId | '' | undefined | null): MethodProfile | null => (method ? METHOD_PROFILES[method] ?? null : null);

/** One line on what calibration means for the method, or null when it means tuning (the default reading). */
export const CALIBRATION_NOTE: Record<MethodProfile['calibration'], string | null> = {
  tuning: null,
  estimation: 'Nothing is tuned: parameters are estimated from the data. Guard against overfitting with prediction on cases the model has not seen.',
  parameters: 'Parameters come from data or the design. Record where each one comes from; tune only what cannot be measured.',
};

/** Short names for what step 6 is, for headings and open items. */
export const EXPERIMENT_LABEL: Record<MethodProfile['experiment'], string> = {
  'policy-experiment': 'Policy experiment',
  'scenario-analysis': 'Scenario analysis',
  'analysis-plan': 'Analysis plan',
};

/** Short names for what step 4 collects. */
export const INPUTS_LABEL: Record<MethodProfile['inputs'], string> = {
  distributions: 'Uncertain inputs',
  measurement: 'Measured variables',
  parameters: 'Parameters',
};
