import { useMemo } from 'react';
import { Dices, Download } from 'lucide-react';
import type { ArtefactEditor } from '../../../app/artefacts';
import { generate, generatedCsv, generatorSize, GENERATE_MAX, modelLaw, modelMoments } from '../../../domain/distributions/inputModel';
import { describeSample, sig } from '../../../domain/distributions/sample';
import { Badge, Callout, downloadFile, NumberField, TextField } from '../../../ui/controls';
import { CodeTabs } from '../../../ui/playful';
import { ModelChart } from './charts';
import { pythonScript, rScript } from './exports';
import { fileStem } from './report';

const num = (x: number | null) => (x === null ? '—' : sig(x, 4).replace('-', '−'));
const SIZES = [100, 1000, 10000];

export function GenerateStep({ editor }: { editor: ArtefactEditor<'data-model'> }) {
  const d = editor.artefact.data;
  const { seed, n } = d.generator;
  const paramsKey = d.params.join(',');
  // Recomputed only when the model, the seed or the size changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draws = useMemo(() => generate({ family: d.family, params: d.params, generator: { seed, n } }), [d.family, paramsKey, seed, n]);
  const law = modelLaw(d);
  const m = law ? modelMoments(law, d) : null;
  const s = draws ? describeSample(draws) : null;
  const newSeed = () => editor.setData((x) => { x.generator.seed = String(Math.floor(10000 + Math.random() * 90000)); });

  if (!law || !draws) return <Callout tone="warning">The model parameters are not valid. Fix them in step 3.</Callout>;
  return (
    <div className="dm-stack">
      <div className="dm-gen-controls">
        <TextField label="Seed" value={seed} maxLength={200} hint="Same seed, same values." onChange={(v) => editor.setData((x) => { x.generator.seed = v; })} />
        <button type="button" className="btn dm-dice" onClick={newSeed}><Dices size={16} aria-hidden="true" /> New seed</button>
        <NumberField label="How many" value={n} integer min={1} max={GENERATE_MAX} onChange={(v) => editor.setData((x) => { x.generator.n = generatorSize(v); })} />
        <div className="seg" role="group" aria-label="Quick sizes">
          {SIZES.map((k) => <button key={k} type="button" aria-pressed={n === k} onClick={() => editor.setData((x) => { x.generator.n = k; })}>{k.toLocaleString('en-GB')}</button>)}
        </div>
      </div>
      <p className="dm-synthetic"><Badge tone="warning">Synthetic</Badge> Drawn from the model. Not observations.</p>
      <ModelChart title={`${draws.length} synthetic values and the model`} values={draws} law={law} unit={d.unit} dataLabel="Synthetic values" modelLabel="Model" />
      <dl className="dm-tiles">
        <div className="dm-tile"><dt>Mean of the values</dt><dd>{num(s?.mean ?? null)}</dd></div>
        <div className="dm-tile"><dt>Mean of the model</dt><dd>{m?.mean === null ? 'none' : num(m?.mean ?? null)}</dd></div>
        <div className="dm-tile"><dt>SD of the values</dt><dd>{num(s?.sd ?? null)}</dd></div>
        <div className="dm-tile"><dt>SD of the model</dt><dd>{m?.sd === null ? 'none' : num(m?.sd ?? null)}</dd></div>
      </dl>
      <div className="dm-first">
        <span className="dm-kicker">First values</span>
        <ol className="dm-chips">{draws.slice(0, 12).map((v, i) => <li key={i}>{num(v)}</li>)}</ol>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => downloadFile(`${fileStem(editor.artefact.title, d.name || 'data-model')}-synthetic.csv`, generatedCsv(draws), 'text/csv')}>
          <Download size={16} aria-hidden="true" /> Synthetic values (CSV)
        </button>
      </div>
      <CodeTabs title="The same model in R or Python" r={rScript(editor.artefact.title, d, null)} py={pythonScript(editor.artefact.title, d, null)} />
    </div>
  );
}
