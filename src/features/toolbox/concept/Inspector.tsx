import { useEffect, useId, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Cable, Trash2 } from 'lucide-react';
import { CM_EDGE_HINTS, CM_EDGE_KINDS, CM_EDGE_LABEL_MAX, CM_EDGE_LABELS, CM_EDGE_LOOK, CM_LABEL_MAX, CM_NODE_LABELS, CM_NODE_TYPES, CM_ZONE_LABELS, CM_ZONES } from '../../../domain/artefacts/conceptModel';
import type { CMEdge, CMEdgeKind, CMNode, ConceptModel } from '../../../domain/artefacts/types';
import { Glyph, toneStyle } from './nodes';
import { moveToZone, reverseEdge, setEdgeKind } from './ops';
import type { ConceptEditing } from './useConcept';

export type LinkKind = 'auto' | CMEdgeKind;
export type Sign = CMEdge['sign'];
export type ConnectFn = (from: string, to: string, kind: LinkKind, sign: Sign) => void;

export const nameOf = (n: CMNode | undefined) => (n ? n.label.trim() || `Unnamed ${CM_NODE_LABELS[n.type].toLowerCase()}` : '');

/** A small line in the look of a connection kind, for legends and choices. */
export function KindSample({ kind, width = 34 }: { kind: CMEdgeKind; width?: number }) {
  const look = CM_EDGE_LOOK[kind];
  return (
    <svg width={width} height="12" viewBox={`0 0 ${width} 12`} aria-hidden="true" focusable="false" className="cm-kind-sample">
      <path d={`M2 6H${width - 4}`} style={{ stroke: look.stroke, strokeWidth: Math.min(look.width, 3), strokeDasharray: look.dash || undefined, strokeLinecap: kind === 'decides' ? 'round' : undefined }} />
      <path d={look.marker === 'diamond' ? `M${width - 10} 6 ${width - 6} 2.5 ${width - 2} 6 ${width - 6} 9.5Z` : `M${width - 8} 2 ${width - 2} 6 ${width - 8} 10${look.marker === 'chevron' ? '' : 'Z'}`}
        style={{ fill: look.marker === 'chevron' ? 'none' : look.stroke, stroke: look.stroke, strokeWidth: 1.5, strokeLinejoin: 'round' }} />
    </svg>
  );
}

/** “Connect from → to”: the keyboard way to draw a connection. */
export function ConnectForm({ model, from: initialFrom = '', fixedFrom = false, onConnect, title }: {
  model: ConceptModel; from?: string; fixedFrom?: boolean; onConnect: ConnectFn; title?: string;
}) {
  const ids = { from: useId(), to: useId(), kind: useId(), sign: useId() };
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<LinkKind>('auto');
  const [sign, setSign] = useState<Sign>('');
  useEffect(() => { setFrom(initialFrom); }, [initialFrom]);
  const ready = !!from && !!to && from !== to && model.nodes.some((n) => n.id === from) && model.nodes.some((n) => n.id === to);
  if (model.nodes.length < 2) return <p className="cm-muted cm-connect-empty"><Cable size={15} aria-hidden="true" /> Add two elements to connect them.</p>;
  return (
    <form className="cm-connect" aria-label={title ?? 'Connect two elements'} onSubmit={(e) => { e.preventDefault(); if (!ready) return; onConnect(from, to, kind, sign); setTo(''); }}>
      {title && <span className="cm-bar-title"><Cable size={15} aria-hidden="true" /> {title}</span>}
      {!fixedFrom && (
        <div className="cm-f"><label htmlFor={ids.from}>From</label>
          <select id={ids.from} value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Choose…</option>
            {model.nodes.map((n) => <option key={n.id} value={n.id}>{nameOf(n)}</option>)}
          </select>
        </div>
      )}
      <div className="cm-f"><label htmlFor={ids.kind}>As</label>
        <select id={ids.kind} value={kind} onChange={(e) => setKind(e.target.value as LinkKind)}>
          <option value="auto">Best guess</option>
          {CM_EDGE_KINDS.map((k) => <option key={k} value={k}>{CM_EDGE_LABELS[k]}</option>)}
        </select>
      </div>
      {kind === 'influence' && (
        <div className="cm-f"><label htmlFor={ids.sign}>Sign</label>
          <select id={ids.sign} value={sign} onChange={(e) => setSign(e.target.value as Sign)}>
            <option value="">None</option><option value="+">+ more gives more</option><option value="-">− more gives less</option>
          </select>
        </div>
      )}
      <div className="cm-f"><label htmlFor={ids.to}>To</label>
        <select id={ids.to} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Choose…</option>
          {model.nodes.filter((n) => n.id !== from).map((n) => <option key={n.id} value={n.id}>{nameOf(n)}</option>)}
        </select>
      </div>
      <button type="submit" className="btn small primary" disabled={!ready}><Cable size={14} aria-hidden="true" /> Connect</button>
    </form>
  );
}

function NodeFields({ node, model, change, onConnect, onRemove }: { node: CMNode; model: ConceptModel; change: ConceptEditing['change']; onConnect: ConnectFn; onRemove: () => void }) {
  const ids = { label: useId(), type: useId(), zone: useId() };
  const edit = (fn: (n: CMNode) => void, key: string | null = null) => change((d) => { const n = d.nodes.find((x) => x.id === node.id); if (n) fn(n); }, key);
  return (
    <>
      <span className="cm-bar-badge" style={toneStyle(node.type)} title={CM_NODE_LABELS[node.type]}><Glyph type={node.type} /></span>
      <div className="cm-f cm-f-name"><label htmlFor={ids.label}>Name</label>
        <input id={ids.label} type="text" value={node.label} maxLength={CM_LABEL_MAX} placeholder="Unnamed" autoComplete="off"
          onChange={(e) => { const v = e.target.value; edit((n) => { n.label = v; }, `label:${node.id}`); }} />
      </div>
      <div className="cm-f"><label htmlFor={ids.type}>Type</label>
        <select id={ids.type} value={node.type} onChange={(e) => edit((n) => { n.type = e.target.value as CMNode['type']; })}>
          {CM_NODE_TYPES.map((t) => <option key={t} value={t}>{CM_NODE_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="cm-f"><label htmlFor={ids.zone}>Where</label>
        <select id={ids.zone} value={node.zone} onChange={(e) => change((d) => moveToZone(d, node.id, e.target.value as CMNode['zone']))}>
          {CM_ZONES.map((z) => <option key={z} value={z}>{z === 'outside' ? 'Outside' : CM_ZONE_LABELS[z]}</option>)}
        </select>
      </div>
      <span className="cm-bar-sep" aria-hidden="true" />
      <ConnectForm model={model} from={node.id} fixedFrom onConnect={onConnect} />
      <span className="cm-bar-end">
        <button type="button" className="btn small danger" onClick={onRemove}><Trash2 size={14} aria-hidden="true" /> Delete</button>
      </span>
    </>
  );
}

function EdgeFields({ edge, model, change, onRemove }: { edge: CMEdge; model: ConceptModel; change: ConceptEditing['change']; onRemove: () => void }) {
  const ids = { label: useId(), kind: useId(), sign: useId() };
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const edit = (fn: (e: CMEdge) => void, key: string | null = null) => change((d) => { const e = d.edges.find((x) => x.id === edge.id); if (e) fn(e); }, key);
  return (
    <>
      <p className="cm-ends"><strong>{nameOf(byId.get(edge.from))}</strong> <ArrowRight size={14} aria-hidden="true" /><span className="sr-only">to</span> <strong>{nameOf(byId.get(edge.to))}</strong></p>
      <fieldset className="cm-kinds">
        <legend>Kind</legend>
        {CM_EDGE_KINDS.map((k) => (
          <label key={k} className="cm-kind" title={CM_EDGE_HINTS[k]}>
            <input type="radio" name={ids.kind} value={k} checked={edge.kind === k} onChange={() => edit((e) => setEdgeKind(e, k))} />
            <KindSample kind={k} width={26} /> <span>{CM_EDGE_LABELS[k]}</span>
          </label>
        ))}
      </fieldset>
      {edge.kind === 'influence' && (
        <fieldset className="cm-kinds cm-signs">
          <legend>Sign</legend>
          {([['', 'none', 'No sign'], ['+', '+', 'Plus: more gives more'], ['-', '−', 'Minus: more gives less']] as const).map(([v, text, name]) => (
            <label key={v || 'none'} className={`cm-kind cm-sign-choice${v ? '' : ' is-none'}`} title={name}>
              <input type="radio" name={ids.sign} value={v} checked={edge.sign === v} aria-label={name} onChange={() => edit((e) => { e.sign = v; })} />
              <span aria-hidden="true">{text}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="cm-f cm-f-name"><label htmlFor={ids.label}>Label</label>
        <input id={ids.label} type="text" value={edge.label} maxLength={CM_EDGE_LABEL_MAX} placeholder="Optional" autoComplete="off"
          onChange={(e) => { const v = e.target.value; edit((x) => { x.label = v; }, `edge-label:${edge.id}`); }} />
      </div>
      <span className="cm-bar-end">
        <button type="button" className="btn small cm-icon-btn" aria-label="Reverse the direction" title="Reverse the direction" onClick={() => change((d) => reverseEdge(d, edge.id))}><ArrowLeftRight size={15} aria-hidden="true" /></button>
        <button type="button" className="btn small danger" onClick={onRemove}><Trash2 size={14} aria-hidden="true" /> Delete</button>
      </span>
    </>
  );
}

/**
 * The panel docked above the canvas: it edits what is selected, and offers the connect form when nothing is.
 * Docked rather than floating, so it never covers the frame or an element.
 */
export function Inspector({ model, selNodes, selEdges, change, onConnect, onRemove }: {
  model: ConceptModel; selNodes: string[]; selEdges: string[]; change: ConceptEditing['change']; onConnect: ConnectFn; onRemove: () => void;
}) {
  const node = selNodes.length === 1 && !selEdges.length ? model.nodes.find((n) => n.id === selNodes[0]) : undefined;
  const edge = selEdges.length === 1 && !selNodes.length ? model.edges.find((e) => e.id === selEdges[0]) : undefined;
  const many = selNodes.length + selEdges.length;
  const what = node ? `Selected: ${CM_NODE_LABELS[node.type].toLowerCase()}` : edge ? 'Selected: connection' : many > 1 ? `${many} selected` : 'Connect';
  return (
    <section className={`cm-bar${node || edge ? ' is-selection' : ''}`} aria-label={what}>
      {node ? <NodeFields key={node.id} node={node} model={model} change={change} onConnect={onConnect} onRemove={onRemove} />
        : edge ? <EdgeFields key={edge.id} edge={edge} model={model} change={change} onRemove={onRemove} />
          : many > 1 ? (
            <>
              <span className="cm-bar-title">{many} selected</span>
              <span className="cm-bar-end"><button type="button" className="btn small danger" onClick={onRemove}><Trash2 size={14} aria-hidden="true" /> Delete all {many}</button></span>
            </>
          ) : <ConnectForm model={model} onConnect={onConnect} title="Connect" />}
    </section>
  );
}
