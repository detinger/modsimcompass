import { Dices, ExternalLink, GitFork, LineChart, ScatterChart, Sigma, Waves } from 'lucide-react';

export type ToolId = 'sandbox' | 'distributions' | 'choose' | 'fitting' | 'sampling' | 'regression' | 'apps';

export interface ToolDef {
  id: ToolId;
  /** Full name, shown as the page heading. */
  title: string;
  /** Short name for tiles and the "more tools" strip. */
  short: string;
  tagline: string;
  icon: typeof Dices;
  tone: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'sandbox', title: 'Backlog sandbox', short: 'Backlog sandbox', tagline: 'Arrivals in, service out. Watch the backlog move.', icon: Waves, tone: 'tone-primary' },
  { id: 'distributions', title: 'Distribution explorer', short: 'Explore', tagline: '22 shapes of uncertainty to play with.', icon: Sigma, tone: 'tone-blue' },
  { id: 'choose', title: 'Choose a distribution', short: 'Choose', tagline: 'Answer a few questions, get a shortlist.', icon: GitFork, tone: 'tone-purple' },
  { id: 'fitting', title: 'Fit a distribution', short: 'Fit', tagline: 'Which curve matches your data?', icon: LineChart, tone: 'tone-orange' },
  { id: 'sampling', title: 'Random sampling', short: 'Sampling', tagline: 'Flip coins until chance settles down.', icon: Dices, tone: 'tone-teal' },
  { id: 'regression', title: 'Regression', short: 'Regression', tagline: 'How noise hides a true line.', icon: ScatterChart, tone: 'tone-brown' },
  { id: 'apps', title: 'Specialist apps', short: 'Specialist apps', tagline: 'One app for each method.', icon: ExternalLink, tone: 'tone-primary' },
];

export const toolById = (id: string): ToolDef | undefined => TOOLS.find((t) => t.id === id);

export interface ToolGroup { id: string; title: string; tools: ToolId[] }

/** Hub layout: tiles in groups (docs/COMPASS-SPEC.md §6). */
export const TOOL_GROUPS: ToolGroup[] = [
  { id: 'simulate', title: 'Simulate', tools: ['sandbox'] },
  { id: 'distributions', title: 'Distributions', tools: ['distributions', 'choose', 'fitting'] },
  { id: 'randomness', title: 'Randomness', tools: ['sampling'] },
  { id: 'relationships', title: 'Relationships', tools: ['regression'] },
  { id: 'apps', title: 'Specialist apps', tools: ['apps'] },
];
