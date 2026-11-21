import { useCallback, useMemo, useState } from 'react';
import { FlaskConical, PencilLine } from 'lucide-react';
import { useArtefactEditor, type ArtefactEditor } from '../../../app/artefacts';
import { useStore } from '../../../app/store';
import { analyse, comparison, precisionText } from '../../../domain/artefacts/comparison';
import type { Comparison } from '../../../domain/artefacts/types';
import { downloadFile, Segmented, TextArea, TextField } from '../../../ui/controls';
import { FigureCard } from '../../../ui/playful';
import { fileStem } from '../data/report';
import { ToolPage, type ToolExport } from '../ToolPage';
import { Answer } from './Answer';
import { CsvTwoColumns, PolicyBox, readNumbers, type Imported } from './Entry';
import { exampleComparison, typeValues } from './example';
import { differencesCsv, plotSvg, summaryHtml, summaryMarkdown } from './exports';
import { OptionalNumber } from './fields';
import { PairingLesson } from './PairingLesson';
import './compare.css';

/** `/toolbox/compare[/:id]`: is the difference between two policies real, or chance? (docs/LEARN-TOOLBOX-PLAN.md §5.5). */
export default function CompareTool({ id }: { id?: string }) {
  const editor = useArtefactEditor('comparison', id);
  return <Workspace key={editor.artefact.id} editor={editor} />;
}

const lines = (xs: number[]) => xs.join('\n');

function Workspace({ editor }: { editor: ArtefactEditor<'comparison'> }) {
  const { toast } = useStore();
  const d = editor.artefact.data;
  const [textB, setTextB] = useState(() => lines(d.baseline));
  const [textA, setTextA] = useState(() => lines(d.alternative));
  const example = d.origin === 'example';

  const set = useCallback((fn: (x: Comparison) => void) => editor.setData(fn), [editor]);
  const replace = useCallback((next: Comparison) => {
    setTextB(lines(next.baseline)); setTextA(lines(next.alternative));
    editor.setData((x) => { Object.assign(x, next); });
  }, [editor]);

  const loadExample = (shared: boolean) => {
    const before = structuredClone(d), hadData = d.baseline.length > 0 || d.alternative.length > 0;
    replace(exampleComparison(shared));
    if (hadData && before.origin !== 'example') toast('Example loaded. Your numbers were replaced.', 'info', { label: 'Undo', run: () => replace(before) });
  };
  const ownResults = () => {
    if (!example) { document.getElementById('cmp-outcome')?.focus(); return; }
    const before = structuredClone(d);
    replace(comparison.empty());
    toast('Example cleared. Enter your own results.', 'info', { label: 'Undo', run: () => replace(before) });
    window.requestAnimationFrame(() => document.getElementById('cmp-outcome')?.focus());
  };
  const onImport = (x: Imported) => {
    setTextB(lines(x.baseline)); setTextA(lines(x.alternative));
    set((c) => {
      // Results from a file come from another simulator: not paired until the user says so.
      c.baseline = x.baseline; c.alternative = x.alternative; c.origin = 'imported'; c.paired = false;
      if (x.baselineName && (example || !c.baselineLabel.trim() || c.baselineLabel === 'Baseline')) c.baselineLabel = x.baselineName.slice(0, 200);
      if (x.alternativeName && (example || !c.alternativeLabel.trim() || c.alternativeLabel === 'Alternative')) c.alternativeLabel = x.alternativeName.slice(0, 200);
      if (example) { c.note = ''; c.outcome = ''; c.unit = ''; c.minimumDifference = null; c.targetHalfWidth = null; }
      c.note = c.note.trim() ? c.note : `Imported from “${x.file}”.`;
    });
    toast(`${x.baseline.length} rows read from “${x.file}”.${x.dropped ? ` ${x.dropped} rows with a missing value were left out.` : ''}`, x.dropped ? 'warning' : 'success');
  };
  // Typing replaces the numbers of one policy (see `typeValues`: an edited example becomes the user's own numbers).
  const onText = (which: 'baseline' | 'alternative', t: string) => {
    (which === 'baseline' ? setTextB : setTextA)(t);
    const { values } = readNumbers(t);
    set((c) => typeValues(c, which, values));
  };

  const an = analyse(d);
  const exports: ToolExport[] = useMemo(() => {
    const title = editor.artefact.title, stem = fileStem(title, d.outcome || 'comparison');
    const at = () => new Date().toISOString();
    return [
      { id: 'md', label: 'Summary (Markdown)', run: () => downloadFile(`${stem}-summary.md`, summaryMarkdown(title, d, at()), 'text/markdown') },
      { id: 'html', label: 'Summary (HTML)', run: () => downloadFile(`${stem}-summary.html`, summaryHtml(title, d, at()), 'text/html') },
      { id: 'svg', label: 'Plot (SVG)', run: () => { const svg = plotSvg(d); if (svg) downloadFile(`${stem}-plot.svg`, svg, 'image/svg+xml'); else toast('Enter results for both policies first.', 'warning'); } },
      { id: 'csv', label: 'Differences (CSV)', run: () => downloadFile(`${stem}-replications.csv`, differencesCsv(d), 'text/csv') },
    ];
  }, [editor.artefact.title, d, toast]);

  const lengthsDiffer = d.baseline.length !== d.alternative.length && d.baseline.length > 0 && d.alternative.length > 0;

  return (
    <ToolPage kind="comparison" editor={editor} exports={exports} intro={<FigureCard id="paired-comparison" />}>
      <div className="cmp-doors" role="group" aria-label="Whose numbers">
        <button type="button" className="cmp-door" aria-pressed={!example} onClick={ownResults}>
          <span className="cmp-door-icon" aria-hidden="true"><PencilLine size={22} /></span>
          <span><strong>Your own results</strong><small>From any simulator: paste or import</small></span>
        </button>
        <button type="button" className="cmp-door" aria-pressed={example} onClick={() => loadExample(true)}>
          <span className="cmp-door-icon" aria-hidden="true"><FlaskConical size={22} /></span>
          <span><strong>Try it with example data</strong><small>Two capacities of a daily backlog</small></span>
        </button>
      </div>

      {example && <PairingLesson shared={d.paired} onShared={(s) => { if (s !== d.paired) replace(exampleComparison(s)); }} />}

      <div className="cmp-grid">
        <section className="cmp-card" aria-labelledby="cmp-what">
          <h2 id="cmp-what"><span className="cmp-num" aria-hidden="true">1</span> What is compared</h2>
          <div className="cmp-fields">
            <TextField id="cmp-outcome" label="Outcome" value={d.outcome} maxLength={500} placeholder="e.g. Average waiting time" onChange={(v) => set((c) => { c.outcome = v; })} />
            <TextField label="Unit" value={d.unit} maxLength={200} placeholder="e.g. minutes" onChange={(v) => set((c) => { c.unit = v; })} />
            <Segmented label="Better is" value={d.direction} options={[{ value: 'lower', label: 'Lower' }, { value: 'higher', label: 'Higher' }]} onChange={(v) => set((c) => { c.direction = v; })} />
          </div>
          <div className="cmp-fields two">
            <TextField label="Baseline name" value={d.baselineLabel} maxLength={200} onChange={(v) => set((c) => { c.baselineLabel = v; })} />
            <TextField label="Alternative name" value={d.alternativeLabel} maxLength={200} onChange={(v) => set((c) => { c.alternativeLabel = v; })} />
          </div>
        </section>

        <section className="cmp-card" aria-labelledby="cmp-results">
          <h2 id="cmp-results"><span className="cmp-num" aria-hidden="true">2</span> Results per replication {example && <span className="badge warning">Example data</span>}</h2>
          <div className="cmp-boxes">
            <PolicyBox which="baseline" name={d.baselineLabel.trim() || 'Baseline'} text={textB} onText={(t) => onText('baseline', t)} />
            <PolicyBox which="alternative" name={d.alternativeLabel.trim() || 'Alternative'} text={textA} onText={(t) => onText('alternative', t)} />
          </div>
          <fieldset className={`cmp-paired${lengthsDiffer ? ' is-off' : ''}`} aria-describedby="cmp-paired-why">
            <legend>Did run i of both policies use the same random inputs?</legend>
            <p id="cmp-paired-why" className="hint">Only then can the runs be compared row by row (paired). Otherwise a two-sample (Welch) interval is used.</p>
            <div className="cmp-paired-options">
              <label><input type="radio" name="cmp-paired" checked={!d.paired || lengthsDiffer} onChange={() => set((c) => { c.paired = false; })} /> No, or not sure</label>
              <label><input type="radio" name="cmp-paired" checked={d.paired && !lengthsDiffer} disabled={lengthsDiffer} onChange={() => set((c) => { c.paired = true; })} /> Yes, the same inputs in each row</label>
            </div>
            {lengthsDiffer && <p className="hint">Not possible here: the two lists differ in length.</p>}
          </fieldset>
          <CsvTwoColumns onUse={onImport} />
        </section>
      </div>

      <section className="cmp-card cmp-wide" aria-labelledby="cmp-answer">
        <h2 id="cmp-answer"><span className="cmp-num" aria-hidden="true">3</span> The answer {example && <span className="badge warning">Example data</span>}</h2>
        <Answer d={d} />
      </section>

      <section className="cmp-card cmp-wide" aria-labelledby="cmp-plan">
        <h2 id="cmp-plan"><span className="cmp-num" aria-hidden="true">4</span> Decide and plan</h2>
        <div className="cmp-fields">
          <OptionalNumber label="Smallest difference that matters" unit={d.unit.trim() || undefined} value={d.minimumDifference}
            hint="Decide before you look. Empty: not set." onChange={(v) => set((c) => { c.minimumDifference = v; })} />
          <OptionalNumber label="Wanted precision (±)" unit={d.unit.trim() || undefined} value={d.targetHalfWidth} positive
            hint={d.targetHalfWidth === null ? 'Half-width of the interval you want.' : precisionText(an.precision)} onChange={(v) => set((c) => { c.targetHalfWidth = v; })} />
        </div>
        {an.precision.needed !== null && (
          <div className="cmp-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (an.precision.have / Math.max(1, an.precision.needed)) * 100)}%` }} />
          </div>
        )}
        <TextArea label="Note" rows={2} value={d.note} placeholder="Model, run length, seed, anything a reader needs" onChange={(v) => set((c) => { c.note = v; })} />
      </section>
    </ToolPage>
  );
}
