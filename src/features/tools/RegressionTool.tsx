import { useMemo, useState } from 'react';
import { Repeat } from 'lucide-react';
import { ols, repeatedSlopes, simulateLinear } from '../../domain/distributions/experiments';
import { histogram } from '../../domain/sandbox/stats';
import { LINEAR_CODE } from '../../domain/distributions/code';
import { NumberField, fmt } from '../../ui/controls';
import { Histogram } from '../../ui/charts';
import { CodeTabs } from '../../ui/playful';
import { Scatter } from './toolCharts';
import { ToolFrame } from './ToolFrame';

export default function RegressionTool() {
  const [b0, setB0] = useState(10);
  const [b1, setB1] = useState(1);
  const [sigma, setSigma] = useState(2);
  const [n, setN] = useState(30);
  const [round, setRound] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const sample = useMemo(() => simulateLinear(b0, b1, sigma, n, `lm-${round}`), [b0, b1, sigma, n, round]);
  const fit = useMemo(() => ols(sample.x, sample.y), [sample]);
  const slopes = useMemo(() => (repeat ? repeatedSlopes(b0, b1, sigma, n, `lm-${round}`, 300) : null), [repeat, b0, b1, sigma, n, round]);
  const covered = fit.slopeCI ? fit.slopeCI[0] <= b1 && b1 <= fit.slopeCI[1] : null;
  return (
    <ToolFrame id="regression">
      <div className="lab-layout">
        <aside className="lab-panel tone-brown" aria-label="Model settings">
          <p className="formula" style={{ fontSize: 15, textAlign: 'center' }}>y = β₀ + β₁·x + ε,  ε ~ N(0, σ²)</p>
          <NumberField label="Intercept β₀" value={b0} min={-5} max={25} step={0.5} slider onChange={setB0} />
          <NumberField label="Slope β₁" value={b1} min={-3} max={3} step={0.1} slider onChange={setB1} />
          <NumberField label="Noise σ" value={sigma} min={0} max={10} step={0.1} slider onChange={(v) => setSigma(Math.max(0, v))} />
          <NumberField label="Sample size n" value={n} min={5} max={500} step={5} integer slider onChange={(v) => setN(Math.max(3, Math.min(500, v)))} />
          <button className="btn primary" onClick={() => setRound((r) => r + 1)}>New sample</button>
        </aside>
        <section className="stack" style={{ minWidth: 0 }}>
          <div className="lab-panel">
            <Scatter x={sample.x} y={sample.y} xLabel="Length (cm)" yLabel="Swim speed (cm/s)"
              lines={[{ b0, b1, color: 'var(--chart-3)', label: 'True line' }, { b0: fit.intercept, b1: fit.slope, color: 'var(--accent)', label: 'OLS estimate', dashed: true }]} />
            <div className="stat-row">
              <div className="stat"><small>Estimated slope β̂₁</small><strong>{fmt(fit.slope, 3)}</strong></div>
              <div className="stat"><small>95% CI for β₁</small><strong style={{ fontSize: 15 }}>{fit.slopeCI ? `${fmt(fit.slopeCI[0], 2)} to ${fmt(fit.slopeCI[1], 2)}` : '—'}</strong></div>
              <div className="stat"><small>Covers true β₁?</small><strong>{covered === null ? '—' : covered ? 'Yes ✓' : 'No ✗'}</strong></div>
              <div className="stat"><small>R²</small><strong>{fmt(fit.r2, 3)}</strong></div>
            </div>
            <p className="subtle-text">Turn up σ or turn down n: the dashed line wanders away from the truth.</p>
          </div>
          <div className="lab-panel">
            <div className="card-head"><h2 style={{ fontSize: 16, margin: 0 }}>Repeat the experiment 300 times</h2>
              <button className="btn small" aria-pressed={repeat} onClick={() => setRepeat((v) => !v)}><Repeat size={14} aria-hidden="true" /> {repeat ? 'Hide' : 'Run'}</button></div>
            {slopes && (
              <>
                <Histogram bins={histogram(slopes, 20)} xLabel="Estimated slope β̂₁" color="c3" ariaLabel="Histogram of 300 slope estimates" markers={[{ value: b1, label: 'true β₁' }]} />
                <p className="subtle-text">Each sample gives a different estimate. The spread is the uncertainty a single study cannot see.</p>
              </>
            )}
          </div>
          <p className="subtle-text">A fitted slope describes an association in these data. Reading it as “change x and y will follow” needs a causal argument.</p>
          <CodeTabs r={LINEAR_CODE.r(b0, b1, sigma, n)} py={LINEAR_CODE.py(b0, b1, sigma, n)} />
        </section>
      </div>
    </ToolFrame>
  );
}
