import type { MethodId } from '../../domain/methods/registry';

/** Text equivalent of each method picture: what the small moving diagram shows. */
export const METHOD_PICTURE_TEXT: Record<MethodId, string> = {
  'path-analysis': 'Three measured variables joined by arrows. Training points to skills, skills point to satisfaction, and training also points straight to satisfaction. The direct path and the path through skills light up in turn and add up to a total effect.',
  'cb-sem': 'Two hidden constructs drawn as ovals, each with three measured indicators below it. Arrows run from each construct to its indicators, every indicator has an error term, and one arrow links the two constructs. The parts light up in turn.',
  'pls-sem': 'Three indicators feed a composite construct through arrows whose thickness is their weight. The weights adjust over a few rounds and settle. The composite then predicts an outcome construct.',
  'petri-nets': 'A net of round places and bar-shaped transitions. One token is split into two branches that run side by side. The last transition can fire only when both of its input places hold a token.',
  'monte-carlo': 'Two uncertain costs, each drawn as a small curve, are sampled and added. Run after run, the totals pile up into a histogram. The share of runs above a budget line is the chance of an overrun.',
  'markov-chains': 'Three weather states joined by arrows with probabilities. A marker hops from state to state. Only the arrows leaving the current state matter for the next move, and the share of time in each state settles.',
  'system-dynamics': 'A tank is filled by an inflow and drained by an outflow. A feedback arrow makes the outflow grow with the level. When the inflow changes, the level moves smoothly to a new balance, traced as a curve over time.',
  'queueing-theory': 'Arrivals join a line in front of one server. As utilisation approaches one, the line grows, slowly at first and then sharply, following the curve of the formula for the number in the system.',
  des: 'Items arrive, wait in a line, are served one at a time and leave. Below, a time line marks every arrival and departure. The clock jumps from one event to the next.',
  'cellular-automata': 'A grid of cells. A cell switches on when one of its four neighbours is on, then rests, then switches off. From single cells, waves spread across the grid and cancel where they meet.',
  abm: 'Dots of different sizes move around a space. One has adopted an idea. Others adopt after enough contacts, each by its own rule. The share of adopters over time draws an S-shaped curve.',
};
