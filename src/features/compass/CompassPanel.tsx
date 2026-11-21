import type { CSSProperties } from 'react';
import { Eye, Leaf, Lightbulb, PenLine, ThumbsDown, ThumbsUp, ArrowRight } from 'lucide-react';
import { Link } from '../../app/router';
import type { StepDef, Warning } from '../../domain/passport/compass';
import type { ProjectDoc } from '../../domain/passport/schema';
import { usePassport } from '../project/passportContext';
import { Area } from '../project/fields';
import { SEVERITY, SEVERITY_ORDER, STEP_META, warningText } from './stepMeta';
import { stepSummary } from './summary';

/** A small compass whose needle turns a little further at every step. */
function Dial({ n }: { n: number }) {
  return (
    <svg className="cp-dial" viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      <circle cx="20" cy="20" r="17" className="ring" />
      <path d="M20 4.5v3M20 32.5v3M4.5 20h3M32.5 20h3" className="ticks" />
      <g className="needle" style={{ '--a': `${Math.round((n - 1) * 51.4 - 40)}deg` } as CSSProperties}>
        <path d="M20 7l4 13h-8z" className="north" />
        <path d="M20 33l4-13h-8z" className="south" />
      </g>
      <circle cx="20" cy="20" r="2" className="pin" />
    </svg>
  );
}

export function OpenItems({ warnings }: { warnings: Warning[] }) {
  return (
    <section className="cp-sec cp-open" id="open-items" aria-labelledby="open-h">
      <div className="cp-sec-head">
        <h3 id="open-h">Open items</h3>
        {warnings.length > 0 && <span className="cp-count" aria-hidden="true">{warnings.length}</span>}
        <span className="sr-only" aria-live="polite">{warnings.length} open {warnings.length === 1 ? 'item' : 'items'}</span>
      </div>
      {warnings.length === 0 ? (
        <div className="cp-calm">
          <span className="cp-calm-icon" aria-hidden="true"><Leaf size={18} /></span>
          <div><strong>Nothing open here</strong><span>Completeness only — quality is for the checkpoints.</span></div>
        </div>
      ) : SEVERITY_ORDER.map((sev) => {
        const list = warnings.filter((w) => w.severity === sev);
        if (list.length === 0) return null;
        const { label, icon: Icon, cls } = SEVERITY[sev];
        return (
          <div key={sev} className={`cp-sev ${cls}`}>
            <p className="cp-sev-head"><span className="cp-sev-icon" aria-hidden="true"><Icon size={14} /></span>{label}<span className="cp-sev-n">{list.length}</span></p>
            <ul>{list.map((w) => <li key={w.id}>{warningText(w)}</li>)}</ul>
          </div>
        );
      })}
    </section>
  );
}

/**
 * The same guidance as the side column, as one fold-out placed above the form. On narrow screens the side column
 * comes after every field, so without this the “why” and the examples would be out of reach while typing.
 */
export function QuickGuide({ step }: { step: StepDef }) {
  return (
    <details className="cp-quick">
      <summary><Lightbulb size={15} aria-hidden="true" /> Why this step matters, with a good and a weak example</summary>
      <p>{step.why}</p>
      <div className="cp-ex good"><p className="cp-ex-tag"><ThumbsUp size={13} aria-hidden="true" /> Good example</p><p>{step.good}</p></div>
      <div className="cp-ex weak"><p className="cp-ex-tag"><ThumbsDown size={13} aria-hidden="true" /> Weak example</p><p>{step.weak}</p></div>
    </details>
  );
}

/** The side column: why the step matters, examples, open items, self-check and a peek at the worked example. */
export function CompassPanel({ step, warnings, example }: { step: StepDef; warnings: Warning[]; example: ProjectDoc | null }) {
  const { doc, update, readOnly } = usePassport();
  const answers = doc.passport.selfChecks ?? {};
  const peek = example ? stepSummary(example, step.id) : [];
  const peekChecks = example ? step.selfChecks.filter((q) => (example.passport.selfChecks?.[q.id] ?? '').trim()) : [];
  return (
    <aside className={`cp-panel ${STEP_META[step.id].tone}`} aria-label="Compass guidance for this step" tabIndex={readOnly ? 0 : undefined}>
      <div className="cp-panel-head"><Dial n={step.number} /><div><strong>Compass</strong><span>Guidance for step {step.number}</span></div></div>

      <section className="cp-sec cp-why" aria-labelledby="why-h">
        <h3 id="why-h"><Lightbulb size={15} aria-hidden="true" /> Why it matters</h3>
        <p>{step.why}</p>
      </section>

      <section className="cp-sec cp-examples" aria-label="Examples">
        <div className="cp-ex good"><p className="cp-ex-tag"><ThumbsUp size={13} aria-hidden="true" /> Good example</p><p>{step.good}</p></div>
        <div className="cp-ex weak"><p className="cp-ex-tag"><ThumbsDown size={13} aria-hidden="true" /> Weak example</p><p>{step.weak}</p></div>
      </section>

      <OpenItems warnings={warnings} />

      <section className="cp-sec cp-self" aria-labelledby="self-h">
        <div className="cp-sec-head"><h3 id="self-h"><PenLine size={15} aria-hidden="true" /> Self-check</h3></div>
        <p className="cp-self-note">In your own words · never scored</p>
        {step.selfChecks.map((q) => (
          <Area key={q.id} label={q.question} rows={3} value={answers[q.id] ?? ''}
            onChange={(v) => update((d) => { (d.passport.selfChecks ??= {})[q.id] = v; })} />
        ))}
      </section>

      {!readOnly && example && (
        <details className="cp-sec cp-peek">
          <summary><Eye size={15} aria-hidden="true" /> Peek at the worked example</summary>
          {peek.length === 0 && peekChecks.length === 0 ? <p className="cp-empty-row">Nothing recorded for this step.</p> : (
            <dl>
              {peek.map((it) => (
                <div key={it.label}>
                  <dt>{it.label}</dt>
                  <dd>{Array.isArray(it.value) ? <ul>{it.value.map((v, i) => <li key={i}>{v}</li>)}</ul> : it.value}</dd>
                </div>
              ))}
              {peekChecks.map((q) => <div key={q.id} className="cp-peek-self"><dt>{q.question}</dt><dd>{example.passport.selfChecks[q.id]}</dd></div>)}
            </dl>
          )}
          <Link to={`/example/${step.id}`} className="cp-peek-link">Open the worked example <ArrowRight size={13} aria-hidden="true" /></Link>
        </details>
      )}
    </aside>
  );
}
