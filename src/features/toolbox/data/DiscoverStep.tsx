import { useMemo, useState } from 'react';
import { ArrowRight, Check, Info } from 'lucide-react';
import type { ArtefactEditor } from '../../../app/artefacts';
import type { DataModel } from '../../../domain/artefacts/types';
import { deltaAicLabel, qqPairs, type FitResult } from '../../../domain/distributions/fitting';
import { applyFit } from '../../../domain/distributions/inputModel';
import { FAMILIES, type Kind } from '../../../domain/distributions/laws';
import { sig } from '../../../domain/distributions/sample';
import { Callout } from '../../../ui/controls';
import { Thumb } from '../../../ui/playful';
import { ModelChart, QQChart, RangeStrip } from './charts';
import type { StepNo } from './Stepper';
import type { Sample } from './types';

const num = (x: number) => sig(x, 4).replace('-', '−');

function Tiles({ items }: { items: [string, string][] }) {
  return <dl className="dm-tiles">{items.map(([k, v]) => <div key={k} className="dm-tile"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function DiscoverStep({ editor, sample, onGo }: { editor: ArtefactEditor<'data-model'>; sample: Sample | null; onGo: (n: StepNo) => void }) {
  const d = editor.artefact.data;
  if (!sample) {
    if (d.summary) {
      const s = d.summary;
      return (
        <div className="dm-stack">
          <Callout tone="info" title="The data was not kept with this artefact.">What it stores: the summary and the ranking of the fits. Import the data again to see the histogram and the Q–Q plot.</Callout>
          <Tiles items={[['Values', String(s.n)], ['Mean', num(s.mean)], ['Standard deviation', num(s.sd)], ['Range', `${num(s.min)} to ${num(s.max)}`]]} />
          {d.fit && d.fit.candidates.length > 0 && <StoredFits fit={d.fit} />}
          <div className="btn-row"><button type="button" className="btn" onClick={() => onGo(1)}>Bring the data again</button></div>
        </div>
      );
    }
    return (
      <div className="dm-empty">
        <p><strong>No data to discover.</strong></p>
        <p className="muted">{d.origin === 'described' ? 'Your model comes from your answers. That is fine: say so in step 5.' : 'Bring a CSV file or paste numbers, or describe the input without data.'}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => onGo(1)}>Bring data</button>
          <button type="button" className="btn primary" onClick={() => onGo(3)}>Settle the model <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
      </div>
    );
  }
  return <WithData editor={editor} sample={sample} onGo={onGo} />;
}

function StoredFits({ fit }: { fit: NonNullable<DataModel['fit']> }) {
  const best = Math.min(...fit.candidates.map((c) => c.aic));
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Stored ranking of the fits">
      <table className="data">
        <caption>Ranking stored with the artefact (lower AIC fits better)</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Family</th><th scope="col" className="num">AIC</th><th scope="col" className="num">Difference</th><th scope="col">Support</th></tr></thead>
        <tbody>{fit.candidates.map((c, i) => (
          <tr key={c.family}><td>{i + 1}{i + 1 === fit.rank ? ' (in use)' : ''}</td><td>{FAMILIES[c.family].title}</td><td className="num">{num(c.aic)}</td><td className="num">{num(c.aic - best)}</td><td>{deltaAicLabel(c.aic - best)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function WithData({ editor, sample, onGo }: { editor: ArtefactEditor<'data-model'>; sample: Sample; onGo: (n: StepNo) => void }) {
  const d = editor.artefact.data;
  const { prepared } = sample;
  const s = prepared.summary;
  const inUse: Kind | null = d.origin === 'fitted' && prepared.fits.some((f) => f.kind === d.family) ? d.family : null;
  const [picked, setPicked] = useState<Kind | null>(inUse ?? prepared.fits[0]?.kind ?? null);
  const chosen: FitResult | null = prepared.fits.find((f) => f.kind === picked) ?? prepared.fits[0] ?? null;
  const pairs = useMemo(() => (chosen ? qqPairs(chosen.law, prepared.fitted) : []), [chosen, prepared.fitted]);
  const best = prepared.fits[0]?.aic ?? 0;

  return (
    <div className="dm-stack">
      <Tiles items={[['Values', String(s.n)], ['Mean', num(s.mean)], ['Standard deviation', num(s.sd)], ['Median', num(s.median)], ['Range', `${num(s.min)} to ${num(s.max)}`]]} />
      <RangeStrip s={s} unit={d.unit} />
      {prepared.fitted.length < s.n && <p className="hint"><Info size={13} aria-hidden="true" /> The fits use {prepared.fitted.length} of the {s.n} values, taken at even steps through the list.</p>}

      {prepared.fits.length === 0 ? (
        <>
          <ModelChart title="The data" values={prepared.values} unit={d.unit} />
          <Callout tone="info">{s.n < 3 ? 'At least 3 values are needed to fit a curve.' : 'No candidate could be fitted to these values.'} Set the model by hand in step 3.</Callout>
        </>
      ) : (
        <>
          <div className="dm-two">
            <ModelChart title={`The data and ${chosen ? FAMILIES[chosen.kind].title : 'the model'}`} values={prepared.values} law={chosen?.law} unit={d.unit} modelLabel={chosen ? `${FAMILIES[chosen.kind].title} fit` : 'Model'} />
            {chosen && (
              <div>
                <QQChart pairs={pairs} unit={d.unit} />
                <p className="hint">On the line: the shapes agree. Bending away at the ends: the tails differ.</p>
              </div>
            )}
          </div>

          <div className="dm-fits">
            <h3 className="dm-sub">Which curve fits best?</h3>
            <p className="hint">Maximum likelihood, ranked by AIC. The bar is the relative support among these candidates only.</p>
            <ul className="dm-fit-list">
              {prepared.fits.map((f, i) => {
                const delta = f.aic - best;
                return (
                  <li key={f.kind}>
                    <button type="button" className="dm-fit" aria-pressed={chosen?.kind === f.kind} onClick={() => setPicked(f.kind)}>
                      <span className="dm-fit-rank" aria-hidden="true">{i + 1}</span>
                      <Thumb kind={f.kind} fields={f.params} className="thumb dm-fit-thumb" />
                      <span className="dm-fit-name"><strong>{FAMILIES[f.kind].title}</strong>{f.kind === inUse && <span className="badge success"><Check size={11} aria-hidden="true" /> In use</span>}</span>
                      <span className="dm-fit-bar" aria-hidden="true"><span style={{ width: `${Math.max(2, prepared.weights[i] * 100)}%` }} /></span>
                      <span className="dm-fit-meta">{deltaAicLabel(delta)}{i > 0 ? ` · +${num(delta)}` : ''}<span className="sr-only">. Rank {i + 1}. Akaike weight {num(prepared.weights[i] * 100)} percent.</span></span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {prepared.countData && <p className="hint">Whole numbers: each curve is scored by the chance it gives each value (x ± ½), so curves and counts compare fairly.</p>}
            {chosen && (
              <div className="dm-chosen">
                <div>
                  <strong>{FAMILIES[chosen.kind].title}</strong>
                  <span className="muted"> · {chosen.paramLabels.map((l, k) => `${l} ${num(chosen.params[k])}`).join(' · ')}</span>
                  <div className="hint">AIC {num(chosen.aic)}{chosen.ksD !== null ? ` · largest gap to the data (KS distance) ${num(chosen.ksD)}` : ''} · {chosen.method}</div>
                </div>
                {chosen.kind === inUse
                  ? <button type="button" className="btn" onClick={() => onGo(3)}>In use. Settle <ArrowRight size={14} aria-hidden="true" /></button>
                  : <button type="button" className="btn primary" onClick={() => editor.setData((x) => applyFit(x, prepared, chosen))}>Use {FAMILIES[chosen.kind].title}</button>}
              </div>
            )}
            {prepared.failures.length > 0 && <p className="hint">Not fitted: {prepared.failures.map((f) => `${FAMILIES[f.kind].title} (${f.reason.replace(/\.$/, '').toLowerCase()})`).join('; ')}.</p>}
            <details className="dm-table-fold">
              <summary>How to read this</summary>
              <ul className="dm-read">
                <li>AIC = 2k − 2 × log-likelihood. Lower is better; it rewards fit and charges for parameters.</li>
                <li>A difference of 2 or less: similar support. Prefer the family whose story matches how the values arise.</li>
                <li>No p-values: with parameters estimated from the same data they would not be valid.</li>
                <li>The best of these candidates may still be wrong. Look at the Q–Q plot.</li>
              </ul>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
