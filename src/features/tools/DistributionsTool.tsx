import { useMemo, useState } from 'react';
import { Download, GitFork } from 'lucide-react';
import { Link, useRouter } from '../../app/router';
import { FAMILIES, isKind, KINDS, lawFor, lawSD, type Kind } from '../../domain/distributions/laws';
import { binDraws, drawFrom, median } from '../../domain/distributions/preview';
import { FAMILY_NOTES } from '../../domain/distributions/tree';
import { pythonCode, rCode } from '../../domain/distributions/code';
import { Callout, downloadFile, fmt } from '../../ui/controls';
import { CodeTabs, Thumb } from '../../ui/playful';
import { DistChart } from './toolCharts';
import { ToolFrame } from './ToolFrame';
import { SendDistribution } from './SendDistribution';

const GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: 'Continuous', kinds: KINDS.filter((k) => !FAMILIES[k].discrete) },
  { title: 'Discrete', kinds: KINDS.filter((k) => FAMILIES[k].discrete) },
];
const SIZES = [100, 1000, 5000, 10000];

function initialFields(kind: Kind): string[] {
  const p = new URLSearchParams(window.location.search).get('p');
  const parts = p ? p.split('|') : null;
  return parts && parts.length === FAMILIES[kind].params.length ? parts : FAMILIES[kind].defaults.map(String);
}

export default function DistributionsTool({ kind: routeKind }: { kind?: string }) {
  const { navigate } = useRouter();
  const kind: Kind = routeKind && isKind(routeKind) ? routeKind : 'normal';
  return <Explorer key={kind} kind={kind} onKind={(k) => navigate(`/tools/distributions/${k}`)} />;
}

function Explorer({ kind, onKind }: { kind: Kind; onKind: (k: Kind) => void }) {
  const fam = FAMILIES[kind];
  const [fields, setFields] = useState<string[]>(() => initialFields(kind));
  const [n, setN] = useState(1000);
  const [seed, setSeed] = useState('42');
  const [qx, setQx] = useState('');
  const [qp, setQp] = useState('0.95');
  const { law, error } = useMemo(() => { try { return { law: lawFor(kind, fields), error: null }; } catch (e) { return { law: null, error: e instanceof Error ? e.message : String(e) }; } }, [kind, fields]);
  const draws = useMemo(() => (law ? drawFrom(law, seed || '0', kind, n) : null), [law, seed, kind, n]);
  const rows = useMemo(() => (law && draws ? binDraws(law, draws) : null), [law, draws]);
  const sMean = draws ? draws.reduce((a, b) => a + b, 0) / draws.length : NaN;
  const sSd = draws ? Math.sqrt(draws.reduce((s, x) => s + (x - sMean) ** 2, 0) / Math.max(1, draws.length - 1)) : NaN;
  const note = FAMILY_NOTES[kind];

  return (
    <ToolFrame id="distributions">
      <div className="lab-panel" style={{ marginBottom: 16 }}>
        {GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: 10 }}>
            <p className="field-label" style={{ margin: '0 0 6px' }}>{g.title}</p>
            <div className="family-picker" role="group" aria-label={`${g.title} families`}>
              {g.kinds.map((k) => (
                <button key={k} className={`family-btn ${FAMILIES[k].discrete ? 'tone-purple' : 'tone-blue'}`} aria-pressed={k === kind} onClick={() => onKind(k)}>
                  <Thumb kind={k} fields={FAMILY_NOTES[k]?.thumb ?? FAMILIES[k].defaults} />{FAMILIES[k].title}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="subtle-text" style={{ margin: 0 }}><GitFork size={13} aria-hidden="true" /> Unsure? <Link to="/tools/choose">Let the questions choose</Link>.</p>
      </div>

      <div className="lab-layout">
        <aside className={`lab-panel ${fam.discrete ? 'tone-purple' : 'tone-blue'}`} aria-label="Parameters">
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>{fam.title}</h2>
          {note && <p className="muted" style={{ fontSize: 13, margin: '0 0 4px' }}>{note.use}</p>}
          {note && <p className="subtle-text" style={{ marginTop: 0 }}>e.g. {note.example}</p>}
          <p className="subtle-text">Support: {fam.support}</p>
          {fam.params.map((p, i) => (
            <div key={p} className="field">
              <label htmlFor={`dp-${i}`}>{p}</label>
              <input id={`dp-${i}`} type="text" value={fields[i]} aria-invalid={error ? true : undefined}
                onChange={(e) => setFields(fields.map((f, j) => (j === i ? e.target.value : f)))} />
            </div>
          ))}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="field"><span className="field-label">Draws</span>
            <div className="seg" role="group" aria-label="Number of draws">{SIZES.map((s) => <button key={s} aria-pressed={n === s} onClick={() => setN(s)}>{s.toLocaleString('en-GB')}</button>)}</div>
          </div>
          <div className="field"><label htmlFor="dseed">Seed</label><input id="dseed" type="text" value={seed} maxLength={32} onChange={(e) => setSeed(e.target.value)} /><span className="hint">Same seed → same draws.</span></div>
          <button className="btn small ghost" onClick={() => setFields(fam.defaults.map(String))}>Reset parameters</button>
        </aside>

        <section className="stack" style={{ minWidth: 0 }}>
          {law && rows && draws ? (
            <div className="lab-panel">
              <div className="stat-row">
                <div className="stat"><small>Sample mean</small><strong>{fmt(sMean, 3)}</strong></div>
                <div className="stat"><small>Model mean</small><strong>{law.undefinedMean ? 'none' : fmt(law.mean, 3)}</strong></div>
                <div className="stat"><small>Sample SD</small><strong>{fmt(sSd, 3)}</strong></div>
                <div className="stat"><small>Model SD</small><strong>{law.undefinedMean ? 'none' : fmt(lawSD(law), 3)}</strong></div>
                <div className="stat"><small>Median</small><strong>{fmt(median(draws), 3)}</strong></div>
              </div>
              {law.undefinedMean && <Callout tone="warning">The Cauchy distribution has no mean: sample averages never settle, however many draws you take.</Callout>}
              <DistChart rows={rows} law={law} unit="Value" />
              <p className="subtle-text">{n.toLocaleString('en-GB')} seeded draws by inverse-CDF sampling. More draws → bars hug the model.</p>
            </div>
          ) : <div className="lab-panel"><p className="muted">Fix the parameters to see the distribution.</p></div>}

          {law && (
            <div className="lab-panel">
              <h3 style={{ fontSize: 15 }}>Ask the model</h3>
              <div className="grid two">
                <div className="field"><label htmlFor="qx">Value x</label><input id="qx" type="text" value={qx} placeholder="e.g. 1.5" onChange={(e) => setQx(e.target.value)} />
                  {qx.trim() !== '' && Number.isFinite(Number(qx)) && <span className="hint">{law.discrete ? 'P(X = x)' : 'Density f(x)'} = {fmt(law.pdf(Number(qx)), 5)} · P(X ≤ x) = {fmt(law.cdf(Number(qx)), 5)}</span>}
                </div>
                <div className="field"><label htmlFor="qp">Probability p</label><input id="qp" type="text" value={qp} onChange={(e) => setQp(e.target.value)} />
                  <span className="hint">{Number(qp) > 0 && Number(qp) < 1 ? `${fmt(Number(qp) * 100, 1)}% of values are ≤ ${fmt(law.inv(Number(qp)), 4)}` : 'Enter p between 0 and 1.'}</span>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn small ghost" disabled={!draws} onClick={() => draws && downloadFile(`${kind}-draws.csv`, `draw,value\r\n${draws.map((v, i) => `${i + 1},${v}`).join('\r\n')}\r\n`, 'text/csv')}><Download size={14} aria-hidden="true" /> Draws (CSV)</button>
              </div>
            </div>
          )}
          {law && <SendDistribution kind={kind} fields={fields} provenance="Chosen in Tools: Distribution explorer (not fitted to data)" />}
          <CodeTabs r={rCode(kind, fields, n)} py={pythonCode(kind, fields, n)} />
        </section>
      </div>
    </ToolFrame>
  );
}
