import type { CMEdgeKind, CMNodeType, CMZone, ConceptModel } from '../../../domain/artefacts/types';
import { arrange } from './arrange';

/**
 * Starters: a small, generic skeleton for each family of methods, to rename and reshape. The labels are placeholders,
 * not data. Positions come from the auto-arrange, so a starter always sits neatly inside its zones.
 */
export type StarterId = 'stock-flow' | 'queue-network' | 'agents' | 'causal' | 'acceptance';

interface StarterSpec {
  id: StarterId; label: string; detail: string;
  nodes: [CMNodeType, string, CMZone][];
  /** [from, to, kind, sign, label] by index into `nodes`. */
  edges: [number, number, CMEdgeKind, '' | '+' | '-', string][];
  /** Texts of the frame a starter suggests; they are filled in only where the model has none yet. */
  objectives?: string;
  assumptions?: string;
}

export const STARTERS: StarterSpec[] = [
  {
    id: 'stock-flow', label: 'Stock and flow', detail: 'Something piles up and drains',
    nodes: [
      ['lever', 'Inflow rate', 'inputs'], ['variable', 'Outflow fraction', 'inputs'],
      ['activity', 'Inflow', 'content'], ['stock', 'Stock', 'content'], ['activity', 'Outflow', 'content'],
      ['outcome', 'Stock over time', 'outputs'],
      ['external', 'Source', 'outside'], ['external', 'Sink', 'outside'],
    ],
    edges: [
      [6, 2, 'flow', '', ''], [2, 3, 'flow', '', ''], [3, 4, 'flow', '', ''], [4, 7, 'flow', '', ''],
      [0, 2, 'influence', '+', ''], [1, 4, 'influence', '+', ''], [3, 4, 'influence', '+', ''],
      [3, 5, 'information', '', 'measured as'],
    ],
  },
  {
    id: 'queue-network', label: 'Queue network', detail: 'Items wait for a server',
    nodes: [
      ['variable', 'Arrival rate', 'inputs'], ['lever', 'Number of servers', 'inputs'],
      ['entity', 'Customer', 'content'], ['stock', 'Queue', 'content'], ['activity', 'Service', 'content'], ['resource', 'Server', 'content'],
      ['outcome', 'Waiting time', 'outputs'], ['outcome', 'Server use', 'outputs'],
      ['external', 'Breakdowns', 'outside'],
    ],
    edges: [
      [0, 2, 'influence', '+', ''], [2, 3, 'flow', '', 'joins'], [3, 4, 'flow', '', ''], [5, 4, 'influence', '', 'serves'],
      [1, 5, 'influence', '+', ''], [3, 6, 'information', '', 'measured as'], [5, 7, 'information', '', ''],
    ],
  },
  {
    id: 'agents', label: 'Interacting agents', detail: 'Many small choices add up',
    nodes: [
      ['lever', 'Interaction rule', 'inputs'], ['variable', 'Starting mix', 'inputs'],
      ['actor', 'Agent', 'content'], ['actor', 'Neighbours', 'content'], ['activity', 'Meet and decide', 'content'],
      ['variable', 'Agent state', 'content'], ['resource', 'Shared space', 'content'],
      ['outcome', 'Pattern that emerges', 'outputs'],
      ['external', 'Outside news', 'outside'],
    ],
    edges: [
      [2, 4, 'decides', '', ''], [3, 4, 'decides', '', ''], [4, 5, 'influence', '', 'changes'], [5, 2, 'information', '', 'remembers'],
      [0, 4, 'influence', '', ''], [1, 5, 'influence', '', ''], [6, 4, 'influence', '', ''], [5, 7, 'information', '', 'adds up to'],
    ],
  },
  {
    id: 'causal', label: 'Causal paths', detail: 'What drives what, and how',
    nodes: [
      ['lever', 'Policy', 'inputs'],
      ['variable', 'Driver', 'content'], ['variable', 'Mediator', 'content'], ['variable', 'Moderator', 'content'],
      ['outcome', 'Effect', 'outputs'],
      ['external', 'Unmeasured cause', 'outside'],
    ],
    edges: [
      [0, 1, 'influence', '+', ''], [1, 2, 'influence', '+', ''], [2, 4, 'influence', '+', ''], [1, 4, 'influence', '-', 'direct'],
      [3, 2, 'influence', '', 'changes strength'], [5, 1, 'influence', '', ''], [5, 4, 'influence', '', ''],
    ],
  },
  {
    id: 'acceptance', label: 'Technology acceptance', detail: 'Beliefs that lead to using a tool',
    nodes: [
      ['variable', 'Perceived ease of use (PEOU)', 'content'], ['variable', 'Perceived usefulness (PU)', 'content'], ['variable', 'Attitude (ATT)', 'content'],
      ['outcome', 'Intention to use (BI)', 'outputs'],
    ],
    edges: [
      [0, 1, 'influence', '+', ''], [0, 2, 'influence', '+', ''], [1, 2, 'influence', '+', ''], [1, 3, 'influence', '+', ''], [2, 3, 'influence', '+', ''],
    ],
    objectives: 'Which beliefs drive the intention to use the new tool?',
    assumptions: 'Each construct is measured by several survey items.',
  },
];

/** The elements and connections of a starter, arranged, with ids from `makeId`, and the frame texts it suggests. */
export function buildStarter(id: StarterId, makeId: (prefix: 'n' | 'e') => string): Pick<ConceptModel, 'nodes' | 'edges'> & { objectives?: string; assumptions?: string } {
  const spec = STARTERS.find((s) => s.id === id);
  if (!spec) return { nodes: [], edges: [] };
  const nodeIds = spec.nodes.map(() => makeId('n'));
  const nodes = spec.nodes.map(([type, label, zone], i) => ({ id: nodeIds[i], type, label, x: 0, y: i * 10, zone }));
  const edges = spec.edges.map(([a, b, kind, sign, label]) => ({ id: makeId('e'), from: nodeIds[a], to: nodeIds[b], kind, sign, label }));
  const arranged = arrange({ objectives: '', assumptions: '', simplifications: '', nodes, edges });
  return { nodes: arranged, edges, objectives: spec.objectives, assumptions: spec.assumptions };
}

/** Puts a starter in place of the drawing; the frame texts it suggests fill only those the model leaves empty. */
export function putStarter(d: ConceptModel, built: ReturnType<typeof buildStarter>): void {
  d.nodes = built.nodes;
  d.edges = built.edges;
  if (built.objectives && !d.objectives.trim()) d.objectives = built.objectives;
  if (built.assumptions && !d.assumptions.trim()) d.assumptions = built.assumptions;
}
