import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FileInput, Gauge, Rows3, Tag, Network } from 'lucide-react';
import { useArtefactEditor, type ArtefactEditor } from '../../../../app/artefacts';
import { useStore } from '../../../../app/store';
import { defaultTitle } from '../../../../domain/artefacts/file';
import type { MeasurementData } from '../../../../domain/artefacts/types';
import { buildFromSurvey, type Survey } from '../../../../domain/measurement/build';
import { keptRows } from '../../../../domain/measurement/limits';
import type { Cell } from '../../../../domain/measurement/stats';
import { downloadFile } from '../../../../ui/controls';
import { ToolPage, type ToolExport } from '../../ToolPage';
import { fileStem } from '../report';
import { Stepper, type StepDef, type StepNo } from '../Stepper';
import { MBring } from './MBring';
import { ConstructsStep } from './Constructs';
import { dictionaryCsv, dictionaryMarkdown, itemSummariesCsv } from './exports';
import { ItemsStep } from './Items';
import { MeasureArt } from './MeasureArt';
import { MName } from './MName';
import { ReliabilityStep } from './Reliability';

export const M_STEPS: StepDef[] = [
  { n: 1, title: 'Bring the data', short: 'Bring', hint: 'A survey file with one column per item, or the example.', icon: FileInput },
  { n: 2, title: 'Constructs', short: 'Constructs', hint: 'Items grouped by name. Rename, regroup, mark reverse-coded items.', icon: Network },
  { n: 3, title: 'Items', short: 'Items', hint: 'Range, missing answers, skew and straight-lining.', icon: Rows3 },
  { n: 4, title: 'Reliability screen', short: 'Screen', hint: 'Alpha and item–total correlations: a quick screen, not validation.', icon: Gauge },
  { n: 5, title: 'Name it', short: 'Name', hint: 'Source, missing values, and how it will look in a project.', icon: Tag },
];

/** Data and inputs for measured variables: survey items grouped into constructs (one measurement data artefact). */
export function MeasurementTool({ id, modeSwitch }: { id?: string; modeSwitch: ReactNode }) {
  const editor = useArtefactEditor('measurement-data', id);
  return <Workspace key={editor.artefact.id} editor={editor} modeSwitch={modeSwitch} />;
}

/** An edit of the data, given the rows on screen (null when they are not in memory). */
export type MEdit = (fn: (draft: MeasurementData, rows: Cell[][] | null) => void) => void;

function Workspace({ editor, modeSwitch }: { editor: ArtefactEditor<'measurement-data'>; modeSwitch: ReactNode }) {
  const { toast } = useStore();
  const d = editor.artefact.data;
  // Raw rows, in the order of the items. In memory only, unless kept with the artefact.
  const [rows, setRows] = useState<Cell[][] | null>(() => (d.keepData && d.data.length ? d.data : null));
  const [step, setStep] = useState<StepNo>(() => (editor.persisted && d.items.length ? 2 : 1));
  const headingRef = useRef<HTMLHeadingElement>(null);

  const go = useCallback((n: StepNo) => {
    setStep(n);
    window.requestAnimationFrame(() => {
      const h = headingRef.current;
      if (!h) return;
      h.focus({ preventScroll: true });
      const top = h.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) h.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }, []);

  const edit: MEdit = useCallback((fn) => editor.setData((x) => {
    fn(x, rows);
    if (x.keepData && rows) x.data = keptRows(rows, x.items.length);
  }), [editor, rows]);

  const accept = useCallback((survey: Survey, opts: { source: string; origin: MeasurementData['origin']; reverse?: string[]; title?: string }) => {
    const built = buildFromSurvey(survey, opts);
    if (built.data.items.length < 1) { toast('No column holds measured values.', 'warning'); return; }
    setRows(built.rows);
    editor.setData((x) => {
      const keep = x.keepData;
      Object.assign(x, built.data, { keepData: keep, data: keep ? keptRows(built.rows, built.data.items.length) : [], note: x.note, maxArrows: x.maxArrows });
    });
    if (opts.title && editor.artefact.title === defaultTitle('measurement-data')) editor.rename(opts.title);
    const counts = `${built.data.items.length} items in ${built.data.constructs.length} constructs, ${built.data.cases} cases.`;
    // A survey wider than the limit keeps its first items, and says so.
    if (built.dropped > 0) toast(`${counts} The file has ${built.data.items.length + built.dropped} item columns; only the first ${built.data.items.length} were taken.`, 'warning');
    else toast(counts, 'success');
    go(2);
  }, [editor, toast, go]);

  const exports: ToolExport[] = useMemo(() => {
    const title = editor.artefact.title, stem = fileStem(title, 'measurement-data');
    return [
      { id: 'dict-md', label: 'Data dictionary (Markdown)', run: () => downloadFile(`${stem}-dictionary.md`, dictionaryMarkdown(title, d, new Date().toISOString()), 'text/markdown') },
      { id: 'dict-csv', label: 'Data dictionary (CSV)', run: () => downloadFile(`${stem}-dictionary.csv`, dictionaryCsv(d), 'text/csv') },
      { id: 'items-csv', label: 'Item summaries (CSV)', run: () => downloadFile(`${stem}-items.csv`, itemSummariesCsv(d, rows), 'text/csv') },
    ];
  }, [editor.artefact.title, d, rows]);

  const done: Record<StepNo, boolean> = {
    1: d.items.length > 0, 2: d.constructs.length > 0, 3: d.items.some((it) => it.summary),
    4: d.constructs.some((c) => c.alpha !== null) || (d.constructs.length > 0 && d.constructs.every((c) => c.mode !== 'reflective')),
    5: !!d.source.trim() && d.missing !== 'undecided',
  };
  const meta = M_STEPS[step - 1];
  return (
    <ToolPage kind="measurement-data" editor={editor} exports={exports} intro={<MeasureArt />}>
      {modeSwitch}
      <Stepper steps={M_STEPS} current={step} done={done} onGo={go} />
      <section className="dm-panel" aria-labelledby="dm-step-title">
        <header className="dm-panel-head">
          <span className="dm-panel-num" aria-hidden="true">{step}</span>
          <div>
            <h2 id="dm-step-title" ref={headingRef} tabIndex={-1}>{meta.title}</h2>
            <p className="muted">{meta.hint}</p>
            {d.origin === 'example' && d.items.length > 0 && <p className="ms-example-note"><span className="badge">Example</span> Example data made by the app, not responses from real people.</p>}
          </div>
        </header>
        {step === 1 && <MBring d={d} rows={rows} onSurvey={accept} onForget={() => { setRows(null); editor.setData((x) => { x.data = []; }); }} onNext={go} />}
        {step === 2 && <ConstructsStep d={d} rows={rows} edit={edit} />}
        {step === 3 && <ItemsStep d={d} rows={rows} />}
        {step === 4 && <ReliabilityStep d={d} rows={rows} edit={edit} />}
        {step === 5 && <MName d={d} rows={rows} edit={edit} />}
      </section>
      <nav className="dm-next" aria-label="Steps">
        {step > 1 ? <button type="button" className="btn" onClick={() => go((step - 1) as StepNo)}>← {M_STEPS[step - 2].short}</button> : <span />}
        {step < 5 && <button type="button" className="btn primary" onClick={() => go((step + 1) as StepNo)}>{M_STEPS[step].short} →</button>}
      </nav>
    </ToolPage>
  );
}
