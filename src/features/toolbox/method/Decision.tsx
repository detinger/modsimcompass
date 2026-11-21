import { useId } from 'react';
import { ArrowLeftRight, Ban, X } from 'lucide-react';
import { decisionCautions, methodChoice, type MethodRole } from '../../../domain/artefacts/methodChoice';
import type { MethodChoice } from '../../../domain/artefacts/types';
import { FAMILIES, FAMILY_TONE, METHOD_BY_ID, METHODS, type MethodId } from '../../../domain/methods/registry';
import { FAMILY_ORDER } from '../../../content/diagrams/specs';
import { Callout } from '../../../ui/controls';
import { SvgFigure } from '../SvgFigure';
import { MethodGlyph } from './glyphs';

const ROLE_TEXT: Record<MethodRole, { tag: string; why: string; placeholder: string }> = {
  primary: { tag: 'Primary', why: 'Why it fits', placeholder: 'What about your question makes this method fit?' },
  alternative: { tag: 'Alternative', why: 'Why it is the alternative', placeholder: 'When would you switch to it, or use it as a check?' },
};

function RoleSlot({ role, d, onChoose, onClear, onWhy }: {
  role: MethodRole; d: MethodChoice; onChoose(m: MethodId): void; onClear(): void; onWhy(text: string): void;
}) {
  const selId = useId(), whyId = useId();
  const m = d[role] ? METHOD_BY_ID[d[role] as MethodId] : null;
  const text = ROLE_TEXT[role];
  const why = role === 'primary' ? d.justification : d.alternativeJustification;
  return (
    <div className={`mt-role is-${role} mt-anim${m ? ` ${FAMILY_TONE[m.family]}` : ' is-empty'}`}>
      <div className="mt-role-head">
        <span className="mt-glyph-box">{m ? <MethodGlyph method={m.id} size={40} /> : <span className="mt-role-q" aria-hidden="true">?</span>}</span>
        <div className="mt-role-title">
          <span className="mt-role-tag">{text.tag}</span>
          <strong>{m ? m.name : 'Not chosen yet'}</strong>
          {m && <span className="mt-fam-label">{FAMILIES[m.family].label}</span>}
        </div>
        {m && <button type="button" className="btn small ghost mt-drop" aria-label={`Clear the ${text.tag.toLowerCase()} method`} title="Clear" onClick={onClear}><X size={15} aria-hidden="true" /></button>}
      </div>
      <div className="field">
        <label htmlFor={selId}>{text.tag} method</label>
        <select id={selId} value={d[role]} onChange={(e) => (e.target.value ? onChoose(e.target.value as MethodId) : onClear())}>
          <option value="">Not chosen yet</option>
          {FAMILY_ORDER.map((f) => (
            <optgroup key={f} label={FAMILIES[f].label}>
              {METHODS.filter((x) => x.family === f).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={whyId}>{text.why}</label>
        <textarea id={whyId} rows={4} value={why} maxLength={20000} placeholder={text.placeholder} onChange={(e) => onWhy(e.target.value)} />
      </div>
      {m && <p className="mt-role-omit"><Ban size={14} aria-hidden="true" /><span><span className="mt-omit-tag">Leaves out</span> {m.omits.join('; ')}</span></p>}
    </div>
  );
}

/** Primary and alternative with the author's reasons, and the picture the project and the report will show. */
export function Decision({ d, onChoose, onClear, onWhy, onSwap }: {
  d: MethodChoice; onChoose(role: MethodRole, m: MethodId): void; onClear(role: MethodRole): void;
  onWhy(role: MethodRole, text: string): void; onSwap(): void;
}) {
  const svg = methodChoice.figure(d);
  const cautions = decisionCautions(d);
  const label = `The four method families. Primary: ${d.primary ? METHOD_BY_ID[d.primary].name : 'not chosen yet'}. Alternative: ${d.alternative ? METHOD_BY_ID[d.alternative].name : 'not chosen yet'}.`;
  return (
    <>
      <div className="mt-roles">
        <RoleSlot role="primary" d={d} onChoose={(m) => onChoose('primary', m)} onClear={() => onClear('primary')} onWhy={(t) => onWhy('primary', t)} />
        <button type="button" className="btn small ghost mt-swap" disabled={!d.primary && !d.alternative} onClick={onSwap} aria-label="Swap primary and alternative" title="Swap">
          <ArrowLeftRight size={16} aria-hidden="true" />
        </button>
        <RoleSlot role="alternative" d={d} onChoose={(m) => onChoose('alternative', m)} onClear={() => onClear('alternative')} onWhy={(t) => onWhy('alternative', t)} />
      </div>
      {cautions.map((c) => <Callout key={c} tone="warning">{c}</Callout>)}
      {svg && (
        <figure className="mt-figure">
          <SvgFigure svg={svg} label={label} />
          <figcaption>As the project and its report show it.</figcaption>
        </figure>
      )}
      <p className="mt-note">Your reasons are yours. The app never scores them.</p>
    </>
  );
}
