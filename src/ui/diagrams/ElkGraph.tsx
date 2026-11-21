import { useMemo, type ReactNode } from 'react';
import stored from './layouts.generated.json';
import { finishLayout, layoutKey, snapWidth, type Box, type Dir, type GraphDef, type GraphLayout, type StoredLayout } from './layoutCore';

export type { Box, Dir, EdgeGeo, GEdge, GNode, GraphDef, GraphLayout, Side } from './layoutCore';

const STORED = stored as unknown as Record<string, StoredLayout>;
const finished = new Map<string, GraphLayout>();
function lookup(def: GraphDef, dir: Dir): GraphLayout | undefined {
  const key = layoutKey(def, dir);
  let hit = finished.get(key);
  if (!hit && STORED[key]) { hit = finishLayout(STORED[key]); finished.set(key, hit); }
  return hit;
}

/**
 * Picks the stored layout for the available width. `build` must be a stable function (module-level):
 * it receives the direction being tried and the snapped width, and returns sizes and connections for that case.
 * When the left-to-right layout is wider than the card, the same graph is laid out top-to-bottom instead.
 */
export function useGraphLayout(build: (dir: Dir, width: number) => GraphDef, width: number): GraphLayout | null {
  return useMemo(() => {
    if (width <= 0) return null;
    const w = snapWidth(width);
    const right = lookup(build('RIGHT', w), 'RIGHT');
    if (right && right.width <= width) return right;
    return lookup(build('DOWN', w), 'DOWN') ?? right ?? null;
  }, [build, width]);
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
