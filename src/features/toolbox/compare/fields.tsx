import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * A number that may be left empty (empty means “not set”). Keeps the typed text, so “-” or “1.” are never turned
 * into a number behind the user's back; a value is passed on only when the text reads as one.
 */
export function OptionalNumber({ label, value, onChange, hint, positive, unit }: {
  label: string; value: number | null; onChange: (v: number | null) => void; hint?: ReactNode; positive?: boolean; unit?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value));
  const [error, setError] = useState<string | null>(null);
  const last = useRef(value);
  useEffect(() => { if (value !== last.current) { last.current = value; setText(value === null ? '' : String(value)); setError(null); } }, [value]);
  const commit = (t: string) => {
    setText(t);
    const s = t.trim().replace(',', '.').replace(/^−/, '-');
    if (s === '') { setError(null); last.current = null; onChange(null); return; }
    const n = Number(s);
    if (!Number.isFinite(n)) { setError('Enter a number, or leave it empty.'); return; }
    if (positive && n <= 0) { setError('Enter a number above zero, or leave it empty.'); return; }
    setError(null); last.current = n; onChange(n);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}{unit ? <span className="unit"> ({unit})</span> : null}</label>
      <input id={id} type="text" inputMode="decimal" value={text} placeholder="Not set" autoComplete="off"
        aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint${error ? ` ${id}-err` : ''}`} onChange={(e) => commit(e.target.value)} />
      <span id={`${id}-hint`} className="hint">{hint}</span>
      {error && <span id={`${id}-err`} className="field-error" role="alert">{error}</span>}
    </div>
  );
}
