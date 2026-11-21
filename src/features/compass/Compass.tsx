import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Compass as CompassIcon, Copy, Download, FolderGit2, FolderOpen, GraduationCap, Lock, Milestone, Pencil, Plus } from 'lucide-react';
import { useArtefacts } from '../../app/artefacts';
import { useStore } from '../../app/store';
import { Link, useRouter } from '../../app/router';
import {
  CHECKPOINT_DEFS, STEPS, STEP_BY_ID, compassWarnings, effectiveProfile, isStepId, stepFor, stepsStarted, type StepDef, type StepId, type StepProfile, type Warning,
} from '../../domain/passport/compass';
import { REVIEW_LABELS, shortAddress, webAddress, type ProjectDoc } from '../../domain/passport/schema';
import { EXAMPLE_TITLE, workedExample, workedExampleCopy } from '../../content/workedExample';
import { originalsFor } from '../../content/templates/build';
import { PassportContext, overviewOf, usePassport, type PassportValue } from '../project/passportContext';
import { Checkpoints } from './Checkpoints';
import { CompassPanel, QuickGuide } from './CompassPanel';
import { StepMain, StillPlanning } from './StepMain';
import { Overview } from './Overview';
import { CHECKPOINTS_ID, SEVERITY, SEVERITY_ORDER, STATUS_CLASS, STEP_META, openCount } from './stepMeta';
import '../../styles/compass.css';
import NotFound from '../help/NotFound';
import { rememberOrigin } from '../../app/cameFrom';

// The export dialog brings the report writers with it; it is loaded when first opened.
const ExportDialog = lazy(() => import('../project/ExportDialog').then((m) => ({ default: m.ExportDialog })));

/** The Learn page that belongs to each step (LEARN-TOOLBOX-PLAN.md §2). */
const LEARN: Record<StepId, { to: string; title: string }> = {
  frame: { to: '/learn/process', title: 'The simulation process' },
  scope: { to: '/learn/ideas', title: 'Parts of a conceptual model' },
  method: { to: '/learn/methods', title: 'Methods at a glance' },
  inputs: { to: '/learn/ideas', title: 'Describing uncertainty' },
  evaluation: { to: '/learn/ideas', title: 'Verification, validation, calibration' },
  experiment: { to: '/learn/ideas', title: 'A fair comparison' },
  conclude: { to: '/learn/process', title: 'Closing the loop' },
};

type Screen = 'overview' | 'step' | 'checkpoints';
/** `/project/overview`: the open project's overview (`/project` is the Project page). */
const OVERVIEW_ID = 'overview';

// The worked example is built once: it is read only and never mutated (copies are deep clones).
let exampleCache: ProjectDoc | null = null;
const getExample = () => (exampleCache ??= workedExample());

/** The project compass: an overview of the seven steps, each step with guidance beside it, and the checkpoints. */
export default function Compass({ step, example }: { step?: string; example?: boolean }) {
  const { active } = useStore();
  const exampleDoc = getExample();
  const doc = example ? exampleDoc : active;
  // Only the seven steps and the checkpoints page exist under a project address.
  if (step && !isStepId(step) && step !== CHECKPOINTS_ID && step !== OVERVIEW_ID) return <NotFound />;
  if (!doc) return <EmptyCompass />;
  return <CompassView key={`${example ? 'example' : 'project'}-${doc.id}`} doc={doc} exampleDoc={exampleDoc} step={step} readOnly={!!example} />;
}

// ── Empty state ───────────────────────────────────────────────────────────
/** The overview or a step with no project open: the way to the Project page, or a blank start right here. */
function EmptyCompass() {
  const { createAndActivate } = useStore();
  return (
    <div className="page cp-root cp-empty">
      <div className="cp-empty-hero">
        <svg className="cp-bigdial" viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
          <circle cx="60" cy="60" r="52" className="ring" />
          <path d="M60 12v9M60 99v9M12 60h9M99 60h9" className="ticks" />
          <g className="needle"><path d="M60 22l11 38H49z" className="north" /><path d="M60 98l11-38H49z" className="south" /></g>
          <circle cx="60" cy="60" r="5" className="pin" />
        </svg>
        <h1>No project open</h1>
        <p className="lede">Open one of yours, start from a template, or begin with a blank project.</p>
        <div className="btn-row">
          <Link to="/project" className="btn primary cp-big"><FolderOpen size={18} aria-hidden="true" /> Projects and templates</Link>
          <button type="button" className="btn cp-big" onClick={() => createAndActivate({ title: 'My modelling project' })}><Plus size={18} aria-hidden="true" /> Start a blank project</button>
        </div>
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

function Header({ doc, started, onExport, screen }: { doc: ProjectDoc; started: StepId[]; onExport: () => void; screen: Screen }) {
  const { update, readOnly, base } = usePassport();
  const repo = webAddress(doc.passport.identity.repository);
  return (
    <header className="cp-head">
      <div className="cp-head-main">
        <p className="cp-eyebrow"><CompassIcon size={14} aria-hidden="true" /> {readOnly ? 'Worked example' : 'Project compass'}</p>
        <Title title={doc.passport.identity.title} readOnly={readOnly} onChange={(v) => update((d) => { d.passport.identity.title = v; })} />
        <p className="cp-progress">
          <span className="cp-pips" aria-hidden="true">{STEPS.map((s) => <i key={s.id} className={`${STEP_META[s.id].tone}${started.includes(s.id) ? ' on' : ''}`} />)}</span>
          <span><strong>{started.length}</strong> of {STEPS.length} steps started</span>
          {doc.passport.identity.stage === 'planning' && <span className="cp-stage-chip">Planning</span>}
          {repo && (
            <a className="cp-repo" href={repo} target="_blank" rel="noopener noreferrer" title={repo}>
              <FolderGit2 size={13} aria-hidden="true" /> {shortAddress(repo, 40)}<span className="sr-only"> (repository with the data and code, opens in a new tab)</span>
            </a>
          )}
        </p>
      </div>
      <div className="cp-head-actions">
        <Link to={overviewOf(base)} className="btn" aria-current={screen === 'overview' ? 'page' : undefined}><CompassIcon size={16} aria-hidden="true" /> Overview</Link>
        <Link to={`${base}/${CHECKPOINTS_ID}`} className="btn" aria-current={screen === 'checkpoints' ? 'page' : undefined}><Milestone size={16} aria-hidden="true" /> Checkpoints</Link>
        {!readOnly && <button type="button" className="btn primary" onClick={onExport}><Download size={16} aria-hidden="true" /> Export</button>}
      </div>
      {screen !== 'overview' && <ul className="cp-cpchips" aria-label="Checkpoint status">
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
      </ul>}
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
/** The Learn page of a step. A statistical model's measured data and analysis plan are explained with its method card. */
function learnFor(id: StepId, profile: StepProfile): { to: string; title: string } {
  if ((id === 'inputs' && profile.inputs === 'measurement') || (id === 'experiment' && profile.experiment === 'analysis-plan')) return LEARN.method;
  return LEARN[id];
}

function StepHead({ step, warnings, profile }: { step: StepDef; warnings: Warning[]; profile: StepProfile }) {
  const learn = learnFor(step.id, profile);
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
        <Link to={learn.to} className="cp-learn"><GraduationCap size={14} aria-hidden="true" /> Learn: {learn.title}</Link>
      </div>
      {warnings.length > 0 && (
        <button type="button" className="cp-jump" onClick={jump}>
          <span className="sr-only">Show open items: </span>
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
        : <Link to={overviewOf(base)} className="cp-foot-link prev tone-primary"><ChevronLeft size={20} aria-hidden="true" /><span><small>Back to</small>Overview</span></Link>}
      {next
        ? <Link to={`${base}/${next.id}`} className={`cp-foot-link next ${STEP_META[next.id].tone}`}><span><small>Next</small>{next.title}</span><ChevronRight size={20} aria-hidden="true" /></Link>
        : <Link to={`${base}/${CHECKPOINTS_ID}`} className="cp-foot-link next tone-primary"><span><small>Next</small>Checkpoints</span><ChevronRight size={20} aria-hidden="true" /></Link>}
    </nav>
  );
}

function CompassView({ doc, exampleDoc, step, readOnly }: { doc: ProjectDoc; exampleDoc: ProjectDoc; step?: string; readOnly: boolean }) {
  const { update, addProject, toast, active } = useStore();
  const { path, navigate } = useRouter();
  const base = readOnly ? '/example' : '/project';
  const noop = useCallback(() => {}, []);
  const ctx = useMemo<PassportValue>(() => ({ doc, update: readOnly ? noop : update, readOnly, base }), [doc, update, readOnly, base, noop]);

  const screen: Screen = !step || step === OVERVIEW_ID ? 'overview' : step === CHECKPOINTS_ID ? 'checkpoints' : 'step';
  const stepId: StepId = step && isStepId(step) ? step : 'frame';
  // The step's texts as the project's method reads them (statistical, analytic or simulation; general with no method).
  const profile = effectiveProfile(doc);
  const def = stepFor(stepId, profile);
  // Copies are compared with their Toolbox originals on this device; the worked example's originals are on no device.
  const { list, put } = useArtefacts();
  const toolbox = useMemo(() => (readOnly ? undefined : new Map(list.map((a) => [a.id, a.revision]))), [list, readOnly]);
  const warnings = useMemo(() => compassWarnings(doc, toolbox), [doc, toolbox]);
  const byStep = useMemo(() => Object.fromEntries(STEPS.map((s) => [s.id, warnings.filter((w) => w.step === s.id)])) as Record<StepId, Warning[]>, [warnings]);
  const started = stepsStarted(doc.passport, doc.artefacts ?? []);

  // Tools opened from a step offer the way back to it.
  useEffect(() => { if (screen === 'step') rememberOrigin(`${base}/${stepId}`, `step ${def.number}`); else if (screen === 'overview') rememberOrigin(overviewOf(base), 'the overview'); }, [base, stepId, def.number, screen]);

  // Move focus to the heading after moving between screens (not on first load).
  const at = screen === 'step' ? stepId : screen;
  const shown = useRef(at);
  useEffect(() => {
    if (shown.current === at) return;
    shown.current = at;
    document.getElementById('cp-step-h')?.focus({ preventScroll: true });
  }, [at]);

  // `?export=1` opens the export dialog; closing it removes the flag so the link works again.
  const wantsExport = !readOnly && /[?&]export=1\b/.test(path);
  const [exportOpen, setExportOpen] = useState(wantsExport);
  useEffect(() => { if (wantsExport) setExportOpen(true); }, [wantsExport]);
  const closeExport = () => { setExportOpen(false); if (wantsExport) navigate(path.split('?')[0], { replace: true }); };

  const copyExample = async () => {
    const copy = workedExampleCopy({ title: `${EXAMPLE_TITLE} (practice)` });
    for (const a of originalsFor(copy, new Date().toISOString())) { try { await put(a); } catch { /* Edit makes the original again */ } }
    await addProject(copy, true);
    toast('Practice copy created. It is yours to edit.', 'success');
    navigate(overviewOf('/project'));
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
              {active
                ? <Link to={overviewOf('/project')} className="btn"><ArrowLeft size={16} aria-hidden="true" /> Back to my project</Link>
                : <Link to="/project" className="btn"><ArrowLeft size={16} aria-hidden="true" /> Projects</Link>}
            </div>
          </div>
        )}
        <Header doc={doc} started={started} onExport={() => setExportOpen(true)} screen={screen} />
        {screen !== 'overview' && <Stepper current={screen === 'step' ? stepId : null} started={started} byStep={byStep} />}
        {screen === 'overview' ? <Overview byStep={byStep} started={started} onExport={() => setExportOpen(true)} /> : screen === 'checkpoints' ? <Checkpoints /> : (
          <div className={`cp-step ${STEP_META[stepId].tone}`} key={stepId}>
            <StepHead step={def} warnings={byStep[stepId]} profile={profile} />
            <QuickGuide step={def} />
            <div className="cp-layout">
              <div className="cp-main"><StillPlanning step={stepId} /><StepMain step={stepId} onExport={() => setExportOpen(true)} /></div>
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
