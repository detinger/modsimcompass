import { useEffect, useId, useState } from 'react';
import { measurementData, MODE_TEXT } from '../../../../domain/artefacts/measurementData';
import type { MeasurementData } from '../../../../domain/artefacts/types';
import { modesFor, moveItem, nameTaken, renameConstruct, setLabel, setMode, setReverse, setScale } from '../../../../domain/measurement/build';
import type { Cell } from '../../../../domain/measurement/stats';
import { SvgFigure } from '../../SvgFigure';
import type { MEdit } from './MeasurementTool';

const NEW = '__new';

/** A construct's name. A name another construct already has is not taken: each construct is one named project row. */
function ConstructName({ d, id, name, inputId, edit }: { d: MeasurementData; id: string; name: string; inputId: string; edit: MEdit }) {
  const [draft, setDraft] = useState(name);
  const [taken, setTaken] = useState(false);
  useEffect(() => { setDraft(name); setTaken(false); }, [name]);
  const change = (v: string) => {
    setDraft(v);
    const clash = nameTaken(d, id, v);
    setTaken(clash);
    if (!clash) edit((x) => { renameConstruct(x, id, v); });
  };
  return (
    <div className="field">
      <label htmlFor={inputId}>Construct</label>
      <input id={inputId} type="text" value={draft} maxLength={200} aria-invalid={taken || undefined} aria-describedby={taken ? `${inputId}-taken` : undefined}
        onChange={(e) => change(e.target.value)} onBlur={() => { if (taken) { setDraft(name); setTaken(false); } }} />
      {taken && <span id={`${inputId}-taken`} className="field-error" role="alert">Another construct has this name.</span>}
    </div>
  );
}

/** The answer scale the items were asked on. Detected from the answers; set it when nobody used an end point. */
function ScaleFields({ d, rows, edit }: { d: MeasurementData; rows: Cell[][] | null; edit: MEdit }) {
  const base = useId();
  const [lo, setLo] = useState(d.scale ? String(d.scale.min) : '');
  const [hi, setHi] = useState(d.scale ? String(d.scale.max) : '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLo(d.scale ? String(d.scale.min) : ''); setHi(d.scale ? String(d.scale.max) : ''); }, [d.scale]);
  const apply = (minText: string, maxText: string) => {
    setLo(minText); setHi(maxText);
    if (!minText.trim() && !maxText.trim()) {
      const probe = structuredClone(d), why = setScale(probe, null, rows);
      setError(why);
      if (!why && d.scale) edit((x, r) => { setScale(x, null, r); });
      return;
    }
    const min = Number(minText), max = Number(maxText);
    if (!minText.trim() || !maxText.trim() || !Number.isFinite(min) || !Number.isFinite(max)) { setError('Enter both ends of the scale.'); return; }
    const probe = structuredClone(d), why = setScale(probe, { min, max }, rows);
    setError(why);
    if (!why && (d.scale?.min !== min || d.scale?.max !== max)) edit((x, r) => { setScale(x, { min, max }, r); });
  };
  return (
    <fieldset className="ms-scale">
      <legend>Answer scale</legend>
      <div className="ms-scale-row">
        <label htmlFor={`${base}-lo`}>From</label>
        <input id={`${base}-lo`} type="text" inputMode="numeric" value={lo} aria-invalid={error ? true : undefined} aria-describedby={`${base}-hint${error ? ` ${base}-err` : ''}`} onChange={(e) => apply(e.target.value, hi)} />
        <label htmlFor={`${base}-hi`}>to</label>
        <input id={`${base}-hi`} type="text" inputMode="numeric" value={hi} aria-invalid={error ? true : undefined} aria-describedby={`${base}-hint${error ? ` ${base}-err` : ''}`} onChange={(e) => apply(lo, e.target.value)} />
      </div>
      <span id={`${base}-hint`} className="hint">Set the full scale, e.g. 1–7, if nobody used the end points. Reverse coding, ranges and bars use it.</span>
      {error && <span id={`${base}-err`} className="field-error" role="alert">{error}</span>}
    </fieldset>
  );
}

/** The constructs as cards: name, mode and items. Items move between constructs; reverse-worded items are recoded on the scale. */
export function ConstructsStep({ d, rows, edit }: { d: MeasurementData; rows: Cell[][] | null; edit: MEdit }) {
  const base = useId();
  const byId = new Map(d.items.map((it) => [it.id, it]));
  if (!d.items.length) return <p className="muted">Bring the data first.</p>;
  return (
    <div className="dm-stack">
      <p className="hint">Grouped by the start of each column name (PEOU1, PEOU_2 → PEOU; Q1_1, Q1_2 → Q1). {d.scale ? '' : 'No common scale was found: set one to reverse-code items.'}</p>
      <ScaleFields d={d} rows={rows} edit={edit} />
      <div className="ms-constructs">
        {d.constructs.map((c, ci) => {
          const modes = modesFor(c);
          return (
            <section key={c.id} className={`ms-construct is-${c.mode}`} aria-labelledby={`${base}-c${ci}`}>
              <div className="ms-c-head">
                <h3 id={`${base}-c${ci}`} className="sr-only">{c.name || 'Unnamed construct'}</h3>
                <ConstructName d={d} id={c.id} name={c.name} inputId={`${base}-n${ci}`} edit={edit} />
                <div className="field">
                  <label htmlFor={`${base}-m${ci}`}>Mode</label>
                  <select id={`${base}-m${ci}`} value={c.mode} disabled={modes.length === 1} onChange={(e) => edit((x, r) => setMode(x, c.id, e.target.value as typeof c.mode, r))}>
                    {modes.map((m) => <option key={m} value={m}>{MODE_TEXT[m]}</option>)}
                  </select>
                </div>
                <span className="ms-alpha-chip" aria-label={c.alpha === null ? 'No alpha' : `Cronbach's alpha ${c.alpha.toFixed(2)}`}>{c.alpha === null ? (c.mode === 'reflective' ? 'α —' : '') : `α ${c.alpha.toFixed(2)}`}</span>
              </div>
              <ul className="ms-items">
                {c.items.map((id) => {
                  const it = byId.get(id);
                  if (!it) return null;
                  return (
                    <li key={id} className={it.reverse ? 'is-reverse' : undefined}>
                      <span className="ms-item-col">{it.column}</span>
                      <input type="text" className="ms-item-label" value={it.label} maxLength={500} placeholder="Wording" aria-label={`Wording of ${it.column}`}
                        onChange={(e) => edit((x) => setLabel(x, id, e.target.value))} />
                      <label className="ms-rev" title={d.scale ? 'Recoded on the scale before any summary' : 'Needs a common scale'}>
                        <input type="checkbox" checked={it.reverse} disabled={!d.scale} onChange={(e) => { const on = e.target.checked; edit((x, r) => setReverse(x, id, on, r)); }} />
                        Reverse<span className="sr-only">-coded: {it.column}</span>
                      </label>
                      <select className="ms-move" value={c.id} aria-label={`Construct of ${it.column}`} onChange={(e) => { const to = e.target.value; edit((x, r) => moveItem(x, id, to === NEW ? null : to, r)); }}>
                        {d.constructs.map((o) => <option key={o.id} value={o.id}>{o.name || 'Unnamed'}</option>)}
                        <option value={NEW}>New construct</option>
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <figure className="ms-figure">
        <SvgFigure svg={measurementData.figure(d)} label={`Constructs and items: ${d.constructs.map((c) => `${c.name} with ${c.items.length} item${c.items.length === 1 ? '' : 's'}${c.mode === 'formative' ? ', formative' : ''}`).join('; ')}.`} />
        <figcaption className="hint">Ovals: constructs (dashed when formative). Squares: items. {rows ? '' : 'Import the data again to recompute alphas after a change.'}</figcaption>
      </figure>
    </div>
  );
}
