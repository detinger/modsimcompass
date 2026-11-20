import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SelectField, TextArea, TextField } from '../../ui/controls';
import { usePassport } from './passportContext';

/** Passport fields that render as plain text when the passport is read only. Every field keeps a visible label. */

export function ReadValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="field cp-ro">
      <span className="field-label">{label}</span>
      <p className="cp-ro-value">{value.trim() ? value : <span className="cp-ro-empty">Not yet specified</span>}</p>
    </div>
  );
}

interface TextProps { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; placeholder?: string }

export function Txt(props: TextProps) {
  const { readOnly } = usePassport();
  return readOnly ? <ReadValue label={props.label} value={props.value} /> : <TextField {...props} />;
}

export function Area(props: TextProps & { rows?: number }) {
  const { readOnly } = usePassport();
  return readOnly ? <ReadValue label={props.label} value={props.value} /> : <TextArea {...props} />;
}

export function Pick<T extends string>(props: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; hint?: ReactNode }) {
  const { readOnly } = usePassport();
  if (readOnly) return <ReadValue label={props.label} value={props.options.find((o) => o.value === props.value)?.label ?? ''} />;
  return <SelectField {...props} />;
}

/** One-of-many chips. With `clearTo`, pressing the chosen chip again clears the answer. */
export function Choice<T extends string>(props: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; hint?: ReactNode; clearTo?: T; disabled?: boolean;
}) {
  const { readOnly } = usePassport();
  const id = useId();
  if (readOnly) return <ReadValue label={props.label} value={props.options.find((o) => o.value === props.value)?.label ?? ''} />;
  return (
    <div className="field">
      <span className="field-label" id={id}>{props.label}</span>
      <div className="cp-chips" role="group" aria-labelledby={id}>
        {props.options.map((o) => (
          <button key={o.value} type="button" className="cp-chip" aria-pressed={props.value === o.value} disabled={props.disabled}
            onClick={() => { if (props.value !== o.value) props.onChange(o.value); else if (props.clearTo !== undefined) props.onChange(props.clearTo); }}>
            {o.label}
          </button>
        ))}
      </div>
      {props.hint && <span className="hint">{props.hint}</span>}
    </div>
  );
}

/** A titled card that groups a few related fields. */
export function FieldCard({ icon: Icon, title, sub, children, aside, id }: { icon: LucideIcon; title: string; sub?: ReactNode; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section className="cp-card" id={id}>
      <header className="cp-card-head">
        <span className="cp-card-icon" aria-hidden="true"><Icon size={18} /></span>
        <div className="cp-card-title"><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
        {aside}
      </header>
      {children}
    </section>
  );
}
