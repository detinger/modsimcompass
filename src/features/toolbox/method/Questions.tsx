import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { MethodChoice } from '../../../domain/artefacts/types';
import { QUESTIONS, type Advice, type MethodAnswers } from '../../../domain/methods/rules';

/** Shorter or more neutral hints where the rule table's own example would not fit every project. */
/**
 * The questions of the rule table, one at a time. Every answer updates the shortlist at once; “Not sure yet” is
 * always allowed. Adapted from the chooser that used to sit in the project's method step.
 */
export function Questions({ answers, advice, onAnswer, onClear }: {
  answers: MethodChoice['answers']; advice: Advice;
  onAnswer<Q extends keyof MethodAnswers>(key: Q, value: MethodAnswers[Q]): void; onClear(): void;
}) {
  const [qi, setQi] = useState(() => { const first = QUESTIONS.findIndex((q) => answers[q.key] === 'unsure'); return first < 0 ? 0 : first; });
  const promptRef = useRef<HTMLParagraphElement>(null);
  const q = QUESTIONS[qi];
  const answered = QUESTIONS.filter((x) => answers[x.key] !== 'unsure').length;

  const go = (i: number, focus = true) => {
    setQi(Math.max(0, Math.min(QUESTIONS.length - 1, i)));
    if (focus) window.setTimeout(() => promptRef.current?.focus({ preventScroll: true }), 0);
  };
  const answer = (value: string) => onAnswer(q.key, value as MethodAnswers[typeof q.key]);
  // A click with the pointer moves on to the next question. Arrow keys only change the answer (a keyboard click has detail 0),
  // so moving through the options never jumps away from the question.
  const moveOn = (detail: number) => { if (detail > 0 && qi < QUESTIONS.length - 1) go(qi + 1); };

  return (
    <div className="mt-questions">
      <div className="mt-q-card">
        <div className="mt-q-top">
          <div className="mt-dots" role="group" aria-label="Questions">
            {QUESTIONS.map((x, i) => (
              <button key={x.key} type="button" className={answers[x.key] !== 'unsure' ? 'is-done' : undefined} aria-current={i === qi ? 'step' : undefined}
                aria-label={`Question ${i + 1} of ${QUESTIONS.length}${answers[x.key] !== 'unsure' ? ', answered' : ''}`} onClick={() => go(i)} />
            ))}
          </div>
          <span className="mt-q-count">{qi + 1} / {QUESTIONS.length} · {q.group}</span>
        </div>
        <p className="mt-q-prompt" id="mt-q-prompt" ref={promptRef} tabIndex={-1}>{q.prompt}</p>
        <div className="mt-q-options" role="radiogroup" aria-labelledby="mt-q-prompt">
          {q.options.map((o) => {
            const checked = answers[q.key] === o.value;
            return (
              <label key={o.value} className={`mt-q-option${o.value === 'unsure' ? ' is-unsure' : ''}${checked ? ' is-checked' : ''}`}>
                <input type="radio" className="mt-q-radio" name={`mt-q-${q.key}`} value={o.value} checked={checked}
                  onChange={() => answer(o.value)} onClick={(e) => moveOn(e.detail)} />
                {o.label}
              </label>
            );
          })}
        </div>
        <p className="hint">{q.help}</p>
        <div className="mt-q-nav">
          <button type="button" className="btn small ghost" disabled={qi === 0} onClick={() => go(qi - 1)}><ChevronLeft size={14} aria-hidden="true" /> Back</button>
          <span className="mt-q-answered">{answered} of {QUESTIONS.length} answered</span>
          <button type="button" className="btn small ghost" disabled={qi === QUESTIONS.length - 1} onClick={() => go(qi + 1)}>Next <ChevronRight size={14} aria-hidden="true" /></button>
        </div>
      </div>
      <aside className="mt-q-side" aria-label="About your answers">
        {advice.general.map((g) => <p key={g} className="mt-q-note is-warning">{g}</p>)}
        {advice.missing.length > 0 ? (
          <>
            <p className="mt-q-side-h">Still open</p>
            <ul className="mt-q-missing">{advice.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </>
        ) : answered > 0 ? <p className="mt-q-note">The key questions are answered.</p> : null}
        {answered > 0 && (
          <button type="button" className="btn small ghost" onClick={() => { onClear(); go(0, false); }}><RotateCcw size={14} aria-hidden="true" /> Clear answers</button>
        )}
      </aside>
    </div>
  );
}
