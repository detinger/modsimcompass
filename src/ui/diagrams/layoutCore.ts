import type { ELK, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';

/**
 * Node–edge graphs are positioned by elkjs (layered algorithm, orthogonal routing) and drawn at 1:1,
 * so text keeps its real size. A graph is described by sizes and connections only — never by coordinates.
 *
 * The engine runs at build time (scripts/gen-layouts.ts). The app looks layouts up by key, so the engine
 * is never downloaded by a browser. tests/layouts.test.ts fails when the stored layouts are out of date.
 */
export type Dir = 'RIGHT' | 'DOWN';
export type Side = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export interface GNode {
  id: string;
  w: number;
  h: number;
  /** Named connection points with a fixed side; reference them from edges as "node.port". */
  ports?: Record<string, Side>;
  /** A node with children is a container: its size comes from its content plus `pad`. */
  children?: GNode[];
  edges?: GEdge[];
  pad?: { top: number; right: number; bottom: number; left: number };
  dir?: Dir;
}
export interface GEdge { id: string; from: string; to: string; label?: string }
export interface GraphDef { nodes: GNode[]; edges: GEdge[]; spacing?: { layer?: number; node?: number } }

export interface Box { x: number; y: number; w: number; h: number }
export interface EdgeGeo { d: string; /** Full route, for tokens that travel along the edge. */ route: string; head: string; label?: Box & { text: string } }
export interface GraphLayout { dir: Dir; width: number; height: number; nodes: Record<string, Box>; edges: Record<string, EdgeGeo> }
/** What is stored: positions and edge corner points only. Paths and arrowheads are derived by `finishLayout`. */
export interface StoredLayout { dir: Dir; width: number; height: number; nodes: Record<string, Box>; edges: Record<string, { pts: [number, number][]; label?: Box & { text: string } }> }

const options = (dir: Dir, sp: GraphDef['spacing'] = {}): Record<string, string> => ({
  'elk.algorithm': 'layered',
  'elk.direction': dir,
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': String(sp.layer ?? 44),
  'elk.spacing.nodeNode': String(sp.node ?? 22),
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '16',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
  'elk.spacing.edgeLabel': '6',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
});

const LABEL_H = 24;
const labelWidth = (text: string) => Math.ceil(text.length * 7.7 + 18);

function toElkEdge(e: GEdge): ElkExtendedEdge {
  return {
    id: e.id, sources: [e.from], targets: [e.to],
    labels: e.label ? [{ id: `${e.id}:label`, text: e.label, width: labelWidth(e.label), height: LABEL_H, layoutOptions: { 'elk.edgeLabels.inline': 'true' } }] : undefined,
  };
}

function toElkNode(n: GNode, dir: Dir, sp: GraphDef['spacing']): ElkNode {
  const node: ElkNode = { id: n.id, width: n.w, height: n.h };
  const lo: Record<string, string> = {};
  if (n.ports) {
    node.ports = Object.entries(n.ports).map(([key, side]) => ({ id: `${n.id}.${key}`, width: 1, height: 1, layoutOptions: { 'elk.port.side': side } }));
    lo['elk.portConstraints'] = 'FIXED_SIDE';
  }
  if (n.children) {
    const inner = n.dir ?? dir;
    const p = n.pad ?? { top: 12, right: 12, bottom: 12, left: 12 };
    node.children = n.children.map((c) => toElkNode(c, inner, sp));
    node.edges = (n.edges ?? []).map(toElkEdge);
    Object.assign(lo, options(inner, sp), {
      'elk.padding': `[top=${p.top},left=${p.left},bottom=${p.bottom},right=${p.right}]`,
      'elk.nodeSize.constraints': 'MINIMUM_SIZE', 'elk.nodeSize.minimum': `(${n.w},${n.h})`,
    });
  }
  node.layoutOptions = lo;
  return node;
}

type Pt = [number, number];
const HEAD = 9;

/** Orthogonal route with rounded corners; the line stops short of the tip so the arrowhead stays crisp. */
function roundedPath(pts: Pt[], radius: number, trim: number): string {
  const p = pts.map((q) => [...q] as Pt);
  const n = p.length;
  if (trim > 0 && n > 1) {
    const [ax, ay] = p[n - 2], [bx, by] = p[n - 1], len = Math.hypot(bx - ax, by - ay) || 1;
    const t = Math.min(trim, len - 1);
    p[n - 1] = [bx - ((bx - ax) / len) * t, by - ((by - ay) / len) * t];
  }
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < n - 1; i++) {
    const [px, py] = p[i - 1], [x, y] = p[i], [nx, ny] = p[i + 1];
    const d1 = Math.hypot(x - px, y - py) || 1, d2 = Math.hypot(nx - x, ny - y) || 1;
    const r = Math.min(radius, d1 / 2, d2 / 2);
    d += ` L${(x - ((x - px) / d1) * r).toFixed(1)},${(y - ((y - py) / d1) * r).toFixed(1)} Q${x},${y} ${(x + ((nx - x) / d2) * r).toFixed(1)},${(y + ((ny - y) / d2) * r).toFixed(1)}`;
  }
  return `${d} L${p[n - 1][0].toFixed(1)},${p[n - 1][1].toFixed(1)}`;
}

function arrowHead(pts: Pt[]): string {
  const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1], len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len, uy = (by - ay) / len;
  const cx = bx - ux * HEAD, cy = by - uy * HEAD;
  return `${bx},${by} ${(cx - uy * 5).toFixed(1)},${(cy + ux * 5).toFixed(1)} ${(cx + uy * 5).toFixed(1)},${(cy - ux * 5).toFixed(1)}`;
}

/** Runs the layout engine. Only the build-time generator and the tests call this; the app reads stored layouts. */
export async function computeLayout(elk: ELK, def: GraphDef, dir: Dir): Promise<StoredLayout> {
  const root: ElkNode = {
    id: 'root',
    layoutOptions: { ...options(dir, def.spacing), 'elk.padding': '[top=4,left=4,bottom=4,right=4]' },
    children: def.nodes.map((n) => toElkNode(n, dir, def.spacing)),
    edges: def.edges.map(toElkEdge),
  };
  const res = await elk.layout(root);
  const nodes: Record<string, Box> = {};
  const edges: StoredLayout['edges'] = {};
  const visit = (n: ElkNode, ox: number, oy: number) => {
    for (const e of (n.edges ?? []) as ElkExtendedEdge[]) {
      const s = e.sections?.[0];
      if (!s) continue;
      const pts: Pt[] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((q) => [Math.round(q.x + ox), Math.round(q.y + oy)]);
      const l = e.labels?.[0];
      edges[e.id] = { pts, ...(l?.text ? { label: { text: l.text, x: (l.x ?? 0) + ox, y: (l.y ?? 0) + oy, w: l.width ?? 0, h: l.height ?? 0 } } : {}) };
    }
    for (const c of n.children ?? []) {
      const x = ox + (c.x ?? 0), y = oy + (c.y ?? 0);
      nodes[c.id] = { x, y, w: c.width ?? 0, h: c.height ?? 0 };
      visit(c, x, y);
    }
  };
  visit(res, 0, 0);
  return { dir, width: Math.ceil(res.width ?? 0), height: Math.ceil(res.height ?? 0), nodes, edges };
}

/** Turns stored corner points into drawable paths and arrowheads. */
export function finishLayout(stored: StoredLayout): GraphLayout {
  const edges: Record<string, EdgeGeo> = {};
  for (const [id, e] of Object.entries(stored.edges)) edges[id] = { d: roundedPath(e.pts, 12, HEAD - 2), route: roundedPath(e.pts, 12, 0), head: arrowHead(e.pts), label: e.label };
  return { dir: stored.dir, width: stored.width, height: stored.height, nodes: stored.nodes, edges };
}

/** Widths are snapped to this grid so that a finite set of layouts covers every screen. */
export const WIDTH_STEP = 16, WIDTH_MIN = 160, WIDTH_MAX = 1408;
export const snapWidth = (width: number) => Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, Math.floor(width / WIDTH_STEP) * WIDTH_STEP));

/** Short stable key for one graph description in one direction (cyrb53 of its JSON). */
export function layoutKey(def: GraphDef, dir: Dir): string {
  const text = dir + JSON.stringify(def);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
