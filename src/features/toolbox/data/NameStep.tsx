import { useId } from 'react';
import type { ArtefactEditor } from '../../../app/artefacts';
import { dataModel, describeModel } from '../../../domain/artefacts/dataModel';
import type { DataModel } from '../../../domain/artefacts/types';
import { KEEP_MAX_VALUES, keptValues } from '../../../domain/distributions/inputModel';
import { Segmented, TextArea, TextField } from '../../../ui/controls';
import { SvgFigure } from '../SvgFigure';
import type { Sample } from './types';

const STATUS: { value: Exclude<DataModel['availability'], ''>; label: string }[] = [
  { value: 'have', label: 'Have it' }, { value: 'obtainable', label: 'Can get it' }, { value: 'assume', label: 'Must assume' },
];

export function NameStep({ editor, sample }: { editor: ArtefactEditor<'data-model'>; sample: Sample | null }) {
  const d = editor.artefact.data;
  const keepId = useId();
  const set = (fn: (x: DataModel) => void) => editor.setData(fn);
  const values = sample?.prepared.values ?? (d.keepData ? d.data : []);
  const canKeep = values.length > 0;
  const lines = dataModel.summary(d);

  return (
    <div className="dm-name">
      <div className="dm-stack">
        <div className="dm-two tight">
          <TextField label="Name" value={d.name} maxLength={200} placeholder="e.g. Service time" onChange={(v) => set((x) => { x.name = v; })} />
          <TextField label="Unit" value={d.unit} maxLength={200} placeholder="e.g. minutes" onChange={(v) => set((x) => { x.unit = v; })} />
        </div>
        <Segmented label="Data status" value={d.availability === '' ? ('' as never) : d.availability} options={STATUS} onChange={(v) => set((x) => { x.availability = v; })} />
        <TextArea label="Source" rows={2} value={d.provenance} placeholder="Where the numbers come from, or who said so" onChange={(v) => set((x) => { x.provenance = v; })} />
        <TextArea label="Uncertainty" rows={2} value={d.uncertainty} placeholder="How sure? What range is plausible?" onChange={(v) => set((x) => { x.uncertainty = v; })} />
        {d.availability !== 'have' && d.availability !== '' && (
          <TextArea label={d.availability === 'obtainable' ? 'Plan to get the data' : 'How the assumption will be checked'} rows={2} value={d.plan} onChange={(v) => set((x) => { x.plan = v; })} />
        )}
        <div className={`dm-keep${canKeep ? '' : ' is-off'}`}>
          <input id={keepId} type="checkbox" checked={d.keepData} disabled={!canKeep && !d.keepData} aria-describedby={`${keepId}-hint`}
            onChange={(e) => { const on = e.target.checked; set((x) => { x.keepData = on; x.data = on ? keptValues(values) : []; }); }} />
          <div>
            <label htmlFor={keepId}>Keep the data with this artefact</label>
            <p id={`${keepId}-hint`} className="hint">
              {canKeep
                ? `Off: only the model and a summary are saved. On: the ${values.length > KEEP_MAX_VALUES ? `${KEEP_MAX_VALUES.toLocaleString('en-GB')} values (taken at even steps from ${values.length.toLocaleString('en-GB')})` : `${values.length} values`} travel with it, into files and projects.`
                : 'No data on screen to keep.'}
            </p>
          </div>
        </div>
      </div>
      <aside className="dm-preview" aria-label="How it will look in a project">
        <span className="dm-kicker">In a project</span>
        <SvgFigure svg={dataModel.figure(d)} label={`Picture of ${describeModel(d)}`} className="dm-preview-fig" />
        <ul className="dm-preview-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </aside>
    </div>
  );
}
