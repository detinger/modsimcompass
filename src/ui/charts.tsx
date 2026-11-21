import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

/** Measure the rendered width so SVG text stays at its true pixel size (no viewBox scaling). */
export function useWidth(fallback = 640): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = Math.round(entries[0].contentRect.width);
      if (cw > 0) setW(Math.max(260, cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
import { fmt } from './controls';

/**
 * Theme-aware SVG charts (STYLE §8.4): colours from tokens, 11px axes, 2px lines,
 * zero-baseline bars, step series without smoothing, legend with line styles, and an
 * equivalent data table for every chart.
 */
export interface Series { label: string; values: number[]; color: 'baseline' | 'alternative' | 'reference' | 'c3'; dashed?: boolean }
const COLOR: Record<Series['color'], string> = { baseline: 'var(--ms-baseline)', alternative: 'var(--ms-alternative)', reference: 'var(--ms-reference)', c3: 'var(--chart-3)' };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
/** Round tick values (1, 2 or 5 × a power of ten apart) that lie inside [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [lo];
  const raw = (hi - lo) / target, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  const step = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k++) out.push(Number((k * step).toPrecision(12)));
  return out;
}
function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max * i) / count);
}

export function ChartFrame({ title, question, units, status, children, table, legend }: { title: string; question?: string; units?: string; status?: ReactNode; children: ReactNode; table?: ReactNode; legend?: ReactNode }) {
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <div className="chart-head">
        <h3 style={{ fontSize: 14 }}>{title}</h3>
        {status}
      </div>
      {question && <p className="chart-q">{question}{units ? ` Units: ${units}.` : ''}</p>}
      {children}
      {legend}
      {table && <details><summary>Show data table</summary>{table}</details>}
    </figure>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.label}>
          <svg viewBox="0 0 24 8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke={COLOR[s.color]} strokeWidth="2" strokeDasharray={s.dashed ? '5 3' : undefined} /></svg>
          {s.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Step chart of end-of-day values. x = day (1..n), with the initial value plotted at day 0.
 * Convention stated in the caption: points are end-of-day values; the step holds the value until the next day.
 */
export function StepChart({ series, initial, yLabel, xLabel = 'Day', height = 220, ariaLabel }: { series: Series[]; initial?: number[]; yLabel: string; xLabel?: string; height?: number; ariaLabel: string }) {
  const [box, W] = useWidth();
  const H = height, L = 52, R = 12, T = 10, B = 34;
  const n = Math.max(...series.map((s) => s.values.length), 1);
  const all = series.flatMap((s, i) => [...s.values, initial?.[i] ?? 0]);
  const yMax = niceMax(Math.max(...all, 0) * 1.05);
  const x = (d: number) => L + (d / n) * (W - L - R);
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const xt = n <= 12 && W > 360 ? Array.from({ length: n + 1 }, (_, i) => i) : Array.from({ length: 6 }, (_, i) => Math.round((n * i) / 5));
  return (
    <div ref={box}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel}>
      <g className="grid">{ticks(yMax).map((t) => <line key={t} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />)}</g>
      <g className="axis">
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} />
        <line x1={L} x2={L} y1={T} y2={H - B} />
        {ticks(yMax).map((t) => <text key={t} x={L - 6} y={y(t) + 4} textAnchor="end">{fmt(t, 1)}</text>)}
        {xt.map((d) => <text key={d} x={x(d)} y={H - B + 14} textAnchor="middle">{d}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle">{xLabel}</text>
        <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
      </g>
      {series.map((s, si) => {
        const pts: string[] = [];
        let prev = initial?.[si] ?? s.values[0] ?? 0;
        pts.push(`${x(0)},${y(prev)}`);
        s.values.forEach((v, i) => { pts.push(`${x(i + 1)},${y(prev)}`); pts.push(`${x(i + 1)},${y(v)}`); prev = v; });
        return <polyline key={s.label} points={pts.join(' ')} fill="none" stroke={COLOR[s.color]} strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined} />;
      })}
    </svg></div>
  );
}

export function StepTable({ series, initial, unit }: { series: Series[]; initial?: number[]; unit: string }) {
  const n = Math.max(...series.map((s) => s.values.length));
  return (
    <div className="table-wrap tall" tabIndex={0} role="region" aria-label="Chart data">
      <table className="data">
        <thead><tr><th scope="col">Day</th>{series.map((s) => <th key={s.label} scope="col" className="num">{s.label} ({unit})</th>)}</tr></thead>
        <tbody>
          {initial && <tr><td>0 (start)</td>{series.map((s, i) => <td key={s.label} className="num">{fmt(initial[i])}</td>)}</tr>}
          {Array.from({ length: n }, (_, d) => (
            <tr key={d}><td>{d + 1}</td>{series.map((s) => <td key={s.label} className="num">{fmt(s.values[d])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Histogram({ bins, xLabel, color = 'baseline', ariaLabel, height = 200, markers }: { bins: { from: number; to: number; count: number }[]; xLabel: string; color?: Series['color']; ariaLabel: string; height?: number; markers?: { value: number; label: string }[] }) {
  const [box, W] = useWidth();
  const H = height, L = 44, R = 12, T = 18, B = 34;
  if (!bins.length) return null;
  const min = bins[0].from, max = bins[bins.length - 1].to === min ? min + 1 : bins[bins.length - 1].to;
  const yMax = niceMax(Math.max(...bins.map((b) => b.count)));
  const x = (v: number) => L + ((v - min) / (max - min || 1)) * (W - L - R);
  const y = (c: number) => T + (1 - c / yMax) * (H - T - B);
  const single = bins.length === 1 && bins[0].from === bins[0].to;
  return (
    <div ref={box}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel}>
      <g className="grid">{ticks(yMax).map((t) => <line key={t} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />)}</g>
      {single ? (
        <rect x={(L + W - R) / 2 - 20} y={y(bins[0].count)} width={40} height={H - B - y(bins[0].count)} fill={COLOR[color]} opacity={0.85} />
      ) : bins.map((b, i) => (
        <rect key={i} x={x(b.from) + 1} y={y(b.count)} width={Math.max(1, x(b.to) - x(b.from) - 2)} height={H - B - y(b.count)} fill={COLOR[color]} opacity={0.85} />
      ))}
      {markers?.map((m, i) => !single && (
        <g key={i}>
          <line x1={x(m.value)} x2={x(m.value)} y1={T - 6} y2={H - B} stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 3" />
          <text x={x(m.value)} y={T - 8} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text)' }}>{m.label}</text>
        </g>
      ))}
      <g className="axis">
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} />
        {ticks(yMax).map((t) => <text key={t} x={L - 6} y={y(t) + 4} textAnchor="end">{fmt(t, 0)}</text>)}
        {single ? <text x={(L + W - R) / 2} y={H - B + 14} textAnchor="middle">{fmt(bins[0].from)}</text>
          : [0, 0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={x(min + f * (max - min))} y={H - B + 14} textAnchor="middle">{fmt(min + f * (max - min), 1)}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle">{xLabel}</text>
        <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle">Replications</text>
      </g>
    </svg></div>
  );
}

export function HistogramTable({ bins, unit }: { bins: { from: number; to: number; count: number }[]; unit: string }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Histogram data">
      <table className="data">
        <caption>Equal-width bins; each bin includes its lower edge; the last bin also includes its upper edge.</caption>
        <thead><tr><th scope="col">From ({unit})</th><th scope="col">To ({unit})</th><th scope="col" className="num">Replications</th></tr></thead>
        <tbody>{bins.map((b, i) => <tr key={i}><td>{fmt(b.from)}</td><td>{fmt(b.to)}</td><td className="num">{b.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** Horizontal interval display: point with whisker. Used for CI vs percentile panels. */
export function IntervalBar({ lower, upper, point, min, max, label, color = 'baseline' }: { lower: number; upper: number; point: number; min: number; max: number; label: string; color?: Series['color'] }) {
  const [box, W] = useWidth();
  const H = 46, L = 12, R = 12;
  const span = max - min || 1;
  const x = (v: number) => L + ((v - min) / span) * (W - L - R);
  const id = useId();
  return (
    <div ref={box}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby={id}>
      <title id={id}>{label}</title>
      <line x1={L} x2={W - R} y1={30} y2={30} stroke="var(--chart-axis)" />
      <line x1={x(lower)} x2={x(upper)} y1={18} y2={18} stroke={COLOR[color]} strokeWidth={3} />
      <line x1={x(lower)} x2={x(lower)} y1={11} y2={25} stroke={COLOR[color]} strokeWidth={2} />
      <line x1={x(upper)} x2={x(upper)} y1={11} y2={25} stroke={COLOR[color]} strokeWidth={2} />
      <circle cx={x(point)} cy={18} r={4} fill="var(--chart-surface)" stroke={COLOR[color]} strokeWidth={2} />
      {[0, 0.5, 1].map((f) => <text key={f} x={x(min + f * span)} y={44} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'} style={{ fontSize: 11, fill: 'var(--text-muted)' }}>{fmt(min + f * span, 1)}</text>)}
    </svg></div>
  );
}
