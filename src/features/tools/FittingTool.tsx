import { useMemo, useState } from 'react';
import { Eye, EyeOff, Shuffle, Wand2 } from 'lucide-react';
import { Link } from '../../app/router';
import { DATASETS } from '../../domain/distributions/datasets';
import { deltaAicLabel, fitAll, parseData, qqPairs, type FitResult } from '../../domain/distributions/fitting';
import { describeLaw, FAMILIES, lawFor, type Kind } from '../../domain/distributions/laws';
import { binDraws, drawFrom } from '../../domain/distributions/preview';
import { fitPythonCode, fitRCode } from '../../domain/distributions/code';
import { Callout, fmt } from '../../ui/controls';
import { CodeTabs, Thumb } from '../../ui/playful';
import { DistChart, QQPlot } from './toolCharts';
import { ToolFrame } from './ToolFrame';
import { SendDistribution } from './SendDistribution';

const MYSTERY: { kind: Kind; fields: number[] }[] = [
  { kind: 'gamma', fields: [3, 2] }, { kind: 'weibull', fields: [1.6, 8] }, { kind: 'lognormal', fields: [1.5, 0.4] },
  { kind: 'normal', fields: [20, 3] }, { kind: 'exponential', fields: [0.25] }, { kind: 'poisson', fields: [6] }, { kind: 'triangular', fields: [2, 4, 10] },
];
const TONES: Record<string, string> = { normal: 'tone-blue', lognormal: 'tone-orange', exponential: 'tone-teal', gamma: 'tone-purple', weibull: 'tone-brown', logistic: 'tone-blue', uniform: 'tone-teal', triangular: 'tone-orange', poisson: 'tone-purple', geometric: 'tone-brown' };
type Source = 'example' | 'paste' | 'mystery';

export default function FittingTool() {
  const [source, setSource] = useState<Source>('example');
  const [datasetId, setDatasetId] = useState(DATASETS[0].id);
  const [text, setText] = useState('');
  const [mysteryN, setMysteryN] = useState(150);
  const [mysteryRound, setMysteryRound] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [selected, setSelected] = useState<Kind | null>(null);

  const mystery = MYSTERY[(mysteryRound * 5) % MYSTERY.length];
  const { values, rejected, label, parsedNote } = useMemo(() => {
    if (source === 'example') { const d = DATASETS.find((x) => x.id === datasetId)!; return { values: d.values, rejected: [] as string[], label: d.label, parsedNote: '' }; }
    if (source === 'paste') {
      const p = parseData(text);
      const parsedNote = p.commaIsDecimal ? 'Commas were read as decimal commas (1,5 = 1.5).' : p.decimalCommas.length ? `Read as separate values: ${p.decimalCommas.join(' · ')}. Use a dot for decimals, or separate values with spaces only.` : '';
      return { values: p.values, rejected: p.rejected, label: 'Your data', parsedNote };
    }
    return { values: drawFrom(lawFor(mystery.kind, mystery.fields), `mystery-${mysteryRound}`, 'fit', mysteryN), rejected: [] as string[], label: `Mystery sample #${mysteryRound}`, parsedNote: '' };
  }, [source, datasetId, text, mystery, mysteryRound, mysteryN]);

  const result = useMemo(() => (values.length >= 3 ? fitAll(values) : null), [values]);
  const best = result?.fits[0] ?? null;
  const chosen: FitResult | null = result?.fits.find((f) => f.kind === selected) ?? best;
  const weights = useMemo(() => {
    if (!result?.fits.length) return [];
    const w = result.fits.map((f) => Math.exp(-(f.aic - result.fits[0].aic) / 2));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  }, [result]);
  const n = values.length;
  const m = n ? values.reduce((a, b) => a + b, 0) / n : NaN;
  const sd = n > 1 ? Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : NaN;
  const rows = useMemo(() => (chosen && n ? binDraws(chosen.law, values, chosen.law.discrete ? 30 : Math.min(30, Math.max(8, Math.round(Math.sqrt(n) * 1.5)))) : null), [chosen, values, n]);

  return (
    <ToolFrame id="fitting">
      <div className="lab-layout">
        <aside className="lab-panel" aria-label="Data">
          <div className="seg" role="tablist" aria-label="Data source" style={{ marginBottom: 12 }}>
            <button role="tab" aria-selected={source === 'example'} onClick={() => { setSource('example'); setSelected(null); }}>Examples</button>
            <button role="tab" aria-selected={source === 'paste'} onClick={() => { setSource('paste'); setSelected(null); }}>My data</button>
            <button role="tab" aria-selected={source === 'mystery'} onClick={() => { setSource('mystery'); setSelected(null); setReveal(false); }}>Mystery</button>
          </div>
          {source === 'example' && (
            <div className="option-list">
              {DATASETS.map((d) => (
                <label key={d.id} className={`option${datasetId === d.id ? ' chosen' : ''}`}>
                  <input type="radio" name="ds" checked={datasetId === d.id} onChange={() => { setDatasetId(d.id); setSelected(null); }} />
                  <span><strong>{d.label}</strong><br /><span className="subtle-text">{d.note}</span></span>
                </label>
              ))}
            </div>
          )}
          {source === 'paste' && (
            <div className="field">
              <label htmlFor="fit-data">Paste numbers</label>
              <textarea id="fit-data" rows={8} value={text} onChange={(e) => { setText(e.target.value); setSelected(null); }} placeholder="e.g. 4.2, 5.1, 3.8 …  (commas, spaces or new lines)" />
              <span className="hint">Up to 5,000 values. Nothing leaves your browser.</span>
              {rejected.length > 0 && <span className="field-error">Ignored: {rejected.slice(0, 5).join(', ')}{rejected.length > 5 ? ' …' : ''}</span>}
              {source === 'paste' && parsedNote && <span className="hint" role="status">{parsedNote}</span>}
            </div>
          )}
          {source === 'mystery' && (
            <div>
              <p style={{ fontSize: 15, fontWeight: 650, margin: '0 0 6px' }}>🕵️ A hidden distribution made this data.</p>
              <p className="subtle-text">Can the fitting find it? Fewer points make it harder.</p>
              <div className="seg" role="group" aria-label="Sample size">{[30, 150, 1000].map((k) => <button key={k} aria-pressed={mysteryN === k} onClick={() => setMysteryN(k)}>{k} points</button>)}</div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn small" onClick={() => { setMysteryRound((r) => r + 1); setReveal(false); setSelected(null); }}><Shuffle size={14} aria-hidden="true" /> New mystery</button>
                <button className="btn small primary" onClick={() => setReveal((v) => !v)}>{reveal ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} {reveal ? 'Hide' : 'Reveal'} the truth</button>
              </div>
              {reveal && <Callout tone="evidence" title={`Truth: ${describeLaw(mystery.kind, mystery.fields)}`}>{best?.kind === mystery.kind ? 'The lowest AIC picked the right family.' : `The lowest AIC picked ${best ? FAMILIES[best.kind].title : '—'}. Similar shapes can fit equally well — especially with few points.`}</Callout>}
            </div>
          )}
          <div className="stat-row">
            <div className="stat"><small>n</small><strong>{n}</strong></div>
            <div className="stat"><small>Mean</small><strong>{fmt(m)}</strong></div>
            <div className="stat"><small>SD</small><strong>{fmt(sd)}</strong></div>
            <div className="stat"><small>Range</small><strong style={{ fontSize: 14 }}>{n ? `${fmt(Math.min(...values))}–${fmt(Math.max(...values))}` : '—'}</strong></div>
          </div>
          <p className="subtle-text"><Wand2 size={13} aria-hidden="true" /> Not sure what shape to expect? <Link to="/tools/choose">Choose a distribution</Link> from what you know about the process.</p>
        </aside>

        <section style={{ minWidth: 0 }} className="stack">
          {!result ? <div className="lab-panel"><p className="muted">Add at least 3 numbers to fit.</p></div> : (
            <>
              <div className="lab-panel">
                <div className="card-head"><h2 style={{ margin: 0 }}>Which curve fits best?</h2><span className="subtle-text">{label} · maximum likelihood · ranked by AIC</span></div>
                <div role="group" aria-label="Fitted families">
                  {result.fits.map((f, i) => (
                    <button key={f.kind} className={`fit-row ${TONES[f.kind] ?? 'tone-primary'}`} aria-pressed={chosen?.kind === f.kind} onClick={() => setSelected(f.kind)}>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{i === 0 ? '🏅' : <span style={{ width: 20, textAlign: 'center' }} className="subtle-text">{i + 1}</span>}<strong>{FAMILIES[f.kind].title}</strong></span>
                      <span className="fit-bar" title={`Akaike weight ${fmt(weights[i] * 100, 1)}%`}><span style={{ width: `${Math.max(2, weights[i] * 100)}%` }} /></span>
                      <span className="subtle-text fit-meta" style={{ minWidth: 150, textAlign: 'right' }}>{deltaAicLabel(f.aic - result.fits[0].aic)} · ΔAIC {fmt(f.aic - result.fits[0].aic, 1)}</span>
                    </button>
                  ))}
                </div>
                {result.failures.length > 0 && <p className="subtle-text">Not fitted: {result.failures.map((f) => `${FAMILIES[f.kind].title} (${f.reason.replace(/\.$/, '').toLowerCase()})`).join('; ')}.</p>}
                <details>
                  <summary>How to read this</summary>
                  <ul className="muted" style={{ fontSize: 13 }}>
                    <li>Each family is fitted by maximum likelihood. AIC = 2k − 2·log-likelihood rewards fit and penalises parameters.</li>
                    <li>Bars show Akaike weights: relative support <em>among these candidates only</em>. None of them may be right.</li>
                    <li>ΔAIC ≤ 2: similar support. Prefer the family whose story matches how the data arise.</li>
                    <li>The Kolmogorov–Smirnov distance D is shown, but no p-value: with estimated parameters the usual p-value is invalid.</li>
                  </ul>
                </details>
              </div>

              {chosen && rows && (
                <div className={`lab-panel ${TONES[chosen.kind] ?? ''}`}>
                  <div className="card-head">
                    <h2 style={{ margin: 0, display: 'flex', gap: 10, alignItems: 'center' }}><Thumb kind={chosen.kind} fields={chosen.params} className="thumb" />{describeLaw(chosen.kind, chosen.params.map((p) => Number(p.toPrecision(4))))}</h2>
                  </div>
                  <div className="stat-row fit-stats">
                    {chosen.paramLabels.map((l, i) => <div key={l} className="stat"><small>{l}</small><strong>{fmt(Number(chosen.params[i].toPrecision(4)), 4)}</strong></div>)}
                    <div className="stat"><small>Log-likelihood</small><strong>{fmt(chosen.logLik, 2)}</strong></div>
                    <div className="stat"><small>AIC</small><strong>{fmt(chosen.aic, 1)}</strong></div>
                    <div className="stat"><small>BIC</small><strong>{fmt(chosen.bic, 1)}</strong></div>
                    {chosen.ksD !== null && <div className="stat"><small>KS distance D</small><strong>{fmt(chosen.ksD, 3)}</strong></div>}
                  </div>
                  <div className="grid two">
                    <div><h3 style={{ fontSize: 14 }}>Data vs fitted curve</h3>
                      <DistChart rows={rows} law={chosen.law} overlays={best && best.kind !== chosen.kind ? [{ law: best.law, color: 'var(--text-muted)', label: `Best AIC: ${FAMILIES[best.kind].title}`, dashed: true }] : []} />
                    </div>
                    <div><h3 style={{ fontSize: 14 }}>Q–Q plot</h3>
                      <QQPlot pairs={qqPairs(chosen.law, values)} />
                      <p className="subtle-text">Dots on the dashed line → the shapes agree. Curving tails → the model misses the extremes.</p>
                    </div>
                  </div>
                  <p className="subtle-text">Method: {chosen.method}.</p>
                  <SendDistribution kind={chosen.kind} fields={chosen.params.map((p) => Number(p.toPrecision(4)))} label={source === 'paste' ? 'Fitted input' : label}
                    provenance={`Maximum-likelihood fit to ${n} values (${label}) in Tools: Fit a distribution; AIC ${fmt(chosen.aic, 1)}, rank ${result.fits.indexOf(chosen) + 1} of ${result.fits.length}`} />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <Link className="btn small ghost" to={`/tools/distributions/${chosen.kind}?p=${encodeURIComponent(chosen.params.map((p) => Number(p.toPrecision(4))).join('|'))}`}>Open in explorer</Link>
                  </div>
                </div>
              )}
              <CodeTabs title="Same fit in R (fitdistrplus) or Python (scipy)" r={fitRCode(values)} py={fitPythonCode(values)} />
            </>
          )}
        </section>
      </div>
    </ToolFrame>
  );
}
