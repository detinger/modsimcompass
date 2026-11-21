import { useId, useState, type DragEvent } from 'react';
import { ArrowRight, FlaskConical, Trash2, Upload } from 'lucide-react';
import type { MeasurementData } from '../../../../domain/artefacts/types';
import { itemColumns, type Survey } from '../../../../domain/measurement/build';
import { EXAMPLE_SURVEY_SOURCE, exampleSurvey } from '../../../../domain/measurement/example';
import type { Cell } from '../../../../domain/measurement/stats';
import { CSV_MAX_BYTES, parseCsv } from '../../../../domain/distributions/csv';
import { Callout, readFileText } from '../../../../ui/controls';
import type { StepNo } from '../Stepper';

type OnSurvey = (survey: Survey, opts: { source: string; origin: MeasurementData['origin']; reverse?: string[]; title?: string }) => void;

/** A CSV file as a survey: its numeric columns, read row by row so each row stays one case. */
export function surveyFromCsv(text: string): { ok: true; survey: Survey; leftOut: string[] } | { ok: false; error: string } {
  const res = parseCsv(text);
  if (!res.ok) return res;
  const cols = res.table.columns.filter((c) => c.offered);
  const survey: Survey = { columns: cols.map((c) => c.name), rows: Array.from({ length: res.table.rows }, (_, r) => cols.map((c) => c.byRow[r] ?? null)) };
  const used = new Set(itemColumns(survey).map((j) => survey.columns[j]));
  const leftOut = res.table.columns.map((c) => c.name).filter((n) => !used.has(n));
  if (used.size < 2) return { ok: false, error: 'Fewer than two columns hold measured values. One column per item, one row per case.' };
  return { ok: true, survey, leftOut };
}

export function MBring({ d, rows, onSurvey, onForget, onNext }: { d: MeasurementData; rows: Cell[][] | null; onSurvey: OnSurvey; onForget(): void; onNext(n: StepNo): void }) {
  const [error, setError] = useState<string | null>(null);
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const inputId = useId();
  const read = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const res = surveyFromCsv(await readFileText(f, CSV_MAX_BYTES));
      if (!res.ok) { setError(res.error); return; }
      setLeftOut(res.leftOut);
      onSurvey(res.survey, { source: `File “${f.name}”`, origin: 'imported', title: f.name.replace(/\.[^.]+$/, '') });
    } catch (e) { setError(e instanceof Error ? e.message : 'The file could not be read.'); }
  };
  const example = () => {
    const s = exampleSurvey();
    setLeftOut([]);
    onSurvey({ columns: s.columns, labels: s.labels, rows: s.rows }, { source: EXAMPLE_SURVEY_SOURCE, origin: 'example', reverse: s.reverse, title: 'Example survey' });
  };
  return (
    <div className="dm-stack">
      {rows ? (
        <div className="dm-current" role="status">
          <div className="dm-current-text">
            <strong>{rows.length} cases · {d.items.length} items on screen</strong>
            <span className="muted">{d.origin === 'example' ? 'Example data, not responses from real people' : d.source}{d.keepData ? '' : ' · in memory only'}</span>
          </div>
          <button type="button" className="btn small ghost" onClick={onForget}><Trash2 size={14} aria-hidden="true" /> Forget them</button>
          <button type="button" className="btn small" onClick={() => onNext(2)}>Constructs <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
      ) : d.items.length > 0 && (
        <Callout tone="info" title="The answers were not kept with this artefact.">The constructs and summaries are here. Import the file again to recompute after changes.</Callout>
      )}
      <div className="ms-bring">
        <label htmlFor={inputId} className={`dm-drop${over ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); void read(e.dataTransfer.files?.[0]); }}>
          <input id={inputId} type="file" className="dm-file-input" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={(e) => { void read(e.target.files?.[0]); e.target.value = ''; }} />
          <span className="dm-drop-icon" aria-hidden="true"><Upload size={24} /></span>
          <span><strong>Choose a survey CSV</strong> or drop it here</span>
          <small className="muted">One column per item (PEOU1, PEOU2, …), one row per case · stays in this browser</small>
        </label>
        <button type="button" className="ms-example" onClick={example}>
          <span className="dm-mode-icon" aria-hidden="true"><FlaskConical size={22} /></span>
          <span className="dm-mode-text"><strong>Try with example survey data</strong><small>Four constructs, 14 items, 150 cases. Made by the app.</small></span>
        </button>
      </div>
      {error && <Callout tone="error" role="alert">{error}</Callout>}
      {leftOut.length > 0 && <p className="hint">Left out (not measured values, or a case number): {leftOut.join(', ')}.</p>}
    </div>
  );
}
