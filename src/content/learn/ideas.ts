import type { DiagramId } from '../diagrams/types';
import type { ArtefactKind } from '../../domain/artefacts/types';

/** The three Learn pages, as shown on the landing page and in the pager. */
export interface LearnPage { id: 'process' | 'methods' | 'ideas'; title: string; line: string; minutes: number; tone: string }

export const LEARN_PAGES: LearnPage[] = [
  { id: 'process', title: 'The simulation process', line: 'Seven stops from a question to a recommendation.', minutes: 6, tone: 'tone-blue' },
  { id: 'methods', title: 'Methods at a glance', line: 'Eleven methods, each as one moving picture.', minutes: 12, tone: 'tone-purple' },
  { id: 'ideas', title: 'Key ideas', line: 'Four ideas every model rests on, and a glossary.', minutes: 8, tone: 'tone-orange' },
];

export const learnPath = (id: LearnPage['id']) => `/learn/${id}`;

/** One key idea: a picture, a few lines, and the tool where it is put to work. */
export interface KeyIdea {
  id: string;
  title: string;
  /** One of the app's five diagrams, or the Learn picture drawn for this idea. */
  figure: DiagramId | 'uncertainty';
  lines: string[];
  tool: ArtefactKind;
}

export const KEY_IDEAS: KeyIdea[] = [
  {
    id: 'concept', title: 'Parts of a conceptual model', figure: 'concept-components', tool: 'concept-model',
    lines: [
      'Decide what the model must answer before building anything.',
      'Inputs you can change, outputs you will judge, and the content in between.',
      'Write down what you assume and what you leave out.',
    ],
  },
  {
    id: 'uncertainty', title: 'Describing uncertainty', figure: 'uncertainty', tool: 'data-model',
    lines: [
      'An uncertain input is a distribution, not a single number.',
      'Look at the data, summarise it, then fit a curve you can sample from.',
      'No data? Describe the shape, and say where the guess comes from.',
    ],
  },
  {
    id: 'checks', title: 'Verification, validation, calibration', figure: 'vv-cycle', tool: 'check-plan',
    lines: [
      'Verification compares the program with the concept.',
      'Validation compares the model with the real system.',
      'Calibration only tunes. Validate on evidence you did not tune on.',
    ],
  },
  {
    id: 'comparison', title: 'A fair comparison', figure: 'paired-comparison', tool: 'comparison',
    lines: [
      'Give both options the same random inputs.',
      'Luck then cancels, and the difference shows the option itself.',
      'Repeat until the interval is narrow enough to decide.',
    ],
  },
];

/** The picture drawn for “Describing uncertainty”: caption, stages and text equivalent. */
export const UNCERTAINTY = {
  title: 'Describing uncertainty',
  caption: 'From observations to a model you can sample from.',
  stages: [
    { label: 'Observe', text: 'Forty measured service times, each one a dot.' },
    { label: 'Summarise', text: 'Stack the dots: the histogram shows the shape.' },
    { label: 'Fit', text: 'A smooth curve stands in for the histogram.' },
    { label: 'Sample', text: 'New values are drawn from the curve, as many as you need.' },
  ],
  axis: 'Service time (minutes)',
  text: [
    'Observe: forty service times are plotted as dots along a time axis.',
    'Summarise: the dots stack into columns. Most values are short, a few are long.',
    'Fit: a smooth, right-skewed curve is laid over the columns. It is the input model.',
    'Sample: new values are drawn from the curve and land on the axis, most of them where the curve is highest.',
  ],
};

/** “Chance and noise”: the two small experiments under the key ideas. */
export const CHANCE = {
  title: 'Chance and noise',
  line: 'One run is one draw. Two small experiments show why that matters.',
  coins: { title: 'Coin flips', line: 'Early flips swing wildly. The share of heads settles only slowly.' },
  line2: { title: 'A noisy line', line: 'Each new sample gives a different slope. One sample is one opinion.' },
};
