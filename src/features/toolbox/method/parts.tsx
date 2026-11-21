import { useId } from 'react';
import { Ban, Check, Columns3, ExternalLink, Plus, Star, TriangleAlert, X } from 'lucide-react';
import { Link } from '../../../app/router';
import type { MethodRole, ShortlistEntry } from '../../../domain/artefacts/methodChoice';
import { FAMILIES, FAMILY_TONE, METHOD_BY_ID, appForMethod, type MethodId } from '../../../domain/methods/registry';
import { MethodGlyph } from './glyphs';

/** Link to a specialist app. A missing address is never invented: there is simply no link. */
export function AppLink({ method }: { method: MethodId }) {
  const app = appForMethod(method);
  if (!app.url) return null;
  return (
    <a className="btn small ghost" href={app.url} target="_blank" rel="noopener noreferrer">
      Open {app.name} <ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export interface CardActions {
  role: MethodRole | null;
  compared: boolean;
  onChoose(role: MethodRole): void;
  onCompare(): void;
  /** Present only when the method can leave the list (kept by hand, no role). */
  onDrop?: () => void;
}

/**
 * A shortlisted method: what it is for, why the answers point to it, what to watch, and what it leaves out.
 * Layout of the details row adapted from the expandable technique card of the owner's Lean Six Sigma toolbox.
 */
export function MethodCard({ entry, actions }: { entry: ShortlistEntry; actions: CardActions }) {
  const m = METHOD_BY_ID[entry.method];
  const hid = useId();
  const { role } = actions;
  return (
    <article className={`mt-card mt-anim ${FAMILY_TONE[m.family]}${role ? ' is-chosen' : ''}`} aria-labelledby={hid}>
      <header className="mt-card-head">
        <span className="mt-glyph-box"><MethodGlyph method={m.id} size={38} /></span>
        <div className="mt-card-title">
          <h3 id={hid}>{m.name}</h3>
          <span className="mt-fam-label">{FAMILIES[m.family].label}</span>
        </div>
        <span className="mt-tags">
          {role && <span className={`mt-tag is-${role}`}>{role === 'primary' ? 'Primary' : 'Alternative'}</span>}
          <span className="mt-tag">{entry.fromAnswers ? 'From your answers' : 'Your pick'}</span>
        </span>
      </header>
      <p className="mt-purpose">{m.purpose}</p>
      {entry.reasons.length > 0 && (
        <ul className="mt-points is-fit" aria-label="Why it may fit">{entry.reasons.map((r) => <li key={r}><Check size={15} aria-hidden="true" />{r}</li>)}</ul>
      )}
      {entry.cautions.length > 0 && (
        <ul className="mt-points is-caution" aria-label="Cautions">{entry.cautions.map((r) => <li key={r}><TriangleAlert size={15} aria-hidden="true" />{r}</li>)}</ul>
      )}
      <ul className="mt-points is-omit" aria-label="What it leaves out">
        {m.omits.map((r) => <li key={r}><Ban size={15} aria-hidden="true" /><span><span className="mt-omit-tag">Leaves out</span> {r}</span></li>)}
      </ul>
      <details className="mt-more">
        <summary>Needs, assumes, fails when</summary>
        <div className="mt-more-grid">
          <div><p className="mt-more-h">Needs</p><ul>{m.dataNeeds.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><p className="mt-more-h">Assumes</p><ul>{m.assumptions.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><p className="mt-more-h">Fails when</p><ul>{m.failureConditions.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </details>
      <footer className="mt-card-actions">
        <button type="button" className={`btn small${role === 'primary' ? '' : ' primary'}`} aria-pressed={role === 'primary'} onClick={() => actions.onChoose('primary')}>
          <Star size={14} aria-hidden="true" /> {role === 'primary' ? 'Primary' : 'Use as primary'}
        </button>
        <button type="button" className="btn small" aria-pressed={role === 'alternative'} onClick={() => actions.onChoose('alternative')}>
          {role === 'alternative' ? 'Alternative' : 'Keep as alternative'}
        </button>
        <button type="button" className="btn small ghost" aria-pressed={actions.compared} onClick={actions.onCompare}>
          <Columns3 size={14} aria-hidden="true" /> Compare
        </button>
        <AppLink method={m.id} />
        {actions.onDrop && (
          <button type="button" className="btn small ghost mt-drop" aria-label={`Take ${m.name} off the shortlist`} title="Take off the shortlist" onClick={actions.onDrop}>
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </footer>
    </article>
  );
}

/** A compact tile for a method inside a family: purpose, what it leaves out, and a way onto the shortlist. */
export function MethodTile({ method, listed, lock, compared, onToggleList, onCompare }: {
  method: MethodId; listed: boolean;
  /** Why the method stays on the list whatever this tile says (“From your answers”, “Primary”), or null. */ lock: string | null;
  compared: boolean; onToggleList(): void; onCompare(): void;
}) {
  const m = METHOD_BY_ID[method];
  const hid = useId();
  return (
    <article className={`mt-tile mt-anim ${FAMILY_TONE[m.family]}${listed ? ' is-listed' : ''}`} aria-labelledby={hid}>
      <div className="mt-tile-head">
        <span className="mt-glyph-box"><MethodGlyph method={m.id} size={44} /></span>
        <h4 id={hid}>{m.name}</h4>
      </div>
      <p className="mt-purpose">{m.purpose}</p>
      <p className="mt-tile-omit"><Ban size={14} aria-hidden="true" /><span><span className="mt-omit-tag">Leaves out</span> {m.omits[0]}</span></p>
      <div className="mt-tile-actions">
        {lock ? <span className="mt-tag is-locked"><Check size={13} aria-hidden="true" /> {lock}</span> : (
          <button type="button" className={`btn small${listed ? '' : ' primary'}`} aria-pressed={listed} onClick={onToggleList}>
            {listed ? <><Check size={14} aria-hidden="true" /> On the shortlist</> : <><Plus size={14} aria-hidden="true" /> Shortlist</>}
          </button>
        )}
        <button type="button" className="btn small ghost" aria-pressed={compared} onClick={onCompare}><Columns3 size={14} aria-hidden="true" /> Compare</button>
        <Link className="mt-learn" to={`/learn/methods/${m.id}`}>More<span className="sr-only"> about {m.name}</span></Link>
      </div>
    </article>
  );
}
