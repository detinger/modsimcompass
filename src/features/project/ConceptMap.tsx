import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { newId, type MapNode } from '../../domain/passport/schema';
import { usePassport } from './passportContext';

/**
 * Lightweight conceptual sketch (PLAN §9). Not executable, not BPMN, not a Petri net,
 * not a causal certificate. The table editor provides every operation by keyboard;
 * the SVG view is a read-only rendering with an automatic circular layout.
 */
export function ConceptMap() {
  const { doc, update, readOnly } = usePassport();
  const { nodes, relations } = doc.passport.representation;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [label, setLabel] = useState('');
  const [directed, setDirected] = useState(true);
  const name = (id: string) => nodes.find((n) => n.id === id)?.label || '(unnamed)';

  const W = 640, H = 340, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 44;
  const pos = (i: number) => {
    if (nodes.length === 1) return { x: cx, y: cy };
    const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return { x: cx + R * 1.5 * Math.cos(a), y: cy + R * Math.sin(a) };
  };
  return (
    <div>
      {nodes.length > 0 && (
        <div className="diagram-wrap" style={{ marginBottom: 12 }} role="group" aria-label="Concept map (scrolls sideways on small screens)" tabIndex={0}>
          <svg className="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Conceptual sketch with ${nodes.length} elements and ${relations.length} relations; the table below lists them.`}>
            <defs><marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ms-relation)" /></marker></defs>
            {relations.map((r) => {
              const i = nodes.findIndex((n) => n.id === r.from), j = nodes.findIndex((n) => n.id === r.to);
              if (i < 0 || j < 0) return null;
              const a = pos(i), b = pos(j);
              const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
              const sx = a.x + (dx / len) * 46, sy = a.y + (dy / len) * 18, ex = b.x - (dx / len) * 50, ey = b.y - (dy / len) * 20;
              return (
                <g key={r.id}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} className="edge" markerEnd={r.directed ? 'url(#cm-arrow)' : undefined} />
                  {r.label && <text x={(sx + ex) / 2} y={(sy + ey) / 2 + 3} textAnchor="middle" className="small cp-edge-label">{r.label}</text>}
                </g>
              );
            })}
            {nodes.map((n, i) => {
              const p = pos(i);
              return (
                <g key={n.id}>
                  {n.type === 'stakeholder' ? <rect x={p.x - 46} y={p.y - 16} width={92} height={32} rx={16} className="node" />
                    : n.type === 'variable' ? <ellipse cx={p.x} cy={p.y} rx={48} ry={18} className="node" />
                    : <rect x={p.x - 46} y={p.y - 16} width={92} height={32} rx={3} className="node" />}
                  <text x={p.x} y={p.y + 4} textAnchor="middle" className="label">{(n.label || '(unnamed)').slice(0, 16)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {readOnly ? (
        nodes.length === 0 ? <p className="cp-empty-row">No sketch yet.</p> : (
          <ul className="cp-relations">
            {relations.map((r) => <li key={r.id}><strong>{name(r.from)}</strong> <span>{r.directed ? '→' : '—'} {r.label || 'relates to'} {r.directed ? '→' : '—'}</span> <strong>{name(r.to)}</strong></li>)}
          </ul>
        )
      ) : (<>
      {nodes.length > 0 && <div className="table-wrap" tabIndex={0} role="region" aria-label="Elements">
        <table className="data">
          <caption>Elements (rectangle = entity, ellipse = variable, rounded = stakeholder)</caption>
          <thead><tr><th scope="col">Label</th><th scope="col">Type</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id}>
                <td><input type="text" aria-label="Element label" value={n.label} onChange={(e) => update((d) => { const x = d.passport.representation.nodes.find((y) => y.id === n.id); if (x) x.label = e.target.value; })} /></td>
                <td><select aria-label="Element type" value={n.type} onChange={(e) => update((d) => { const x = d.passport.representation.nodes.find((y) => y.id === n.id); if (x) x.type = e.target.value as MapNode['type']; })}>
                  <option value="entity">Entity</option><option value="variable">Variable</option><option value="stakeholder">Stakeholder</option>
                </select></td>
                <td><button className="btn small ghost" aria-label={`Delete element ${n.label || ''}`} onClick={() => update((d) => {
                  d.passport.representation.nodes = d.passport.representation.nodes.filter((y) => y.id !== n.id);
                  d.passport.representation.relations = d.passport.representation.relations.filter((r) => r.from !== n.id && r.to !== n.id);
                })}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      <button type="button" className="btn small" style={{ margin: '8px 0 14px' }} onClick={() => update((d) => { d.passport.representation.nodes.push({ id: newId('n'), type: 'entity', label: '', x: 0, y: 0 }); })}><Plus size={14} aria-hidden="true" /> Add element</button>

      {relations.length > 0 && <div className="table-wrap" tabIndex={0} role="region" aria-label="Relations">
        <table className="data">
          <caption>Relations</caption>
          <thead><tr><th scope="col">From</th><th scope="col">Label</th><th scope="col">To</th><th scope="col">Directed</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {relations.map((r) => (
              <tr key={r.id}>
                <td>{name(r.from)}</td>
                <td><input type="text" aria-label="Relation label" value={r.label} onChange={(e) => update((d) => { const x = d.passport.representation.relations.find((y) => y.id === r.id); if (x) x.label = e.target.value; })} /></td>
                <td>{name(r.to)}</td>
                <td><input type="checkbox" aria-label="Directed" checked={r.directed} onChange={(e) => update((d) => { const x = d.passport.representation.relations.find((y) => y.id === r.id); if (x) x.directed = e.target.checked; })} /></td>
                <td><button className="btn small ghost" aria-label="Disconnect" onClick={() => update((d) => { d.passport.representation.relations = d.passport.representation.relations.filter((y) => y.id !== r.id); })}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {nodes.length >= 2 && (
        <fieldset style={{ marginTop: 14 }}>
          <legend>Connect two elements</legend>
          <div className="inline-fields">
            <label className="field"><span className="field-label">From</span><select value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Choose…</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.label || '(unnamed)'}</option>)}</select></label>
            <label className="field"><span className="field-label">Relation label</span><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. submits, increases, waits for" /></label>
            <label className="field"><span className="field-label">To</span><select value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.label || '(unnamed)'}</option>)}</select></label>
          </div>
          <label className="check"><input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} /> Directed (arrow)</label>
          <button type="button" className="btn small" disabled={!from || !to || from === to} onClick={() => { update((d) => { d.passport.representation.relations.push({ id: newId('r'), from, to, label, directed }); }); setLabel(''); }}>Connect</button>
        </fieldset>
      )}
      </>)}
    </div>
  );
}
