import { useId } from 'react';
import { measurementData, MISSING_TEXT } from '../../../../domain/artefacts/measurementData';
import type { MeasurementData, MissingHandling } from '../../../../domain/artefacts/types';
import { keptRows, MAX_KEPT_ROWS } from '../../../../domain/measurement/limits';
import type { Cell } from '../../../../domain/measurement/stats';
import { SelectField, TextArea } from '../../../../ui/controls';
import { SvgFigure } from '../../SvgFigure';
import type { MEdit } from './MeasurementTool';

const MISSING_OPTIONS = (Object.keys(MISSING_TEXT) as MissingHandling[]).map((value) => ({ value, label: MISSING_TEXT[value] }));

/** Source, missing values, a note and whether the answers travel with the artefact; and the card a project will show. */
export function MName({ d, rows, edit }: { d: MeasurementData; rows: Cell[][] | null; edit: MEdit }) {
  const keepId = useId();
  const canKeep = !!rows?.length;
  const lines = measurementData.summary(d);
  return (
    <div className="dm-name">
      <div className="dm-stack">
        <TextArea label="Source" rows={2} value={d.source} placeholder="Who answered, when, how they were reached" onChange={(v) => edit((x) => { x.source = v; })} />
        <SelectField label="Missing values" value={d.missing} options={MISSING_OPTIONS} onChange={(v) => edit((x) => { x.missing = v; })} />
        <TextArea label="Note" rows={2} value={d.note} placeholder="Wording source, translation, anything a reader needs" onChange={(v) => edit((x) => { x.note = v; })} />
        <div className={`dm-keep${canKeep || d.keepData ? '' : ' is-off'}`}>
          <input id={keepId} type="checkbox" checked={d.keepData} disabled={!canKeep && !d.keepData} aria-describedby={`${keepId}-hint`}
            onChange={(e) => { const on = e.target.checked; edit((x, r) => { x.keepData = on; x.data = on && r ? keptRows(r, x.items.length) : []; }); }} />
          <div>
            <label htmlFor={keepId}>Keep the answers with this artefact</label>
            <p id={`${keepId}-hint`} className="hint">
              {canKeep ? `Off: only the constructs and summaries are saved. On: the answers of ${Math.min(rows!.length, MAX_KEPT_ROWS)} cases travel with it, into files and projects.` : 'No answers on screen to keep.'}
            </p>
          </div>
        </div>
      </div>
      <aside className="dm-preview" aria-label="How it will look in a project">
        <span className="dm-kicker">In a project</span>
        <SvgFigure svg={measurementData.figure(d)} label={`Constructs and items of ${lines[0] ?? 'this dataset'}`} className="dm-preview-fig" />
        <ul className="dm-preview-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <p className="hint">Step 4 of the project gets one input row per construct.</p>
      </aside>
    </div>
  );
}
