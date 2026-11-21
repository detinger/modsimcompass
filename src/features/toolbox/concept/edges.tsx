import { BaseEdge, EdgeLabelRenderer, useInternalNode, type ConnectionLineComponentProps, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react';
import { CM_EDGE_KINDS, CM_EDGE_LABEL_MAX, CM_EDGE_LOOK, CM_MARKER_PATH, CM_NODE_H, CM_NODE_W, edgePath, type CMRect } from '../../../domain/artefacts/conceptModel';
import type { CMEdge } from '../../../domain/artefacts/types';
import { InlineEditor } from './nodes';
import { useConceptCtx } from './useConcept';

export type ConnectionFlowEdge = Edge<{ edge: CMEdge; bend: number }, 'connection'>;

const rectOf = (n: InternalNode): CMRect => ({
  x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y,
  w: n.measured?.width ?? CM_NODE_W, h: n.measured?.height ?? CM_NODE_H,
});

/** Arrow heads of the four kinds, defined once for the canvas. */
export function EdgeMarkers() {
  return (
    <svg className="cm-markers" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {CM_EDGE_KINDS.map((k) => {
          const look = CM_EDGE_LOOK[k], open = look.marker === 'chevron', size = k === 'flow' ? 14 : 12;
          return (
            <marker key={k} id={`cm-mk-${k}`} viewBox="0 0 12 12" refX="11" refY="6" markerWidth={size} markerHeight={size} markerUnits="userSpaceOnUse" orient="auto">
              <path d={CM_MARKER_PATH[look.marker]} style={{ fill: open ? 'none' : look.stroke, stroke: look.stroke, strokeWidth: open ? 1.8 : 1, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
            </marker>
          );
        })}
        <marker id="cm-mk-connect" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto">
          <path d={CM_MARKER_PATH.arrow} className="cm-mk-connect" />
        </marker>
      </defs>
    </svg>
  );
}

/** A connection, from outline to outline, in the look of its kind; with its sign and label beside it. */
export function ConnectionEdge({ id, source, target, data, selected }: EdgeProps<ConnectionFlowEdge>) {
  const s = useInternalNode(source), t = useInternalNode(target);
  const { editingEdge, setEditingEdge, change, selectOnly } = useConceptCtx();
  if (!s || !t || !data) return null;
  const e = data.edge, look = CM_EDGE_LOOK[e.kind];
  const g = edgePath(rectOf(s), rectOf(t), data.bend);
  const editing = editingEdge === id;
  const label = e.label.trim();
  const pick = (ev: React.MouseEvent) => { ev.stopPropagation(); selectOnly([], [id]); };
  // The same key as the label field of the panel above the canvas, so a burst of typing is one undo step.
  const save = (value: string) => change((d) => { const x = d.edges.find((m) => m.id === id); if (x) x.label = value.trim(); }, `edge-label:${id}`);
  return (
    <>
      {selected && <path d={g.path} className="cm-edge-halo" />}
      <BaseEdge id={id} path={g.path} markerEnd={`url(#cm-mk-${e.kind})`} interactionWidth={18} className={`cm-edge cm-e-${e.kind}`}
        style={{ stroke: look.stroke, strokeWidth: look.width + (selected ? 0.8 : 0), strokeDasharray: look.dash || undefined, strokeLinecap: e.kind === 'decides' ? 'round' : undefined }} />
      {(label || editing || (e.kind === 'influence' && e.sign)) && (
        <EdgeLabelRenderer>
          {e.kind === 'influence' && e.sign && (
            <div className={`cm-sign nodrag nopan${selected ? ' is-selected' : ''}`} aria-hidden="true" onClick={pick}
              style={{ transform: `translate(-50%, -50%) translate(${g.signX}px, ${g.signY}px)` }}>{e.sign === '+' ? '+' : '−'}</div>
          )}
          {(label || editing) && (
            <div className={`cm-edge-label nodrag nopan${selected ? ' is-selected' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${g.labelX}px, ${g.labelY}px)` }}
              aria-hidden={editing ? undefined : true} onClick={pick} onDoubleClick={(ev) => { ev.stopPropagation(); setEditingEdge(id); }}>
              {editing ? (
                <InlineEditor initial={e.label} label="Label of this connection" max={CM_EDGE_LABEL_MAX} multiline={false} onInput={save} onDone={(value) => {
                  setEditingEdge(null);
                  if (value !== null) save(value);
                }} />
              ) : label}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** The line drawn while connecting: dashed while it searches, solid over an element it can join. */
export function ConnectionPreview({ fromNode, toNode, toX, toY, connectionStatus }: ConnectionLineComponentProps) {
  const target = connectionStatus === 'valid' && toNode ? rectOf(toNode) : { x: toX, y: toY, w: 0, h: 0 };
  const g = edgePath(rectOf(fromNode), target, 0, 0);
  return (
    <g className={`cm-connecting${connectionStatus ? ` is-${connectionStatus}` : ''}`}>
      <path d={g.path} fill="none" markerEnd="url(#cm-mk-connect)" />
    </g>
  );
}
