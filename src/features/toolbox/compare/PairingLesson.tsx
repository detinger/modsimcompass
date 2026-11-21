import { useMemo } from 'react';
import { analyse, fmtNum } from '../../../domain/artefacts/comparison';
import { niceTicks, useWidth } from '../../../ui/charts';
import { exampleComparison } from './example';

/**
 * Why pairing matters, on the example: the same two capacities run twice, once with the same random arrivals for
 * both and once with separate arrivals. Both intervals on one axis, with the replications each would need.
 */
export function PairingLesson({ shared, onShared }: { shared: boolean; onShared: (shared: boolean) => void }) {
  const [box, W] = useWidth(640);
  const rows = useMemo(() => [true, false].map((s) => {
    const d = exampleComparison(s), an = analyse(d);
    return { shared: s, d, diff: an.difference, needed: an.precision.needed, target: d.targetHalfWidth, minimum: d.minimumDifference };
  }), []);
  const lo = Math.min(...rows.map((r) => r.diff.lower ?? 0), -(rows[0].minimum ?? 0)) - 1;
  const hi = Math.max(0, ...rows.map((r) => r.diff.upper ?? 0)) + 1;
  const L = 12, R = 12, H = 128;
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const minimum = rows[0].minimum;
  return (
    <section className="cmp-lesson" aria-labelledby="cmp-lesson-title">
      <div className="cmp-lesson-head">
        <h2 id="cmp-lesson-title">Why the same inputs matter</h2>
        <div className="seg" role="group" aria-label="Random inputs of the example">
          <button type="button" aria-pressed={shared} onClick={() => onShared(true)}>Same inputs</button>
          <button type="button" aria-pressed={!shared} onClick={() => onShared(false)}>Different inputs</button>
        </div>
      </div>
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
          aria-label={rows.map((r) => `${r.shared ? 'Same inputs' : 'Different inputs'}: interval ${fmtNum(r.diff.lower)} to ${fmtNum(r.diff.upper)}, half-width ${fmtNum(r.diff.halfWidth)}`).join('. ')}>
          {minimum !== null && <line className="cmp-l-min" x1={x(-minimum)} x2={x(-minimum)} y1={8} y2={H - 26} />}
          <line className="cmp-l-zero" x1={x(0)} x2={x(0)} y1={8} y2={H - 26} />
          {rows.map((r, i) => {
            const y = 30 + i * 40;
            const on = r.shared === shared;
            return (
              <g key={String(r.shared)} className={on ? 'is-on' : 'is-off'}>
                <text className="cmp-l-label" x={L} y={y - 10}>{r.shared ? 'Same inputs' : 'Different inputs'} · ± {fmtNum(r.diff.halfWidth)}</text>
                {r.diff.lower !== null && r.diff.upper !== null && <line className={`cmp-l-bar ${r.shared ? 'is-paired' : 'is-welch'}`} x1={x(r.diff.lower)} x2={x(r.diff.upper)} y1={y} y2={y} />}
                {r.diff.mean !== null && <circle className="cmp-l-dot" cx={x(r.diff.mean)} cy={y} r={5} />}
              </g>
            );
          })}
          <line className="cmp-l-axis" x1={L} x2={W - R} y1={H - 26} y2={H - 26} />
          {niceTicks(lo, hi, Math.max(3, Math.floor(W / 90))).map((t) => <text key={t} className="cmp-l-tick" x={x(t)} y={H - 10} textAnchor="middle">{String(t).replace('-', '−')}</text>)}
        </svg>
      </div>
      <ul className="cmp-lesson-facts">
        {rows.map((r) => (
          <li key={String(r.shared)} className={r.shared === shared ? 'is-on' : undefined}>
            <strong>{r.shared ? 'Same inputs' : 'Different inputs'}</strong>: about {r.needed ?? '—'} {r.shared ? 'pairs' : 'replications of each'} for ± {fmtNum(r.target)}
          </li>
        ))}
      </ul>
      <p className="hint">Same model, same capacities, same number of runs. Only the random arrivals differ. Dashed: the smallest difference that matters (−{fmtNum(minimum)}).</p>
    </section>
  );
}
