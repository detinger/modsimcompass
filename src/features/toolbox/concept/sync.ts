import { CM_EDGE_LABELS, CM_NODE_H, CM_NODE_LABELS, CM_NODE_W, CM_ZONE_LABELS, frameOf, routeBends, type CMFrame } from '../../../domain/artefacts/conceptModel';
import type { CMEdge, CMNode, ConceptModel } from '../../../domain/artefacts/types';
import type { ConnectionFlowEdge } from './edges';
import { FRAME_ID, type ConceptFlowNode, type ElementFlowNode, type FrameFlowNode } from './nodes';

/**
 * The model is the truth; React Flow's nodes and edges are rebuilt from it after every change. What React Flow
 * owns (selection, measured size) is carried over, and an unchanged element keeps its object, so React Flow
 * redraws only what changed.
 */

const sameNode = (a: CMNode, b: CMNode) => a.id === b.id && a.type === b.type && a.label === b.label && a.x === b.x && a.y === b.y && a.zone === b.zone;
const sameEdge = (a: CMEdge, b: CMEdge) => a.id === b.id && a.from === b.from && a.to === b.to && a.kind === b.kind && a.sign === b.sign && a.label === b.label;
const sameFrame = (a: CMFrame, b: CMFrame) => a.height === b.height && a.middleBottom === b.middleBottom && a.outside.h === b.outside.h;

export const nodeAriaLabel = (n: CMNode) => `${CM_NODE_LABELS[n.type]}: ${n.label.trim() || 'Unnamed'}, ${CM_ZONE_LABELS[n.zone]}`;

function frameNode(f: CMFrame): FrameFlowNode {
  const width = f.outside.x + f.outside.w, height = Math.max(f.height, f.outside.h);
  return {
    id: FRAME_ID, type: 'frame', position: { x: 0, y: 0 }, data: { frame: f }, width, height, zIndex: -1,
    draggable: false, selectable: false, focusable: false, connectable: false, deletable: false,
  };
}

/** Nodes for React Flow: the frame first (drawn underneath), then one per element. `select` replaces the selection. */
export function syncNodes(prev: ConceptFlowNode[], model: ConceptModel, select?: string[]): ConceptFlowNode[] {
  const byId = new Map(prev.map((n) => [n.id, n]));
  const f = frameOf(model);
  const oldFrame = byId.get(FRAME_ID);
  const out: ConceptFlowNode[] = [oldFrame && oldFrame.type === 'frame' && sameFrame(oldFrame.data.frame, f) ? oldFrame : frameNode(f)];
  for (const n of model.nodes) {
    const p = byId.get(n.id);
    const selected = select ? select.includes(n.id) : !!p?.selected;
    if (p && p.type === 'element' && sameNode(p.data.node, n) && !!p.selected === selected && p.position.x === n.x && p.position.y === n.y) { out.push(p); continue; }
    // An initial size lets React Flow show a new element at once, before it is measured, so its name editor can take the focus.
    const next: ElementFlowNode = { id: n.id, type: 'element', position: { x: n.x, y: n.y }, data: { node: n }, selected, ariaLabel: nodeAriaLabel(n), initialWidth: CM_NODE_W, initialHeight: CM_NODE_H };
    if (p?.measured) next.measured = p.measured;
    out.push(next);
  }
  return out.length === prev.length && out.every((n, i) => n === prev[i]) ? prev : out;
}

/** Edges for React Flow, each with its sideways bend. */
export function syncEdges(prev: ConnectionFlowEdge[], model: ConceptModel, select?: string[]): ConnectionFlowEdge[] {
  const byId = new Map(prev.map((e) => [e.id, e]));
  const names = new Map(model.nodes.map((n) => [n.id, n.label.trim() || 'Unnamed']));
  const bends = routeBends(model);
  const out = model.edges.map((e): ConnectionFlowEdge => {
    const p = byId.get(e.id), bend = bends.get(e.id) ?? 0;
    const selected = select ? select.includes(e.id) : !!p?.selected;
    const ariaLabel = `${CM_EDGE_LABELS[e.kind]}${e.sign ? ` ${e.sign === '+' ? 'plus' : 'minus'}` : ''} from ${names.get(e.from)} to ${names.get(e.to)}${e.label.trim() ? `: ${e.label.trim()}` : ''}`;
    if (p && p.data && sameEdge(p.data.edge, e) && p.data.bend === bend && !!p.selected === selected && p.ariaLabel === ariaLabel) return p;
    return { id: e.id, source: e.from, target: e.to, type: 'connection', data: { edge: e, bend }, selected, ariaLabel };
  });
  return out.length === prev.length && out.every((e, i) => e === prev[i]) ? prev : out;
}
