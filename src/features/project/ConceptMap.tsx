import { useLayoutEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { newId, type MapNode } from '../../domain/passport/schema';
import { usePassport } from './passportContext';

/** Inner width of an element, tracked as it appears and resizes. */
function useWidth(): [(el: HTMLDivElement | null) => void, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth - 22)); // minus the wrapper's padding
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

/** Up to two lines of at most `max` characters; a label that does not fit ends with an ellipsis. */
export function wrapLabel(text: string, max: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length && out.length < 2) {
    let line = words[i++];
    while (i < words.length && `${line} ${words[i]}`.length <= max) line += ` ${words[i++]}`;
    out.push(line);
  }
  const fit = (l: string, more: boolean) => (l.length > max || more ? `${l.slice(0, Math.min(l.length, max - 1))}…` : l);
  return out.map((l, k) => fit(l, k === out.length - 1 && i < words.length));
}

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

  // Drawn at the real size of its container, so labels keep their size on a phone instead of shrinking.
  const [wrapRef, width] = useWidth();
  const W = Math.max(280, width || 640);
  const narrow = W < 520;
  const nodeW = Math.min(150, Math.floor(W * (narrow ? 0.42 : 0.24))), nodeH = 44;
  // Wide: elements sit on an ellipse. Narrow: two staggered columns, which cannot overlap however many there are.
  const rows = Math.ceil(nodes.length / 2);
  const H = narrow ? rows * 96 + 56 : Math.max(280, rows * 64 + 60);
  const cx = W / 2, cy = H / 2, rx = W / 2 - nodeW / 2 - 6, ry = H / 2 - nodeH / 2 - 6;
  const pos = (i: number) => {
    if (nodes.length === 1) return { x: cx, y: cy };
    if (narrow) {
      const right = i % 2 === 1, alone = !right && i === nodes.length - 1;
      return { x: alone ? cx : right ? W - nodeW / 2 - 6 : nodeW / 2 + 6, y: 30 + Math.floor(i / 2) * 96 + (right ? 44 : 0) };
    }
    const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  };
  const lines = (text: string) => wrapLabel(text || '(unnamed)', Math.max(8, Math.floor((nodeW - 14) / 6.6)));
  const hw = nodeW / 2, hh = nodeH / 2;
  /** A line between two nodes, trimmed at their borders; a pair of opposite arrows is drawn side by side. */
  const edge = (r: { from: string; to: string }) => {
    const i = nodes.findIndex((n) => n.id === r.from), j = nodes.findIndex((n) => n.id === r.to);
    if (i < 0 || j < 0 || i === j) return null;
    const a = pos(i), b = pos(j);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const trim = Math.min(hw / (Math.abs(dx) / len || 1e-9), hh / (Math.abs(dy) / len || 1e-9)) + 3;
    const twin = relations.some((o) => o.from === r.to && o.to === r.from);
    const ox = twin ? (-dy / len) * 9 : 0, oy = twin ? (dx / len) * 9 : 0;
    return { sx: a.x + (dx / len) * trim + ox, sy: a.y + (dy / len) * trim + oy, ex: b.x - (dx / len) * (trim + 3) + ox, ey: b.y - (dy / len) * (trim + 3) + oy };
  };
  // Each label sits on its line at the first spot that is clear of every element and of the labels placed before it.
  const labels: { id: string; x: number; y: number; text: string }[] = [];
  for (const r of relations) {
    const g = edge(r);
    if (!g || !r.label.trim()) continue;
    const text = r.label.length > 26 ? `${r.label.slice(0, 25)}…` : r.label, half = text.length * 3.2 + 4;
    const clash = (x: number, y: number) =>
      (nodes.some((_, i) => { const q = pos(i); return Math.abs(x - q.x) < hw + half - 6 && Math.abs(y - q.y) < hh + 8; }) ? 2 : 0)
      + (labels.some((l) => Math.abs(y - l.y) < 14 && Math.abs(x - l.x) < half + l.text.length * 3.2) ? 1 : 0);
    const spots = [0.5, 0.38, 0.62, 0.28, 0.72].map((t) => ({ x: g.sx + (g.ex - g.sx) * t, y: g.sy + (g.ey - g.sy) * t }));
    const best = spots.reduce((a, b) => (clash(b.x, b.y) < clash(a.x, a.y) ? b : a));
    labels.push({ id: r.id, x: Math.max(half, Math.min(W - half, best.x)), y: best.y, text });
  }
  return (
    <div>
      {nodes.length > 0 && (
        <div className="diagram-wrap cm-wrap" style={{ marginBottom: 12 }} ref={wrapRef}>
          <svg className="cm-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Conceptual sketch with ${nodes.length} elements and ${relations.length} relations; the list below names them.`}>
            <defs><marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ms-relation)" /></marker></defs>
            {relations.map((r) => {
              const g = edge(r);
              return g && <line key={r.id} x1={g.sx} y1={g.sy} x2={g.ex} y2={g.ey} className="edge" markerEnd={r.directed ? 'url(#cm-arrow)' : undefined} />;
            })}
            {nodes.map((n, i) => {
              const p = pos(i), text = lines(n.label);
              return (
                <g key={n.id}>
                  {n.type === 'variable' ? <ellipse cx={p.x} cy={p.y} rx={hw} ry={hh} className="node" />
                    : <rect x={p.x - hw} y={p.y - hh} width={nodeW} height={nodeH} rx={n.type === 'stakeholder' ? hh : 6} className="node" />}
                  <text x={p.x} y={p.y + (text.length === 1 ? 4.5 : -3)} textAnchor="middle" className="label cm-label">
                    {text.map((t, k) => <tspan key={k} x={p.x} dy={k === 0 ? 0 : 15}>{t}</tspan>)}
                  </text>
                </g>
              );
            })}
            {/* Labels last, with a halo, so a node or a crossing line never hides them. */}
            {labels.map((l) => <text key={l.id} x={l.x} y={l.y + 4} textAnchor="middle" className="cm-edge-label">{l.text}</text>)}
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
          <button type="button" className="btn small" disabled={!nodes.some((n) => n.id === from) || !nodes.some((n) => n.id === to) || from === to} onClick={() => { update((d) => { d.passport.representation.relations.push({ id: newId('r'), from, to, label, directed }); }); setLabel(''); }}>Connect</button>
        </fieldset>
      )}
      </>)}
    </div>
  );
}
