import { useId, useMemo, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { CSV_MAX_BYTES, pairedColumns, parseCsv, type CsvTable } from '../../../domain/distributions/csv';
import { parseData } from '../../../domain/distributions/fitting';
import { Callout, readFileText } from '../../../ui/controls';

/** Parsed numbers of one policy's box, with what was left out. */
export function readNumbers(text: string): { values: number[]; note: string } {
  const p = parseData(text);
  const notes = [
    p.rejected.length ? `left out: ${p.rejected.slice(0, 4).join(', ')}${p.rejected.length > 4 ? ' …' : ''}` : '',
    p.commaIsDecimal ? 'commas read as decimal commas' : '',
    p.decimalCommas.length ? `read as separate values: ${p.decimalCommas.join(' · ')}` : '',
  ].filter(Boolean);
  return { values: p.values, note: notes.join(' · ') };
}

/** One policy's results: a box of numbers with its colour key and a count. */
export function PolicyBox({ which, name, text, onText }: { which: 'baseline' | 'alternative'; name: string; text: string; onText: (t: string) => void }) {
  const id = useId();
  const { values, note } = useMemo(() => readNumbers(text), [text]);
  return (
    <div className={`field cmp-box is-${which}`}>
      <label htmlFor={id}><i className={`cmp-key is-${which}`} aria-hidden="true" />{name}<span className="sr-only">: results per replication</span></label>
      <textarea id={id} rows={8} value={text} spellCheck={false} placeholder={'One value per replication\n31.2\n28.7\n…'} aria-describedby={`${id}-hint`} onChange={(e) => onText(e.target.value)} />
      <span id={`${id}-hint`} className="hint" role="status">{values.length} replication{values.length === 1 ? '' : 's'}{note ? ` · ${note}` : ''}</span>
    </div>
  );
}

/** True for 1, 2, 3, … (or any run of whole numbers going up by one): a row counter. */
export const isRowCounter = (xs: number[]): boolean => xs.length > 1 && xs.every((v, i) => Number.isInteger(v) && v === xs[0] + i);

export interface Imported { baseline: number[]; alternative: number[]; baselineName: string | null; alternativeName: string | null; file: string; dropped: number }

/** Two columns from a CSV file, read row by row so that pairs stay pairs. */
export function CsvTwoColumns({ onUse }: { onUse: (x: Imported) => void }) {
  const [file, setFile] = useState<{ name: string; table: CsvTable } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0), [second, setSecond] = useState(1);
  const inputId = useId(), aId = useId(), bId = useId();
  const offered = file?.table.columns.filter((c) => c.offered) ?? [];

  const read = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const text = await readFileText(f, CSV_MAX_BYTES);
      const res = parseCsv(text);
      if (!res.ok) { setFile(null); setError(res.error); return; }
      const cols = res.table.columns.filter((c) => c.offered);
      if (cols.length < 2) { setFile(null); setError('The file needs two columns of numbers: one per policy, one row per replication.'); return; }
      // A column that just counts the rows (1, 2, 3, …) is a replication number, not a result: skip it by default.
      const results = cols.filter((c) => !isRowCounter(c.values));
      const pick = results.length >= 2 ? results : cols;
      setFile({ name: f.name, table: res.table }); setFirst(pick[0].index); setSecond(pick[1].index);
    } catch (e) { setFile(null); setError(e instanceof Error ? e.message : 'The file could not be read.'); }
  };
  const use = () => {
    if (!file) return;
    const a = file.table.columns[first], b = file.table.columns[second];
    const { first: base, second: alt, dropped } = pairedColumns(a, b);
    onUse({ baseline: base, alternative: alt, baselineName: file.table.header ? a.name : null, alternativeName: file.table.header ? b.name : null, file: file.name, dropped });
    setFile(null);
  };
  return (
    <div className="cmp-import">
      <label htmlFor={inputId} className="btn cmp-file">
        <input id={inputId} type="file" className="cmp-file-input" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={(e) => { void read(e.target.files?.[0]); e.target.value = ''; }} />
        <Upload size={16} aria-hidden="true" /> Import a CSV with two columns
      </label>
      {error && <Callout tone="error" role="alert">{error}</Callout>}
      {file && (
        <div className="cmp-import-pick">
          <span className="cmp-import-name"><FileSpreadsheet size={15} aria-hidden="true" /> {file.name} · {file.table.rows} rows</span>
          <span className="field"><label htmlFor={aId}>Baseline column</label>
            <select id={aId} value={first} onChange={(e) => setFirst(Number(e.target.value))}>{offered.map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}</select></span>
          <span className="field"><label htmlFor={bId}>Alternative column</label>
            <select id={bId} value={second} onChange={(e) => setSecond(Number(e.target.value))}>{offered.map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}</select></span>
          <button type="button" className="btn primary" disabled={first === second} onClick={use}>Use these columns</button>
          <button type="button" className="btn ghost" onClick={() => setFile(null)}>Cancel</button>
          {first === second && <span className="hint">Pick two different columns.</span>}
        </div>
      )}
    </div>
  );
}
