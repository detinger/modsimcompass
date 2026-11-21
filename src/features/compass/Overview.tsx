import { ArrowRight, Check, Download, Flag, Milestone, Plus } from 'lucide-react';
import { Link } from '../../app/router';
import { KIND_ORDER, KINDS, kindDef } from '../../domain/artefacts/kinds';
import type { ArtefactKind } from '../../domain/artefacts/types';
import { CHECKPOINT_DEFS, STEPS, STEP_BY_ID, effectiveProfile, type StepDef, type StepId, type StepProfile, type Warning } from '../../domain/passport/compass';
import { REVIEW_LABELS, type CheckpointId, type Inclusion, type ReviewStatus } from '../../domain/passport/schema';
import CompassView from '../../ui/diagrams/CompassView';
import type { JourneyFlag, JourneyProject } from '../../ui/diagrams/compassShared';
import { SvgFigure } from '../toolbox/SvgFigure';
import { TOOL_META } from '../toolbox/toolMeta';
import { usePassport } from '../project/passportContext';
import { CHECKPOINTS_ID, SEVERITY, SEVERITY_ORDER, STATUS_CLASS, STEP_META, openCount } from './stepMeta';
import '../../styles/diagrams.css';

/** The kinds of artefact each step holds, in the order of `KIND_ORDER`. */
const KINDS_OF: Record<StepId, ArtefactKind[]> = Object.fromEntries(STEPS.map((s) => [s.id, KIND_ORDER.filter((k) => KINDS[k].step === s.id)])) as Record<StepId, ArtefactKind[]>;
/**
 * The kinds a tile offers for a step: those the method uses (measurement data or data models in step 4, a comparison
 * in step 6 only for a policy experiment), plus any kind the project already includes there.
 */
function kindsFor(step: StepId, profile: StepProfile, included: ReadonlySet<ArtefactKind>): ArtefactKind[] {
  const wanted = (k: ArtefactKind) => {
    if (included.has(k)) return true;
    if (k === 'measurement-data') return profile.inputs === 'measurement';
    if (k === 'data-model') return profile.inputs !== 'measurement';
    if (k === 'comparison') return profile.experiment === 'policy-experiment';
    return true;
  };
  return KINDS_OF[step].filter(wanted);
}
/** The checkpoint that follows each step, when one does. */
const FLAG_AFTER: Partial<Record<StepId, CheckpointId>> = Object.fromEntries(CHECKPOINT_DEFS.map((c) => [c.steps[c.steps.length - 1], c.id]));
const FLAG_STATUS: Record<ReviewStatus, JourneyFlag> = { draft: 'draft', 'self-reviewed': 'done', 'teacher-reviewed': 'done', 'needs-revision': 'revise' };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The step to look at next: the first that is not started or still has open items; 8 when every step is clear. */
function nextStop(started: StepId[], byStep: Record<StepId, Warning[]>): number {
  const s = STEPS.find((x) => !started.includes(x.id) || openCount(byStep[x.id]) > 0);
  return s ? s.number : STEPS.length + 1;
}

/** Up to three small kind icons for the copies at a stop. */
function Marks({ copies }: { copies: Inclusion[] }) {
  if (copies.length === 0) return null;
  return (
    <>
      {copies.slice(0, 3).map((c) => { const { icon: Icon, tone } = TOOL_META[c.kind]; return <span key={c.id} className={`dgm-j-mark ${tone}`}><Icon size={12} /></span>; })}
      {copies.length > 3 && <span className="dgm-j-mark is-more">+{copies.length - 3}</span>}
    </>
  );
}

/** One included copy in a tile: its picture when the kind draws one, otherwise its icon; and its name. */
function MiniCopy({ inc }: { inc: Inclusion }) {
  const { icon: Icon, tone } = TOOL_META[inc.kind];
  let svg: string | null = null;
  try { svg = kindDef(inc.kind).figure(inc.data); } catch { svg = null; }
  return (
    <div className={`cp-ov-copy ${tone}`}>
      {svg ? <SvgFigure svg={svg} className="cp-ov-thumb" /> : <span className="cp-ov-copy-icon" aria-hidden="true"><Icon size={18} /></span>}
      <span className="cp-ov-copy-name">{inc.title.trim() || 'Untitled'}</span>
    </div>
  );
}

function StopTile({ step, started, warnings, here }: { step: StepDef; started: boolean; warnings: Warning[]; here: boolean }) {
  const { doc, base } = usePassport();
  const { tone, icon: Icon } = STEP_META[step.id];
  const p = doc.passport;
  const open = openCount(warnings);
  const kinds = kindsFor(step.id, effectiveProfile(doc), new Set((doc.artefacts ?? []).map((i) => i.kind)));
  const copies = (doc.artefacts ?? []).filter((i) => kinds.includes(i.kind));
  const cp = FLAG_AFTER[step.id];
  const quote = step.id === 'frame' ? p.decision.question : step.id === 'conclude' ? p.conclusion.recommendation : '';
  return (
    <li className={`cp-ov-stop ${tone}${started ? ' is-started' : ''}${here ? ' is-here' : ''}`}>
      <div className="cp-ov-head">
        <span className="cp-ov-icon" aria-hidden="true"><Icon size={20} /><b>{step.number}</b></span>
        <h3><Link to={`${base}/${step.id}`} className="cp-ov-link">{step.title}</Link></h3>
        {started
          ? <span className={`cp-ov-state${open ? ' has-open' : ''}`}>{open ? plural(open, 'open item') : <><Check size={13} aria-hidden="true" /> Clear</>}</span>
          : <span className="cp-ov-state is-new">Not started</span>}
      </div>
      {kinds.length > 0 && (
        <div className="cp-ov-copies">
          {copies.slice(0, 3).map((c) => <MiniCopy key={c.id} inc={c} />)}
          {copies.length > 3 && <p className="cp-ov-more">and {copies.length - 3} more</p>}
          {copies.length === 0 && kinds.map((k) => <p key={k} className={`cp-ov-empty ${TOOL_META[k].tone}`}><Plus size={14} aria-hidden="true" /> {KINDS[k].label}</p>)}
        </div>
      )}
      {(step.id === 'frame' || step.id === 'conclude') && (
        <p className={`cp-ov-quote${quote.trim() ? '' : ' is-empty'}`}>
          <span>{quote.trim() || (step.id === 'conclude' && p.identity.stage === 'planning' ? 'Due after the runs.' : step.id === 'frame' ? 'No question yet.' : 'No recommendation yet.')}</span>
        </p>
      )}
      {warnings.length > 0 && (
        <p className="cp-ov-sev">
          {SEVERITY_ORDER.map((sev) => {
            const n = warnings.filter((w) => w.severity === sev).length;
            if (!n) return null;
            const { icon: SevIcon, cls, label } = SEVERITY[sev];
            return <span key={sev} className={cls}><SevIcon size={12} aria-hidden="true" />{n}<span className="sr-only"> {label}</span></span>;
          })}
        </p>
      )}
      {cp && (
        <Link to={`${base}/${CHECKPOINTS_ID}?cp=${cp}`} className={`cp-ov-flag ${STATUS_CLASS[p.review[cp].status]}`}>
          <Flag size={13} aria-hidden="true" />{CHECKPOINT_DEFS.find((c) => c.id === cp)!.label}<span className="cp-ov-flag-st">{REVIEW_LABELS[p.review[cp].status]}</span>
        </Link>
      )}
    </li>
  );
}

/** `/project` and `/example`: the project on the compass. The road shows where it stands; the tiles show each step. */
export function Overview({ byStep, started, onExport }: { byStep: Record<StepId, Warning[]>; started: StepId[]; onExport: () => void }) {
  const { doc, readOnly, base } = usePassport();
  const here = nextStop(started, byStep);
  const copiesAt = (id: StepId) => (doc.artefacts ?? []).filter((i) => KINDS[i.kind]?.step === id);
  const journey: JourneyProject = {
    here,
    href: (n) => `${base}/${STEPS[n - 1].id}`,
    stops: STEPS.map((s) => {
      const copies = copiesAt(s.id);
      return { started: started.includes(s.id), open: openCount(byStep[s.id]), marks: <Marks copies={copies} />, describe: copies.length ? plural(copies.length, 'artefact') : undefined };
    }),
    flags: Object.fromEntries(CHECKPOINT_DEFS.map((c) => {
      const status = doc.passport.review[c.id].status;
      return [STEP_BY_ID[c.steps[c.steps.length - 1]].number, { status: FLAG_STATUS[status], label: REVIEW_LABELS[status].toLowerCase() }];
    })),
  };
  const next = here <= STEPS.length ? STEPS[here - 1] : null;
  const total = (doc.artefacts ?? []).length;
  const openAll = STEPS.reduce((n, s) => n + openCount(byStep[s.id]), 0);
  return (
    <div className="cp-ov">
      <section className="figure-card diagram-card cp-journey" aria-labelledby="cp-step-h">
        <div className="cp-ov-maphead">
          <div>
            <h2 id="cp-step-h" tabIndex={-1}>Your route</h2>
            <p>{next ? <>Next stop: <strong>{next.number}. {next.title}</strong></> : 'Every step is under way. Time for the checkpoints.'}</p>
          </div>
          <Link to={next ? `${base}/${next.id}` : `${base}/${CHECKPOINTS_ID}`} className="btn primary">
            {next ? `Go to step ${next.number}` : 'Checkpoints'} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="dgm-stage"><CompassView project={journey} /></div>
      </section>

      <h2 className="cp-ov-h">Seven steps</h2>
      <ol className="cp-ov-grid">
        {STEPS.map((s) => <StopTile key={s.id} step={s} started={started.includes(s.id)} warnings={byStep[s.id]} here={here === s.number} />)}
        <li className="cp-ov-stop cp-ov-finish tone-green">
          <div className="cp-ov-head">
            <span className="cp-ov-icon" aria-hidden="true"><Milestone size={20} /></span>
            <h3>{readOnly ? 'Report' : 'Share it'}</h3>
          </div>
          <p className="cp-ov-facts">{plural(started.length, 'step')} started · {plural(total, 'artefact')} · {plural(openAll, 'open item')}</p>
          <div className="btn-row">
            {!readOnly && <button type="button" className="btn primary small" onClick={onExport}><Download size={15} aria-hidden="true" /> Export</button>}
            <Link to={`${base}/${CHECKPOINTS_ID}`} className="btn small"><Milestone size={15} aria-hidden="true" /> Checkpoints</Link>
          </div>
        </li>
      </ol>
    </div>
  );
}
