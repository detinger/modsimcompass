import { useId, useState } from 'react';
import type { ArtefactEditor } from '../../../app/artefacts';
import { describeModel, lawFields } from '../../../domain/artefacts/dataModel';
import type { DataModel } from '../../../domain/artefacts/types';
import { deltaAicLabel } from '../../../domain/distributions/fitting';
import { applyFit, defaultParams, modelLaw, modelMoments } from '../../../domain/distributions/inputModel';
import { FAMILIES, KINDS, lawFor, type Kind } from '../../../domain/distributions/laws';
import { sig } from '../../../domain/distributions/sample';
import { FAMILY_NOTES } from '../../../domain/distributions/tree';
import { Thumb } from '../../../ui/playful';
import { ModelChart } from './charts';
import type { Sample } from './types';

const num = (x: number) => sig(x, 4).replace('-', '−');
const ORIGIN: Record<DataModel['origin'], string> = { fitted: 'Fitted to data', described: 'Described without data', manual: 'Set by hand' };
const GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: 'Continuous', kinds: KINDS.filter((k) => !FAMILIES[k].discrete) },
  { title: 'Discrete', kinds: KINDS.filter((k) => FAMILIES[k].discrete) },
];
const LIST: Kind[] = ['categorical', 'empirical'];

export function SettleStep({ editor, sample }: { editor: ArtefactEditor<'data-model'>; sample: Sample | null }) {
  const d = editor.artefact.data;
  const fits = sample?.prepared.fits ?? [];
  const [mode, setMode] = useState<'fit' | 'hand'>(fits.length && d.origin === 'fitted' ? 'fit' : 'hand');
  const law = modelLaw(d);
  const m = law ? modelMoments(law, d) : null;
  const best = fits[0]?.aic ?? 0;

  return (
    <div className="dm-stack">
      <div className="dm-model-head">
        <Thumb kind={d.family} fields={lawFields(d.family, d.params)} className="thumb dm-model-thumb" />
        <div className="dm-model-words">
          <span className="dm-kicker">{ORIGIN[d.origin]}</span>
          <strong className="dm-model-name">{describeModel(d)}</strong>
          <span className="muted">{m ? (m.mean === null ? 'No mean: averages never settle' : `Mean ${num(m.mean)}${m.sd !== null ? ` · standard deviation ${num(m.sd)}` : ''}`) : 'The parameters are not valid yet.'} · {FAMILIES[d.family].support}</span>
        </div>
      </div>

      <div className="seg dm-seg" role="group" aria-label="How to settle the model">
        <button type="button" aria-pressed={mode === 'fit'} disabled={!fits.length} onClick={() => setMode('fit')}>Take a fit</button>
        <button type="button" aria-pressed={mode === 'hand'} onClick={() => setMode('hand')}>Set by hand</button>
      </div>
      {!fits.length && <p className="hint">{d.summary ? 'Bring the data again to take a fit.' : 'Fits need data. Set the model by hand.'}</p>}

      <div className="dm-settle">
        <div className="dm-settle-side">
          {mode === 'fit' && fits.length > 0 ? (
            <ul className="dm-fit-list compact" aria-label="Fits, best first">
              {fits.slice(0, 6).map((f, i) => {
                const inUse = d.origin === 'fitted' && d.family === f.kind;
                return (
                  <li key={f.kind}>
                    <button type="button" className="dm-fit" aria-pressed={inUse} onClick={() => editor.setData((x) => applyFit(x, sample!.prepared, f))}>
                      <span className="dm-fit-rank" aria-hidden="true">{i + 1}</span>
                      <Thumb kind={f.kind} fields={f.params} className="thumb dm-fit-thumb" />
                      <span className="dm-fit-name"><strong>{FAMILIES[f.kind].title}</strong></span>
                      <span className="dm-fit-meta">{deltaAicLabel(f.aic - best)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <HandEditor key={d.family} editor={editor} />
          )}
        </div>
        <ModelChart title={`Live preview: ${describeModel(d)}`} values={sample?.prepared.values} law={law} unit={d.unit} modelLabel={FAMILIES[d.family].title} />
      </div>
    </div>
  );
}

/** Family and parameters by hand. Every valid change is saved at once and drawn in the preview. */
function HandEditor({ editor }: { editor: ArtefactEditor<'data-model'> }) {
  const d = editor.artefact.data;
  const fam = FAMILIES[d.family];
  const [fields, setFields] = useState<string[]>(() => lawFields(d.family, d.params).map(String));
  const [error, setError] = useState<string | null>(null);
  const base = useId();
  const note = FAMILY_NOTES[d.family];

  const commit = (kind: Kind, raw: string[]) => {
    const next = raw.map((t) => t.trim().replace(/−/g, '-'));
    try {
      lawFor(kind, next);
      const params = LIST.includes(kind) ? next[0].split(',').map((t) => Number(t.trim())) : next.map(Number);
      setError(null);
      editor.setData((x) => { x.family = kind; x.params = params; x.origin = x.origin === 'described' ? 'described' : 'manual'; x.fit = null; });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const pickFamily = (k: Kind) => { if (k !== d.family) editor.setData((x) => { x.family = k; x.params = defaultParams(k); x.origin = x.origin === 'described' ? 'described' : 'manual'; x.fit = null; }); };

  return (
    <div className="dm-hand">
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="dm-picker-group">
          <legend>{g.title}</legend>
          <div className="dm-picker">
            {g.kinds.map((k) => (
              <button key={k} type="button" className="dm-family" aria-pressed={k === d.family} onClick={() => pickFamily(k)}>
                <Thumb kind={k} fields={FAMILY_NOTES[k]?.thumb ?? FAMILIES[k].defaults} className="thumb" />
                <span>{FAMILIES[k].title}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="dm-params">
        {note && <p className="dm-note"><strong>{fam.title}:</strong> {note.use} <span className="muted">e.g. {note.example}</span></p>}
        {fam.params.map((label, i) => (
          <div key={label} className="field">
            <label htmlFor={`${base}-${i}`}>{label}</label>
            <input id={`${base}-${i}`} type="text" inputMode={LIST.includes(d.family) ? 'text' : 'decimal'} value={fields[i] ?? ''} autoComplete="off"
              aria-invalid={error ? true : undefined} aria-describedby={error ? `${base}-err` : undefined}
              onChange={(e) => { const next = fields.map((f, j) => (j === i ? e.target.value : f)); setFields(next); commit(d.family, next); }} />
          </div>
        ))}
        {error && <p id={`${base}-err`} className="field-error" role="alert">{error} The preview shows the last valid model.</p>}
      </div>
    </div>
  );
}
