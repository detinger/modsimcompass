/**
 * The app has exactly five diagrams. Each one is a purpose-built component in src/ui/diagrams;
 * this module only describes what every diagram must provide so a card can title it and offer a text equivalent.
 * All text is English. No author names or citations.
 */
export type DiagramId = 'compass-journey' | 'concept-components' | 'method-families' | 'vv-cycle' | 'paired-comparison';

export interface DiagramSpec {
  id: DiagramId;
  title: string;
  /** One sentence shown next to the title. */
  caption: string;
  /** Plain-text equivalent: one list item per line, readable without the picture. */
  text: string[];
}

/** One walkthrough step: the sentence shown while that part of the diagram is revealed. */
export type StepCaptions = readonly string[];
