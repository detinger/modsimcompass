import { useId, useMemo } from 'react';
import { useArtefacts } from '../../../../app/artefacts';
import { sampleSizeText } from '../../../../domain/artefacts/measurementData';
import type { MeasurementData } from '../../../../domain/artefacts/types';
import { reliabilityScreen } from '../../../../domain/measurement/build';
import { maxInDegree, type Cell } from '../../../../domain/measurement/stats';
import { OptionalNumber } from '../../compare/fields';
import type { MEdit } from './MeasurementTool';

const f2 = (x: number | null) => (x === null ? '—' : x.toFixed(2).replace('-', '−'));

/** Alpha on a 0–1 track, with the common 0.7 rule-of-thumb mark. Decorative: the number is stated next to it. */
function AlphaTrack({ alpha }: { alpha: number }) {
  const at = Math.max(0, Math.min(1, alpha)) * 100;
  return (
    <span className="ms-track" aria-hidden="true">
      <span className="ms-track-fill" style={{ width: `${at}%` }} />
      <span className="ms-track-mark" style={{ left: '70%' }} />
    </span>
  );
}

/**
 * A quick screen of internal consistency: alpha per reflective construct and, per item, its correlation with the rest
 * of its construct and the alpha without it. Worded as a screen; it validates nothing and gives no p-values.
 */
export function ReliabilityStep({ d, rows, edit }: { d: MeasurementData; rows: Cell[][] | null; edit: MEdit }) {
  const base = useId();
  const { ofKind } = useArtefacts();
  const screen = useMemo(() => (rows ? reliabilityScreen(d, rows) : null), [d, rows]);
  // The busiest construct in the latest conceptual model: a suggestion for the sample-size note.
  const concept = ofKind('concept-model')[0];
  const fromConcept = concept ? maxInDegree(concept.data.edges.filter((e) => e.kind !== 'information')) : 0;
  const note = sampleSizeText(d);
  if (!d.items.length) return <p className="muted">Bring the data first.</p>;
  return (
    <div className="dm-stack">
      <p className="hint">A screen, not validation. A common rule of thumb looks for alpha of 0.7 or more in reflective constructs; formative items need not agree.</p>
      <div className="ms-screen">
        {d.constructs.map((c, ci) => {
          const s = screen?.[ci];
          const alpha = s ? s.alpha : c.alpha;
          return (
            <section key={c.id} className="ms-rel" aria-labelledby={`${base}-${ci}`}>
              <div className="ms-rel-head">
                <h3 id={`${base}-${ci}`}>{c.name || 'Unnamed'}</h3>
                {c.mode === 'reflective' ? (
                  <span className="ms-rel-alpha">{alpha === null ? 'α —' : <>α <strong>{f2(alpha)}</strong></>}{alpha !== null && <AlphaTrack alpha={alpha} />}</span>
                ) : <span className="hint">{c.mode === 'formative' ? 'Formative: alpha does not apply.' : 'One item: no alpha.'}</span>}
              </div>
              {c.mode === 'reflective' && s && (
                <div className="table-wrap" tabIndex={0} role="region" aria-label={`Items of ${c.name}`}>
                  <table className="data">
                    <thead><tr><th scope="col">Item</th><th scope="col" className="num">Corrected item–total r</th><th scope="col" className="num">Alpha without it</th></tr></thead>
                    <tbody>
                      {s.items.map((x) => (
                        <tr key={x.item.id} className={x.alphaIfDeleted !== null && s.alpha !== null && x.alphaIfDeleted > s.alpha + 0.005 ? 'ms-lift' : undefined}>
                          <th scope="row">{x.item.column}{x.item.reverse ? ' (reversed)' : ''}</th>
                          <td className="num">{f2(x.r)}</td>
                          <td className="num">{f2(x.alphaIfDeleted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="hint">{s.n} complete cases. A shaded row would raise alpha if left out: check its wording before dropping anything.</p>
                </div>
              )}
              {c.mode === 'reflective' && !s && <p className="hint">Import the data again to see the item–total correlations.</p>}
            </section>
          );
        })}
      </div>
      <section className="ms-sample" aria-labelledby={`${base}-ss`}>
        <h3 id={`${base}-ss`}>Sample size</h3>
        <div className="ms-sample-row">
          <OptionalNumber label="Most arrows into one construct" value={d.maxArrows} positive
            hint="Count them in your structural model." onChange={(v) => edit((x) => { x.maxArrows = v === null ? null : Math.min(100, Math.max(1, Math.round(v))); })} />
          {fromConcept > 0 && d.maxArrows !== fromConcept && (
            <button type="button" className="btn small" onClick={() => edit((x) => { x.maxArrows = fromConcept; })}>Use {fromConcept} from “{concept!.title}”</button>
          )}
        </div>
        <p className="ms-sample-note">{note ?? 'Give the most arrows that point into one construct to compare the cases with a rough floor of ten cases per arrow.'}</p>
      </section>
    </div>
  );
}
