import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Leaf, Milestone } from 'lucide-react';
import { Link, useRouter } from '../../app/router';
import { CHECKPOINT_DEFS, RUBRIC_LEVELS, STEP_BY_ID, checkpointReadiness, type CheckpointDef, type StepId } from '../../domain/passport/compass';
import { REVIEW_LABELS, type Checkpoint, type CheckpointId, type ReviewStatus } from '../../domain/passport/schema';
import { usePassport } from '../project/passportContext';
import { Area, Choice, Txt } from '../project/fields';
import { CHECKPOINT_TONE, SEVERITY, STATUS_CLASS, warningText } from './stepMeta';

/** Today as YYYY-MM-DD in the user's own time zone (a target date is a local calendar day). */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const STATUS_OPTIONS = (Object.keys(REVIEW_LABELS) as ReviewStatus[]).map((k) => ({ value: k, label: REVIEW_LABELS[k] }));
const SOURCE_OPTIONS: { value: Checkpoint['feedbackSource']; label: string }[] = [{ value: 'self', label: 'Self-review' }, { value: 'teacher', label: 'Reviewer feedback' }];
const stepRange = (steps: StepId[]) => {
  const n = steps.map((s) => STEP_BY_ID[s].number);
  return n.length === 1 ? `Step ${n[0]}` : `Steps ${n[0]}–${n[n.length - 1]}`;
};

function CheckpointCard({ def, index, open, onToggle }: { def: CheckpointDef; index: number; open: boolean; onToggle: () => void }) {
  const { doc, update, readOnly, base } = usePassport();
  const r = doc.passport.review[def.id];
  const rubric = r.rubric ?? {};
  const ready = checkpointReadiness(doc, def.id);
  const rated = def.rubric.filter((c) => rubric[c.id] !== undefined).length;
  const setLevel = (criterion: string, level: number) => update((d) => {
    const cp = d.passport.review[def.id];
    cp.rubric ??= {};
    if (cp.rubric[criterion] === level) delete cp.rubric[criterion]; else cp.rubric[criterion] = level;
  });
  return (
    <article className={`cp-ck ${CHECKPOINT_TONE[def.id]}${open ? ' open' : ''}`} id={def.id}>
      <h3 className="cp-ck-h">
        <button type="button" aria-expanded={open} aria-controls={`ck-${def.id}`} onClick={onToggle}>
          <span className="cp-ck-n" aria-hidden="true">{index + 1}</span>
          <span className="cp-ck-name">{def.label}<small>{stepRange(def.steps)}</small></span>
          <span className="cp-ck-facts">
            {r.due && (() => {
              const late = r.due < localToday() && (r.status === 'draft' || r.status === 'needs-revision');
              return <span className={`cp-due${late ? ' late' : ''}`}>{late ? 'Was due' : 'Due'} {new Date(`${r.due}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>;
            })()}
            <span className={`cp-pill ${ready.length > 0 ? 'has-open' : 'calm'}`}>{ready.length > 0 ? `${ready.length} open` : 'Nothing open'}</span>
            <span className="cp-pill">{rated} of {def.rubric.length} rated</span>
            <span className={`cp-pill ${STATUS_CLASS[r.status]}`}>{REVIEW_LABELS[r.status]}</span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className="cp-ck-chev" />
        </button>
      </h3>
      {open && (
        <div className="cp-ck-body" id={`ck-${def.id}`}>
          <p className="cp-ck-expected"><span>Expected evidence</span>{def.expected}</p>
          <div className="cp-ck-grid">
            <section aria-label={`${def.label}: readiness`}>
              <h4>Readiness</h4>
              {ready.length === 0 ? (
                <div className="cp-calm">
                  <span className="cp-calm-icon" aria-hidden="true"><Leaf size={18} /></span>
                  <div><strong>Nothing open here</strong><span>The fields are filled. The rubric looks at quality.</span></div>
                </div>
              ) : def.steps.map((sid) => {
                const list = ready.filter((w) => w.step === sid);
                if (list.length === 0) return null;
                return (
                  <div key={sid} className="cp-ready">
                    <Link to={`${base}/${sid}`} className="cp-ready-step">Step {STEP_BY_ID[sid].number} · {STEP_BY_ID[sid].title} <ArrowRight size={13} aria-hidden="true" /></Link>
                    <ul>
                      {list.map((w) => {
                        const { icon: Icon, cls, label } = SEVERITY[w.severity];
                        return <li key={w.id} className={cls}><Icon size={14} aria-hidden="true" /><span><span className="sr-only">{label}: </span>{warningText(w)}</span></li>;
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
            <section aria-label={`${def.label}: rubric`}>
              <h4>Rubric</h4>
              <ul className="list-reset cp-rubric">
                {def.rubric.map((c) => {
                  const value = rubric[c.id];
                  return (
                    <li key={c.id}>
                      <p className="cp-rubric-name">{c.criterion}</p>
                      <p className="cp-rubric-strong"><span>Strong</span>{c.strong}</p>
                      <div className="cp-levels" role="group" aria-label={`${c.criterion}: level`}>
                        {RUBRIC_LEVELS.map((label, lv) => (
                          <button key={label} type="button" aria-pressed={value === lv} className={value !== undefined && lv <= value ? 'on' : undefined}
                            disabled={readOnly} onClick={() => setLevel(c.id, lv)}>
                            <i aria-hidden="true" />{label}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
          <section className="cp-ck-review" aria-label={`${def.label}: review`}>
            <h4>Review</h4>
            <div className="cp-duo">
              <Choice label="Status" value={r.status} onChange={(v) => update((d) => { d.passport.review[def.id].status = v; })} options={STATUS_OPTIONS} />
              <Choice label="Feedback source" value={r.feedbackSource} clearTo="" onChange={(v) => update((d) => { d.passport.review[def.id].feedbackSource = v; })}
                options={SOURCE_OPTIONS} hint="Entered manually, not authenticated." />
            </div>
            {(!readOnly || r.due) && (
              <div className="field" style={{ maxWidth: 220 }}>
                <label htmlFor={`due-${def.id}`}>Target date (optional)</label>
                <input id={`due-${def.id}`} type="date" value={r.due ?? ''} disabled={readOnly} onChange={(e) => update((d) => { d.passport.review[def.id].due = e.target.value; })} />
              </div>
            )}
            {(!readOnly || r.reviewer.trim()) && <Txt label="Reviewer name (optional)" value={r.reviewer} onChange={(v) => update((d) => { d.passport.review[def.id].reviewer = v; })} />}
            {(!readOnly || r.notes.trim()) && <Area label="Notes" value={r.notes} onChange={(v) => update((d) => { d.passport.review[def.id].notes = v; })} rows={3} />}
          </section>
        </div>
      )}
    </article>
  );
}

/** Five checkpoint cards: expected evidence, readiness, rubric and review record. No score is calculated. */
export function Checkpoints() {
  const { doc } = usePassport();
  const { path } = useRouter();
  // `?cp=design` (from the header chips) opens that checkpoint; otherwise the first one still in draft.
  const asked = CHECKPOINT_DEFS.find((c) => c.id === new URLSearchParams(path.split('?')[1] ?? '').get('cp'))?.id ?? null;
  const [open, setOpen] = useState<Set<CheckpointId>>(() => new Set([asked ?? (CHECKPOINT_DEFS.find((c) => doc.passport.review[c.id].status === 'draft') ?? CHECKPOINT_DEFS[0]).id]));
  useEffect(() => {
    if (!asked) return;
    setOpen((s) => (s.has(asked) ? s : new Set([...s, asked])));
    document.getElementById(asked)?.scrollIntoView({ block: 'start' });
  }, [asked]);
  const toggle = (id: CheckpointId) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="cp-cks">
      <div className="cp-stephead tone-primary">
        <span className="cp-stepicon" aria-hidden="true"><Milestone size={26} /></span>
        <div>
          <p className="cp-stepno">Assessment</p>
          <h2 tabIndex={-1} id="cp-step-h">Checkpoints</h2>
          <p className="cp-short">Five reviews along the way. Review status stays separate from steps started.</p>
        </div>
      </div>
      {CHECKPOINT_DEFS.map((def, i) => <CheckpointCard key={def.id} def={def} index={i} open={open.has(def.id)} onToggle={() => toggle(def.id)} />)}
    </div>
  );
}
