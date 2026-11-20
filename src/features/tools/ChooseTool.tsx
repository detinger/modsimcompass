import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, LineChart, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Link } from '../../app/router';
import { FAMILIES } from '../../domain/distributions/laws';
import { childrenOf, EDGES, FAMILY_NOTES, LEAVES, pathTo, QUESTIONS } from '../../domain/distributions/tree';
import { Thumb } from '../../ui/playful';
import { ToolFrame } from './ToolFrame';

const COL = 142, ROW = 112, X0 = 70, Y0 = 8, QH = 64, LEAF_Y = Y0 + 4 * ROW + 6;
const pos = (id: string) => QUESTIONS[id] ? { x: X0 + QUESTIONS[id].col * COL, y: Y0 + QUESTIONS[id].row * ROW } : { x: X0 + LEAVES[id].col * COL, y: LEAF_Y };

export default function ChooseTool() {
  const [at, setAt] = useState('root');
  const steps = pathTo(at);
  const onPath = useMemo(() => new Set(['root', ...steps.map((s) => s.to)]), [steps]);
  const hotEdges = useMemo(() => new Set(steps.map((s) => `${s.from}>${s.to}`)), [steps]);
  const q = QUESTIONS[at], leaf = LEAVES[at];
  const W = X0 * 2 + 12 * COL, H = LEAF_Y + 96;
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current, p = pos(at);
    if (el) el.scrollTo({ left: Math.max(0, p.x - el.clientWidth / 2), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [at]);

  return (
    <ToolFrame id="choose">
      <div className="lab-panel tone-purple" style={{ marginBottom: 16 }} aria-live="polite">
        <div className="crumbs" aria-label="Your path">
          <button onClick={() => setAt('root')}><RotateCcw size={12} aria-hidden="true" /> Start</button>
          {steps.map((s) => <span key={s.to} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>→ <button onClick={() => setAt(s.to)}>{s.answer}</button></span>)}
        </div>
        {q && (
          <>
            <h2 style={{ fontSize: 22, margin: '12px 0 4px' }}>{q.text}</h2>
            <p className="muted" style={{ margin: 0 }}>{q.help}</p>
            <div className="answers">{childrenOf(at).map((c) => <button key={c.to} className="answer-btn" onClick={() => setAt(c.to)}>{c.answer} <ArrowRight size={14} aria-hidden="true" /></button>)}</div>
          </>
        )}
        {leaf && (
          <>
            <h2 style={{ fontSize: 22, margin: '12px 0 8px' }}>✨ Try: {leaf.title}</h2>
            <div className="tiles wide">
              {leaf.kinds.map((k) => {
                const note = FAMILY_NOTES[k]!;
                return (
                  <div key={k} className="tile tone-purple" style={{ minHeight: 0 }}>
                    <Thumb kind={k} fields={note.thumb} className="thumb" />
                    <span className="tile-title">{FAMILIES[k].title}</span>
                    <span className="tile-text">{note.use}</span>
                    <span className="tile-text"><em>e.g. {note.example}</em></span>
                    <div className="btn-row" style={{ marginTop: 6 }}>
                      <Link className="btn small primary" to={`/tools/distributions/${k}`}><SlidersHorizontal size={14} aria-hidden="true" /> Explore</Link>
                      <Link className="btn small" to="/tools/fitting"><LineChart size={14} aria-hidden="true" /> Fit my data</Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="subtle-text" style={{ marginTop: 10 }}>A shortlist, not a verdict: check it against your data and how the values arise.</p>
          </>
        )}
      </div>

      <div ref={wrap} className="tree-wrap" tabIndex={0} role="region" aria-label="Decision tree; each box is a button">
        <div className="tree" style={{ width: W, height: H }}>
          <svg className="edges" width={W} height={H} aria-hidden="true">
            {EDGES.map(([from, to]) => { const a = pos(from), b = pos(to); return <line key={`${from}>${to}`} className={hotEdges.has(`${from}>${to}`) ? 'hot' : undefined} x1={a.x} y1={a.y + QH} x2={b.x} y2={b.y} />; })}
          </svg>
          {EDGES.map(([from, to, answer]) => {
            const a = pos(from), b = pos(to), t = 0.62;
            return <span key={`l-${from}>${to}`} className={`edge-label${hotEdges.has(`${from}>${to}`) ? ' hot' : ''}`} style={{ left: a.x + (b.x - a.x) * t, top: a.y + QH + (b.y - a.y - QH) * t }}>{answer}</span>;
          })}
          {Object.entries(QUESTIONS).map(([id, node]) => (
            <button key={id} className={`node q${id === at ? ' selected' : onPath.has(id) ? ' onpath' : ''}`} style={{ left: pos(id).x, top: pos(id).y, minHeight: QH }} onClick={() => setAt(id)} aria-current={id === at ? 'step' : undefined}>{node.text}</button>
          ))}
          {Object.entries(LEAVES).map(([id, l]) => (
            <button key={id} className={`node leaf tone-purple${id === at ? ' selected' : onPath.has(id) ? ' onpath' : ''}`} style={{ left: pos(id).x, top: LEAF_Y }} onClick={() => setAt(id)} aria-current={id === at ? 'step' : undefined}>
              <strong style={{ fontSize: 11.5 }}>{l.title}</strong>
              <Thumb kind={l.kinds[0]} fields={FAMILY_NOTES[l.kinds[0]]!.thumb} className="thumb" />
            </button>
          ))}
        </div>
      </div>
      <p className="subtle-text">Tree adapted from the Monte Carlo Simulation Lab. Scroll sideways to see all of it.</p>
    </ToolFrame>
  );
}
