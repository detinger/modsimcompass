import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useArtefactEditor, type ArtefactEditor } from '../../../app/artefacts';
import { useStore } from '../../../app/store';
import type { DataModel } from '../../../domain/artefacts/types';
import { applyFit, keptValues, prepareSample, summaryRecord, type PreparedSample } from '../../../domain/distributions/inputModel';
import { sameData } from '../../../domain/artefacts/clean';
import { downloadFile } from '../../../ui/controls';
import { ToolPage, type ToolExport } from '../ToolPage';
import { BringStep } from './BringStep';
import { DiscoverStep } from './DiscoverStep';
import { fitReportHtml, fitReportMarkdown, pythonScript, rScript, syntheticCsv } from './exports';
import { GenerateStep } from './GenerateStep';
import { IntroArt } from './IntroArt';
import { NameStep } from './NameStep';
import { fileStem } from './report';
import { SettleStep } from './SettleStep';
import { Stepper, STEPS, type StepNo } from './Stepper';
import type { Sample, SampleSource } from './types';

/** Data and inputs for uncertain inputs: one guided path from data, or a description, to a data model (docs/LEARN-TOOLBOX-PLAN.md §5.3). */
export function DistributionsTool({ id, modeSwitch }: { id?: string; modeSwitch: ReactNode }) {
  const editor = useArtefactEditor('data-model', id);
  // A different artefact starts with a clean slate: its raw rows are not those on screen.
  return <Workspace key={editor.artefact.id} editor={editor} modeSwitch={modeSwitch} />;
}

/** The model is the untouched default: nothing chosen yet, so a fit may be put in place without asking. */
const untouched = (d: DataModel) => d.origin === 'manual' && d.fit === null && sameData({ f: d.family, p: d.params }, { f: 'normal', p: [0, 1] });

function Workspace({ editor, modeSwitch }: { editor: ArtefactEditor<'data-model'>; modeSwitch: ReactNode }) {
  const { toast } = useStore();
  const d = editor.artefact.data;
  const [sample, setSample] = useState<Sample | null>(() => {
    // Data kept with the artefact comes back with it; data that was not kept stays gone.
    if (!d.keepData || d.data.length === 0) return null;
    const prepared = prepareSample(d.data);
    return prepared ? { prepared, label: 'Data kept with this artefact', source: 'kept' } : null;
  });
  const [step, setStep] = useState<StepNo>(() => (editor.persisted && !untouched(d) ? 3 : 1));
  const headingRef = useRef<HTMLHeadingElement>(null);

  const go = useCallback((n: StepNo) => {
    setStep(n);
    // Focus follows the step, so a screen reader hears where it is; the page scrolls to the step heading.
    window.requestAnimationFrame(() => {
      const h = headingRef.current;
      if (!h) return;
      h.focus({ preventScroll: true });
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const top = h.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) h.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    });
  }, []);

  /** New data: summarise and rank fits once, keep the rows in memory, and record what the artefact may keep. */
  const acceptData = useCallback((values: number[], label: string, source: SampleSource, hints: { name?: string; provenance?: string } = {}) => {
    const prepared = prepareSample(values);
    if (!prepared) { toast('No numbers to use.', 'warning'); return; }
    setSample({ prepared, label, source });
    let autoFitted = false;
    editor.setData((x) => {
      x.summary = summaryRecord(prepared.summary);
      x.data = x.keepData ? keptValues(values) : [];
      if ((untouched(x) || x.origin === 'fitted') && prepared.fits[0]) { applyFit(x, prepared, prepared.fits[0]); autoFitted = true; }
      else if (x.origin === 'fitted') x.fit = null;
      if (!x.name.trim() && hints.name) x.name = hints.name.slice(0, 200);
      if (!x.provenance.trim() && hints.provenance) x.provenance = hints.provenance;
      if (!x.availability) x.availability = source === 'example' ? 'assume' : 'have';
    });
    toast(prepared.fits.length ? `${values.length} values read. ${autoFitted ? 'The lowest-AIC fit is in use.' : 'Compare the fits in step 2.'}` : `${values.length} values read. At least 3 are needed for fits.`, 'success');
    go(2);
  }, [editor, toast, go]);

  const forgetData = useCallback(() => {
    setSample(null);
    editor.setData((x) => { x.data = []; });
  }, [editor]);

  const exports: ToolExport[] = useMemo(() => {
    const title = editor.artefact.title, stem = fileStem(title, d.name || 'data-model');
    const at = () => new Date().toISOString();
    const prepared: PreparedSample | null = sample?.prepared ?? null;
    return [
      { id: 'csv', label: 'Synthetic data (CSV)', run: () => { const csv = syntheticCsv(d); if (csv) downloadFile(`${stem}-synthetic.csv`, csv, 'text/csv'); else toast('Fix the model parameters first.', 'warning'); } },
      { id: 'md', label: 'Fit report (Markdown)', run: () => downloadFile(`${stem}-fit-report.md`, fitReportMarkdown(title, d, prepared, at()), 'text/markdown') },
      { id: 'html', label: 'Fit report (HTML)', run: () => downloadFile(`${stem}-fit-report.html`, fitReportHtml(title, d, prepared, at()), 'text/html') },
      { id: 'r', label: 'R code', run: () => downloadFile(`${stem}.R`, rScript(title, d, prepared), 'text/plain') },
      { id: 'py', label: 'Python code', run: () => downloadFile(`${stem}.py`, pythonScript(title, d, prepared), 'text/x-python') },
    ];
  }, [editor.artefact.title, d, sample, toast]);

  const done: Record<StepNo, boolean> = {
    1: !!sample || !!d.summary || d.origin === 'described',
    2: !!d.fit || (!!sample && sample.prepared.fits.length > 0),
    3: !untouched(d),
    4: !untouched(d),
    5: !!(d.name.trim() && d.unit.trim() && d.availability),
  };
  const meta = STEPS[step - 1];

  return (
    <ToolPage kind="data-model" editor={editor} exports={exports} intro={<IntroArt />}>
      {modeSwitch}
      <Stepper current={step} done={done} onGo={go} />
      <section className="dm-panel" aria-labelledby="dm-step-title">
        <header className="dm-panel-head">
          <span className="dm-panel-num" aria-hidden="true">{step}</span>
          <div>
            <h2 id="dm-step-title" ref={headingRef} tabIndex={-1}>{meta.title}</h2>
            <p className="muted">{meta.hint}</p>
          </div>
        </header>
        {step === 1 && <BringStep editor={editor} sample={sample} onData={acceptData} onForget={forgetData} onNext={go} />}
        {step === 2 && <DiscoverStep editor={editor} sample={sample} onGo={go} />}
        {step === 3 && <SettleStep editor={editor} sample={sample} />}
        {step === 4 && <GenerateStep editor={editor} />}
        {step === 5 && <NameStep editor={editor} sample={sample} />}
      </section>
      <nav className="dm-next" aria-label="Steps">
        {step > 1 ? <button type="button" className="btn" onClick={() => go((step - 1) as StepNo)}>← {STEPS[step - 2].short}</button> : <span />}
        {step < 5 && <button type="button" className="btn primary" onClick={() => go((step + 1) as StepNo)}>{STEPS[step].short} →</button>}
      </nav>
    </ToolPage>
  );
}
