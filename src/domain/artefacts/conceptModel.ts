import { mdCell, mdLine, mdText, NOT_SPECIFIED } from '../../exports/mdText';
import type { MapNode, ProjectDoc } from '../passport/schema';
import { isId, isNum, isObj, items, oneOf, own, sameData, text, type Warn } from './clean';
import type { KindDef } from './kinds';
import type { CMEdge, CMEdgeKind, CMNode, CMNodeType, CMZone, ConceptModel } from './types';

/**
 * The conceptual model artefact (docs/TOOLBOX-SPEC.md §2 and §5). Besides the kind definition, this file holds
 * everything about the model that does not need React: the layout of the “Parts of a conceptual model” frame,
 * the zone rule, the look of each element and connection, edge geometry and the standalone SVG picture.
 * The canvas in src/features/toolbox/concept draws from the same constants, so the picture and the canvas agree.
 */

export const CM_NODE_TYPES: readonly CMNodeType[] = ['actor', 'entity', 'resource', 'activity', 'stock', 'variable', 'lever', 'outcome', 'external', 'note'];
export const CM_NODE_LABELS: Record<CMNodeType, string> = {
  actor: 'Actor', entity: 'Entity', resource: 'Resource', activity: 'Activity', stock: 'Queue or stock',
  variable: 'Variable', lever: 'Lever', outcome: 'Outcome', external: 'External influence', note: 'Note',
};
/** A few words on what each element is for. */
export const CM_NODE_HINTS: Record<CMNodeType, string> = {
  actor: 'Someone who decides or acts', entity: 'A thing that moves through', resource: 'Something used and shared',
  activity: 'A step that takes time', stock: 'Where things pile up', variable: 'A quantity that changes',
  lever: 'What you can change', outcome: 'What you judge', external: 'Pushes in from outside', note: 'A remark',
};
export const CM_ZONES: readonly CMZone[] = ['inputs', 'content', 'outputs', 'outside'];
export const CM_ZONE_LABELS: Record<CMZone, string> = { inputs: 'Inputs', content: 'Content', outputs: 'Outputs', outside: 'Outside the boundary' };
export const CM_ZONE_HINTS: Record<CMZone, string> = { inputs: 'what you change', content: 'scope and detail', outputs: 'what you judge', outside: 'what you leave out' };
export const CM_EDGE_KINDS: readonly CMEdgeKind[] = ['flow', 'influence', 'information', 'decides'];
export const CM_EDGE_LABELS: Record<CMEdgeKind, string> = { flow: 'flow', influence: 'influence', information: 'information', decides: 'decides' };
export const CM_EDGE_HINTS: Record<CMEdgeKind, string> = { flow: 'things move along it', influence: 'one changes the other', information: 'is seen or measured', decides: 'chooses or sets' };
/** Longest label of an element; connection labels are shorter still. */
export const CM_LABEL_MAX = 500;
export const CM_EDGE_LABEL_MAX = 200;
/** Where a new element of each type goes when it is added without a position. */
export const CM_HOME_ZONE: Record<CMNodeType, CMZone> = {
  actor: 'content', entity: 'content', resource: 'content', activity: 'content', stock: 'content',
  variable: 'content', lever: 'inputs', outcome: 'outputs', external: 'outside', note: 'content',
};

const empty = (): ConceptModel => ({ objectives: '', assumptions: '', simplifications: '', nodes: [], edges: [] });

function sanitize(raw: unknown, warn: Warn): ConceptModel | null {
  if (!isObj(raw)) return null;
  const rawNodes = items(own(raw, 'nodes'), 'nodes', warn), rawEdges = items(own(raw, 'edges'), 'edges', warn);
  if (!rawNodes || !rawEdges) return null;
  const nodes: CMNode[] = [], ids = new Set<string>();
  rawNodes.forEach((n, i) => {
    const id = isObj(n) ? own(n, 'id') : undefined;
    const type = isObj(n) ? CM_NODE_TYPES.find((t) => t === own(n, 'type')) : undefined;
    if (!isObj(n) || !isId(id) || ids.has(id) || !type) { warn(`nodes[${i}]: not a valid element; left out.`); return; }
    const x = own(n, 'x'), y = own(n, 'y');
    if (!isNum(x) || !isNum(y)) warn(`nodes[${i}]: position reset.`);
    // A position far off any sensible canvas is brought back: it would only make the picture unreadable.
    else if (Math.abs(x) > POSITION_LIMIT || Math.abs(y) > POSITION_LIMIT) warn(`nodes[${i}]: position brought back onto the canvas.`);
    ids.add(id);
    const px = isNum(x) ? clamp(x, -POSITION_LIMIT, POSITION_LIMIT) : 0, py = isNum(y) ? clamp(y, -POSITION_LIMIT, POSITION_LIMIT) : 0;
    // A missing or unknown zone is taken from the position. A stored zone is kept: it is what the author chose,
    // and saved models (the worked example among them) were drawn on other layouts than today's frame.
    const zone = oneOf(own(n, 'zone'), CM_ZONES, zoneAt(px + CM_NODE_W / 2, py + CM_NODE_H / 2, CM_LAYOUT), `nodes[${i}].zone`, warn);
    nodes.push({ id, type, label: text(own(n, 'label'), `nodes[${i}].label`, warn, CM_LABEL_MAX), x: px, y: py, zone });
  });
  const edges: CMEdge[] = [], edgeIds = new Set<string>(), pairs = new Set<string>();
  rawEdges.forEach((e, i) => {
    const id = isObj(e) ? own(e, 'id') : undefined, from = isObj(e) ? own(e, 'from') : undefined, to = isObj(e) ? own(e, 'to') : undefined;
    const kind = isObj(e) ? CM_EDGE_KINDS.find((k) => k === own(e, 'kind')) : undefined;
    if (!isObj(e) || !isId(id) || edgeIds.has(id) || !kind || !isId(from) || !isId(to) || !ids.has(from) || !ids.has(to)) { warn(`edges[${i}]: not a valid connection; left out.`); return; }
    // The same rules as drawing: no connection from an element to itself, and one of each kind per direction.
    if (from === to) { warn(`edges[${i}]: joins an element to itself; left out.`); return; }
    const pair = `${from}\u0000${to}\u0000${kind}`;
    if (pairs.has(pair)) { warn(`edges[${i}]: the same connection again; left out.`); return; }
    pairs.add(pair);
    edgeIds.add(id);
    const sign = oneOf(own(e, 'sign'), ['', '+', '-'] as const, '', `edges[${i}].sign`, warn);
    edges.push({ id, from, to, kind, sign: kind === 'influence' ? sign : '', label: text(own(e, 'label'), `edges[${i}].label`, warn, CM_EDGE_LABEL_MAX) });
  });
  return {
    objectives: text(own(raw, 'objectives'), 'objectives', warn),
    assumptions: text(own(raw, 'assumptions'), 'assumptions', warn),
    simplifications: text(own(raw, 'simplifications'), 'simplifications', warn),
    nodes, edges,
  };
}

const names = (nodes: CMNode[]) => nodes.map((n) => n.label.trim()).filter(Boolean);
const short = (list: string[], max = 4) => (list.length > max ? `${list.slice(0, max).join(', ')} and ${list.length - max} more` : list.join(', '));
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const cut = (s: string, max: number) => { const t = mdLine(s); return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t; };
const SIGN_TEXT = { '': '', '+': '+', '-': '−' } as const;

/** What a connection is called when it has no label of its own. */
export const edgeName = (e: CMEdge): string => e.label.trim() || (e.kind === 'influence' && e.sign ? `influence ${e.sign === '+' ? '+' : '−'}` : CM_EDGE_LABELS[e.kind]);
/** Kind, sign and label of a connection in words, for lists and the report: “influence +: speeds up”. */
export function connectionText(e: CMEdge): string {
  const kind = `${CM_EDGE_LABELS[e.kind]}${e.kind === 'influence' && e.sign ? ` ${SIGN_TEXT[e.sign]}` : ''}`;
  const label = mdLine(e.label);
  return label ? `${kind}: ${label}` : kind;
}

/**
 * The lists the project shows at step 2: levers, outcomes, and what was left outside the boundary.
 * Notes are remarks, not parts of the model, so they are never listed.
 */
export function conceptLists(d: ConceptModel): { levers: string[]; outcomes: string[]; excluded: string[] } {
  return {
    levers: names(d.nodes.filter((n) => n.type === 'lever')),
    outcomes: names(d.nodes.filter((n) => n.type === 'outcome')),
    excluded: names(d.nodes.filter((n) => n.zone === 'outside' && n.type !== 'note')),
  };
}

function summary(d: ConceptModel): string[] {
  const things = d.nodes.filter((n) => n.type !== 'note');
  if (!things.length && !d.objectives.trim()) return ['Nothing drawn yet.'];
  const L = [`${count(things.length, 'element')}, ${count(d.edges.length, 'connection')}`];
  const { levers, outcomes, excluded } = conceptLists(d);
  if (d.objectives.trim()) L.push(`Aim: ${cut(d.objectives, 90)}`);
  if (levers.length) L.push(`Levers: ${short(levers)}`);
  if (outcomes.length) L.push(`Outcomes: ${short(outcomes)}`);
  if (excluded.length) L.push(`Left out: ${short(excluded)}`);
  return L.slice(0, 5);
}

/** Report section: the three texts, the elements by zone, the connections, then levers, outcomes and what is left out. */
function markdown(d: ConceptModel): string[] {
  const L = [`- **Objectives:** ${mdText(d.objectives)}`, `- **Assumptions:** ${mdText(d.assumptions)}`, `- **Simplifications:** ${mdText(d.simplifications)}`, ''];
  const things = d.nodes.filter((n) => n.type !== 'note');
  if (!things.length) L.push(`Elements: _${NOT_SPECIFIED}_`, '');
  else {
    L.push('| Where | Element | Type |', '| --- | --- | --- |');
    for (const zone of CM_ZONES) things.filter((n) => n.zone === zone).forEach((n) => L.push(`| ${CM_ZONE_LABELS[zone]} | ${mdCell(n.label, 'Unnamed')} | ${CM_NODE_LABELS[n.type]} |`));
    L.push('');
  }
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const label = (id: string) => byId.get(id)?.label ?? '';
  if (d.edges.length) {
    L.push('| From | Connection | To |', '| --- | --- | --- |');
    d.edges.forEach((e) => L.push(`| ${mdCell(label(e.from), 'Unnamed')} | ${mdCell(connectionText(e))} | ${mdCell(label(e.to), 'Unnamed')} |`));
    L.push('');
  }
  const { levers, outcomes, excluded } = conceptLists(d);
  const list = (xs: string[]) => (xs.length ? xs.map(mdLine).join(', ') : `_${NOT_SPECIFIED}_`);
  if (things.length) L.push(`- **Levers:** ${list(levers)}`, `- **Outcomes:** ${list(outcomes)}`, `- **Left out:** ${excluded.length ? list(excluded) : '_Nothing placed outside the boundary_'}`);
  const notes = d.nodes.filter((n) => n.type === 'note' && n.label.trim());
  notes.forEach((n) => L.push(`- **Note:** ${mdText(n.label)}`));
  if (things.length || notes.length) L.push('');
  return L;
}

const LEGACY_TYPE: Record<CMNodeType, MapNode['type'] | null> = {
  actor: 'stakeholder', variable: 'variable', lever: 'variable', outcome: 'variable', stock: 'variable',
  entity: 'entity', resource: 'entity', activity: 'entity', external: 'entity', note: null,
};

function applyToProject(doc: ProjectDoc, d: ConceptModel): void {
  const rep = doc.passport.representation;
  const kept = d.nodes.filter((n) => LEGACY_TYPE[n.type] !== null);
  const ids = new Set(kept.map((n) => n.id));
  rep.nodes = kept.map((n) => ({ id: n.id, type: LEGACY_TYPE[n.type]!, label: n.label, x: n.x, y: n.y }));
  rep.relations = d.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ id: e.id, from: e.from, to: e.to, label: edgeName(e), directed: true }));
  if (!rep.notes.trim()) {
    rep.notes = [['Objectives', d.objectives], ['Assumptions', d.assumptions], ['Simplifications', d.simplifications]]
      .filter(([, value]) => value.trim()).map(([name, value]) => `${name}: ${value.trim()}`).join('\n');
  }
}

// ── Layout of the frame: the “Parts of a conceptual model” diagram ─────────

/** Size of an element on the canvas and in the picture. */
export const CM_NODE_W = 140;
export const CM_NODE_H = 56;
const POSITION_LIMIT = 100_000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Objectives across the top; inputs, content and outputs across the middle; assumptions and simplifications below;
 * and, to the right, an area for what is left outside the boundary. The middle band grows downwards when the
 * elements inside the boundary need more room.
 */
export const CM_LAYOUT = {
  width: 900,
  head: 88,
  foot: 112,
  middle: 420,
  /** x of the borders between inputs | content | outputs. */
  columns: [0, 180, 720, 900] as const,
  gap: 24,
  outsideWidth: 172,
  pad: 14,
  /** Room above the first row for the column headings. */
  padTop: 38,
  rowPitch: 76,
} as const;

export interface CMRect { x: number; y: number; w: number; h: number }
export interface CMFrame {
  width: number; height: number;
  /** Top and bottom of the middle band, where elements live. */
  middleTop: number; middleBottom: number;
  columns: readonly [number, number, number, number];
  outside: CMRect;
}

/** The frame for a model: its height follows the lowest element inside the boundary. */
export function frameOf(d: Pick<ConceptModel, 'nodes'>): CMFrame {
  const L = CM_LAYOUT;
  let bottom = L.head + L.middle, outsideBottom = 0;
  for (const n of d.nodes) {
    if (n.zone === 'outside') outsideBottom = Math.max(outsideBottom, n.y + CM_NODE_H + L.pad);
    else bottom = Math.max(bottom, Math.min(n.y, POSITION_LIMIT) + CM_NODE_H + L.pad);
  }
  const height = bottom + L.foot;
  return {
    width: L.width, height, middleTop: L.head, middleBottom: bottom, columns: L.columns,
    outside: { x: L.width + L.gap, y: 0, w: L.outsideWidth, h: Math.max(height, outsideBottom) },
  };
}

/**
 * The zone at a point. Only what lies to the right of the frame is outside the boundary; everywhere else the column
 * under the point decides, so the zone depends on x alone and never changes when the frame grows or shrinks.
 */
export function zoneAt(x: number, _y: number, f: Pick<CMFrame, 'width' | 'columns'>): CMZone {
  if (x > f.width) return 'outside';
  if (x < f.columns[1]) return 'inputs';
  if (x < f.columns[2]) return 'content';
  return 'outputs';
}

/** The left edges an element may have in a zone: wholly inside its column, or wholly right of the frame. */
export function zoneXRange(zone: CMZone, f: Pick<CMFrame, 'columns' | 'outside'>): [number, number] {
  if (zone === 'outside') return [f.outside.x, POSITION_LIMIT];
  const i = zone === 'inputs' ? 0 : zone === 'content' ? 1 : 2;
  const lo = f.columns[i];
  return [lo, Math.max(lo, f.columns[i + 1] - CM_NODE_W)];
}

/** Left and right border of a zone (the outside area has no right border). */
export function zoneEdges(zone: CMZone, f: Pick<CMFrame, 'width' | 'columns'>): [number, number | null] {
  if (zone === 'outside') return [f.width, null];
  const i = zone === 'inputs' ? 0 : zone === 'content' ? 1 : 2;
  return [f.columns[i], f.columns[i + 1]];
}

/**
 * Where an element dropped with its top-left corner at (x, y) ends up, and in which zone. Its centre decides the zone.
 * It is then kept wholly inside that zone: inside the boundary within its column and the middle band, so it never
 * covers the objectives, the assumptions or a neighbouring column; outside, to the right of the frame.
 */
export function placeNode(x: number, y: number, f: CMFrame): { x: number; y: number; zone: CMZone } {
  const zone = zoneAt(x + CM_NODE_W / 2, y + CM_NODE_H / 2, f);
  const [xlo, xhi] = zoneXRange(zone, f);
  const px = Math.round(clamp(x, xlo, xhi));
  if (zone === 'outside') return { x: px, y: Math.round(clamp(y, 0, POSITION_LIMIT)), zone };
  const lo = f.middleTop + CM_LAYOUT.padTop, hi = Math.max(lo, f.middleBottom - CM_LAYOUT.pad - CM_NODE_H);
  return { x: px, y: Math.round(clamp(y, lo, hi)), zone };
}

/** The x of each slot column of a zone, best first. */
export function zoneSlots(zone: CMZone, f: CMFrame): number[] {
  const [, a, b, c] = f.columns;
  const mid = (lo: number, hi: number) => Math.round(lo + (hi - lo - CM_NODE_W) / 2);
  if (zone === 'inputs') return [mid(0, a)];
  if (zone === 'outputs') return [mid(b, c)];
  if (zone === 'outside') return [mid(f.outside.x, f.outside.x + f.outside.w)];
  const pitch = Math.round((b - a) / 3);
  return [mid(a + pitch, a + 2 * pitch), mid(a, a + pitch), mid(a + 2 * pitch, b)];
}

const overlaps = (a: CMRect, b: CMRect, margin = 8) => a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
export const nodeRect = (n: Pick<CMNode, 'x' | 'y'>): CMRect => ({ x: n.x, y: n.y, w: CM_NODE_W, h: CM_NODE_H });

/** The first free slot of a zone; a new row below the others when every slot is taken. */
export function freeSpot(d: Pick<ConceptModel, 'nodes'>, zone: CMZone): { x: number; y: number } {
  const f = frameOf(d), xs = zoneSlots(zone, f), rects = d.nodes.map(nodeRect);
  const top = f.middleTop + CM_LAYOUT.padTop;
  for (let row = 0; row < 400; row++) {
    const y = top + row * CM_LAYOUT.rowPitch;
    for (const x of xs) if (!rects.some((r) => overlaps(r, { x, y, w: CM_NODE_W, h: CM_NODE_H }))) return { x, y };
  }
  return { x: xs[0], y: top };
}

// ── Look of elements and connections (CSS variables with fallbacks) ─────────

export interface CMTone { line: string; soft: string }
const tone = (name: string, line: string, softName: string, soft: string): CMTone => ({ line: `var(--${name}, ${line})`, soft: `var(--${softName}, ${soft})` });
export const CM_NODE_TONE: Record<CMNodeType, CMTone> = {
  actor: tone('fam-emergence', '#7c4ddb', 'fam-emergence-soft', '#efe8fb'),
  entity: tone('fam-relationships', '#3b6fe0', 'fam-relationships-soft', '#e7eefc'),
  resource: tone('fam-processes', '#a65a2e', 'fam-processes-soft', '#f7ebe3'),
  activity: tone('accent', '#d9822b', 'accent-soft', '#fbeedd'),
  stock: tone('primary', '#1f5f8b', 'primary-soft', '#e3eef7'),
  variable: tone('info', '#5a6779', 'info-soft', '#eef1f5'),
  lever: tone('success', '#2f855a', 'success-soft', '#e3f4ea'),
  outcome: tone('fam-uncertainty', '#2e8f7a', 'fam-uncertainty-soft', '#e2f3ef'),
  external: tone('text-subtle', '#6b7787', 'bg-subtle', '#eef1f5'),
  note: tone('warning', '#b7791f', 'warning-soft', '#fdf3dc'),
};

/** Glyphs on a 24 × 24 grid, drawn with a round 2-unit stroke and no fill. */
export const CM_GLYPHS: Record<CMNodeType, string> = {
  actor: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 21a7.5 7.5 0 0 1 15 0',
  entity: 'M12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z M3.5 7.5 12 12l8.5-4.5 M12 12v9',
  resource: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z',
  activity: 'M5 6l6 6-6 6 M13 6l6 6-6 6',
  stock: 'M5 6c0-1.66 3.13-3 7-3s7 1.34 7 3v12c0 1.66-3.13 3-7 3s-7-1.34-7-3Z M5 6c0 1.66 3.13 3 7 3s7-1.34 7-3 M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3',
  variable: 'M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0',
  lever: 'M5 20h14 M12 20l3.6-10.2 M16.5 7.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  outcome: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  external: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
  note: 'M5 3h14v12l-6 6H5Z M13 21v-6h6',
};

export type CMMarker = 'arrow' | 'chevron' | 'diamond';
export interface CMEdgeLook { stroke: string; width: number; dash: string; marker: CMMarker }
/** Distinct by weight, dash pattern and arrow head, so the kinds stay apart without colour. */
export const CM_EDGE_LOOK: Record<CMEdgeKind, CMEdgeLook> = {
  flow: { stroke: 'var(--model-stroke, #22242a)', width: 3.4, dash: '', marker: 'arrow' },
  influence: { stroke: 'var(--primary, #1f5f8b)', width: 2, dash: '', marker: 'arrow' },
  information: { stroke: 'var(--text-muted, #4b5867)', width: 1.6, dash: '6 5', marker: 'chevron' },
  decides: { stroke: 'var(--fam-emergence, #7c4ddb)', width: 2.2, dash: '1 5', marker: 'diamond' },
};
/** Arrow heads on a 12 × 12 box; the tip sits at x = 11. */
export const CM_MARKER_PATH: Record<CMMarker, string> = {
  arrow: 'M1 1.5 11 6 1 10.5Z',
  chevron: 'M2 1.5 11 6 2 10.5',
  diamond: 'M1 6 6 1.5 11 6 6 10.5Z',
};

// ── Edge geometry (shared by the canvas and the picture) ──────────────────

interface XY { x: number; y: number }
const centre = (r: CMRect): XY => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Where a ray from the centre of a rectangle in direction (dx, dy) leaves it. */
function outline(r: CMRect, dx: number, dy: number): XY {
  const c = centre(r), len = Math.hypot(dx, dy);
  if (!len || (!r.w && !r.h)) return c;
  const ux = dx / len, uy = dy / len;
  const tx = ux ? r.w / 2 / Math.abs(ux) : Infinity, ty = uy ? r.h / 2 / Math.abs(uy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: c.x + ux * t, y: c.y + uy * t };
}

export interface CMEdgePath { path: string; labelX: number; labelY: number; signX: number; signY: number; start: XY; end: XY; /** Control point of the curve (the middle of a straight line). */ control: XY }

/**
 * A connection from one rectangle to another, from outline to outline. `bend` bows it sideways (pixels at the middle),
 * so two connections between the same pair stay apart. The end stops just short of the outline for the arrow head.
 */
export function edgePath(a: CMRect, b: CMRect, bend = 0, gap = 2): CMEdgePath {
  const ca = centre(a), cb = centre(b);
  const dx = cb.x - ca.x, dy = cb.y - ca.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const cx = (ca.x + cb.x) / 2 + px * bend * 2, cy = (ca.y + cb.y) / 2 + py * bend * 2;
  const start = bend ? outline(a, cx - ca.x, cy - ca.y) : outline(a, dx, dy);
  const rawEnd = bend ? outline(b, cx - cb.x, cy - cb.y) : outline(b, -dx, -dy);
  // Pull the end back along its tangent, so the arrow tip lands on the outline rather than inside it.
  const tx = rawEnd.x - (bend ? cx : start.x), ty = rawEnd.y - (bend ? cy : start.y), tl = Math.hypot(tx, ty) || 1;
  const end = { x: rawEnd.x - (tx / tl) * gap, y: rawEnd.y - (ty / tl) * gap };
  const r = (v: number) => Math.round(v * 10) / 10;
  const at = (t: number): XY => (bend
    ? { x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * cx + t * t * end.x, y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * cy + t * t * end.y }
    : { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  // The sign sits beside the arrow head, as polarity usually does; on a short connection, beside its middle.
  const short = Math.hypot(end.x - start.x, end.y - start.y) < 120;
  const mid = at(0.5), near = at(short ? 0.5 : 0.76), off = short ? 17 : 14;
  const path = bend ? `M${r(start.x)} ${r(start.y)} Q${r(cx)} ${r(cy)} ${r(end.x)} ${r(end.y)}` : `M${r(start.x)} ${r(start.y)} L${r(end.x)} ${r(end.y)}`;
  return { path, labelX: mid.x, labelY: mid.y, signX: near.x + px * off, signY: near.y + py * off, start, end, control: bend ? { x: cx, y: cy } : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } };
}

/** Sideways bend of each connection: 0 when it is alone, fanned out when several join the same pair. */
export function edgeBends(edges: readonly Pick<CMEdge, 'id' | 'from' | 'to'>[], spacing = 30): Map<string, number> {
  const groups = new Map<string, Pick<CMEdge, 'id' | 'from' | 'to'>[]>();
  for (const e of edges) {
    const key = e.from < e.to ? `${e.from}\u0000${e.to}` : `${e.to}\u0000${e.from}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const out = new Map<string, number>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    sorted.forEach((e, i) => {
      const lane = sorted.length === 1 ? 0 : i - (sorted.length - 1) / 2;
      // Measured in the direction from the smaller id to the larger, so opposite connections bow apart.
      out.set(e.id, lane * spacing * (e.from < e.to ? 1 : -1));
    });
  }
  return out;
}

/**
 * Bends for drawing: the lanes of `edgeBends`, and a connection that would run underneath another element is bowed
 * round it (the smallest bend that clears, on the side of its lane). Used by the canvas and the picture alike.
 */
export function routeBends(d: { nodes: readonly CMNode[]; edges: readonly Pick<CMEdge, 'id' | 'from' | 'to'>[] }): Map<string, number> {
  const lanes = edgeBends(d.edges);
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const rects = d.nodes.map((n) => ({ id: n.id, r: nodeRect(n) }));
  const out = new Map<string, number>();
  const inside = (p: XY, r: CMRect) => p.x > r.x - 6 && p.x < r.x + r.w + 6 && p.y > r.y - 6 && p.y < r.y + r.h + 6;
  for (const e of d.edges) {
    const base = lanes.get(e.id) ?? 0, a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b || a === b) { out.set(e.id, base); continue; }
    const others = rects.filter((x) => x.id !== a.id && x.id !== b.id).map((x) => x.r);
    const ra = nodeRect(a), rb = nodeRect(b);
    const hits = (bend: number) => {
      const g = edgePath(ra, rb, bend, 0);
      let n = 0;
      for (let i = 1; i < 16; i++) {
        const t = i / 16, p = { x: (1 - t) ** 2 * g.start.x + 2 * (1 - t) * t * g.control.x + t * t * g.end.x, y: (1 - t) ** 2 * g.start.y + 2 * (1 - t) * t * g.control.y + t * t * g.end.y };
        if (others.some((r) => inside(p, r))) n++;
      }
      return n;
    };
    let best = base, fewest = others.length ? hits(base) : 0;
    const side = base < 0 ? -1 : 1;
    for (const step of [36, 64, 96, 132, 172]) {
      if (!fewest) break;
      for (const bend of [base + side * step, base - side * step]) {
        const n = hits(bend);
        if (n < fewest) { best = bend; fewest = n; }
        if (!n) break;
      }
    }
    out.set(e.id, best);
  }
  return out;
}

// ── The picture ───────────────────────────────────────────────────────────

/**
 * Text for the picture. Besides the markup characters, `=`, `:`, `@` and `(` become character references, so no user
 * text can look like an event attribute, a script address, an import or a url to the safety check of the picture.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  .replace(/=/g, '&#61;').replace(/:/g, '&#58;').replace(/@/g, '&#64;').replace(/\(/g, '&#40;');
const FONT = "Inter, 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const C = {
  bg: 'var(--canvas-bg, #ffffff)', frame: 'var(--bg-elevated, #ffffff)', band: 'var(--bg-subtle, #eef1f5)', line: 'var(--border-strong, #b7c1cf)',
  soft: 'var(--border, #d6dce5)', text: 'var(--model-label, #22242a)', muted: 'var(--text-muted, #4b5867)', fill: 'var(--model-fill, #ffffff)',
};

/** Up to `lines` lines of at most `max` characters; text that does not fit ends with an ellipsis. */
export function wrapText(value: string, max: number, lines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length && out.length < lines) {
    let line = words[i++];
    while (i < words.length && `${line} ${words[i]}`.length <= max) line += ` ${words[i++]}`;
    out.push(line);
  }
  const ellipsis = (l: string) => {
    const room = Math.max(1, max - 1);
    if (l.length <= room) return `${l}…`;
    // Cut at a word when that keeps most of the line; otherwise mid-word.
    const space = l.lastIndexOf(' ', room);
    return `${(space >= room / 2 ? l.slice(0, space) : l.slice(0, room)).trimEnd()}…`;
  };
  return out.map((l, k) => (l.length > max || (k === out.length - 1 && i < words.length) ? ellipsis(l) : l));
}

/** A djb2 hash, so the ids inside one picture never collide with those of another picture on the same page. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function textBlock(x: number, y: number, lines: string[], size: number, fill: string, weight = 400, lh = size * 1.35, anchor = 'start'): string {
  if (!lines.length) return '';
  const spans = lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join('');
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" style="fill:${fill}">${spans}</text>`;
}

function nodeSvg(n: CMNode): string {
  const t = CM_NODE_TONE[n.type], W = CM_NODE_W, H = CM_NODE_H;
  const rx = n.type === 'actor' ? H / 2 : n.type === 'stock' ? 3 : n.type === 'note' ? 2 : 12;
  const fill = n.type === 'note' ? t.soft : n.type === 'external' ? C.band : C.fill;
  const strokeW = n.type === 'stock' ? 3 : 2;
  const dash = n.type === 'external' ? ';stroke-dasharray:6 4' : '';
  const parts = [`<g transform="translate(${n.x} ${n.y})">`];
  if (n.type === 'outcome') parts.push(`<rect x="-4" y="-4" width="${W + 8}" height="${H + 8}" rx="${rx + 4}" style="fill:none;stroke:${t.line};stroke-width:1.5"/>`);
  parts.push(`<rect width="${W}" height="${H}" rx="${rx}" style="fill:${fill};stroke:${n.type === 'note' ? 'none' : t.line};stroke-width:${strokeW}${dash}"/>`);
  if (n.type === 'lever') parts.push(`<rect x="0" y="6" width="5" height="${H - 12}" rx="2.5" style="fill:${t.line}"/>`);
  if (n.type === 'note') parts.push(`<path d="M${W - 14} ${H}v-14h14" style="fill:none;stroke:${t.line};stroke-width:1.5"/>`);
  parts.push(`<circle cx="${n.type === 'actor' ? 26 : 25}" cy="${H / 2}" r="15" style="fill:${n.type === 'note' ? C.fill : t.soft}"/>`);
  parts.push(`<path d="${CM_GLYPHS[n.type]}" transform="translate(${n.type === 'actor' ? 17 : 16} ${H / 2 - 9}) scale(.75)" style="fill:none;stroke:${t.line};stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"/>`);
  const lines = wrapText(n.label || 'Unnamed', 12, 3);
  const y0 = H / 2 + 4.2 - ((lines.length - 1) * 14) / 2;
  parts.push(textBlock(47, y0, lines, 12.5, n.label.trim() ? C.text : C.muted, 600, 14));
  parts.push('</g>');
  return parts.join('');
}

function edgeSvg(e: CMEdge, a: CMNode, b: CMNode, bend: number, id: string): string {
  const look = CM_EDGE_LOOK[e.kind];
  const g = edgePath(nodeRect(a), nodeRect(b), bend, 2);
  const dash = look.dash ? `;stroke-dasharray:${look.dash}` : '';
  const cap = e.kind === 'decides' ? ';stroke-linecap:round' : '';
  const parts = [`<path d="${g.path}" marker-end="url(#${id}-${e.kind})" style="fill:none;stroke:${look.stroke};stroke-width:${look.width}${dash}${cap}"/>`];
  if (e.kind === 'influence' && e.sign) {
    parts.push(`<circle cx="${g.signX.toFixed(1)}" cy="${g.signY.toFixed(1)}" r="9" style="fill:${C.fill};stroke:${look.stroke};stroke-width:1.5"/>`);
    parts.push(textBlock(Number(g.signX.toFixed(1)), Number((g.signY + 4.5).toFixed(1)), [SIGN_TEXT[e.sign]], 14, look.stroke, 700, 14, 'middle'));
  }
  const label = wrapText(e.label, 26, 1)[0];
  if (label) {
    const w = Math.round(label.length * 6.2 + 12);
    parts.push(`<rect x="${(g.labelX - w / 2).toFixed(1)}" y="${(g.labelY - 10).toFixed(1)}" width="${w}" height="20" rx="10" style="fill:${C.fill};stroke:${C.soft}"/>`);
    parts.push(textBlock(Number(g.labelX.toFixed(1)), Number((g.labelY + 4).toFixed(1)), [label], 11.5, C.muted, 500, 12, 'middle'));
  }
  return parts.join('');
}

function frameSvg(d: ConceptModel, f: CMFrame, showOutside: boolean): string {
  const [, a, b, c] = f.columns, P = 18;
  const head = CM_LAYOUT.head, footTop = f.middleBottom;
  const half = f.width / 2;
  const parts = [
    `<rect x="0" y="0" width="${f.width}" height="${f.height}" rx="18" style="fill:${C.frame};stroke:${C.line};stroke-width:1.5"/>`,
    `<path d="M0 ${head}H${f.width} M0 ${footTop}H${f.width}" style="fill:none;stroke:${C.soft};stroke-width:1.5"/>`,
    `<path d="M${a} ${head}V${footTop} M${b} ${head}V${footTop} M${half} ${footTop}V${f.height}" style="fill:none;stroke:${C.soft};stroke-width:1.5;stroke-dasharray:5 6"/>`,
    textBlock(P, 30, ['Objectives'], 13, C.muted, 700),
    textBlock(P, 54, d.objectives.trim() ? wrapText(d.objectives, 112, 2) : ['What must the model answer?'], 14, d.objectives.trim() ? C.text : C.muted, 400, 20),
  ];
  for (const [zone, lo, hi] of [['inputs', 0, a], ['content', a, b], ['outputs', b, c]] as const) {
    parts.push(textBlock((lo + hi) / 2, head + 22, [CM_ZONE_LABELS[zone]], 13, C.muted, 700, 13, 'middle'));
  }
  // Inputs feed the content, the content produces the outputs.
  for (const x of [a, b]) parts.push(`<path d="M${x - 12} ${head + 17}h20m-6-5 6 5-6 5" style="fill:none;stroke:${C.line};stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>`);
  for (const [label, value, x] of [['Assumptions', d.assumptions, 0], ['Simplifications', d.simplifications, half]] as const) {
    parts.push(textBlock(x + P, footTop + 28, [label], 13, C.muted, 700));
    parts.push(textBlock(x + P, footTop + 52, value.trim() ? wrapText(value, 58, 3) : [x ? 'What you leave out of the model' : 'What you believe without checking'], 13, value.trim() ? C.text : C.muted, 400, 19));
  }
  if (showOutside) {
    const o = f.outside;
    parts.push(`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="18" style="fill:none;stroke:${C.line};stroke-width:1.5;stroke-dasharray:8 6"/>`);
    parts.push(textBlock(o.x + o.w / 2, 30, [CM_ZONE_LABELS.outside], 13, C.muted, 700, 13, 'middle'));
  }
  return parts.join('');
}

/**
 * The model as a standalone SVG picture, drawn without React Flow: the frame with its three texts, the elements and
 * the connections. All text is escaped, nothing is loaded from outside, and colours are CSS variables with fallbacks,
 * so the picture follows the theme inside the app and has light colours in a file. `force` draws an empty frame too.
 */
export function conceptFigure(d: ConceptModel, opts: { force?: boolean } = {}): string | null {
  if (!d.nodes.length && !opts.force) return null;
  const f = frameOf(d);
  const showOutside = d.nodes.some((n) => n.zone === 'outside' || n.x + CM_NODE_W / 2 > f.width);
  const M = 24;
  let minX = 0, minY = 0, maxX = showOutside ? f.outside.x + f.outside.w : f.width, maxY = Math.max(f.height, showOutside ? f.outside.h : 0);
  for (const n of d.nodes) { minX = Math.min(minX, n.x - 6); minY = Math.min(minY, n.y - 6); maxX = Math.max(maxX, n.x + CM_NODE_W + 6); maxY = Math.max(maxY, n.y + CM_NODE_H + 6); }
  const vx = Math.floor(minX - M), vy = Math.floor(minY - M), w = Math.ceil(maxX - minX + 2 * M), h = Math.ceil(maxY - minY + 2 * M);
  const id = `cm${hash(JSON.stringify(d))}`;
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const bends = routeBends(d);
  const markers = CM_EDGE_KINDS.map((k) => {
    const look = CM_EDGE_LOOK[k], open = look.marker === 'chevron';
    return `<marker id="${id}-${k}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="${k === 'flow' ? 14 : 12}" markerHeight="${k === 'flow' ? 14 : 12}" markerUnits="userSpaceOnUse" orient="auto">`
      + `<path d="${CM_MARKER_PATH[look.marker]}" style="fill:${open ? 'none' : look.stroke};stroke:${look.stroke};stroke-width:${open ? 1.8 : 1};stroke-linejoin:round;stroke-linecap:round"/></marker>`;
  }).join('');
  const label = `Conceptual model with ${count(d.nodes.length, 'element')} and ${count(d.edges.length, 'connection')}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}" role="img" aria-label="${esc(label)}">`,
    `<title>${esc(label)}</title>`,
    `<defs>${markers}</defs>`,
    `<rect x="${vx}" y="${vy}" width="${w}" height="${h}" style="fill:${C.bg}"/>`,
    frameSvg(d, f, showOutside),
    ...d.edges.map((e) => { const a = byId.get(e.from), b = byId.get(e.to); return a && b && a !== b ? edgeSvg(e, a, b, bends.get(e.id) ?? 0, id) : ''; }),
    ...d.nodes.map(nodeSvg),
    '</svg>',
  ].join('');
}

// ── Relationship models ──────────────────────────────────────────────────

/**
 * A label such as “Perceived usefulness (PU)”, split into its words and its abbreviation; `abbr` is '' when there is none.
 * An abbreviation is a short word in brackets at the end with at least two capitals, so “Queue (waiting)” stays one label.
 */
export function labelParts(label: string): { main: string; abbr: string } {
  const m = label.trim().match(/^(.*\S)\s*\(((?=(?:[^A-Z]*[A-Z]){2})[A-Za-z0-9]{2,10})\)$/);
  return m ? { main: m[1], abbr: m[2] } : { main: label.trim(), abbr: '' };
}

/** Element types that stand for a construct (a measured or latent quantity) in a relationship model. */
const CONSTRUCT_TYPES: ReadonlySet<CMNodeType> = new Set(['variable', 'outcome']);

/** Influence connections between two construct elements: the structural paths of a relationship model. */
function structuralPaths(d: Pick<ConceptModel, 'nodes' | 'edges'>): CMEdge[] {
  const constructs = new Set(d.nodes.filter((n) => CONSTRUCT_TYPES.has(n.type)).map((n) => n.id));
  return d.edges.filter((e) => e.kind === 'influence' && e.from !== e.to && constructs.has(e.from) && constructs.has(e.to));
}

/** True for a relationship model: two or more variable or outcome elements joined by influence connections. */
export const isRelationshipModel = (d: Pick<ConceptModel, 'nodes' | 'edges'>): boolean => structuralPaths(d).length > 0;

/**
 * The largest number of influence arrows into one construct, counting each source once; 0 when there are none.
 * This is the number a sample-size note for a relationship model is based on.
 */
export function maxArrowsIn(d: Pick<ConceptModel, 'nodes' | 'edges'>): number {
  const sources = new Map<string, Set<string>>();
  for (const e of structuralPaths(d)) sources.set(e.to, (sources.get(e.to) ?? new Set()).add(e.from));
  return Math.max(0, ...[...sources.values()].map((s) => s.size));
}

export const conceptModel: KindDef<'concept-model'> = {
  kind: 'concept-model', label: 'Conceptual model', toolPath: '/toolbox/concept', step: 'scope', many: false,
  empty, sanitize, isEmpty: (d) => sameData(d, empty()), summary, markdown, figure: (d) => conceptFigure(d), applyToProject,
};
