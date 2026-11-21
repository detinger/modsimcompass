import { useState, type ReactNode } from 'react';
import { ArrowRight, CircleCheck, FolderOpen, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useAddToProject, useArtefacts } from '../../app/artefacts';
import { Link, useRouter } from '../../app/router';
import { useStore } from '../../app/store';
import { createArtefact } from '../../domain/artefacts/file';
import { inclusionState, removeInclusion, undoChange, undoRecord, type UndoRecord } from '../../domain/artefacts/include';
import { KINDS, kindDef } from '../../domain/artefacts/kinds';
import type { Artefact, ArtefactKind } from '../../domain/artefacts/types';
import type { Inclusion } from '../../domain/passport/schema';
import { Dialog } from '../../ui/controls';
import { ArtefactCard, shortDate } from '../toolbox/ArtefactCard';
import { TOOL_META } from '../toolbox/toolMeta';
import { usePassport } from './passportContext';

/**
 * Artefacts in a project step (docs/TOOLBOX-SPEC.md §7): the copy the project keeps, shown as a card with its state,
 * or an invitation to make one in the Toolbox or to choose one from My artefacts.
 */

export type CopyState = 'current' | 'outdated' | 'source-missing';

/** Whether each copy still matches its Toolbox original on this device. */
export function useCopyState(): (inc: Inclusion) => CopyState {
  const { get } = useArtefacts();
  return (inc) => {
    const source = get(inc.sourceId);
    return inclusionState(inc, source && source.kind === inc.kind ? source : undefined);
  };
}

/** A kind's own text and picture, without letting a faulty kind break the step. */
function cardParts(inc: Inclusion): { summary: string[]; figure: string | null } {
  const def = kindDef(inc.kind);
  let summary: string[] = [], figure: string | null = null;
  try { summary = def.summary(inc.data); } catch { summary = []; }
  try { figure = def.figure(inc.data); } catch { figure = null; }
  return { summary, figure };
}

/** A project is live: a copy follows its original on this device, so the only other state is an original that is not here. */
const STATE_BADGE: Record<CopyState, { text: string; cls: string }> = {
  current: { text: 'Live', cls: 'badge success' },
  outdated: { text: 'Live', cls: 'badge success' },
  'source-missing': { text: 'Original not on this device', cls: 'badge' },
};

/** The tool on this copy's original, with a way back to the step it was opened from. */
export const editPath = (inc: Inclusion, artefactId = inc.sourceId) => `${KINDS[inc.kind].toolPath}/${artefactId}?from=${KINDS[inc.kind].step}`;

/** One included copy: summary, picture, when it last changed and its state, with Edit and Remove. */
export function IncludedCard({ inc, headingLevel = 3 }: { inc: Inclusion; headingLevel?: 2 | 3 | 4 }) {
  const { update, readOnly } = usePassport();
  const { put } = useArtefacts();
  const { toast } = useStore();
  const { navigate } = useRouter();
  const stateOf = useCopyState();
  const state = stateOf(inc);
  const name = inc.title.trim() || 'Untitled';
  const { summary, figure } = cardParts(inc);

  const remove = () => {
    // Undo puts back only what Remove took: the copy, the rows it owned and the lines it took back (a check plan's).
    // Edits made after the remove stay.
    let record: UndoRecord | null = null;
    update((d) => { const before = structuredClone(d); if (removeInclusion(d, inc.id)) record = undoRecord(before, d, [inc.id]); });
    toast(`Removed “${name}” from the project.`, 'info', { label: 'Undo', run: () => { const rec = record; if (rec) update((d) => { undoChange(d, rec); }); } });
  };
  /** The original is not on this device (an older project, an import, a practice copy): make it an artefact again, link the copy to it, then open it. From then on it is live. */
  const reopen = async () => {
    const t = new Date().toISOString();
    const made = { ...createArtefact(inc.kind, { title: name, now: t }), data: structuredClone(inc.data), revision: 1 } as Artefact;
    try { await put(made); } catch { toast('The artefact could not be saved on this device.', 'error'); return; }
    update((d) => { const c = (d.artefacts ?? []).find((x) => x.id === inc.id); if (c) { c.sourceId = made.id; c.sourceRevision = made.revision; } });
    navigate(editPath(inc, made.id));
  };

  const actions = readOnly ? undefined : (
    <>
      {state === 'source-missing'
        ? <button type="button" className="btn small primary" onClick={() => { void reopen(); }}><SquarePen size={14} aria-hidden="true" /> Edit<span className="sr-only">: {name}</span></button>
        : <Link className="btn small primary" to={editPath(inc)}><SquarePen size={14} aria-hidden="true" /> Edit<span className="sr-only">: {name}</span></Link>}
      <span className="ac-icons">
        <button type="button" className="icon-btn danger" data-tip="Remove from project" aria-label={`Remove ${name} from the project`} onClick={remove}><Trash2 size={16} aria-hidden="true" /></button>
      </span>
    </>
  );
  return (
    <ArtefactCard kind={inc.kind} title={inc.title} updatedAt={inc.addedAt} dateLabel="Updated" summary={summary} figure={figure} headingLevel={headingLevel}
      to={!readOnly && state !== 'source-missing' ? editPath(inc) : undefined}
      status={readOnly ? undefined : <span className={STATE_BADGE[state].cls}>{STATE_BADGE[state].text}</span>}
      actions={actions} />
  );
}

/** A small picture of what the artefact looks like, for the empty slot. Decorative. */
export function KindPicture({ kind }: { kind: ArtefactKind }) {
  const art: Record<ArtefactKind, ReactNode> = {
    'concept-model': <>
      <rect className="kp-frame" x="6" y="6" width="108" height="60" rx="10" />
      <rect className="kp-soft" x="14" y="26" width="26" height="20" rx="6" /><rect className="kp-soft" x="48" y="16" width="26" height="20" rx="6" /><rect className="kp-soft" x="48" y="40" width="26" height="18" rx="6" /><rect className="kp-strong" x="82" y="28" width="26" height="18" rx="6" />
      <path className="kp-line" d="M40 34 L48 27 M40 38 L48 48 M74 26 L82 34 M74 49 L82 40" />
    </>,
    'method-choice': <>
      <circle className="kp-soft" cx="22" cy="36" r="12" /><rect className="kp-soft" x="40" y="24" width="24" height="24" rx="4" /><path className="kp-strong" d="M84 22 L98 48 L70 48 Z" /><path className="kp-soft" d="M108 24 L118 36 L108 48 L98 36 Z" transform="translate(-6 0)" />
      <path className="kp-line" d="M76 58 L84 64 L98 52" />
    </>,
    'data-model': <>
      <path className="kp-axis" d="M10 62 H112" />
      {[16, 30, 44, 58, 72, 86].map((x, i) => <rect key={x} className={i === 2 || i === 3 ? 'kp-strong' : 'kp-soft'} x={x} y={62 - [12, 26, 40, 36, 22, 10][i]} width="12" height={[12, 26, 40, 36, 22, 10][i]} rx="2" />)}
      <path className="kp-line" d="M12 58 C30 50 40 12 56 14 S88 52 108 58" />
    </>,
    'measurement-data': <>
      <ellipse className="kp-strong" cx="60" cy="18" rx="22" ry="11" />
      {[22, 48, 74, 100].map((x) => <g key={x}><path className="kp-line" d={`M60 29 L${x} 50`} /><rect className="kp-soft" x={x - 9} y="50" width="18" height="14" rx="3" /></g>)}
    </>,
    'check-plan': <>
      {[14, 32, 50].map((y, i) => <g key={y}><rect className={i < 2 ? 'kp-strong' : 'kp-soft'} x="14" y={y - 6} width="12" height="12" rx="3" /><rect className="kp-soft" x="34" y={y - 4} width={[70, 56, 64][i]} height="8" rx="4" /></g>)}
      <path className="kp-tick" d="M16.5 14 L19.5 17 L24 11 M16.5 32 L19.5 35 L24 29" />
    </>,
    'comparison': <>
      <path className="kp-axis" d="M60 8 V64" />
      {[[30, 18], [36, 30], [26, 42], [34, 54], [84, 22], [92, 34], [80, 44], [88, 56]].map(([x, y], i) => <circle key={i} className={x > 60 ? 'kp-strong' : 'kp-soft'} cx={x} cy={y} r="5" />)}
      <path className="kp-line" d="M36 30 L92 34" />
    </>,
  };
  return <svg className="kp" viewBox="0 0 120 72" width="120" height="72" aria-hidden="true">{art[kind]}</svg>;
}

/** The empty slot: what the artefact is, and two ways to bring one in. `title` and `line` replace the general words. */
function Invitation({ kind, another, title, line }: { kind: ArtefactKind; another?: boolean; title?: string; line?: string }) {
  const { readOnly } = usePassport();
  const [choosing, setChoosing] = useState(false);
  const meta = TOOL_META[kind], def = KINDS[kind];
  if (readOnly) return another ? null : <p className="cp-empty-row">No {def.label.toLowerCase()} included.</p>;
  return (
    <div className={`cp-invite ${meta.tone}${another ? ' is-another' : ''}`}>
      {!another && <KindPicture kind={kind} />}
      <div className="cp-invite-text">
        <p className="cp-invite-title">{another ? `Add another ${def.label.toLowerCase()}` : title ?? `No ${def.label.toLowerCase()} yet`}</p>
        {!another && <p className="cp-invite-line">{line ?? meta.tagline}</p>}
        <div className="btn-row">
          <Link className={`btn${another ? ' small' : ' primary'}`} to={def.toolPath}><Plus size={15} aria-hidden="true" /> Make one<span className="sr-only"> with the {meta.name} tool</span></Link>
          <button type="button" className={`btn${another ? ' small' : ''}`} onClick={() => setChoosing(true)}><FolderOpen size={15} aria-hidden="true" /> Choose from My artefacts</button>
        </div>
      </div>
      {choosing && <ChooseDialog kind={kind} onClose={() => setChoosing(false)} />}
    </div>
  );
}

/** “Choose from My artefacts”: the artefacts of this kind on the device, each one click away from the project. */
export function ChooseDialog({ kind, onClose }: { kind: ArtefactKind; onClose: () => void }) {
  const { ofKind } = useArtefacts();
  const { state, add } = useAddToProject();
  const def = KINDS[kind], meta = TOOL_META[kind];
  const list = (ofKind(kind) as Artefact[]).filter((a) => !kindDef(a.kind).isEmpty(a.data));
  const Icon = meta.icon;
  return (
    <Dialog title={`Choose a ${def.label.toLowerCase()}`} onClose={onClose} narrow
      actions={<button type="button" className="btn" onClick={onClose}>Close</button>}>
      {list.length === 0 ? (
        <div className="cp-choose-empty">
          <p>None in My artefacts yet.</p>
          <Link className="btn primary" to={def.toolPath} onClick={onClose}>Make one<span className="sr-only"> with the {meta.name} tool</span> <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      ) : (
        <ul className={`cp-choose ${meta.tone}`}>
          {list.map((a) => {
            const where = state(a);
            const name = a.title.trim() || 'Untitled';
            let first = '';
            try { first = kindDef(a.kind).summary(a.data)[0] ?? ''; } catch { first = ''; }
            return (
              <li key={a.id}>
                <span className="cp-choose-icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="cp-choose-text"><strong>{name}</strong><small>{[first, shortDate(a.updatedAt) && `Edited ${shortDate(a.updatedAt)}`].filter(Boolean).join(' · ')}</small></span>
                {where === 'current' || where === 'outdated'
                  ? <span className="badge success"><CircleCheck size={12} aria-hidden="true" /> Included</span>
                  : <button type="button" className="btn small primary" onClick={() => { add(a); onClose(); }}>
                    <Plus size={14} aria-hidden="true" />Add<span className="sr-only">: {name}</span>
                  </button>}
              </li>
            );
          })}
        </ul>
      )}
      {!def.many && list.length > 0 && <p className="muted cp-choose-note">A project holds one {def.label.toLowerCase()}. Adding another replaces it.</p>}
    </Dialog>
  );
}

/** The slot of a step: the included copies of `kind`, then the invitation (always for a kind a project holds several of). */
export function ArtefactSlot({ kind }: { kind: ArtefactKind }) {
  const { doc } = usePassport();
  const copies = (doc.artefacts ?? []).filter((i) => i.kind === kind);
  return (
    <section className={`cp-slot ${TOOL_META[kind].tone}`} aria-label={KINDS[kind].label}>
      {copies.length > 0 && <div className="cp-slot-cards">{copies.map((inc) => <IncludedCard key={inc.id} inc={inc} />)}</div>}
      {(copies.length === 0 || KINDS[kind].many) && <Invitation kind={kind} another={copies.length > 0} />}
    </section>
  );
}

/** For step 4: bring in a data model (each one owns an input row). */
export function DataModelInvite() {
  const { doc } = usePassport();
  const any = (doc.artefacts ?? []).some((i) => i.kind === 'data-model');
  return <Invitation kind="data-model" another={any} />;
}

/** For step 4 of a statistical model: bring in the survey or measured data (one row per construct). */
export function MeasurementInvite() {
  const { doc } = usePassport();
  const any = (doc.artefacts ?? []).some((i) => i.kind === 'measurement-data');
  return <Invitation kind="measurement-data" another={any} title="Bring your survey data" line="Items and measured variables, grouped into constructs. One row per construct." />;
}
