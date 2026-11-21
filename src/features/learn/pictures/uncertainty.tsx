import { useState } from 'react';
import { Play } from 'lucide-react';
import { UNCERTAINTY } from '../../../content/learn/ideas';
import { at, seeded } from './kit';
import { MotionProvider, useFrames, useReducedMotion } from './motion';

/* The picture for "Describing uncertainty": forty observed service times are plotted, stacked into a histogram,
   smoothed into a curve, and the curve is then sampled. Synthetic values, drawn from a fixed seed. */

const W = 560, H = 220;
const AXIS_Y = 176, BASE_Y = 168, GAP = 9, XMAX = 12;
const sx = (v: number) => 40 + (Math.min(v, XMAX) / XMAX) * (W - 70);
const MU = 1.2, SIGMA = 0.5;
const pdf = (x: number) => (x <= 0 ? 0 : Math.exp(-((Math.log(x) - MU) ** 2) / (2 * SIGMA * SIGMA)) / (x * SIGMA * Math.sqrt(2 * Math.PI)));

export const UNC = (() => {
  const u = seeded(23);
  const z = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  const draw = () => Math.min(XMAX - 0.05, Math.exp(MU + SIGMA * z()));
  const obs = Array.from({ length: 40 }, draw);
  const jitter = obs.map(() => (u() - 0.5) * 22);
  const inBin = Array<number>(XMAX).fill(0);
  const stack = obs.map((v) => { const b = Math.floor(v); const k = inBin[b]++; return { x: sx(b + 0.5), y: BASE_Y - k * GAP }; });
  const samples = Array.from({ length: 14 }, draw);
  /** The fitted curve, scaled so its area matches the stacked dots. */
  const curveY = (x: number) => BASE_Y + 4 - pdf(x) * obs.length * GAP;
  const curve = Array.from({ length: 97 }, (_, i) => { const x = 0.05 + (i / 96) * (XMAX - 0.05); return `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${curveY(x).toFixed(1)}`; }).join(' ');
  return { obs, jitter, stack, samples, curveY, curve, bins: inBin };
})();

/** Frame → stage. The sample stage has two frames: new values appear on the curve, then drop onto the axis. */
const FRAME_STAGE = [0, 1, 2, 3, 3, 3];
const STAGE_FRAME = [0, 1, 2, 4];

function Canvas({ pick }: { pick: number | null }) {
  const { ref, frame, moving } = useFrames<SVGSVGElement>(1900, 4);
  const f = pick === null ? frame % FRAME_STAGE.length : STAGE_FRAME[pick];
  const stage = FRAME_STAGE[f];
  const stacked = stage >= 1, fitted = stage >= 2, sampled = stage >= 3, dropped = f >= 4;
  const s = UNCERTAINTY.stages[stage];
  return (
    <svg ref={ref} className="lp-pic lp-unc" viewBox={`0 0 ${W} ${H}`} role="img" data-moving={moving ? 'true' : undefined}
      aria-label={`${UNCERTAINTY.title}, stage ${stage + 1} of 4, ${s.label}: ${s.text}`} style={{ ['--lp-ms' as string]: '900ms' }}>
      <text className="lp-stage" x={40} y={28}>{stage + 1} · {s.label}</text>
      <line className="lp-axis" x1={36} y1={AXIS_Y} x2={W - 24} y2={AXIS_Y} />
      {Array.from({ length: XMAX / 2 + 1 }, (_, i) => i * 2).map((v) => (
        <text key={v} className="lp-quiet" x={sx(v)} y={AXIS_Y + 16} textAnchor="middle">{v}</text>
      ))}
      <text className="lp-quiet" x={(W + 16) / 2} y={H - 6} textAnchor="middle">{UNCERTAINTY.axis}</text>
      <path className={`lp-trace lp-fade${fitted ? '' : ' is-hidden'}`} d={UNC.curve} />
      {UNC.obs.map((v, i) => {
        const p = stacked ? UNC.stack[i] : { x: sx(v), y: 150 + UNC.jitter[i] };
        return <circle key={i} className={`lp-obs lp-move${sampled ? ' is-dim' : ''}`} r={3.8} style={at(p.x, p.y)} />;
      })}
      {UNC.samples.map((v, i) => (
        <circle key={i} className="lp-new lp-move" r={4.2}
          style={{ ...at(sx(v), dropped ? AXIS_Y : UNC.curveY(v)), opacity: sampled ? 1 : 0, transitionDelay: dropped ? `${i * 45}ms` : '0ms' }} />
      ))}
    </svg>
  );
}

export function UncertaintyFigure() {
  const [pick, setPick] = useState<number | null>(null);
  const reduced = useReducedMotion();
  return (
    <figure className="lrn-unc">
      <figcaption className="lrn-fig-head"><strong>{UNCERTAINTY.title}</strong><span>{UNCERTAINTY.caption}</span></figcaption>
      <div className="lrn-unc-stage">
        <MotionProvider playing={pick === null}>
          <Canvas pick={pick} />
        </MotionProvider>
      </div>
      <div className="lrn-unc-controls">
        <div className="seg" role="group" aria-label="Stage">
          {UNCERTAINTY.stages.map((s, i) => (
            <button key={s.label} type="button" aria-pressed={pick === i} onClick={() => setPick(i)}>{i + 1} {s.label}</button>
          ))}
        </div>
        {!reduced && (
          <button type="button" className="btn small" disabled={pick === null} onClick={() => setPick(null)}>
            <Play size={14} aria-hidden="true" /> Play
          </button>
        )}
        {pick !== null && <p className="lrn-unc-text" aria-live="polite">{UNCERTAINTY.stages[pick].text}</p>}
      </div>
      <details className="lrn-astext"><summary>As text</summary><ul>{UNCERTAINTY.text.map((t) => <li key={t}>{t}</li>)}</ul></details>
    </figure>
  );
}
