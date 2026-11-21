import { useState } from 'react';
import type { Law } from '../../domain/distributions/laws';
import type { PreviewRow } from '../../domain/distributions/preview';
import { niceTicks, useWidth } from '../../ui/charts';
import { fmt } from '../../ui/controls';

const AX = { fontSize: 11, fill: 'var(--text-muted)' } as const;

/** Sampled shares (bars) with the model overlaid: a curve for continuous laws, markers for discrete. */
export function DistChart({ rows, law, unit = 'Value', overlays = [], height = 240 }: {
  rows: PreviewRow[]; law?: Law | null; unit?: string; height?: number;
  overlays?: { law: Law; color: string; label: string; dashed?: boolean }[];
}) {
  const [box, W] = useWidth();
  const [cdf, setCdf] = useState(false);
  const H = height, L = 46, R = 12, T = 10, B = 34;
  const lo = rows[0].lo, hi = rows[rows.length - 1].hi;
  const span = hi - lo || 1, bw = span / rows.length;
  const n = rows.reduce((s, r) => s + r.count, 0);
  let cum = 0;
  const data = rows.map((r) => { cum += r.count; return { ...r, value: cdf ? cum / n : r.observed }; });
  const allOverlays = [...(law ? [{ law, color: 'var(--accent)', label: 'Model', dashed: false }] : []), ...overlays];
  const curves = allOverlays.filter((o) => !o.law.discrete && hi > lo).map((o) => ({
    ...o, pts: Array.from({ length: 121 }, (_, i) => { const v = lo + (span * i) / 120; return [v, cdf ? o.law.cdf(v) - o.law.cdf(lo) : o.law.pdf(v) * bw] as [number, number]; }).filter(([, p]) => Number.isFinite(p)),
  }));
  const max = cdf ? 1 : Math.max(...data.map((d) => Math.max(d.value, law && law.discrete ? d.expected : 0)), ...curves.flatMap((c) => c.pts.map(([, p]) => p)), 0.001) * 1.08;
  const x = (v: number) => L + ((v - lo) / span) * (W - L - R);
  const y = (p: number) => T + (1 - Math.min(p, max) / max) * (H - T - B);
  const colW = (W - L - R) / data.length;
  return (
    <div>
      <div className="seg" role="group" aria-label="Chart view" style={{ marginBottom: 6 }}>
        <button aria-pressed={!cdf} onClick={() => setCdf(false)}>Histogram</button>
        <button aria-pressed={cdf} onClick={() => setCdf(true)}>Cumulative</button>
      </div>
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={cdf ? 'Cumulative share of the sample with the model cumulative probability' : 'Share of the sample in each bin with the model probability'}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t * max)} y2={y(t * max)} stroke="var(--chart-grid)" /><text x={L - 6} y={y(t * max) + 4} textAnchor="end" style={AX}>{fmt(t * max * 100, 0)}%</text></g>)}
          {data.map((d, i) => cdf
            ? <path key={i} d={`M${L + i * colW},${y(i ? data[i - 1].value : 0)} h${colW} V${y(d.value)}`} stroke="var(--ms-baseline)" fill="none" strokeWidth={2} />
            : <g key={i}>
                <rect x={L + i * colW + 0.5} y={y(d.value)} width={Math.max(0.5, colW - 1.5)} height={H - B - y(d.value)} fill="var(--ms-baseline)" opacity={0.75} rx={2} />
                {law?.discrete && <line x1={L + i * colW} x2={L + (i + 1) * colW} y1={y(d.expected)} y2={y(d.expected)} stroke="var(--accent)" strokeWidth={3} />}
              </g>)}
          {curves.map((c, i) => <path key={i} d={`M${c.pts.map(([v, p]) => `${x(v).toFixed(1)},${y(p).toFixed(1)}`).join(' L')}`} fill="none" stroke={c.color} strokeWidth={2.5} strokeDasharray={c.dashed ? '6 4' : undefined} strokeLinejoin="round" />)}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--chart-axis)" />
          {niceTicks(lo, lo + span).map((t) => <text key={t} x={x(t)} y={H - B + 14} textAnchor="middle" style={AX}>{fmt(t, 2)}</text>)}
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={AX}>{unit}</text>
        </svg>
      </div>
      <div className="legend">
        <span><svg viewBox="0 0 24 8" aria-hidden="true"><rect x="0" y="0" width="24" height="8" fill="var(--ms-baseline)" opacity=".75" /></svg>Sample</span>
        {allOverlays.map((o) => <span key={o.label}><svg viewBox="0 0 24 8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke={o.color} strokeWidth="2.5" strokeDasharray={o.dashed ? '5 3' : undefined} /></svg>{o.label}</span>)}
      </div>
      <details><summary>Show data table</summary>
        <div className="table-wrap tall" tabIndex={0} role="region" aria-label="Bin table">
          <table className="data"><thead><tr><th scope="col" className="num">From</th><th scope="col" className="num">To</th><th scope="col" className="num">Count</th><th scope="col" className="num">Share</th>{law && <th scope="col" className="num">Model</th>}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td className="num">{fmt(r.lo, 3)}</td><td className="num">{fmt(r.hi, 3)}</td><td className="num">{r.count}</td><td className="num">{fmt(r.observed * 100, 1)}%</td>{law && <td className="num">{fmt(r.expected * 100, 1)}%</td>}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Q–Q plot: sample quantiles against model quantiles; points near the diagonal = good agreement. */
export function QQPlot({ pairs, height = 240 }: { pairs: { theoretical: number; sample: number }[]; height?: number }) {
  const [box, W0] = useWidth();
  const W = Math.min(W0, 420), H = height, L = 46, R = 12, T = 10, B = 34;
  const vals = pairs.flatMap((p) => [p.theoretical, p.sample]).filter(Number.isFinite);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (v: number) => L + ((v - lo) / span) * (W - L - R), y = (v: number) => T + (1 - (v - lo) / span) * (H - T - B);
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Q–Q plot of sample quantiles against fitted model quantiles">
        <line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" />
        {pairs.filter((p) => Number.isFinite(p.theoretical)).map((p, i) => <circle key={i} cx={x(p.theoretical)} cy={y(p.sample)} r={3.2} fill="var(--ms-baseline)" opacity={0.8} />)}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--chart-axis)" /><line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--chart-axis)" />
        {[0, 0.5, 1].map((t) => <g key={t}><text x={x(lo + t * span)} y={H - B + 14} textAnchor="middle" style={AX}>{fmt(lo + t * span, 1)}</text><text x={L - 6} y={y(lo + t * span) + 4} textAnchor="end" style={AX}>{fmt(lo + t * span, 1)}</text></g>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={AX}>Model quantile</text>
        <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" style={AX}>Sample</text>
      </svg>
    </div>
  );
}

/** Scatter with true and fitted lines. */
export function Scatter({ x: xs, y: ys, lines, xLabel, yLabel }: { x: number[]; y: number[]; lines: { b0: number; b1: number; color: string; label: string; dashed?: boolean }[]; xLabel: string; yLabel: string }) {
  const [box, W] = useWidth();
  const H = 280, L = 50, R = 12, T = 10, B = 36;
  const xlo = 10, xhi = 20;
  const yAll = [...ys, ...lines.flatMap((l) => [l.b0 + l.b1 * xlo, l.b0 + l.b1 * xhi])];
  const ylo = Math.min(...yAll), yhi = Math.max(...yAll), ys2 = yhi - ylo || 1;
  const X = (v: number) => L + ((v - xlo) / (xhi - xlo)) * (W - L - R), Y = (v: number) => T + (1 - (v - ylo) / ys2) * (H - T - B);
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Scatter plot of ${xs.length} points with ${lines.map((l) => l.label).join(' and ')}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(ylo + t * ys2)} y2={Y(ylo + t * ys2)} stroke="var(--chart-grid)" /><text x={L - 6} y={Y(ylo + t * ys2) + 4} textAnchor="end" style={AX}>{fmt(ylo + t * ys2, 1)}</text></g>)}
        {xs.map((v, i) => <circle key={i} cx={X(v)} cy={Y(ys[i])} r={3.5} fill="var(--ms-baseline)" opacity={0.65} />)}
        {lines.map((l) => <line key={l.label} x1={X(xlo)} y1={Y(l.b0 + l.b1 * xlo)} x2={X(xhi)} y2={Y(l.b0 + l.b1 * xhi)} stroke={l.color} strokeWidth={2.5} strokeDasharray={l.dashed ? '7 5' : undefined} />)}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--chart-axis)" />
        {[10, 12.5, 15, 17.5, 20].map((v) => <text key={v} x={X(v)} y={H - B + 14} textAnchor="middle" style={AX}>{v}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={AX}>{xLabel}</text>
        <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" style={AX}>{yLabel}</text>
      </svg>
      <div className="legend">{lines.map((l) => <span key={l.label}><svg viewBox="0 0 24 8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dashed ? '5 3' : undefined} /></svg>{l.label}</span>)}</div>
    </div>
  );
}

/** Running proportion with a reference line (law of large numbers). */
export function RunningLine({ values, target, height = 200 }: { values: number[]; target: number; height?: number }) {
  const [box, W] = useWidth();
  const H = height, L = 46, R = 12, T = 10, B = 34, n = values.length;
  const step = Math.max(1, Math.floor(n / 400));
  const pts = values.filter((_, i) => i % step === 0 || i === n - 1).map((v, i, arr) => [i === arr.length - 1 ? n : i * step + 1, v] as [number, number]);
  const X = (k: number) => L + (Math.log(k) / Math.log(Math.max(2, n))) * (W - L - R), Y = (p: number) => T + (1 - p) * (H - T - B);
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Running share of heads over ${n} flips approaching ${target}`}>
        {[0, 0.5, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--chart-grid)" /><text x={L - 6} y={Y(t) + 4} textAnchor="end" style={AX}>{fmt(t * 100, 0)}%</text></g>)}
        <line x1={L} x2={W - R} y1={Y(target)} y2={Y(target)} stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" />
        <path d={`M${pts.map(([k, v]) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')}`} fill="none" stroke="var(--ms-baseline)" strokeWidth={2} />
        {[1, 10, 100, 1000, 10000].filter((k) => k <= n).map((k) => <text key={k} x={X(k)} y={H - B + 14} textAnchor="middle" style={AX}>{k}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={AX}>Number of flips (log scale)</text>
      </svg>
    </div>
  );
}
