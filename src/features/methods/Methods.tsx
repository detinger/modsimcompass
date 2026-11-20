import { useMemo, useRef, useState } from 'react';
import { Ban, Check, ChevronLeft, ChevronRight, ExternalLink, Signpost, TriangleAlert } from 'lucide-react';
import { Link } from '../../app/router';
import { FAMILIES, FAMILY_TONE, METHODS, METHOD_BY_ID, appForMethod, type MethodId } from '../../domain/methods/registry';
import { answersKey, emptyAnswers, evaluateRules, QUESTIONS, RULE_VERSION, type MethodAnswers } from '../../domain/methods/rules';
import { Badge, Callout } from '../../ui/controls';
import { usePassport } from '../project/passportContext';

/** Link to a specialist app. A missing URL is stated, never invented. */
export function AppLink({ method }: { method: MethodId }) {
  const app = appForMethod(method);
  if (!app.url) return <span className="subtle-text" title="The specialist app link has not been configured.">{app.name}: App link not configured</span>;
  return <a className="btn small" href={app.url} target="_blank" rel="noopener noreferrer">Open {app.name} <ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>;
}

const optionLabel = (key: keyof MethodAnswers, value: string) => QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value)?.label ?? value;

/**
 * Embeddable method chooser: one question at a time, then a shortlist with reasons, caveats and
 * what each method leaves out. There are no scores: candidates are ordered by matched reasons only.
 */
export function MethodChooser() {
  const { doc, update, readOnly } = usePassport();
  const answers = doc.methods.answers ?? emptyAnswers();
  const advice = useMemo(() => evaluateRules(answers), [answers]);
  const rep = doc.passport.representation;
  const [qi, setQi] = useState(() => { const first = QUESTIONS.findIndex((q) => answers[q.key] === 'unsure'); return first < 0 ? 0 : first; });
  const promptRef = useRef<HTMLParagraphElement>(null);
  const q = QUESTIONS[qi];
  const answered = QUESTIONS.filter((x) => answers[x.key] !== 'unsure');
  const decisionOutdated = !!doc.methods.answersKey && doc.methods.answersKey !== answersKey(answers);

  const go = (i: number) => { setQi(Math.max(0, Math.min(QUESTIONS.length - 1, i))); window.setTimeout(() => promptRef.current?.focus({ preventScroll: true }), 0); };
  const setAnswer = (key: keyof MethodAnswers, value: string) => {
    update((d) => { d.methods.answers = { ...(d.methods.answers ?? emptyAnswers()), [key]: value } as MethodAnswers; });
    if (qi < QUESTIONS.length - 1) go(qi + 1);
  };
  const choose = (role: 'primary' | 'alternative', id: MethodId) => update((d) => {
    if (role === 'primary') d.passport.representation.primaryMethod = id;
    else d.passport.representation.alternativeMethod = id;
    d.methods = { ruleVersion: RULE_VERSION, answers, answersKey: answersKey(answers), shortlist: advice.candidates.map((c) => c.method), decidedAt: new Date().toISOString() };
  });

  return (
    <section className="cp-card mc" aria-labelledby="mc-h">
      <header className="cp-card-head">
        <span className="cp-card-icon" aria-hidden="true"><Signpost size={18} /></span>
        <div className="cp-card-title"><h3 id="mc-h">Method chooser</h3><p>Describe your system. Get a shortlist with reasons.</p></div>
        <Badge>Rule table {doc.methods.ruleVersion ?? RULE_VERSION}</Badge>
      </header>

      {readOnly ? (
        answered.length === 0 ? <p className="cp-empty-row">No chooser answers recorded.</p> : (
          <details className="mc-recorded">
            <summary>Answers given ({answered.length})</summary>
            <dl className="mc-answers">
              {answered.map((x) => <div key={x.key}><dt>{x.prompt}</dt><dd>{optionLabel(x.key, answers[x.key])}</dd></div>)}
            </dl>
          </details>
        )
      ) : (
        <div className="mc-q">
          <div className="mc-dots" role="group" aria-label="Questions">
            {QUESTIONS.map((x, i) => (
              <button key={x.key} type="button" className={answers[x.key] !== 'unsure' ? 'done' : undefined} aria-current={i === qi ? 'step' : undefined}
                aria-label={`Question ${i + 1} of ${QUESTIONS.length}${answers[x.key] !== 'unsure' ? ', answered' : ''}`} onClick={() => go(i)} />
            ))}
          </div>
          <p className="mc-count">Question {qi + 1} of {QUESTIONS.length} · {q.group}</p>
          <p className="mc-prompt" id="mc-prompt" ref={promptRef} tabIndex={-1}>{q.prompt}</p>
          <div className="cp-chips" role="group" aria-labelledby="mc-prompt">
            {q.options.map((o) => (
              <button key={o.value} type="button" className={`cp-chip${o.value === 'unsure' ? ' unsure' : ''}`} aria-pressed={answers[q.key] === o.value} onClick={() => setAnswer(q.key, o.value)}>{o.label}</button>
            ))}
          </div>
          <p className="hint">{q.help}</p>
          <div className="mc-nav">
            <button type="button" className="btn small ghost" disabled={qi === 0} onClick={() => go(qi - 1)}><ChevronLeft size={14} aria-hidden="true" /> Back</button>
            <span className="subtle-text">{answered.length} of {QUESTIONS.length} answered</span>
            <button type="button" className="btn small ghost" disabled={qi === QUESTIONS.length - 1} onClick={() => go(qi + 1)}>Next <ChevronRight size={14} aria-hidden="true" /></button>
          </div>
        </div>
      )}

      <div className="mc-shortlist" aria-live="polite">
        <h4>Shortlist</h4>
        {advice.status === 'more-information-needed'
          ? <p className="cp-empty-row">No suggestion yet. A few more answers will do it.</p>
          : <p className="subtle-text">Ordered by matched reasons — a reading aid, not a score.{answered.length < QUESTIONS.length ? ' Provisional while some answers are “Not sure yet”.' : ''}</p>}
        {decisionOutdated && !readOnly && <Callout tone="warning">Your answers changed after you chose. Review the choice.</Callout>}
        {advice.general.map((g) => <Callout key={g} tone="warning">{g}</Callout>)}
        {advice.candidates.map((c) => {
          const m = METHOD_BY_ID[c.method];
          const isPrimary = rep.primaryMethod === c.method, isAlt = rep.alternativeMethod === c.method;
          return (
            <article key={c.method} className={`mc-cand ${FAMILY_TONE[m.family]}${isPrimary || isAlt ? ' chosen' : ''}`} aria-labelledby={`m-${c.method}`}>
              <div className="mc-cand-head">
                <h5 id={`m-${c.method}`}>{m.name}</h5>
                <span className="mc-family">{FAMILIES[m.family].label}</span>
                {isPrimary && <Badge tone="primary">Primary</Badge>}
                {isAlt && <Badge tone="primary">Alternative</Badge>}
              </div>
              <p className="mc-summary">{m.summary}</p>
              <ul className="mc-points fit" aria-label="Why it may fit">{c.reasons.map((r) => <li key={r}><Check size={14} aria-hidden="true" />{r}</li>)}</ul>
              {c.caveats.length > 0 && <ul className="mc-points caveat" aria-label="Caveats">{c.caveats.map((r) => <li key={r}><TriangleAlert size={14} aria-hidden="true" />{r}</li>)}</ul>}
              <ul className="mc-points omit" aria-label="What it leaves out">{m.omits.map((r) => <li key={r}><Ban size={14} aria-hidden="true" /><span><span className="mc-omit-tag">Leaves out</span> {r}</span></li>)}</ul>
              {c.method === 'monte-carlo' && <p className="subtle-text">Need input distributions? <Link to="/tools/choose">Choose</Link> · <Link to="/tools/distributions">Explore</Link> · <Link to="/tools/fitting">Fit</Link></p>}
              <details>
                <summary>Assumptions, data needs and limits</summary>
                <p className="field-label">Important assumptions</p><ul>{m.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                <p className="field-label">Data needs</p><ul>{m.dataNeeds.map((a) => <li key={a}>{a}</li>)}</ul>
                <p className="field-label">Fails when</p><ul>{m.failureConditions.map((a) => <li key={a}>{a}</li>)}</ul>
              </details>
              <div className="btn-row">
                {!readOnly && <button type="button" className="btn primary small" onClick={() => choose('primary', c.method)} disabled={isPrimary}>Use as primary</button>}
                {!readOnly && <button type="button" className="btn small" onClick={() => choose('alternative', c.method)} disabled={isAlt}>Keep as alternative</button>}
                <AppLink method={c.method} />
              </div>
            </article>
          );
        })}
        {advice.missing.length > 0 && !readOnly && (
          <details>
            <summary>Still unclear ({advice.missing.length})</summary>
            <ul>{advice.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </details>
        )}
      </div>
    </section>
  );
}

/** Every method in the course, grouped by nothing but its family colour. */
export function MethodCatalogue() {
  return (
    <details className="cp-card mc-all">
      <summary>All {METHODS.length} methods</summary>
      <ul className="mc-catalogue">
        {METHODS.map((m) => (
          <li key={m.id} className={FAMILY_TONE[m.family]}>
            <strong>{m.name}</strong>
            <span className="mc-family">{FAMILIES[m.family].label}</span>
            <p>{m.summary}</p>
            <AppLink method={m.id} />
          </li>
        ))}
      </ul>
    </details>
  );
}
