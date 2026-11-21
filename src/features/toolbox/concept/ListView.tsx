import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp, Plus, Scissors, Target, Trash2 } from 'lucide-react';
import { LIMITS } from '../../../domain/artefacts/clean';
import {
  CM_EDGE_KINDS, CM_EDGE_LABEL_MAX, CM_EDGE_LABELS, CM_HOME_ZONE, CM_LABEL_MAX, CM_NODE_LABELS, CM_NODE_TYPES, CM_ZONE_HINTS, CM_ZONE_LABELS, CM_ZONES,
  isRelationshipModel, maxArrowsIn,
} from '../../../domain/artefacts/conceptModel';
import type { CMEdge, CMNode, CMNodeType, CMZone, ConceptModel } from '../../../domain/artefacts/types';
import { ConnectForm, KindSample, type ConnectFn } from './Inspector';
import { Glyph, toneStyle } from './nodes';
import { moveToZone, setEdgeKind } from './ops';
import type { ConceptEditing } from './useConcept';

/**
 * The same model as a list: the accessible equivalent of the canvas, and the view for small screens.
 * Everything the canvas does can be done here: add, rename, retype, move between zones, connect, disconnect, delete.
 */

function TextField({ field, label, hint, icon, model, change }: {
  field: 'objectives' | 'assumptions' | 'simplifications'; label: string; hint: string; icon: React.ReactNode; model: ConceptModel; change: ConceptEditing['change'];
}) {
  const id = useId();
  return (
    <div className="field cm-list-text">
      <label htmlFor={id}>{icon} {label}</label>
      <textarea id={id} rows={2} value={model[field]} maxLength={LIMITS.text} placeholder={hint}
        onChange={(e) => { const v = e.target.value; change((d) => { d[field] = v; }, `text:${field}`); }} />
    </div>
  );
}

function NodeRow({ node, change, focus }: { node: CMNode; change: ConceptEditing['change']; focus: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focus) input.current?.focus(); }, [focus]);
  const edit = (fn: (n: CMNode) => void, key: string | null = null) => change((d) => { const n = d.nodes.find((x) => x.id === node.id); if (n) fn(n); }, key);
  const name = node.label.trim() || `unnamed ${CM_NODE_LABELS[node.type].toLowerCase()}`;
  return (
    <li className="cm-row" style={toneStyle(node.type)}>
      <span className="cm-badge" aria-hidden="true"><Glyph type={node.type} size={16} /></span>
      <input ref={input} type="text" className="cm-row-name" value={node.label} maxLength={CM_LABEL_MAX} placeholder="Unnamed" aria-label={`Name of ${name}`}
        onChange={(e) => { const v = e.target.value; edit((n) => { n.label = v; }, `label:${node.id}`); }} />
      <select value={node.type} aria-label={`Type of ${name}`} onChange={(e) => edit((n) => { n.type = e.target.value as CMNodeType; })}>
        {CM_NODE_TYPES.map((t) => <option key={t} value={t}>{CM_NODE_LABELS[t]}</option>)}
      </select>
      <select value={node.zone} aria-label={`Where ${name} belongs`} onChange={(e) => change((d) => moveToZone(d, node.id, e.target.value as CMZone))}>
        {CM_ZONES.map((z) => <option key={z} value={z}>{z === 'outside' ? 'Outside' : CM_ZONE_LABELS[z]}</option>)}
      </select>
      <button type="button" className="btn ghost small cm-icon-btn" aria-label={`Delete ${name}`} title="Delete"
        onClick={() => change((d) => { d.nodes = d.nodes.filter((n) => n.id !== node.id); d.edges = d.edges.filter((e) => e.from !== node.id && e.to !== node.id); })}>
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

function EdgeRow({ edge, model, change }: { edge: CMEdge; model: ConceptModel; change: ConceptEditing['change'] }) {
  const edit = (fn: (e: CMEdge) => void, key: string | null = null) => change((d) => { const e = d.edges.find((x) => x.id === edge.id); if (e) fn(e); }, key);
  const nameOf = (id: string) => { const n = model.nodes.find((x) => x.id === id); return n ? n.label.trim() || `Unnamed ${CM_NODE_LABELS[n.type].toLowerCase()}` : ''; };
  const desc = `${nameOf(edge.from)} to ${nameOf(edge.to)}`;
  return (
    <li className="cm-row cm-edge-row">
      <select value={edge.from} aria-label={`Start of the connection ${desc}`} onChange={(e) => { const v = e.target.value; if (v !== edge.to) edit((x) => { x.from = v; }); }}>
        {model.nodes.map((n) => <option key={n.id} value={n.id} disabled={n.id === edge.to}>{nameOf(n.id)}</option>)}
      </select>
      <span className="cm-edge-kind">
        <KindSample kind={edge.kind} width={26} />
        <select value={edge.kind} aria-label={`Kind of the connection ${desc}`} onChange={(e) => edit((x) => setEdgeKind(x, e.target.value as CMEdge['kind']))}>
          {CM_EDGE_KINDS.map((k) => <option key={k} value={k}>{CM_EDGE_LABELS[k]}</option>)}
        </select>
        {edge.kind === 'influence' && (
          <select value={edge.sign} aria-label={`Sign of the connection ${desc}`} onChange={(e) => edit((x) => { x.sign = e.target.value as CMEdge['sign']; })}>
            <option value="">no sign</option><option value="+">+</option><option value="-">−</option>
          </select>
        )}
      </span>
      <select value={edge.to} aria-label={`End of the connection ${desc}`} onChange={(e) => { const v = e.target.value; if (v !== edge.from) edit((x) => { x.to = v; }); }}>
        {model.nodes.map((n) => <option key={n.id} value={n.id} disabled={n.id === edge.from}>{nameOf(n.id)}</option>)}
      </select>
      <input type="text" className="cm-row-name" value={edge.label} maxLength={CM_EDGE_LABEL_MAX} placeholder="Label" aria-label={`Label of the connection ${desc}`}
        onChange={(e) => { const v = e.target.value; edit((x) => { x.label = v; }, `edge-label:${edge.id}`); }} />
      <button type="button" className="btn ghost small cm-icon-btn" aria-label={`Delete the connection ${desc}`} title="Delete"
        onClick={() => change((d) => { d.edges = d.edges.filter((x) => x.id !== edge.id); })}>
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

function AddForm({ onAdd }: { onAdd: (type: CMNodeType, label: string, zone: CMZone) => void }) {
  const ids = { type: useId(), name: useId(), zone: useId() };
  const [type, setType] = useState<CMNodeType>('entity');
  const [name, setName] = useState('');
  const [zone, setZone] = useState<CMZone>(CM_HOME_ZONE.entity);
  return (
    <form className="cm-add" onSubmit={(e) => { e.preventDefault(); onAdd(type, name.trim(), zone); setName(''); }}>
      <div className="field"><label htmlFor={ids.type}>Type</label>
        <select id={ids.type} value={type} onChange={(e) => { const t = e.target.value as CMNodeType; setType(t); setZone(CM_HOME_ZONE[t]); }}>
          {CM_NODE_TYPES.map((t) => <option key={t} value={t}>{CM_NODE_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="field cm-grow"><label htmlFor={ids.name}>Name</label>
        <input id={ids.name} type="text" value={name} maxLength={CM_LABEL_MAX} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field"><label htmlFor={ids.zone}>Where</label>
        <select id={ids.zone} value={zone} onChange={(e) => setZone(e.target.value as CMZone)}>
          {CM_ZONES.map((z) => <option key={z} value={z}>{CM_ZONE_LABELS[z]}</option>)}
        </select>
      </div>
      <button type="submit" className="btn small primary"><Plus size={14} aria-hidden="true" /> Add</button>
    </form>
  );
}

export function ListView({ model, change, onConnect, onAdd, focusId }: {
  model: ConceptModel; change: ConceptEditing['change']; onConnect: ConnectFn;
  onAdd: (type: CMNodeType, label: string, zone: CMZone) => void; focusId: string | null;
}) {
  const headId = useId();
  return (
    <div className="cm-list" aria-labelledby={headId}>
      <h2 id={headId} className="sr-only">The model as a list</h2>
      <TextField field="objectives" label="Objectives" hint="What must the model answer?" icon={<Target size={14} aria-hidden="true" />} model={model} change={change} />
      <div className="cm-list-zones">
        {CM_ZONES.map((zone) => {
          const items = model.nodes.filter((n) => n.zone === zone);
          return (
            <section key={zone} className={`cm-list-zone cm-lz-${zone}`} aria-label={CM_ZONE_LABELS[zone]}>
              <h3>{CM_ZONE_LABELS[zone]} <small>{CM_ZONE_HINTS[zone]}</small> <span className="cm-count">{items.length}</span></h3>
              {items.length ? <ul>{items.map((n) => <NodeRow key={n.id} node={n} change={change} focus={focusId === n.id} />)}</ul> : <p className="cm-muted">Nothing here yet.</p>}
            </section>
          );
        })}
      </div>
      <section className="cm-list-block" aria-label="Add an element">
        <h3>Add an element</h3>
        <AddForm onAdd={onAdd} />
      </section>
      <section className="cm-list-block" aria-label="Connections">
        <h3>Connections <span className="cm-count">{model.edges.length}</span></h3>
        {isRelationshipModel(model) && <p className="cm-muted cm-arrows">Most arrows into one construct: <strong>{maxArrowsIn(model)}</strong></p>}
        {model.edges.length ? <ul>{model.edges.map((e) => <EdgeRow key={e.id} edge={e} model={model} change={change} />)}</ul> : <p className="cm-muted">No connections yet.</p>}
        <ConnectForm model={model} onConnect={onConnect} />
      </section>
      <div className="cm-list-foot">
        <TextField field="assumptions" label="Assumptions" hint="What you believe without checking" icon={<CircleHelp size={14} aria-hidden="true" />} model={model} change={change} />
        <TextField field="simplifications" label="Simplifications" hint="What you leave out on purpose" icon={<Scissors size={14} aria-hidden="true" />} model={model} change={change} />
      </div>
    </div>
  );
}
