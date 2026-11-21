import { useEffect, useState } from 'react';
import type { DailyTrace } from '../../../domain/sandbox/types';
import { fmt } from '../../../ui/controls';

/**
 * Stock-and-flow scene for one inspected trajectory. Quantities are drawn as flows and a
 * stock level, never as literal people. Playback only moves the highlighted day; it never
 * changes or re-runs computation. Reduced motion: no autoplay, step-only.
 */
export function StockFlowScene({ trace, label, runId }: { trace: DailyTrace | null; label: string; /** Playback restarts when this changes, not on unrelated project edits. */ runId: string | null }) {
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const n = trace?.rows.length ?? 0;
  useEffect(() => { setDay(0); setPlaying(false); }, [runId, n]);
  useEffect(() => {
    if (!playing || !trace) return;
    if (day >= n - 1) { setPlaying(false); return; }
    const t = window.setTimeout(() => setDay((d) => d + 1), speed);
    return () => window.clearTimeout(t);
  }, [playing, day, n, speed, trace]);
  if (!trace || n === 0) {
    return (
      <div className="diagram-wrap" role="group" aria-label="Stock-and-flow diagram" tabIndex={0}>
        <svg className="diagram" viewBox="0 0 560 150" role="img" aria-label="Arrivals flow into the backlog stock; served and abandoned requests flow out.">
          <Static />
        </svg>
        <p className="subtle-text">Run the model to inspect the daily flows.</p>
      </div>
    );
  }
  const r = trace.rows[Math.min(day, n - 1)];
  const maxB = Math.max(1, ...trace.rows.map((x) => Math.max(x.startBacklog, x.endBacklog, x.available)));
  const level = Math.min(1, r.endBacklog / maxB);
  return (
    <div>
      <div className="diagram-wrap" role="group" aria-label="Stock-and-flow diagram" tabIndex={0}>
        <svg className="diagram" viewBox="0 0 560 170" role="img" aria-label={`Day ${r.day}: start ${fmt(r.startBacklog)}, arrivals ${fmt(r.arrivals)}, served ${fmt(r.served)}, abandoned ${fmt(r.abandoned)}, end ${fmt(r.endBacklog)} request-equivalents.`}>
          <defs>
            <marker id="sf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--model-stroke)" /></marker>
          </defs>
          <text x="10" y="20" className="label">Arrivals</text>
          <text x="10" y="38" className="label" style={{ fontWeight: 650 }}>{fmt(r.arrivals)}</text>
          <line x1="70" y1="80" x2="200" y2="80" className="edge strong" markerEnd="url(#sf-arrow)" strokeWidth={Math.max(1.5, Math.min(8, r.arrivals / 3))} />
          <rect x="205" y="35" width="150" height="95" rx="4" className="node" />
          <rect x="206" y={36 + 93 * (1 - level)} width="148" height={93 * level} className="fill-primary" />
          <text x="280" y="28" textAnchor="middle" className="label">Backlog (stock)</text>
          <text x="280" y="88" textAnchor="middle" className="label" style={{ fontWeight: 650, fontSize: 15 }}>{fmt(r.endBacklog)}</text>
          <text x="280" y="105" textAnchor="middle" className="small">end of day {r.day} · start {fmt(r.startBacklog)}</text>
          <line x1="355" y1="70" x2="480" y2="70" className="edge strong" markerEnd="url(#sf-arrow)" strokeWidth={Math.max(1.5, Math.min(8, r.served / 3))} />
          <text x="420" y="60" textAnchor="middle" className="label">Served {fmt(r.served)}</text>
          <text x="420" y="90" textAnchor="middle" className="small">capacity {fmt(r.effectiveCapacity)}{r.open ? '' : ' (closed)'}</text>
          <path d="M280 130 L280 158 L420 158" className="edge" markerEnd="url(#sf-arrow)" strokeDasharray={r.abandoned > 0 ? undefined : '4 4'} />
          <text x="430" y="162" className="small">Abandoned {fmt(r.abandoned)}</text>
          <text x="490" y="74" className="small">Completed</text>
        </svg>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <span className="subtle-text">{label} · Day {r.day} of {n}</span>
        <button className="btn small" onClick={() => setDay((d) => Math.max(0, d - 1))} disabled={day === 0}>Previous day</button>
        <button className="btn small" onClick={() => setDay((d) => Math.min(n - 1, d + 1))} disabled={day >= n - 1}>Step</button>
        {!reduce && <button className="btn small" onClick={() => { if (day >= n - 1) setDay(0); setPlaying((p) => !p); }}>{playing ? 'Pause playback' : 'Replay'}</button>}
        <button className="btn small ghost" onClick={() => { setPlaying(false); setDay(0); }}>Reset view</button>
        {!reduce && (
          <label className="subtle-text" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>Playback speed
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: 'auto', minHeight: 28 }}>
              <option value={1200}>Slow</option><option value={700}>Normal</option><option value={300}>Fast</option>
            </select>
          </label>
        )}
      </div>
      <p className="subtle-text">Playback only moves the highlighted day. It does not change results.{reduce ? ' Reduced motion is on: use Step to move through days.' : ''}</p>
    </div>
  );
}

function Static() {
  return (
    <>
      <defs><marker id="sf-arrow0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--model-stroke)" /></marker></defs>
      <text x="10" y="70" className="label">Arrivals</text>
      <line x1="70" y1="75" x2="200" y2="75" className="edge strong" markerEnd="url(#sf-arrow0)" />
      <rect x="205" y="35" width="150" height="80" rx="4" className="node" />
      <text x="280" y="80" textAnchor="middle" className="label">Backlog (stock)</text>
      <line x1="355" y1="75" x2="480" y2="75" className="edge strong" markerEnd="url(#sf-arrow0)" />
      <text x="420" y="65" textAnchor="middle" className="label">Served</text>
      <path d="M280 115 L280 140 L420 140" className="edge" markerEnd="url(#sf-arrow0)" strokeDasharray="4 4" />
      <text x="430" y="144" className="small">Abandoned (optional)</text>
    </>
  );
}
