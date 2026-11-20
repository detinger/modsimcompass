import { useEffect, useState, type ReactNode } from 'react';
import type { ELK, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';

/**
 * Node–edge graphs are positioned by elkjs (layered algorithm, orthogonal routing) and drawn here at 1:1,
 * so text keeps its real size. A graph is described by sizes and connections only — never by coordinates.
 * When the left-to-right layout is wider than the card, the same graph is laid out top-to-bottom instead.
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

let elkPromise: Promise<ELK> | null = null;
const getElk = () => (elkPromise ??= import('elkjs/lib/elk.bundled.js').then((m) => new m.default()));

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

async function runLayout(def: GraphDef, dir: Dir): Promise<GraphLayout> {
  const elk = await getElk();
  const root: ElkNode = {
    id: 'root',
    layoutOptions: { ...options(dir, def.spacing), 'elk.padding': '[top=4,left=4,bottom=4,right=4]' },
    children: def.nodes.map((n) => toElkNode(n, dir, def.spacing)),
    edges: def.edges.map(toElkEdge),
  };
  const res = await elk.layout(root);
  const nodes: Record<string, Box> = {};
  const edges: Record<string, EdgeGeo> = {};
  const visit = (n: ElkNode, ox: number, oy: number) => {
    for (const e of (n.edges ?? []) as ElkExtendedEdge[]) {
      const s = e.sections?.[0];
      if (!s) continue;
      const pts: Pt[] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map((q) => [Math.round(q.x + ox), Math.round(q.y + oy)]);
      const l = e.labels?.[0];
      edges[e.id] = {
        d: roundedPath(pts, 12, HEAD - 2), route: roundedPath(pts, 12, 0), head: arrowHead(pts),
        label: l?.text ? { text: l.text, x: (l.x ?? 0) + ox, y: (l.y ?? 0) + oy, w: l.width ?? 0, h: l.height ?? 0 } : undefined,
      };
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

const cache = new Map<string, Promise<GraphLayout>>();
function layoutOf(def: GraphDef, dir: Dir): Promise<GraphLayout> {
  const key = dir + JSON.stringify(def);
  let hit = cache.get(key);
  if (!hit) { hit = runLayout(def, dir); cache.set(key, hit); }
  return hit;
}

/**
 * Lays the graph out for the available width. `build` must be a stable function (module-level or useCallback):
 * it receives the direction being tried and the width, and returns sizes and connections for that case.
 */
export function useGraphLayout(build: (dir: Dir, width: number) => GraphDef, width: number): GraphLayout | null {
  const [layout, setLayout] = useState<GraphLayout | null>(null);
  useEffect(() => {
    if (width <= 0) return;
    let live = true;
    void (async () => {
      let l = await layoutOf(build('RIGHT', width), 'RIGHT');
      if (l.width > width) l = await layoutOf(build('DOWN', width), 'DOWN');
      if (live) setLayout(l);
    })().catch(() => { /* keep the previous layout */ });
    return () => { live = false; };
  }, [build, width]);
  return layout;
}

export interface Token { id: string; edge: string; className?: string; delay?: number }

/** Draws a laid-out graph: edges in one SVG, nodes and edge labels as HTML on top. */
export function GraphView(props: {
  layout: GraphLayout;
  /** Describes the connections for assistive technology (node text is real text). */
  label: string;
  renderNode: (id: string, box: Box) => ReactNode;
  /** Optional layer behind the edges, for the body of a container node. */
  renderBackdrop?: (id: string) => ReactNode;
  nodeClass?: (id: string) => string;
  edgeClass?: (id: string) => string;
  tokens?: Token[];
}) {
  const { layout, nodeClass, edgeClass } = props;
  return (
    <div className="dgm-graph" data-dir={layout.dir} style={{ width: layout.width, height: layout.height }}>
      {props.renderBackdrop && Object.entries(layout.nodes).map(([id, b]) => {
        const back = props.renderBackdrop?.(id);
        return back ? <div key={id} className="dgm-backdrop" style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>{back}</div> : null;
      })}
      <svg className="dgm-edges" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={props.label}>
        {Object.entries(layout.edges).map(([id, e]) => (
          <g key={id} className={`dgm-edge ${edgeClass?.(id) ?? ''}`} data-edge={id}>
            <path className="dgm-edge-line" d={e.d} />
            <polygon className="dgm-edge-head" points={e.head} />
          </g>
        ))}
        {props.tokens?.map((t) => layout.edges[t.edge] && (
          <circle key={t.id} r={4.5} className={`dgm-token ${t.className ?? ''}`} style={{ offsetPath: `path('${layout.edges[t.edge].route}')`, animationDelay: `${t.delay ?? 0}ms` }} />
        ))}
      </svg>
      {Object.entries(layout.nodes).map(([id, b]) => (
        <div key={id} className={`dgm-node ${nodeClass?.(id) ?? ''}`} data-node={id} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>{props.renderNode(id, b)}</div>
      ))}
      {Object.entries(layout.edges).map(([id, e]) => e.label && (
        <span key={id} className={`dgm-edge-label ${edgeClass?.(id) ?? ''}`} style={{ left: e.label.x + e.label.w / 2, top: e.label.y + e.label.h / 2 }}>{e.label.text}</span>
      ))}
    </div>
  );
}
