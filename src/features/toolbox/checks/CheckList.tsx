import { useId, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, CheckCircle2, Circle, CircleDot, CircleSlash, ListPlus, Plus, Trash2, XCircle, type LucideIcon } from 'lucide-react';
import { calibrationModeOf, CHECK_STATUS_LABELS, CHECK_STATUSES, hasLibraryCheck, type CheckGroup } from '../../../domain/artefacts/checkPlan';
import type { CheckPlan, CheckStatus, PlannedCheck } from '../../../domain/artefacts/types';
import { METHOD_BY_ID, FAMILY_TONE } from '../../../domain/methods/registry';
import { standardChecks, type StandardCheck } from '../../../content/checks';
import { MethodGlyph } from '../method/glyphs';

export const STATUS_ICON: Record<CheckStatus, LucideIcon> = { planned: Circle, done: CircleDot, passed: CheckCircle2, failed: XCircle, na: CircleSlash };

/**
 * One check: what to do, its status and the evidence. The status stripe and icon follow the validation rows of
 * the owner's System Dynamics studio (stripe, icon, title, then the detail underneath).
 */
function CheckRow({ c, n, first, last, onEdit, onMove, onRemove }: {
  c: PlannedCheck; n: number; first: boolean; last: boolean;
  onEdit(change: Partial<Pick<PlannedCheck, 'text' | 'status' | 'evidence'>>): void; onMove(dir: -1 | 1): void; onRemove(): void;
}) {
  const Icon = STATUS_ICON[c.status];
  const name = useId();
  const short = c.text.trim() ? (c.text.length > 40 ? `${c.text.slice(0, 39).trimEnd()}…` : c.text) : `check ${n}`;
  return (
    <li className={`ck-row is-${c.status}`}>
      <span className="ck-mark" aria-hidden="true"><Icon size={18} /></span>
      <div className="ck-body">
        <textarea className="ck-text" rows={1} value={c.text} maxLength={20000} aria-label={`Check ${n}`} placeholder="What to check" onChange={(e) => onEdit({ text: e.target.value })} />
        <div className="ck-controls">
          <fieldset className="ck-status">
            <legend className="sr-only">Status of {short}</legend>
            {CHECK_STATUSES.map((s) => {
              const SIcon = STATUS_ICON[s];
              return (
                <label key={s} className={`ck-pill is-${s}`}>
                  <input type="radio" name={name} value={s} checked={c.status === s} onChange={() => onEdit({ status: s })} />
                  <SIcon size={14} aria-hidden="true" /><span>{CHECK_STATUS_LABELS[s]}</span>
                </label>
              );
            })}
          </fieldset>
          <span className="ck-row-tools">
            <button type="button" className="btn small ghost" disabled={first} aria-label={`Move ${short} up`} title="Move up" onClick={() => onMove(-1)}><ArrowUp size={15} aria-hidden="true" /></button>
            <button type="button" className="btn small ghost" disabled={last} aria-label={`Move ${short} down`} title="Move down" onClick={() => onMove(1)}><ArrowDown size={15} aria-hidden="true" /></button>
            <button type="button" className="btn small ghost" aria-label={`Remove ${short}`} title="Remove" onClick={onRemove}><Trash2 size={15} aria-hidden="true" /></button>
          </span>
        </div>
        <textarea className="ck-evidence" rows={1} value={c.evidence} maxLength={20000}
          aria-label={c.status === 'na' ? `Why ${short} does not apply` : `Evidence for ${short}`}
          placeholder={c.status === 'na' ? 'Why it does not apply to this model' : 'Evidence: what did it show?'}
          onChange={(e) => onEdit({ evidence: e.target.value })} />
      </div>
    </li>
  );
}

/** The plan's checks of one group, and a line to write a new one. */
export function CheckList({ group, d, onEdit, onMove, onRemove, onAdd }: {
  group: CheckGroup; d: CheckPlan;
  onEdit(id: string, change: Partial<Pick<PlannedCheck, 'text' | 'status' | 'evidence'>>): void; onMove(id: string, dir: -1 | 1): void;
  onRemove(id: string): void; onAdd(text: string): void;
}) {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const rows = d.checks.filter((c) => c.group === group);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!draft.trim()) return; onAdd(draft); setDraft(''); };
  return (
    <div className="ck-mine">
      <h3 className="ck-mine-h">Your checks{rows.length > 0 && <span className="ck-mine-n"> {rows.length}</span>}</h3>
      {rows.length === 0 ? (
        <p className="ck-none">No checks yet. Take some from the list, or write your own.</p>
      ) : (
        <ol className="ck-list">
          {rows.map((c, i) => (
            <CheckRow key={c.id} c={c} n={i + 1} first={i === 0} last={i === rows.length - 1}
              onEdit={(ch) => onEdit(c.id, ch)} onMove={(dir) => onMove(c.id, dir)} onRemove={() => onRemove(c.id)} />
          ))}
        </ol>
      )}
      <form className="ck-add" onSubmit={submit}>
        <label htmlFor={inputId} className="sr-only">Write your own check</label>
        <input id={inputId} type="text" value={draft} maxLength={2000} placeholder="Write your own check" autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn" disabled={!draft.trim()}><Plus size={16} aria-hidden="true" /> Add</button>
      </form>
    </div>
  );
}

function LibraryItem({ k, added, onAdd }: { k: StandardCheck; added: boolean; onAdd(): void }) {
  return (
    <li className={`ck-lib-item${added ? ' is-added' : ''}`}>
      <div className="ck-lib-text">
        <span>{k.text}</span>
        {!added && <small>{k.why}</small>}
      </div>
      {added
        ? <span className="ck-lib-added"><Check size={14} aria-hidden="true" /> Added</span>
        : <button type="button" className="btn small" aria-label={`Add: ${k.text}`} onClick={onAdd}><Plus size={14} aria-hidden="true" /> Add</button>}
    </li>
  );
}

/** Checks in their order, gathered under their sub-headings (“Structural model”); checks without one come first. */
function byPart(list: StandardCheck[]): [string, StandardCheck[]][] {
  const out: [string, StandardCheck[]][] = [];
  for (const k of list) {
    const part = k.part ?? '';
    const found = out.find(([p]) => p === part);
    if (found) found[1].push(k); else out.push([part, [k]]);
  }
  return out.sort(([a], [b]) => (a ? 1 : 0) - (b ? 1 : 0));
}

/** The standard checks of one group: the ones for the chosen method first, then the ones for any model. */
export function Library({ group, d, onAdd }: { group: CheckGroup; d: CheckPlan; onAdd(list: StandardCheck[]): void }) {
  const { general, specific } = standardChecks(d.method, group);
  const open = [...specific, ...general].filter((k) => !hasLibraryCheck(d, k.id));
  const method = d.method ? METHOD_BY_ID[d.method] : null;
  return (
    <div className="ck-lib">
      <div className="ck-lib-head">
        <h3>Standard checks</h3>
        <button type="button" className="btn small" disabled={open.length === 0} onClick={() => onAdd(open)}>
          <ListPlus size={14} aria-hidden="true" /> {open.length ? `Add all ${open.length}` : 'All added'}
        </button>
      </div>
      {method && specific.length > 0 && (
        <>
          <p className={`ck-lib-sub ${FAMILY_TONE[method.family]}`}><span className="ck-lib-glyph"><MethodGlyph method={method.id} size={20} /></span>For {method.name}</p>
          {byPart(specific).map(([part, list]) => (
            <div key={part || 'main'}>
              {part && <p className="ck-lib-part">{part}</p>}
              <ul className="ck-lib-list">{list.map((k) => <LibraryItem key={k.id} k={k} added={hasLibraryCheck(d, k.id)} onAdd={() => onAdd([k])} />)}</ul>
            </div>
          ))}
        </>
      )}
      {general.length > 0 && (
        <>
          <p className="ck-lib-sub">{group === 'calibration' && calibrationModeOf(d.method) === 'estimation' ? 'For any estimated model' : 'For any model'}</p>
          <ul className="ck-lib-list">{general.map((k) => <LibraryItem key={k.id} k={k} added={hasLibraryCheck(d, k.id)} onAdd={() => onAdd([k])} />)}</ul>
        </>
      )}
      {!method && <p className="ck-lib-tip">Pick a method above for checks made for it.</p>}
    </div>
  );
}
