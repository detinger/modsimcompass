import { useMemo } from 'react';
import { ArrowRight, BadgeCheck, CircleDot, Copy, Download, History, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import { CHECKPOINT_DEFS, STEPS, compassWarnings, stepsStarted } from '../../domain/passport/compass';
import { REVIEW_LABELS, type ProjectDoc, type ReviewStatus } from '../../domain/passport/schema';

export const titleOf = (p: ProjectDoc) => p.passport.identity.title || 'Untitled project';

/** “2 hours ago”; falls back to a date after a month. */
export function ago(iso: string): string {
  const then = new Date(iso).getTime();
  const s = (Date.now() - then) / 1000;
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CARD_TONES = ['tone-blue', 'tone-teal', 'tone-orange', 'tone-purple', 'tone-brown'];
function toneFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_TONES[h % CARD_TONES.length];
}

/** Draft is an empty dot; every other status has its own icon, so colour is never the only cue. */
const STATUS_ICON: Record<ReviewStatus, typeof UserCheck | null> = { draft: null, 'self-reviewed': UserCheck, 'teacher-reviewed': BadgeCheck, 'needs-revision': RotateCcw };

export function ProjectCard({ doc, active, onOpen, onDuplicate, onDownload, onRecovery, onDelete }: {
  doc: ProjectDoc; active: boolean; onOpen: () => void; onDuplicate: () => void; onDownload: () => void; onRecovery: () => void; onDelete: () => void;
}) {
  const title = titleOf(doc);
  const { started, open } = useMemo(() => ({
    started: stepsStarted(doc.passport),
    open: compassWarnings(doc).filter((w) => w.severity !== 'tip').length,
  }), [doc]);
  const startedNames = STEPS.filter((s) => started.includes(s.id)).map((s) => s.title);
  return (
    <article className={`project-card ${toneFor(doc.id)}${active ? ' is-active' : ''}`} aria-label={title}>
      <header className="pc-head">
        <span className="pc-avatar" aria-hidden="true">{(title.trim()[0] ?? 'P').toUpperCase()}</span>
        <div className="pc-title">
          <h3 title={title}>{title}</h3>
          <p className="subtle-text" title={new Date(doc.updatedAt).toLocaleString('en-GB')}>Edited {ago(doc.updatedAt)}</p>
        </div>
        {active && <span className="badge primary">Current</span>}
      </header>

      <div className="pc-progress">
        <div className="pc-segments" role="img" aria-label={`${started.length} of ${STEPS.length} steps started${startedNames.length ? `: ${startedNames.join(', ')}` : ''}`}>
          {STEPS.map((s) => <span key={s.id} className={started.includes(s.id) ? 'on' : undefined} title={`${s.number}. ${s.title}${started.includes(s.id) ? ' (started)' : ''}`} />)}
        </div>
        <p><strong>{started.length} of {STEPS.length}</strong> steps started</p>
      </div>

      <p className={`pc-open${open === 0 ? ' none' : ''}`}><CircleDot size={15} aria-hidden="true" /> <strong>{open}</strong> open item{open === 1 ? '' : 's'}</p>

      <ul className="pc-checkpoints" aria-label="Checkpoint status">
        {CHECKPOINT_DEFS.map((c) => {
          const status: ReviewStatus = doc.passport.review?.[c.id]?.status ?? 'draft';
          const Icon = STATUS_ICON[status];
          return (
            <li key={c.id} className={`pc-cp ${status}`} title={`${c.label}: ${REVIEW_LABELS[status]}`}>
              <span className="pc-cp-dot" aria-hidden="true">{Icon && <Icon size={13} />}</span>
              <span>{c.label}<span className="sr-only">: {REVIEW_LABELS[status]}</span></span>
            </li>
          );
        })}
      </ul>

      <footer className="pc-actions">
        <button type="button" className="btn primary" onClick={onOpen}>Open<span className="sr-only"> {title}</span> <ArrowRight size={16} aria-hidden="true" /></button>
        <span className="pc-icons">
          <button type="button" className="icon-btn" data-tip="Duplicate" aria-label={`Duplicate ${title}`} onClick={onDuplicate}><Copy size={16} aria-hidden="true" /></button>
          <button type="button" className="icon-btn" data-tip="Download project file" aria-label={`Download project file for ${title}`} onClick={onDownload}><Download size={16} aria-hidden="true" /></button>
          <button type="button" className="icon-btn" data-tip="Recovery file (earlier version)" aria-label={`Download recovery file (earlier version) for ${title}`} onClick={onRecovery}><History size={16} aria-hidden="true" /></button>
          <button type="button" className="icon-btn danger" data-tip="Delete" aria-label={`Delete ${title}`} onClick={onDelete}><Trash2 size={16} aria-hidden="true" /></button>
        </span>
      </footer>
    </article>
  );
}
