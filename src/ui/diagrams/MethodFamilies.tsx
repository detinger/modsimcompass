import { useRef, useState, type ReactNode } from 'react';
import type { MethodFamily } from '../../domain/methods/registry';
import { FAMILIES_HINT, FAMILY_CARDS } from '../../content/diagrams/specs';
import { useSeen } from './walkthrough';

/** A small pictogram of what each family studies; drawn in the family colour. */
const GLYPH: Record<MethodFamily, ReactNode> = {
  // Variables joined by paths.
  relationships: (
    <>
      <path className="is-line is-draw" d="M15,13 L31,21" /><path className="is-line is-draw" d="M15,35 L31,27" /><path className="is-line is-draw" d="M10,19 V29" />
      <circle className="is-fill" cx="10" cy="12" r="6" /><circle className="is-fill" cx="10" cy="36" r="6" /><circle className="is-solid" cx="37" cy="24" r="7" />
    </>
  ),
  // Many possible outcomes around a likely one.
  uncertainty: (
    <>
      <path className="is-line" d="M4,38 H44" />
      <path className="is-line is-fill" d="M5,38 C15,38 16,9 24,9 C32,9 33,38 43,38 Z" />
      <g className="is-drops"><circle className="is-solid" cx="24" cy="31" r="3" /><circle className="is-solid" cx="17" cy="33" r="3" /><circle className="is-solid" cx="31" cy="33" r="3" /><circle className="is-solid" cx="24" cy="22" r="3" /></g>
    </>
  ),
  // Items queue, are served and leave.
  processes: (
    <>
      <g className="is-queue"><circle className="is-solid" cx="6" cy="24" r="3.5" /><circle className="is-solid" cx="15" cy="24" r="3.5" /></g>
      <rect className="is-line is-fill" x="22" y="14" width="16" height="20" rx="4" /><circle className="is-solid" cx="30" cy="24" r="3.5" />
      <path className="is-line" d="M38,24 H46 M43,20.5 L46.5,24 L43,27.5" />
    </>
  ),
  // Simple cells, a pattern nobody programmed.
  emergence: (
    <>
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}-${c}`} className="is-cell" x={3 + c * 11} y={3 + r * 11} width="9" height="9" rx="2" />))}
      {/* A glider: the solid cells are one generation, the hidden ones the next. */}
      {[[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]].map(([r, c]) => <rect key={`now-${r}-${c}`} className="is-solid is-now" x={3 + c * 11} y={3 + r * 11} width="9" height="9" rx="2" />)}
      {[[1, 0], [1, 2], [2, 1], [2, 2], [3, 1]].map(([r, c]) => <rect key={`next-${r}-${c}`} className="is-solid is-next" x={3 + c * 11} y={3 + r * 11} width="9" height="9" rx="2" />)}
    </>
  ),
};

export default function MethodFamilies() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.2);
  const [sel, setSel] = useState<MethodFamily | null>(null);
  const picked = FAMILY_CARDS.find((f) => f.id === sel);
  return (
    <div className={`dgm-families${seen ? ' is-seen' : ''}`} ref={ref}>
      <div className="dgm-fam-grid" role="group" aria-label="Method families">
        {FAMILY_CARDS.map((f, i) => (
          <button key={f.id} type="button" className={`dgm-fam is-${f.id}`} style={{ ['--i' as string]: i }} aria-pressed={sel === f.id} onClick={() => setSel(sel === f.id ? null : f.id)}>
            <span className="dgm-fam-head">
              <svg className="dgm-fam-glyph" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">{GLYPH[f.id]}</svg>
              <span><span className="dgm-fam-name">{f.label}</span><span className="dgm-fam-q">{f.question}</span></span>
            </span>
            <span className="dgm-fam-methods">{f.methods.map((m) => <span key={m} className="dgm-chip">{m}</span>)}</span>
          </button>
        ))}
      </div>
      <p className={`dgm-fam-example${picked ? ` is-${picked.id}` : ''}`} aria-live="polite">
        {picked ? <><strong>For example</strong><span>{picked.example}</span></> : <span className="dgm-hint">{FAMILIES_HINT}</span>}
      </p>
    </div>
  );
}
