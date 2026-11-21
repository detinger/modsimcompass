import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

/* ── Number field with optional slider ─────────────────────────
 * Keeps the raw text so incomplete edits ('-', '', '1.') are preserved and never
 * coerced to zero. Emits a number only when the text parses to a finite value.
 */
export function NumberField(props: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number; step?: number;
  slider?: boolean; hint?: ReactNode; error?: string; integer?: boolean; disabled?: boolean; id?: string;
}) {
  const { label, value, onChange, unit, min, max, step = 1, slider, hint, error, integer, disabled } = props;
  const autoId = useId();
  const id = props.id ?? autoId;
  const [text, setText] = useState(String(value));
  const [localError, setLocalError] = useState<string | null>(null);
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current) { setText(String(value)); lastEmitted.current = value; setLocalError(null); }
  }, [value]);
  const commitText = (t: string) => {
    setText(t);
    const trimmed = t.trim().replace(',', '.');
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') { setLocalError('Enter a number.'); return; }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) { setLocalError('Enter a finite number.'); return; }
    if (integer && !Number.isInteger(n)) { setLocalError('Enter a whole number.'); return; }
    setLocalError(null);
    lastEmitted.current = n;
    onChange(n);
  };
  const shownError = localError ?? error;
  const range = min !== undefined || max !== undefined ? `Allowed ${min ?? '−∞'}–${max ?? '∞'}${unit ? ` ${unit}` : ''}` : null;
  const describedBy = `${id}-hint${shownError ? ` ${id}-err` : ''}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{unit ? <span className="unit"> ({unit})</span> : null}</label>
      <div className={slider ? 'slider-field' : undefined}>
        {slider && (
          <input type="range" aria-label={`${label} slider`} min={min} max={max} step={step} disabled={disabled}
            value={Number.isFinite(value) ? Math.min(max ?? value, Math.max(min ?? value, value)) : 0}
            onChange={(e) => commitText(e.target.value)} tabIndex={-1} aria-hidden="true" />
        )}
        <input id={id} type="text" inputMode="decimal" value={text} disabled={disabled}
          aria-invalid={shownError ? true : undefined} aria-describedby={describedBy}
          onChange={(e) => commitText(e.target.value)} />
      </div>
      <span id={`${id}-hint`} className="hint">{hint}{hint && range ? ' · ' : ''}{range}</span>
      {shownError && <span id={`${id}-err`} className="field-error" role="alert">{shownError}</span>}
    </div>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; placeholder?: string; id?: string; maxLength?: number }) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input id={id} type="text" value={props.value} placeholder={props.placeholder} maxLength={props.maxLength ?? 500}
        aria-describedby={props.hint ? `${id}-hint` : undefined} onChange={(e) => props.onChange(e.target.value)} />
      {props.hint && <span id={`${id}-hint`} className="hint">{props.hint}</span>}
    </div>
  );
}

export function TextArea(props: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; rows?: number; id?: string; placeholder?: string }) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <textarea id={id} rows={props.rows ?? 3} value={props.value} placeholder={props.placeholder} maxLength={20000}
        aria-describedby={props.hint ? `${id}-hint` : undefined} onChange={(e) => props.onChange(e.target.value)} />
      {props.hint && <span id={`${id}-hint`} className="hint">{props.hint}</span>}
    </div>
  );
}

export function SelectField<T extends string>(props: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; hint?: ReactNode; id?: string }) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value as T)} aria-describedby={props.hint ? `${id}-hint` : undefined}>
        {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {props.hint && <span id={`${id}-hint`} className="hint">{props.hint}</span>}
    </div>
  );
}

export function Segmented<T extends string>(props: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const labelId = useId();
  return (
    <div className="field">
      <span className="field-label" id={labelId}>{props.label}</span>
      <div className="seg" role="group" aria-labelledby={labelId}>
        {props.options.map((o) => (
          <button type="button" key={o.value} aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'primary' | 'accent' | 'warning' | 'success' | 'error' | 'evidence' }) {
  return <span className={`badge${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

export function ProvenanceBadge({ kind }: { kind: 'computed' | 'illustrative' | 'mixed' | 'authored' | 'simulated' }) {
  const label = { computed: 'Calculated', illustrative: 'Illustrative trace', mixed: 'Calculated from synthetic data', authored: 'Authored evidence', simulated: 'Simulation result' }[kind];
  return <Badge tone={kind === 'illustrative' || kind === 'authored' ? undefined : 'evidence'}>{label}</Badge>;
}

export function Callout({ tone = 'info', title, children, role }: { tone?: 'info' | 'warning' | 'error' | 'success' | 'evidence'; title?: ReactNode; children?: ReactNode; role?: 'status' | 'alert' }) {
  const Icon = tone === 'warning' ? AlertTriangle : tone === 'error' ? XCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`callout ${tone}`} role={role}>
      <Icon size={18} aria-hidden="true" />
      <div>{title && <strong>{title}</strong>}{title && children ? <div>{children}</div> : children}</div>
    </div>
  );
}

export function Kpi({ label, value, unit, detail, undefinedText, stale }: { label: string; value: string | null; unit?: string; detail?: ReactNode; undefinedText?: string; stale?: boolean }) {
  return (
    <div className={`kpi${stale ? ' stale' : ''}`}>
      <div className="label">{label}</div>
      {value === null ? <div className="undefined">{undefinedText ?? 'Not defined'}</div> : <div className="value">{value}{unit ? <small> {unit}</small> : null}</div>}
      {detail && <div className="detail">{detail}</div>}
    </div>
  );
}

export function fmt(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const r = Math.round(n * 10 ** dp) / 10 ** dp;
  return r.toLocaleString('en-GB', { maximumFractionDigits: dp });
}

/* ── Dialog with focus trap, Escape and focus restoration ───── */
export function Dialog({ title, onClose, children, actions, narrow, mustChoose }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; narrow?: boolean; /** No close button, Escape or backdrop dismissal: one of the actions has to be taken. */ mustChoose?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'));
    (focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mustChoose) { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !mustChoose) onClose(); }}>
      <div className={`dialog${narrow ? ' narrow' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="card-head">
          <h2 id={titleId}>{title}</h2>
          {!mustChoose && <button type="button" className="btn ghost small" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>}
        </div>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

/** Trigger a browser download for generated content. Downloading is not a cloud save. */
export function downloadFile(name: string, content: string | Uint8Array, mime: string): void {
  const part: BlobPart = typeof content === 'string' ? content : new Uint8Array(content);
  const blob = new Blob([part], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) return Promise.reject(new Error(`File is larger than ${Math.round(maxBytes / 1e6)} MB.`));
  return file.text();
}
