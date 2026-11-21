import { libraryPlanId } from '../domain/artefacts/checkPlan';
import type { PlannedCheck } from '../domain/artefacts/types';
import type { MethodId } from '../domain/methods/registry';
import { profileFor } from '../domain/methods/profiles';

/**
 * The library of standard checks behind the verification, validation and calibration tool
 * (docs/LEARN-TOOLBOX-PLAN.md §5.4). A general set applies to any model; each method adds its own.
 *
 * Rules for this file: the text is a short instruction that starts with a verb and can be done and ticked off;
 * the “why” is one line; nothing here says a model is valid. Ids are stable: a check added to a plan
 * remembers the id it came from, so the library can mark it as already added.
 */
export type CheckGroup = PlannedCheck['group'];

export interface StandardCheck {
  id: string;
  group: CheckGroup;
  /** What to do. */
  text: string;
  /** Why it is worth doing, in one line. */
  why: string;
  /** A sub-heading within the method's checks, such as “Structural model”. */
  part?: string;
}

const v = (id: string, text: string, why: string, part?: string): StandardCheck => ({ id, group: 'verification', text, why, ...(part ? { part } : {}) });
const a = (id: string, text: string, why: string, part?: string): StandardCheck => ({ id, group: 'validation', text, why, ...(part ? { part } : {}) });
const c = (id: string, text: string, why: string, part?: string): StandardCheck => ({ id, group: 'calibration', text, why, ...(part ? { part } : {}) });

/** Parts of the validation of a structural equation model. */
const REFLECTIVE = 'Reflective measurement', FORMATIVE = 'Formative measurement', STRUCTURAL = 'Structural model', GLOBAL = 'Global fit';

/** Checks that apply whatever the method, except those a method's profile leaves out (src/domain/methods/profiles.ts). */
export const GENERAL_CHECKS: StandardCheck[] = [
  v('g-units', 'Check units on every equation and input', 'A unit mismatch is the cheapest error to find and the costliest to miss.'),
  v('g-known-answer', 'Run a case with a known answer and compare', 'A model that misses a case you can work out by hand cannot be trusted on the rest.'),
  v('g-extreme', 'Push an input to an extreme and see if the response is sensible', 'No demand or unlimited capacity has an obvious result. A surprise points to an error.'),
  v('g-same-seed', 'Repeat a run with the same seed and confirm identical output', 'Without repeatable runs you cannot tell your own change from chance.'),
  v('g-walk-through', 'Walk one entity or one time step through by hand', 'One case followed line by line shows whether the code does what you intended.'),
  v('g-against-concept', 'Compare the code with the conceptual model, part by part', 'Everything in the conceptual model should be in the code, and nothing else.'),

  a('g-held-out', 'Compare model output with data that was not used to set its parameters', 'Matching the data the parameters came from shows they were set well, not that the model is right.'),
  a('g-expert', 'Show the model and its results to someone who knows the system', 'People who run the system notice behaviour that could not happen.'),
  a('g-direction', 'Change one input and check the output moves in the expected direction', 'More demand should not shorten the wait. A wrong direction means a wrong structure.'),
  a('g-simpler-model', 'Compare with a simpler model or a rough hand calculation', 'A large gap must be explained by something the simple version leaves out.'),
  a('g-plausible-range', 'Vary uncertain inputs across their plausible range and see if the conclusion holds', 'A conclusion that flips inside the plausible range is not yet a conclusion.'),

  c('g-tuned-list', 'List every tuned parameter with its start value, final value and plausible range', 'A tuned value outside what is plausible is hiding an error somewhere else.'),
  c('g-data-aside', 'Name the data used for tuning and set other data aside for validation', 'Data used twice cannot test the model.'),
  c('g-other-fits', 'Check whether other parameter values fit the data equally well', 'If several sets fit, the data cannot tell them apart and their predictions may differ.'),
];

/**
 * The general checks of the third group for a method whose parameters are estimated from data rather than tuned.
 * They take the place of the tuning checks above.
 */
export const ESTIMATION_CHECKS: StandardCheck[] = [
  c('e-record', 'Record what was estimated, with which estimator, on how many cases', 'The estimates belong to these choices: another estimator or sample can give other values.'),
  c('e-holdout', 'Predict cases that were not used for estimation and compare with what happened', 'Fit within the sample always flatters. Prediction on unseen cases is the guard against overfitting.'),
  c('e-data-aside', 'Name the data used for estimation and keep other cases aside for prediction', 'Cases used to estimate cannot also test the prediction.'),
];

/** Checks that belong to one method. */
export const METHOD_CHECKS: Record<MethodId, StandardCheck[]> = {
  'path-analysis': [
    v('pa-spec', 'Check the specification against the theory: every path drawn, and no other', 'A path left out is a claim that it is zero.'),
    v('pa-sample', 'Confirm the cases and variables in the output match the data file', 'Dropped rows and miscoded variables change every estimate without any warning.'),
    v('pa-indirect', 'Check that each indirect effect equals the product of its paths', 'A mismatch means the model that was fitted is not the one that was drawn.'),
    v('pa-recover', 'Fit data simulated with known path values and check they are recovered', 'If the fitting cannot find values you planted, it will not find real ones.'),
    c('pa-converged', 'Confirm the estimation converged and no estimate is impossible, such as a negative variance', 'Numbers from a failed or improper solution are not estimates.'),
    a('pa-fit', 'Check global fit with several indices and the chi-square test, read together, when the model has degrees of freedom', 'A saturated model fits perfectly by construction. One index can look fine while another shows misfit.', GLOBAL),
    a('pa-residuals', 'Inspect the residual correlations for relations the model misses', 'Large residuals show where the drawn paths fail to explain the data.', GLOBAL),
    a('pa-intervals', 'Report direct and indirect effects with bootstrap intervals', 'An indirect effect is a product of paths and is rarely normal; a bootstrap interval allows for that.', STRUCTURAL),
    a('pa-rival', 'Fit a rival model with one path reversed or removed and compare', 'If a rival fits as well, the data do not support your direction.', STRUCTURAL),
  ],
  'cb-sem': [
    v('cb-spec', 'Check the specification against the theory: indicators, error terms and fixed parameters', 'A fixed or freed parameter is part of the theory being tested.'),
    v('cb-identified', 'Check identification: free parameters no more than the known variances and covariances, and a scale for each latent variable', 'The count is necessary, not sufficient. A model that is not identified has no unique answer, whatever the software prints.'),
    v('cb-data', 'Prepare the data: missing values, reverse-coded items, straight-lining, and the distribution the estimator assumes', 'Unreversed items and identical answers distort every loading; a skewed item can break the estimator.'),
    v('cb-recover', 'Fit data simulated from planted values and check they are recovered', 'If the estimation cannot find values you planted, it will not find real ones.'),
    c('cb-converged', 'Confirm the estimation converged, and note the estimator used', 'Numbers from a run that did not converge are not estimates.'),
    c('cb-impossible', 'Look for impossible estimates: negative variances, standardised loadings above one', 'They signal a wrong specification or too little data, not a finding.'),
    a('cb-measurement', 'Check the measurement model before the paths: loadings, reliability, average variance extracted (AVE), discriminant validity (HTMT)', 'Paths between badly measured constructs mean little.', REFLECTIVE),
    a('cb-fit', 'Check global fit with several indices and the chi-square test, read together', 'One index can look fine while another shows misfit. No single cut-off settles it.', GLOBAL),
    a('cb-modification', 'Treat a change suggested by the data as a new hypothesis, to be tested on new data', 'A change found in the data always fits the same data better.', GLOBAL),
    a('cb-paths', 'Report each path with its standard error or interval', 'A path whose interval spans zero does not support the hypothesis.', STRUCTURAL),
    a('cb-rival', 'Compare with a rival model that the theory also allows', 'Good fit does not single out one model: others may fit the same data equally well.', STRUCTURAL),
  ],
  'pls-sem': [
    v('pls-indicators', 'Check the specification against the theory: each indicator on its intended construct, each construct reflective or formative as intended', 'One misplaced indicator, or the wrong mode, changes the meaning of the whole construct.'),
    v('pls-data', 'Prepare the data: handle missing values, reverse-code negatively worded items, screen for straight-lining', 'Unreversed items and identical answers distort every weight and loading downstream.'),
    v('pls-settings', 'Record the estimation settings: weighting scheme, stop criterion, iterations to converge, bootstrap resamples and seed', 'Results cannot be repeated or reviewed without the settings that produced them.'),
    v('pls-bootstrap', 'Rerun the bootstrap with another seed and check the intervals barely move', 'Intervals that move with the seed need more resamples.'),
    v('pls-recover', 'Estimate data simulated from planted values and check they are recovered', 'If the estimation cannot find values you planted, it will not find real ones.'),
    c('pls-converged', 'Confirm the algorithm converged well within its iteration limit', 'Stopping at the limit gives numbers, not estimates.'),
    a('pls-loadings', 'Check each indicator loading; a common guide is about 0.7 or more', 'A weak indicator adds more noise than signal to its construct.', REFLECTIVE),
    a('pls-reliability', 'Check internal consistency: composite reliability and coefficient alpha; a common guide is 0.7 to 0.95', 'Too low means the items disagree; very high can mean they repeat each other.', REFLECTIVE),
    a('pls-ave', 'Check convergent validity: average variance extracted (AVE); a common guide is 0.5 or more', 'Below half, a construct explains less of its items than error does.', REFLECTIVE),
    a('pls-constructs', 'Check discriminant validity with the HTMT ratio; a common guide is below 0.85 to 0.9', 'Two constructs that cannot be told apart cannot have a relation worth reporting.', REFLECTIVE),
    a('pls-f-collinearity', 'Check collinearity among formative indicators (VIF); a common guide is below 3 to 5', 'Overlapping indicators make the weights unstable and hard to read.', FORMATIVE),
    a('pls-f-weights', 'Check the relevance of each weight with its bootstrap interval; drop an indicator only for a reason in theory', 'A formative construct is made of its indicators: dropping one changes what it means.', FORMATIVE),
    a('pls-s-collinearity', 'Check collinearity among the predictors of each construct (VIF)', 'Collinear predictors share the credit between their paths unpredictably.', STRUCTURAL),
    a('pls-s-paths', 'Report each path with its bootstrap interval, not only its size', 'A path whose interval spans zero is not supported.', STRUCTURAL),
    a('pls-s-r2', 'Report R² for each outcome and the effect size (f²) of each predictor', 'How much is explained, and by what, is the substance of the model.', STRUCTURAL),
    a('pls-holdout', 'Predict held-out cases and compare with a simple benchmark, such as a linear model of the indicators', 'A claim about prediction needs cases the model has not seen, and something to beat.', STRUCTURAL),
    a('pls-rival', 'Compare with a rival model that the theory also allows', 'If a rival explains and predicts as well, the data do not single out yours.', STRUCTURAL),
    a('pls-robust', 'Test robustness: non-linear effects, and differences between groups', 'An effect that holds only on average, or only as a straight line, can mislead.', STRUCTURAL),
  ],
  'petri-nets': [
    v('pn-by-hand', 'Fire transitions by hand from the initial marking and compare with the tool', 'The first few markings show whether the arcs and weights are as intended.'),
    v('pn-tokens', 'Check that tokens are conserved wherever a resource should be conserved', 'A resource that multiplies or vanishes is a wrong arc, not a result.'),
    v('pn-deadlock', 'Search the reachable markings for deadlock and for places that grow without limit', 'These are the questions the method answers. Answer them before anything else.'),
    v('pn-dead-transition', 'Confirm every transition can fire at least once', 'A transition that never fires is a step the model cannot perform.'),
    a('pn-real-case', 'Walk a real case through the net with someone who runs the process', 'A tidy net can still describe a process nobody follows.'),
    c('pn-marking', 'Take the initial marking from the real process: how many cases and resources there are at the start', 'Deadlock can depend on the starting tokens, not only on the arcs.'),
  ],
  'monte-carlo': [
    v('mc-input-means', 'Check the sample means of inputs against their specified means', 'It catches a wrong parameter or a wrong distribution before it reaches the outcome.'),
    v('mc-settle', 'Increase the sample size until the outcome estimate settles', 'An estimate that still moves with more samples is not finished.'),
    v('mc-at-means', 'Set every input to a fixed value and compare with the plain calculation', 'With chance removed, the answer can be worked out and compared exactly.'),
    v('mc-dependence', 'Check that the sampled inputs keep the dependence you intended', 'Inputs sampled independently when they move together understate the spread.'),
    a('mc-spread', 'Compare the simulated spread of the outcome with the spread in past records', 'A plausible mean can come with an implausible range.'),
    c('mc-sources', 'Name the source of each input distribution: data, expert judgement or assumption', 'An input with no source is an assumption the result silently depends on.'),
  ],
  'markov-chains': [
    v('mk-rows', 'Check every row of the transition matrix sums to one', 'A row that does not sum to one creates or loses cases at every step.'),
    v('mk-two-steps', 'Multiply the state shares forward two steps by hand and compare', 'It confirms the matrix is applied the right way round.'),
    v('mk-long-run', 'Compare long-run shares from stepping with the solved steady state', 'Stepping settles only for an irreducible, aperiodic chain. Two routes to the same answer catch errors in either.'),
    a('mk-memory', 'Check from data whether time already spent in a state changes the chance of leaving', 'If it does, the states hide memory and the chain will mislead.'),
    c('mk-counts', 'Estimate each probability from counted transitions, and note how many each row rests on', 'A row built on a handful of transitions is a guess, whatever its decimals.'),
    c('mk-periods', 'Estimate the transition probabilities on one period and test them on another', 'Probabilities that drift between periods cannot be projected forward.'),
  ],
  'system-dynamics': [
    v('sd-conservation', 'Confirm every stock changes only through its flows (conservation)', 'Material that appears or vanishes outside the flows is a modelling error.'),
    v('sd-time-step', 'Halve the time step and check the behaviour does not change', 'Behaviour that depends on the step comes from the arithmetic, not from the system.'),
    v('sd-negative', 'Check that no stock goes negative when it cannot in reality', 'A negative stock means an outflow that does not depend on what is left.'),
    v('sd-equilibrium', 'Start in equilibrium and confirm nothing moves until disturbed', 'Movement with no disturbance shows the flows do not balance.'),
    a('sd-shape', 'Compare the shape of behaviour over time with history: growth, overshoot, oscillation', 'The shape tests the feedback structure. Matching a single point does not.'),
  ],
  'queueing-theory': [
    v('qt-stable', 'Check that utilisation is below one before using a steady-state formula', 'At or above one the queue grows without limit and the formula does not apply.'),
    v('qt-time-unit', 'Check that arrival and service rates use the same time unit', 'Per hour against per minute is the commonest slip, and it changes everything.'),
    v('qt-limits', 'Try the limiting cases: very low load, and many servers', 'Waiting should vanish in both. If it does not, the formula is misapplied.'),
    a('qt-arrivals', 'Check from data whether the arrival rate is steady over the period', 'The formulas assume it is. A rush hour breaks them.'),
    a('qt-observed-wait', 'Compare the predicted mean wait with waits that were measured', 'It tests the arrival and service assumptions together.'),
    c('qt-rates', 'Estimate the arrival and service rates from records, and note the period they cover', 'A rate from a quiet month says little about a busy one.'),
  ],
  des: [
    v('des-formula', 'Compare a single-server case with the queueing formula', 'A simple case with a known answer tests the event logic end to end.'),
    v('des-utilisation', 'Check that utilisation stays below one in a stable case', 'Utilisation at one, or a queue that only grows, signals wrong rates or logic.'),
    v('des-trace', 'Trace a few entities through the event list', 'It shows that entities queue, seize and release in the order intended.'),
    v('des-count', 'Count entities: arrived equals departed plus still in the system', 'Entities that are lost or copied point to a routing error.'),
    a('des-waits', 'Compare simulated waiting times with recorded ones over several replications', 'One run is one draw. The comparison needs the spread.'),
  ],
  'cellular-automata': [
    v('ca-by-hand', 'Step a small grid by hand and compare cell by cell', 'A three-by-three grid is enough to catch a wrong neighbourhood.'),
    v('ca-known-pattern', 'Test a pattern whose evolution is known, such as one that stays still or repeats', 'Known patterns test the rule and the update order together.'),
    v('ca-update-order', 'Confirm cells update all at once or in sequence, as intended', 'The two schemes can give different patterns from the same rule.'),
    a('ca-boundary', 'Change the boundary rule and the grid size and see if the result holds', 'A result that depends on the edge is about the grid, not the system.'),
    a('ca-spread', 'Compare the speed of spread or the size of patterns with observations', 'A pattern that only looks right is weak evidence. A measured one is stronger.'),
  ],
  abm: [
    v('abm-one-agent', 'Run with one agent and with identical agents', 'Simple populations have predictable outcomes, so errors in the rules show.'),
    v('abm-seeds', 'Check results across several seeds, not one', 'A pattern from a single run may be chance.'),
    v('abm-follow', 'Follow one agent step by step and compare each decision with its rule', 'Behaviour seen in the crowd is only as right as each agent’s rule.'),
    a('abm-patterns', 'Compare several observed patterns at once, not one summary number', 'Many different models can match one number. Few match several patterns.'),
    c('abm-split', 'Tune on some patterns and keep others to validate against', 'Rules with many free parameters can be tuned to fit almost anything.'),
  ],
};

export const ALL_STANDARD_CHECKS: StandardCheck[] = [...GENERAL_CHECKS, ...ESTIMATION_CHECKS, ...Object.values(METHOD_CHECKS).flat()];

/**
 * The standard checks of one area: the general ones that suit the method, then the method's own (none while it is
 * undecided). A method's profile leaves out general checks that do not apply; for a method estimated from data the
 * third area offers estimation checks instead of the tuning ones.
 */
export function standardChecks(method: MethodId | '', group: CheckGroup): { general: StandardCheck[]; specific: StandardCheck[] } {
  const profile = profileFor(method);
  const pool = group === 'calibration' && profile?.calibration === 'estimation' ? ESTIMATION_CHECKS : GENERAL_CHECKS.filter((k) => k.group === group);
  return {
    general: pool.filter((k) => !profile?.skipGeneral.includes(k.id)),
    specific: method ? METHOD_CHECKS[method].filter((k) => k.group === group) : [],
  };
}

/** The id a plan gives to a check taken from the library, so the library can show it as added. */
export const planIdFor = libraryPlanId;
