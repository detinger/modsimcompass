import { useDeferredValue, useId, useMemo, useState, type DragEvent } from 'react';
import { ArrowRight, ClipboardPaste, FileSpreadsheet, Layers, MessageCircleQuestion, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { ArtefactEditor } from '../../../app/artefacts';
import { CSV_MAX_BYTES, parseCsv, SEPARATOR_NAME, type CsvColumn, type CsvSeparator } from '../../../domain/distributions/csv';
import { DATASETS } from '../../../domain/distributions/datasets';
import { parseData } from '../../../domain/distributions/fitting';
import { defaultParams } from '../../../domain/distributions/inputModel';
import { FAMILIES, type Kind } from '../../../domain/distributions/laws';
import { sig } from '../../../domain/distributions/sample';
import { looksLikeRowNumber } from '../../../domain/measurement/stats';
import { childrenOf, FAMILY_NOTES, LEAVES, pathTo, QUESTIONS } from '../../../domain/distributions/tree';
import { Callout, readFileText } from '../../../ui/controls';
import { Thumb } from '../../../ui/playful';
import { MiniHist } from './charts';
import { ManyResult, useManyInputs } from './ManyInputs';
import type { StepNo } from './Stepper';
import type { Sample, SampleSource } from './types';

type Mode = 'csv' | 'paste' | 'describe';
type OnData = (values: number[], label: string, source: SampleSource, hints?: { name?: string; provenance?: string }) => void;
const num = (x: number) => sig(x, 4).replace('-', '−');

export function BringStep({ editor, sample, onData, onForget, onNext }: {
  editor: ArtefactEditor<'data-model'>; sample: Sample | null; onData: OnData; onForget: () => void; onNext: (n: StepNo) => void;
}) {
  const d = editor.artefact.data;
  const [mode, setMode] = useState<Mode>(d.origin === 'described' && !sample ? 'describe' : 'csv');
  const MODES: { id: Mode; label: string; icon: typeof Upload; text: string }[] = [
    { id: 'csv', label: 'Import a CSV', icon: FileSpreadsheet, text: 'Pick a column' },
    { id: 'paste', label: 'Paste numbers', icon: ClipboardPaste, text: 'From anywhere' },
    { id: 'describe', label: 'No data yet', icon: MessageCircleQuestion, text: 'Answer a few questions' },
  ];
  return (
    <div className="dm-stack">
      {sample && (
        <div className="dm-current" role="status">
          <MiniHist values={sample.prepared.values} />
          <div className="dm-current-text">
            <strong>{sample.prepared.values.length} values on screen</strong>
            <span className="muted">{sample.label}{sample.source === 'kept' ? '' : ' · in memory only'}</span>
          </div>
          <button type="button" className="btn small ghost" onClick={onForget}><Trash2 size={14} aria-hidden="true" /> Forget them</button>
          <button type="button" className="btn small" onClick={() => onNext(2)}>Discover <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
      )}
      <div className="dm-modes" role="group" aria-label="How to begin">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button key={m.id} type="button" className="dm-mode" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              <span className="dm-mode-icon" aria-hidden="true"><Icon size={22} /></span>
              <span className="dm-mode-text"><strong>{m.label}</strong><small>{m.text}</small></span>
            </button>
          );
        })}
      </div>
      {mode === 'csv' && <CsvImport onData={onData} />}
      {mode === 'paste' && <PastePanel onData={onData} />}
      {mode === 'describe' && <Describe editor={editor} onNext={onNext} />}
    </div>
  );
}

// ── CSV ──────────────────────────────────────────────────────────────────

function CsvImport({ onData }: { onData: OnData }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [sep, setSep] = useState<CsvSeparator | 'auto'>('auto');
  const [header, setHeader] = useState<'auto' | 'yes' | 'no'>('auto');
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  /** Columns ticked for several inputs at once; null until the author changes the default (every column but a row number). */
  const [picked, setPicked] = useState<number[] | null>(null);
  const many = useManyInputs();
  const inputId = useId(), sepId = useId(), headId = useId();
  const result = useMemo(() => (file ? parseCsv(file.text, { separator: sep === 'auto' ? undefined : sep, header: header === 'auto' ? undefined : header === 'yes' }) : null), [file, sep, header]);

  const read = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const text = await readFileText(f, CSV_MAX_BYTES);
      setFile({ name: f.name, text }); setSep('auto'); setHeader('auto'); setPicked(null); many.clear();
    } catch (e) { setFile(null); setError(e instanceof Error ? e.message : 'The file could not be read.'); }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void read(e.dataTransfer.files?.[0]); };
  const table = result?.ok ? result.table : null;
  const offered = table?.columns.filter((c) => c.offered) ?? [];
  const other = table?.columns.filter((c) => !c.offered) ?? [];
  // A column that numbers the rows (1, 2, 3, … or a name such as id) is not an input: it is left unticked.
  const rowLike = new Set(offered.filter((c) => looksLikeRowNumber(c.name, c.values)).map((c) => c.index));
  const chosen = picked ?? (offered.length > 1 ? offered.filter((c) => !rowLike.has(c.index)).map((c) => c.index) : []);
  const use = (c: CsvColumn) => onData(c.values, `“${file!.name}”, column “${c.name}”`, 'csv', { name: table?.header ? c.name : undefined, provenance: `File “${file!.name}”, column “${c.name}” (${c.values.length} values)` });

  return (
    <div className="dm-stack">
      <label htmlFor={inputId} className={`dm-drop${over ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <input id={inputId} type="file" className="dm-file-input" accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values" onChange={(e) => { void read(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="dm-drop-icon" aria-hidden="true"><Upload size={24} /></span>
        <span><strong>{file ? `Choose another file` : 'Choose a CSV file'}</strong> or drop it here</span>
        <small className="muted">Comma, semicolon or tab · up to 5 MB · stays in this browser</small>
      </label>
      {error && <Callout tone="error" role="alert">{error}</Callout>}
      {result && !result.ok && <Callout tone="error" role="alert">{result.error}</Callout>}
      {table && file && (
        <>
          <div className="dm-file-facts">
            <span className="dm-file-name"><FileSpreadsheet size={16} aria-hidden="true" /> {file.name}</span>
            <span>{table.rows} rows</span>
            <span className="field dm-inline-field">
              <label htmlFor={sepId}>Separator</label>
              <select id={sepId} value={sep} onChange={(e) => { setSep(e.target.value as CsvSeparator | 'auto'); setPicked(null); }}>
                <option value="auto">Detected: {SEPARATOR_NAME[table.separator]}</option>
                {(Object.keys(SEPARATOR_NAME) as CsvSeparator[]).map((s) => <option key={s} value={s}>{SEPARATOR_NAME[s]}</option>)}
              </select>
            </span>
            <span className="field dm-inline-field">
              <label htmlFor={headId}>First row</label>
              <select id={headId} value={header} onChange={(e) => { setHeader(e.target.value as 'auto' | 'yes' | 'no'); setPicked(null); }}>
                <option value="auto">Detected: {table.header ? 'names' : 'data'}</option>
                <option value="yes">Column names</option>
                <option value="no">Data</option>
              </select>
            </span>
          </div>
          {(table.raggedRows > 0 || table.unclosedQuoteLine !== null || table.blankLines > 0) && (
            <Callout tone="warning">
              {[table.raggedRows ? `${table.raggedRows} rows have more or fewer cells than the first.` : '', table.unclosedQuoteLine !== null ? `A quotation mark opens on line ${table.unclosedQuoteLine} and never closes.` : '', table.blankLines ? `${table.blankLines} blank lines skipped.` : ''].filter(Boolean).join(' ')}
            </Callout>
          )}
          {offered.length === 0 ? <Callout tone="warning">No column holds at least 3 numbers. Is the separator right?</Callout> : (
            <ul className="dm-columns" aria-label="Columns with numbers">
              {offered.map((c) => {
                const lo = Math.min(...c.values), hi = Math.max(...c.values);
                const on = chosen.includes(c.index);
                return (
                  <li key={c.index} className={`dm-column${on ? ' is-picked' : ''}`}>
                    <input type="checkbox" className="dm-pick" checked={on} aria-label={`Pick ${c.name} for several inputs at once`}
                      onChange={() => setPicked(on ? chosen.filter((x) => x !== c.index) : [...chosen, c.index])} />
                    <MiniHist values={c.values} />
                    <div className="dm-column-text">
                      <strong>{c.name}</strong>
                      <span className="muted">{c.values.length} numbers · {num(lo)} to {num(hi)}{c.decimalComma ? ' · decimal commas' : ''}</span>
                      {rowLike.has(c.index) && <span className="dm-row-note">Looks like a row number</span>}
                      {(c.blank > 0 || c.rejected > 0) && (
                        <span className="dm-column-note">
                          {c.blank > 0 && `${c.blank} blank`}{c.blank > 0 && c.rejected > 0 && ' · '}
                          {c.rejected > 0 && `${c.rejected} not numbers, left out (${c.rejectedSamples.slice(0, 2).map((r) => `line ${r.line}: “${r.text}”`).join(', ')})`}
                        </span>
                      )}
                    </div>
                    <button type="button" className="btn primary small" onClick={() => use(c)}>Use<span className="sr-only"> column {c.name}</span></button>
                  </li>
                );
              })}
            </ul>
          )}
          {offered.length > 1 && (
            <div className="dm-many-bar">
              <span className="hint">{chosen.length ? `${chosen.length} picked.` : 'Several inputs? Tick their columns.'} Each becomes its own data model, fitted by the lowest AIC.</span>
              <button type="button" className="btn" disabled={chosen.length < 2}
                onClick={() => { void many.make(offered.filter((c) => chosen.includes(c.index)), file.name); }}>
                <Layers size={16} aria-hidden="true" /> Make {chosen.length >= 2 ? chosen.length : ''} data models
              </button>
            </div>
          )}
          <ManyResult made={many.made} skipped={many.skipped} />
          {other.length > 0 && <p className="hint">Not offered (too few numbers): {other.map((c) => c.name).join(', ')}.</p>}
          <details className="dm-table-fold">
            <summary>First rows</summary>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="First rows of the file">
              <table className="data">
                <thead><tr>{table.columns.map((c) => <th key={c.index} scope="col">{c.name}</th>)}</tr></thead>
                <tbody>{table.preview.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

// ── Paste ────────────────────────────────────────────────────────────────

function PastePanel({ onData }: { onData: OnData }) {
  const [text, setText] = useState('');
  const deferred = useDeferredValue(text);
  const parsed = useMemo(() => parseData(deferred), [deferred]);
  const id = useId();
  const n = parsed.values.length;
  const notes = [
    parsed.commaIsDecimal ? 'Commas read as decimal commas (1,5 = 1.5).' : '',
    parsed.decimalCommas.length ? `Read as separate values: ${parsed.decimalCommas.join(' · ')}. Use a dot for decimals.` : '',
    parsed.truncated ? `Only the first ${n} were read; ${parsed.truncated} more were left out.` : '',
  ].filter(Boolean);
  const example = DATASETS[0];
  return (
    <div className="dm-stack">
      <div className="field">
        <label htmlFor={id}>Numbers</label>
        <textarea id={id} rows={7} value={text} placeholder="4.2  5.1  3.8 …   spaces, commas, semicolons or new lines" aria-describedby={`${id}-hint`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && n > 0) onData(parsed.values, `${n} pasted values`, 'paste', { provenance: 'Pasted values' }); }} />
        <span id={`${id}-hint`} className="hint" role="status">{n ? `${n} numbers` : 'Nothing yet'}{parsed.rejected.length ? ` · left out: ${parsed.rejected.slice(0, 5).join(', ')}${parsed.rejected.length > 5 ? ' …' : ''}` : ''}{notes.length ? ` · ${notes.join(' ')}` : ''}</span>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={n === 0} onClick={() => onData(parsed.values, `${n} pasted values`, 'paste', { provenance: 'Pasted values' })}>Use {n || ''} numbers</button>
        <button type="button" className="btn ghost" onClick={() => onData(example.values, `Example numbers (${example.values.length}, no unit)`, 'example', { provenance: 'Example numbers from the app, with no unit. Not observations of any real system.' })}>Try example numbers</button>
      </div>
    </div>
  );
}

// ── Describe without data ────────────────────────────────────────────────

function Describe({ editor, onNext }: { editor: ArtefactEditor<'data-model'>; onNext: (n: StepNo) => void }) {
  const [at, setAt] = useState('root');
  const steps = pathTo(at);
  const q = QUESTIONS[at], leaf = LEAVES[at];
  const choose = (k: Kind) => {
    editor.setData((x) => { x.family = k; x.params = defaultParams(k); x.origin = 'described'; x.fit = null; if (!x.availability) x.availability = 'assume'; });
    onNext(3);
  };
  return (
    <div className="dm-describe" aria-live="polite">
      <ol className="dm-crumbs" aria-label="Your answers">
        <li><button type="button" onClick={() => setAt('root')}><RotateCcw size={12} aria-hidden="true" /> Start</button></li>
        {steps.map((s) => <li key={s.to}><button type="button" onClick={() => setAt(s.to)}>{s.answer}</button></li>)}
      </ol>
      {q && (
        <div className="dm-question">
          <h3>{q.text}</h3>
          <p className="muted">{q.help}</p>
          <div className="dm-answers">
            {childrenOf(at).map((c) => <button key={c.to} type="button" className="dm-answer" onClick={() => setAt(c.to)}>{c.answer} <ArrowRight size={14} aria-hidden="true" /></button>)}
          </div>
        </div>
      )}
      {leaf && (
        <div className="dm-question">
          <h3>Try: {leaf.title}</h3>
          <ul className="dm-family-cards">
            {leaf.kinds.map((k) => {
              const note = FAMILY_NOTES[k];
              return (
                <li key={k} className="dm-family-card">
                  <Thumb kind={k} fields={note?.thumb ?? FAMILIES[k].defaults} className="thumb" />
                  <strong>{FAMILIES[k].title}</strong>
                  {note && <span className="muted">{note.use}</span>}
                  {note && <span className="dm-example">e.g. {note.example}</span>}
                  <button type="button" className="btn primary small" onClick={() => choose(k)}>Use {FAMILIES[k].title}</button>
                </li>
              );
            })}
          </ul>
          <p className="hint">A shortlist, not a verdict. Set the numbers in the next step.</p>
        </div>
      )}
    </div>
  );
}
