import type { Kind } from './laws';

/**
 * Decision tree for choosing an input distribution — ported from the Monte Carlo
 * Simulation Lab Distribution Helper (`src/science/distributionTree.js`). Every leaf names
 * families defined in laws.ts. Layout positions are column/row slots for the tree canvas.
 */
export interface QuestionNode { col: number; row: number; text: string; help: string }
export interface LeafNode { col: number; title: string; kinds: Kind[] }

export const QUESTIONS: Record<string, QuestionNode> = {
  root: { col: 6.5, row: 0, text: 'Discrete or continuous?', help: 'Discrete: counts or categories (0, 1, 2, …). Continuous: measurements such as time, cost or weight.' },
  dEstimate: { col: 2, row: 1, text: 'Can you list outcomes and their probabilities?', help: 'If you know every outcome and how likely it is, use those probabilities directly.' },
  dShape: { col: 3.5, row: 2, text: 'Symmetric or asymmetric?', help: 'Symmetric counts spread evenly around the middle; asymmetric counts have a longer tail.' },
  dCentre: { col: 2, row: 3, text: 'Clustered around a central value?', help: 'Clustered counts have a clear most-likely value; otherwise every value is about equally likely.' },
  dTail: { col: 5, row: 3, text: 'Where do the outliers point?', help: 'Only towards larger counts, mostly larger, or mostly smaller?' },
  cShape: { col: 10, row: 1, text: 'Symmetric or asymmetric?', help: 'Symmetric data spread evenly around the middle; asymmetric data have a longer tail on one side.' },
  cCentre: { col: 8, row: 2, text: 'Clustered around a central value?', help: 'Clustered data have a peak; unclustered data are spread evenly or have several peaks.' },
  cOutliers: { col: 9, row: 3, text: 'How likely are outliers?', help: 'Hard limits: nothing outside a known range. Otherwise: how often do extreme values occur?' },
  cTail: { col: 12, row: 2, text: 'What does the lopsided shape look like?', help: 'Peak at zero: the smallest values are the most common, as in times between random events. Peak above zero: values cluster at a typical size with occasional much larger ones, as in durations and sizes. Long left tail: occasional much smaller values.' },
};

export const FAMILY_NOTES: Partial<Record<Kind, { use: string; example: string; thumb: (number | string)[] }>> = {
  categorical: { use: 'You list the probability of each outcome directly.', example: 'A student picks channel A, B or C.', thumb: ['0.15, 0.35, 0.3, 0.2'] },
  binomial: { use: 'Successes in a fixed number of independent trials.', example: 'Defective items in a batch of 20.', thumb: [12, 0.5] },
  discrete: { use: 'Every whole number in a range is equally likely.', example: 'The roll of a fair die.', thumb: [1, 8] },
  geometric: { use: 'Failures before the first success.', example: 'Calls before the first sale.', thumb: [0.3] },
  negbinomial: { use: 'Failures before a set number of successes.', example: 'Rejections before the fifth acceptance.', thumb: [5, 0.5] },
  hypergeometric: { use: 'Successes when drawing without replacement.', example: 'Faulty parts in 12 inspected out of 50.', thumb: [50, 20, 12] },
  uniform: { use: 'Every value in a range is equally likely.', example: 'Arrival somewhere within one hour.', thumb: [0, 1] },
  empirical: { use: 'Resamples your own observations, lumps and all.', example: 'Historical daily demand.', thumb: ['1, 2, 2, 3, 6, 7, 7, 8'] },
  triangular: { use: 'Minimum, most likely and maximum; nothing outside.', example: 'An expert’s task-duration estimate.', thumb: [0, 0.5, 1] },
  normal: { use: 'Symmetric bell; extremes are very unlikely.', example: 'Measurement errors.', thumb: [0, 1] },
  logistic: { use: 'Like the normal, with heavier tails.', example: 'Growth and demand models.', thumb: [0, 1] },
  cauchy: { use: 'Very heavy tails; no mean, averages never settle.', example: 'Ratio of two noisy measurements.', thumb: [0, 1] },
  exponential: { use: 'Time between random, independent events.', example: 'Time until the next support ticket.', thumb: [1] },
  lognormal: { use: 'Positive, right-skewed; many effects multiply.', example: 'Costs or file sizes.', thumb: [0, 0.5] },
  gamma: { use: 'Positive, right-skewed; sum of waiting stages.', example: 'Repair time.', thumb: [2, 1] },
  weibull: { use: 'Positive; flexible model for lifetimes.', example: 'Time until a component fails.', thumb: [1.5, 1] },
  minextreme: { use: 'Left-skewed; the smallest of many values.', example: 'Weakest-link strength.', thumb: [0, 1] },
  poisson: { use: 'Counts of independent events in a fixed interval.', example: 'Requests arriving per day.', thumb: [4] },
};

export const LEAVES: Record<string, LeafNode> = {
  categorical: { col: 0, title: 'Categorical', kinds: ['categorical'] },
  binomial: { col: 1, title: 'Binomial', kinds: ['binomial'] },
  discrete: { col: 2, title: 'Uniform discrete', kinds: ['discrete'] },
  geometric: { col: 3, title: 'Geometric', kinds: ['geometric'] },
  negbinomial: { col: 4, title: 'Negative binomial', kinds: ['negbinomial'] },
  hypergeometric: { col: 5, title: 'Hypergeometric', kinds: ['hypergeometric'] },
  uniform: { col: 6, title: 'Uniform or multimodal', kinds: ['uniform', 'empirical'] },
  triangular: { col: 7, title: 'Triangular', kinds: ['triangular'] },
  normal: { col: 8, title: 'Normal', kinds: ['normal'] },
  logistic: { col: 9, title: 'Logistic or Cauchy', kinds: ['logistic', 'cauchy'] },
  exponential: { col: 10, title: 'Exponential', kinds: ['exponential'] },
  skewed: { col: 11, title: 'Lognormal, Gamma or Weibull', kinds: ['lognormal', 'gamma', 'weibull'] },
  minextreme: { col: 12, title: 'Minimum extreme', kinds: ['minextreme'] },
};

/** [parent, child, answer] */
export const EDGES: [string, string, string][] = [
  ['root', 'dEstimate', 'Discrete'], ['root', 'cShape', 'Continuous'],
  ['dEstimate', 'categorical', 'Yes'], ['dEstimate', 'dShape', 'No'],
  ['dShape', 'dCentre', 'Symmetric'], ['dShape', 'dTail', 'Asymmetric'],
  ['dCentre', 'binomial', 'Yes'], ['dCentre', 'discrete', 'No'],
  ['dTail', 'geometric', 'Only positive'], ['dTail', 'negbinomial', 'More positive'], ['dTail', 'hypergeometric', 'More negative'],
  ['cShape', 'cCentre', 'Symmetric'], ['cShape', 'cTail', 'Asymmetric'],
  ['cCentre', 'uniform', 'No'], ['cCentre', 'cOutliers', 'Yes'],
  ['cOutliers', 'triangular', 'Hard limits'], ['cOutliers', 'normal', 'Very low'], ['cOutliers', 'logistic', 'Low'],
  ['cTail', 'exponential', 'Peak at zero'], ['cTail', 'skewed', 'Peak above zero, long right tail'], ['cTail', 'minextreme', 'Long left tail'],
];

export function pathTo(id: string): { from: string; to: string; answer: string }[] {
  const steps: { from: string; to: string; answer: string }[] = [];
  for (let node = id; node !== 'root';) {
    const e = EDGES.find(([, child]) => child === node);
    if (!e) return [];
    steps.unshift({ from: e[0], to: node, answer: e[2] });
    node = e[0];
  }
  return steps;
}

export const childrenOf = (id: string) => EDGES.filter(([from]) => from === id).map(([, to, answer]) => ({ to, answer }));
