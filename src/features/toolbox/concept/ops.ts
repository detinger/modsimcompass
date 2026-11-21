import { CM_HOME_ZONE, CM_LAYOUT, CM_NODE_H, CM_NODE_W, freeSpot, frameOf, labelParts, placeNode, zoneEdges, zoneSlots } from '../../../domain/artefacts/conceptModel';
import type { CMEdge, CMEdgeKind, CMNode, CMNodeType, CMZone, ConceptModel } from '../../../domain/artefacts/types';

/**
 * Edits of the conceptual model. Each one changes a draft in place (as `editor.setData` expects) and knows nothing
 * of React, so the rules (zones, connections, what a delete takes with it) are tested on their own.
 */

/** Adds an element. Dropped at a point, its zone follows the point; added without one, it goes to a free spot of its home zone. */
export function addNode(d: ConceptModel, type: CMNodeType, id: string, at?: { x: number; y: number }, label = ''): CMNode {
  const zone = CM_HOME_ZONE[type];
  const place = at ? placeNode(at.x, at.y, frameOf(d)) : { ...freeSpot(d, zone), zone };
  const node: CMNode = { id, type, label, x: place.x, y: place.y, zone: place.zone };
  d.nodes.push(node);
  return node;
}

/** Removes elements and connections; a removed element takes its connections with it. */
export function removeElements(d: ConceptModel, nodeIds: Iterable<string>, edgeIds: Iterable<string> = []): void {
  const nodes = new Set(nodeIds), edges = new Set(edgeIds);
  d.nodes = d.nodes.filter((n) => !nodes.has(n.id));
  d.edges = d.edges.filter((e) => !edges.has(e.id) && !nodes.has(e.from) && !nodes.has(e.to));
}

const THINGS: ReadonlySet<CMNodeType> = new Set(['entity', 'resource', 'stock', 'activity']);

/** A sensible kind for a new connection between two types of element; it can be changed afterwards. */
export function autoKind(from: CMNodeType, to: CMNodeType): CMEdgeKind {
  if (from === 'note' || to === 'note') return 'information';
  if (from === 'actor') return 'decides';
  if (THINGS.has(from) && THINGS.has(to)) return 'flow';
  if (THINGS.has(from) && to === 'outcome') return 'information';
  return 'influence';
}

export type ConnectResult = { ok: true; edge: CMEdge } | { ok: false; reason: 'self' | 'missing' | 'same'; edge?: CMEdge };

/** Connects two elements. Refused for an element to itself, an unknown end, or the same kind between the same pair again. */
export function connect(d: ConceptModel, from: string, to: string, kind: CMEdgeKind, id: string, sign: CMEdge['sign'] = '', label = ''): ConnectResult {
  if (from === to) return { ok: false, reason: 'self' };
  if (!d.nodes.some((n) => n.id === from) || !d.nodes.some((n) => n.id === to)) return { ok: false, reason: 'missing' };
  const same = d.edges.find((e) => e.from === from && e.to === to && e.kind === kind);
  if (same) return { ok: false, reason: 'same', edge: same };
  const edge: CMEdge = { id, from, to, kind, sign: kind === 'influence' ? sign : '', label };
  d.edges.push(edge);
  return { ok: true, edge };
}

/** Sets the kind of a connection; only an influence keeps a sign. */
export function setEdgeKind(e: CMEdge, kind: CMEdgeKind): void {
  e.kind = kind;
  if (kind !== 'influence') e.sign = '';
}

/** Turns a connection round. */
export function reverseEdge(d: ConceptModel, id: string): void {
  const e = d.edges.find((x) => x.id === id);
  if (e) [e.from, e.to] = [e.to, e.from];
}

/** Moves elements to new top-left positions. Each zone follows the element's centre, measured against the frame before the move. */
export function moveNodes(d: ConceptModel, moves: readonly { id: string; x: number; y: number }[]): void {
  const f = frameOf(d);
  for (const m of moves) {
    const n = d.nodes.find((x) => x.id === m.id);
    if (!n) continue;
    const p = placeNode(m.x, m.y, f);
    n.x = p.x; n.y = p.y; n.zone = p.zone;
  }
}

/**
 * Nudges elements by a few pixels (the arrow keys). An element is kept wholly inside its zone, so at the border of
 * its column a sideways nudge would not move it: it then steps across into the neighbouring zone instead.
 */
export function nudge(d: ConceptModel, ids: Iterable<string>, dx: number, dy: number): void {
  const set = new Set(ids), f = frameOf(d);
  for (const n of d.nodes) {
    if (!set.has(n.id)) continue;
    let p = placeNode(n.x + dx, n.y + dy, f);
    if (dx && p.x === n.x) {
      const [left, right] = zoneEdges(n.zone, f), edge = dx > 0 ? right : left;
      if (edge !== null) {
        const across = placeNode(edge + Math.sign(dx) - CM_NODE_W / 2, n.y + dy, f);
        if (across.zone !== n.zone) p = across;
      }
    }
    n.x = p.x; n.y = p.y; n.zone = p.zone;
  }
}

/**
 * Where the keyboard goes after a delete, so it stays on the canvas: the element after the last removed one (or
 * before it, at the end); after removing only connections, the start of the first one. Null when nothing is left.
 */
export function focusAfterRemoval(d: Pick<ConceptModel, 'nodes' | 'edges'>, nodeIds: readonly string[], edgeIds: readonly string[]): string | null {
  const order = d.nodes.map((n) => n.id), gone = new Set(nodeIds);
  if (gone.size) {
    const at = Math.max(...nodeIds.map((id) => order.indexOf(id)));
    return order.slice(at + 1).find((id) => !gone.has(id)) ?? order.slice(0, Math.max(0, at)).reverse().find((id) => !gone.has(id)) ?? null;
  }
  const first = d.edges.find((e) => edgeIds.includes(e.id));
  return (first && order.includes(first.from) ? first.from : order[0]) ?? null;
}

/** Puts an element into another zone, at a free spot there. */
export function moveToZone(d: ConceptModel, id: string, zone: CMZone): void {
  const n = d.nodes.find((x) => x.id === id);
  if (!n || n.zone === zone) return;
  const spot = freeSpot({ nodes: d.nodes.filter((x) => x.id !== id) }, zone);
  n.x = spot.x; n.y = spot.y; n.zone = zone;
}

/** Centre of an element, for keeping it in view. */
export const nodeCentre = (n: Pick<CMNode, 'x' | 'y'>) => ({ x: n.x + CM_NODE_W / 2, y: n.y + CM_NODE_H / 2 });

/**
 * Adds one variable per construct name, at free spots of the content column in reading order. A name already on the canvas is skipped
 * (case does not matter), whether as a whole label or as the abbreviation of one, such as “PU” in “Perceived usefulness (PU)”.
 * Returns the ids of the elements added.
 */
export function addConstructs(d: ConceptModel, names: readonly string[], makeId: () => string): string[] {
  const key = (s: string) => s.trim().toLowerCase();
  const known = new Set<string>();
  for (const n of d.nodes) { known.add(key(n.label)); const { abbr } = labelParts(n.label); if (abbr) known.add(key(abbr)); }
  const added: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || known.has(key(name))) continue;
    known.add(key(name));
    const id = makeId(), spot = readingOrderSpot(d);
    d.nodes.push({ id, type: 'variable', label: name, x: spot.x, y: spot.y, zone: 'content' });
    added.push(id);
  }
  return added;
}

/** The first free slot of the content column in reading order: rows from the top, each from left to right. */
function readingOrderSpot(d: ConceptModel): { x: number; y: number } {
  const f = frameOf(d), xs = [...zoneSlots('content', f)].sort((a, b) => a - b), gap = 8;
  const free = (x: number, y: number) => !d.nodes.some((n) => n.x < x + CM_NODE_W + gap && x < n.x + CM_NODE_W + gap && n.y < y + CM_NODE_H + gap && y < n.y + CM_NODE_H + gap);
  for (let row = 0; row < 400; row++) {
    const y = f.middleTop + CM_LAYOUT.padTop + row * CM_LAYOUT.rowPitch;
    for (const x of xs) if (free(x, y)) return { x, y };
  }
  return freeSpot(d, 'content');
}
