import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, Compass as CompassIcon, Copy, Download, Lock, Milestone, Pencil, Plus } from 'lucide-react';
import { useStore } from '../../app/store';
import { Link, useRouter } from '../../app/router';
import {
  CHECKPOINT_DEFS, STEPS, STEP_BY_ID, compassWarnings, isStepId, stepsStarted, type StepDef, type StepId, type Warning,
} from '../../domain/passport/compass';
import { REVIEW_LABELS, newId, type ProjectDoc } from '../../domain/passport/schema';
import { workedExample } from '../../content/workedExample';
import { PassportContext, usePassport, type PassportValue } from '../project/passportContext';
import { Checkpoints } from './Checkpoints';
import { CompassPanel, QuickGuide } from './CompassPanel';
import { StepMain } from './StepMain';
import { CHECKPOINTS_ID, SEVERITY, SEVERITY_ORDER, STATUS_CLASS, STEP_META, openCount } from './stepMeta';
import '../../styles/compass.css';
import NotFound from '../help/NotFound';
import { rememberOrigin } from '../../app/cameFrom';

// The export dialog brings the report writers with it; it is loaded when first opened.
const ExportDialog = lazy(() => import('../project/ExportDialog').then((m) => ({ default: m.ExportDialog })));

const LAST_STEP_KEY = 'modsim-essentials.compass.lastStep';
function lastStep(id: string): StepId | null {
  try { const s = window.localStorage.getItem(`${LAST_STEP_KEY}.${id}`); return s && isStepId(s) ? s : null; } catch { return null; }
}
function rememberStep(id: string, step: StepId) {
  try { window.localStorage.setItem(`${LAST_STEP_KEY}.${id}`, step); } catch { /* storage unavailable: nothing to remember */ }
}

// The worked example is built once: it is read only and never mutated (copies are deep clones).
let exampleCache: ProjectDoc | null = null;
const getExample = () => (exampleCache ??= workedExample());

/** The Project Compass: seven steps over the model passport, with guidance beside every step. */
export default function Compass({ step, example }: { step?: string; example?: boolean }) {
  const { active } = useStore();
  const exampleDoc = getExample();
  const doc = example ? exampleDoc : active;
  // Only the seven steps and the checkpoints page exist under a project address.
  if (step && !isStepId(step) && step !== CHECKPOINTS_ID) return <NotFound />;
  if (!doc) return <EmptyCompass />;
  return <CompassView key={`${example ? 'example' : 'project'}-${doc.id}`} doc={doc} exampleDoc={exampleDoc} step={step} readOnly={!!example} />;
}

// ── Empty state ───────────────────────────────────────────────────────────
function EmptyCompass() {
  const { createAndActivate, projects, activate } = useStore();
  return (
    <div className="page cp-root cp-empty">
      <div className="cp-empty-hero">
        <svg className="cp-bigdial" viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
          <circle cx="60" cy="60" r="52" className="ring" />
          <path d="M60 12v9M60 99v9M12 60h9M99 60h9" className="ticks" />
          <g className="needle"><path d="M60 22l11 38H49z" className="north" /><path d="M60 98l11-38H49z" className="south" /></g>
          <circle cx="60" cy="60" r="5" className="pin" />
        </svg>
        <h1>Your project compass</h1>
        <p className="lede">Seven steps from a question to a recommendation you can defend.</p>
        <div className="btn-row">
          <button type="button" className="btn primary cp-big" onClick={() => createAndActivate({ title: 'My modelling project' })}><Plus size={18} aria-hidden="true" /> Start a new project</button>
          <Link to="/example" className="btn cp-big"><BookOpen size={18} aria-hidden="true" /> Open the worked example</Link>
        </div>
        {projects.length > 0 && (
          <div className="cp-empty-recent">
            <span>or continue</span>
            {projects.slice(0, 3).map((p) => <button key={p.id} type="button" className="chip" onClick={() => { void activate(p.id); }}>{p.passport.identity.title || 'Untitled project'}</button>)}
          </div>
        )}
      </div>
      <ol className="cp-empty-steps" aria-label="The seven steps">
        {STEPS.map((s) => {
          const { tone, icon: Icon } = STEP_META[s.id];
          return <li key={s.id} className={tone}><span className="cp-bubble" aria-hidden="true"><Icon size={20} /></span><span>{s.number}. {s.title}</span></li>;
        })}
      </ol>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
function Title({ title, readOnly, onChange }: { title: string; readOnly: boolean; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const btn = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const closing = useRef(false);
  const shown = title.trim() || 'Untitled project';
  const start = () => { closing.current = false; setDraft(title); setEditing(true); };
  // Enter and Escape hand focus back to the rename button; leaving the field by Tab or click keeps focus where the user put it.
  const finish = (save: boolean, viaKeyboard: boolean) => {
    if (closing.current) return; // the blur that follows Enter or Escape must not run this twice
    closing.current = true;
    if (save && draft.trim() && draft.trim() !== title) onChange(draft.trim());
    refocus.current = viaKeyboard;
    setEditing(false);
  };
  useEffect(() => {
    if (!editing && refocus.current) { refocus.current = false; btn.current?.focus(); }
  }, [editing]);
  if (readOnly) return <h1 className="cp-title">{shown}</h1>;
  return (
    <div className="cp-titlebar">
      <h1 className={editing ? 'sr-only' : 'cp-title'} onClick={start}>{shown}</h1>
      {editing ? (
        <input className="cp-title-input" type="text" aria-label="Project title" autoFocus value={draft} maxLength={200}
          onChange={(e) => setDraft(e.target.value)} onBlur={() => finish(true, false)}
          onKeyDown={(e) => {
            // preventDefault: otherwise the same key press would activate the rename button that takes focus next.
            if (e.key === 'Enter') { e.preventDefault(); finish(true, true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false, true); }
          }} />
      ) : (
        <button ref={btn} type="button" className="btn ghost small cp-rename" aria-label="Rename project" onClick={start}><Pencil size={15} aria-hidden="true" /></button>
      )}
    </div>
  );
}

function Header({ doc, started, onExport, onCheckpoints }: { doc: ProjectDoc; started: StepId[]; onExport: () => void; onCheckpoints: boolean }) {
  const { update, readOnly, base } = usePassport();
  return (
    <header className="cp-head">
      <div className="cp-head-main">
        <p className="cp-eyebrow"><CompassIcon size={14} aria-hidden="true" /> {readOnly ? 'Worked example' : 'Project compass'}</p>
        <Title title={doc.passport.identity.title} readOnly={readOnly} onChange={(v) => update((d) => { d.passport.identity.title = v; })} />
        <p className="cp-progress">
          <span className="cp-pips" aria-hidden="true">{STEPS.map((s) => <i key={s.id} className={`${STEP_META[s.id].tone}${started.includes(s.id) ? ' on' : ''}`} />)}</span>
          <span><strong>{started.length}</strong> of {STEPS.length} steps started</span>
          {doc.passport.identity.stage === 'planning' && <span className="cp-stage-chip">Planning</span>}
        </p>
      </div>
      <div className="cp-head-actions">
        {!readOnly && <button type="button" className="btn primary" onClick={onExport}><Download size={16} aria-hidden="true" /> Export</button>}
        <Link to={`${base}/${CHECKPOINTS_ID}`} className="btn" aria-current={onCheckpoints ? 'page' : undefined}><Milestone size={16} aria-hidden="true" /> Checkpoints</Link>
      </div>
      <ul className="cp-cpchips" aria-label="Checkpoint status">
        {CHECKPOINT_DEFS.map((c) => {
          const status = doc.passport.review[c.id].status;
          return (
            <li key={c.id}>
              <Link to={`${base}/${CHECKPOINTS_ID}?cp=${c.id}`} className={`cp-cpchip ${STATUS_CLASS[status]}`}>
                <i aria-hidden="true" /><strong>{c.label}</strong><span className="sr-only">: </span><span>{REVIEW_LABELS[status]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </header>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────
function stepState(started: boolean, open: number): string {
  if (!started) return 'not started';
  return open === 0 ? 'started, nothing open' : `started, ${open} open ${open === 1 ? 'item' : 'items'}`;
}

function Stepper({ current, started, byStep }: { current: StepId | null; started: StepId[]; byStep: Record<StepId, Warning[]> }) {
  const { base } = usePassport();
  const cur = current ? STEP_BY_ID[current] : null;
  const prev = cur && cur.number > 1 ? STEPS[cur.number - 2] : null;
  const next = cur && cur.number < STEPS.length ? STEPS[cur.number] : null;
  const node = (s: StepDef) => {
    const on = started.includes(s.id), open = openCount(byStep[s.id]);
    return { on, open, cls: `${STEP_META[s.id].tone}${on ? ' is-started' : ''}${current === s.id ? ' is-current' : ''}` };
  };
  return (
    <>
      <nav className="cp-stepper" aria-label="Project steps">
        <ol>
          {STEPS.map((s) => {
            const { on, open, cls } = node(s);
            return (
              <li key={s.id} className={cls}>
                <Link to={`${base}/${s.id}`} aria-current={current === s.id ? 'step' : undefined}>
                  <span className="cp-node">
                    <span aria-hidden="true">{s.number}</span>
                    {on && (open > 0 ? <span className="cp-node-badge" aria-hidden="true">{open}</span> : <span className="cp-node-badge calm" aria-hidden="true"><Check size={11} /></span>)}
                  </span>
                  <span className="cp-step-label"><span className="sr-only">Step {s.number}: </span>{s.title}</span>
                  <span className="sr-only"> ({stepState(on, open)})</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      <nav className={`cp-stepper-compact ${cur ? STEP_META[cur.id].tone : 'tone-primary'}`} aria-label="Project steps (compact)">
        {cur && (
          <div className="cp-compact-row">
            {prev ? <Link to={`${base}/${prev.id}`} className="btn" aria-label={`Previous step: ${prev.title}`}><ChevronLeft size={18} aria-hidden="true" /></Link> : <span className="btn cp-ghost-slot" aria-hidden="true" />}
            <p className="cp-compact-label"><span>Step {cur.number} of {STEPS.length}</span> — <strong>{cur.title}</strong></p>
            {next ? <Link to={`${base}/${next.id}`} className="btn" aria-label={`Next step: ${next.title}`}><ChevronRight size={18} aria-hidden="true" /></Link> : <span className="btn cp-ghost-slot" aria-hidden="true" />}
          </div>
        )}
        <ol className="cp-mini">
          {STEPS.map((s) => {
            const { on, open, cls } = node(s);
            return (
              <li key={s.id} className={cls}>
                <Link to={`${base}/${s.id}`} aria-current={current === s.id ? 'step' : undefined} aria-label={`Step ${s.number}: ${s.title} (${stepState(on, open)})`}>{s.number}</Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

// ── Step screen ───────────────────────────────────────────────────────────
function StepHead({ step, warnings }: { step: StepDef; warnings: Warning[] }) {
  const { icon: Icon } = STEP_META[step.id];
  const jump = () => {
    const el = document.getElementById('open-items');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
  };
  return (
    <div className="cp-stephead">
      <span className="cp-stepicon" aria-hidden="true"><Icon size={26} /></span>
      <div>
        <p className="cp-stepno">Step {step.number} of {STEPS.length}</p>
        <h2 tabIndex={-1} id="cp-step-h">{step.title}</h2>
        <p className="cp-short">{step.short}</p>
      </div>
      {warnings.length > 0 && (
        <button type="button" className="cp-jump" onClick={jump} aria-label={`Show open items: ${SEVERITY_ORDER.map((sev) => `${warnings.filter((w) => w.severity === sev).length} ${SEVERITY[sev].label}`).join(', ')}`}>
          {SEVERITY_ORDER.map((sev) => {
            const n = warnings.filter((w) => w.severity === sev).length;
            if (n === 0) return null;
            const { icon: SevIcon, cls, label } = SEVERITY[sev];
            return <span key={sev} className={cls}><SevIcon size={13} aria-hidden="true" /><b>{n}</b> {label}</span>;
          })}
        </button>
      )}
    </div>
  );
}

function FootNav({ step }: { step: StepDef }) {
  const { base } = usePassport();
  const prev = step.number > 1 ? STEPS[step.number - 2] : null;
  const next = step.number < STEPS.length ? STEPS[step.number] : null;
  return (
    <nav className="cp-foot" aria-label="Previous and next step">
      {prev
        ? <Link to={`${base}/${prev.id}`} className={`cp-foot-link prev ${STEP_META[prev.id].tone}`}><ChevronLeft size={20} aria-hidden="true" /><span><small>Previous</small>{prev.title}</span></Link>
        : <span />}
      {next
        ? <Link to={`${base}/${next.id}`} className={`cp-foot-link next ${STEP_META[next.id].tone}`}><span><small>Next</small>{next.title}</span><ChevronRight size={20} aria-hidden="true" /></Link>
        : <Link to={`${base}/${CHECKPOINTS_ID}`} className="cp-foot-link next tone-primary"><span><small>Next</small>Checkpoints</span><ChevronRight size={20} aria-hidden="true" /></Link>}
    </nav>
  );
}

function CompassView({ doc, exampleDoc, step, readOnly }: { doc: ProjectDoc; exampleDoc: ProjectDoc; step?: string; readOnly: boolean }) {
  const { update, addProject, toast } = useStore();
  const { path, navigate } = useRouter();
  const base = readOnly ? '/example' : '/project';
  const noop = useCallback(() => {}, []);
  const ctx = useMemo<PassportValue>(() => ({ doc, update: readOnly ? noop : update, readOnly, base }), [doc, update, readOnly, base, noop]);

  const onCheckpoints = step === CHECKPOINTS_ID;
  const stepId: StepId = step && isStepId(step) ? step : (!readOnly && lastStep(doc.id)) || 'frame';
  const def = STEP_BY_ID[stepId];
  const warnings = useMemo(() => compassWarnings(doc), [doc]);
  const byStep = useMemo(() => Object.fromEntries(STEPS.map((s) => [s.id, warnings.filter((w) => w.step === s.id)])) as Record<StepId, Warning[]>, [warnings]);
  const started = stepsStarted(doc.passport);

  useEffect(() => { if (!readOnly && step && isStepId(step)) rememberStep(doc.id, step); }, [readOnly, step, doc.id]);
  // Tools opened from a step offer the way back to it.
  useEffect(() => { if (!onCheckpoints) rememberOrigin(`${base}/${stepId}`, `step ${def.number}`); }, [base, stepId, def.number, onCheckpoints]);

  // Move focus to the step heading after navigating between steps (not on first load).
  const screen = onCheckpoints ? CHECKPOINTS_ID : stepId;
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    document.getElementById('cp-step-h')?.focus({ preventScroll: true });
  }, [screen]);

  // `?export=1` opens the export dialog; closing it removes the flag so the link works again.
  const wantsExport = !readOnly && /[?&]export=1\b/.test(path);
  const [exportOpen, setExportOpen] = useState(wantsExport);
  useEffect(() => { if (wantsExport) setExportOpen(true); }, [wantsExport]);
  const closeExport = () => { setExportOpen(false); if (wantsExport) navigate(path.split('?')[0], { replace: true }); };

  const copyExample = async () => {
    const t = new Date().toISOString();
    const copy: ProjectDoc = { ...structuredClone(doc), id: newId('prj'), createdAt: t, updatedAt: t, projectRevision: 1, origin: { kind: 'copy', ref: doc.id } };
    copy.passport.identity.title = `${doc.passport.identity.title.replace(/\s*\(worked example\)\s*$/i, '')} (practice)`;
    // The review is the copier's own to do: checkpoints start again as drafts.
    for (const k of Object.keys(copy.passport.review) as (keyof typeof copy.passport.review)[]) copy.passport.review[k] = { status: 'draft', notes: '', reviewer: '', feedbackSource: '', rubric: {}, due: '' };
    await addProject(copy, true);
    toast('Practice copy created. It is yours to edit.', 'success');
    navigate('/project');
  };

  return (
    <PassportContext.Provider value={ctx}>
      <div className="page wide cp-root">
        {readOnly && (
          <div className="cp-banner" role="note">
            <span className="cp-banner-icon" aria-hidden="true"><Lock size={18} /></span>
            <p><strong>Worked example · read only</strong><span>A complete project to learn from.</span></p>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={() => { void copyExample(); }}><Copy size={16} aria-hidden="true" /> Copy as my practice project</button>
              <Link to="/project" className="btn"><ArrowLeft size={16} aria-hidden="true" /> Back to my project</Link>
            </div>
          </div>
        )}
        <Header doc={doc} started={started} onExport={() => setExportOpen(true)} onCheckpoints={onCheckpoints} />
        <Stepper current={onCheckpoints ? null : stepId} started={started} byStep={byStep} />
        {onCheckpoints ? <Checkpoints /> : (
          <div className={`cp-step ${STEP_META[stepId].tone}`} key={stepId}>
            <StepHead step={def} warnings={byStep[stepId]} />
            <QuickGuide step={def} />
            <div className="cp-layout">
              <div className="cp-main"><StepMain step={stepId} onExport={() => setExportOpen(true)} /></div>
              <CompassPanel step={def} warnings={byStep[stepId]} example={exampleDoc} />
            </div>
            <FootNav step={def} />
          </div>
        )}
        {exportOpen && !readOnly && <Suspense fallback={null}><ExportDialog doc={doc} onClose={closeExport} onDownloaded={() => update((d) => { d.start.firstSessionDone.saved = true; })} /></Suspense>}
      </div>
    </PassportContext.Provider>
  );
}
