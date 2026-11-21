import type { MethodId } from '../../domain/methods/registry';

/** Text equivalent of each method picture: what the small moving diagram shows. */
export const METHOD_PICTURE_TEXT: Record<MethodId, string> = {
  'path-analysis': 'Three measured variables joined by arrows. Training points to skills, skills point to satisfaction, and training also points straight to satisfaction. The direct path and the path through skills light up in turn and add up to a total effect.',
  'cb-sem': 'Two hidden constructs drawn as ovals, each with three measured indicators below it. Arrows run from each construct to its indicators, every indicator has an error term, and one arrow links the two constructs. The parts light up in turn.',
  'pls-sem': 'Three indicators feed a composite construct through arrows whose thickness is their weight. The weights adjust over a few rounds and settle. The composite then predicts an outcome construct.',
  'petri-nets': 'Round places and bar-shaped transitions. The token of one order is split into two branches, picking and payment. Picking finishes first, but the join waits until both of its input places hold a token, and only then fires.',
  'monte-carlo': 'Two uncertain costs, each drawn as a small curve, are sampled and added. Run after run, the totals pile up into a histogram. The share of runs above a budget line is the chance of an overrun.',
  'markov-chains': 'Three weather states joined by arrows with probabilities. A marker hops from state to state. Only the arrows leaving the current state matter for the next move, and the share of time in each state settles.',
  'system-dynamics': 'A stock, drawn as a box, is filled by an inflow and drained by an outflow, each a valve on a pipe. An information link makes the outflow grow with the level. When the inflow doubles, the level climbs and settles at a new balance, traced as a curve over time.',
  'queueing-theory': 'Arrivals join a line in front of one server. As the server gets busier, from 30% to 95% of the time, the line grows slowly at first and then sharply. A curve shows the average number in the system shooting up as utilisation nears one.',
  des: 'Five numbered items arrive, wait in a line, are served one at a time and leave. Below, a time line marks every arrival and departure. The clock jumps from one event to the next; nothing happens in between.',
  'cellular-automata': 'A grid of cells that are ready, firing or resting. A ready cell fires when one of its four neighbours fires, then rests, then is ready again. From two single cells, rings spread across the grid and cancel where they meet.',
  abm: 'Twenty-four agents wander in a field. One has adopted an idea. Each of the others adopts after its own number of contacts with adopters; bigger dots need more contacts. The share of adopters over time draws an S-shaped curve.',
};
