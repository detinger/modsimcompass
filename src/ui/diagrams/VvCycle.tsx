import { useState } from 'react';
import { Cpu, Globe, PencilRuler } from 'lucide-react';
import { VV, type CheckId } from '../../content/diagrams/specs';
import { GraphView, useGraphLayout } from './ElkGraph';
import { vvGraph } from './graphDefs';
import { useSeen, useWidth } from './walkthrough';

/** Which nodes each check compares. */
const ENDS: Record<CheckId, [string, string]> = { verification: ['computer', 'concept'], validation: ['computer', 'real'], calibration: ['real', 'computer'] };
const CHECK_IDS = VV.checks.map((c) => c.id) as string[];

/** The build chain runs through the middle; each check is a loop on its own side, so no two links cross. */

const ICON = { real: Globe, concept: PencilRuler, computer: Cpu } as const;

export default function VvCycle() {
  const [ref, width] = useWidth<HTMLDivElement>();
  const layout = useGraphLayout(vvGraph, width);
  const seen = useSeen(ref);
  const [sel, setSel] = useState<CheckId | null>(null);
  const check = VV.checks.find((c) => c.id === sel);
  return (
    <div className={`dgm-vv${seen ? ' is-seen' : ''}`} ref={ref} data-check={sel ?? 'none'}>
      <div className="dgm-vv-picker" role="group" aria-label="Choose a check">
        {VV.checks.map((c) => (
          <button key={c.id} type="button" className={`dgm-pick dgm-k-${c.id}`} aria-pressed={sel === c.id} onClick={() => setSel(sel === c.id ? null : c.id)}>
            <svg className="dgm-swatch" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><path d="M1,5 H29" /></svg>
            {c.label}
          </button>
        ))}
      </div>
      <div className="dgm-scroll">
        {layout ? (
          <GraphView
            layout={layout}
            tokens={sel ? [{ id: sel, edge: sel, className: `is-loop dgm-k-${sel}` }] : undefined}
            label="Real system leads to conceptual model, which leads to computer model. Verification links the computer model back to the conceptual model, validation links it back to the real system, and calibration runs from the real system to the computer model."
            nodeClass={(id) => `dgm-n-${id}${sel && ENDS[sel].includes(id) ? ` is-hot dgm-k-${sel}` : ''}`}
            edgeClass={(id) => (CHECK_IDS.includes(id) ? `dgm-check dgm-k-${id}${sel === id ? ' is-hot' : sel ? ' is-quiet' : ''}` : 'dgm-build')}
            renderNode={(id) => {
              const Icon = ICON[id as keyof typeof ICON];
              const t = VV[id as keyof typeof ICON];
              return <><span className="dgm-node-icon"><Icon size={20} aria-hidden="true" /></span><span className="dgm-node-text"><strong>{t.label}</strong><span>{t.sub}</span></span></>;
            }}
          />
        ) : <div className="dgm-placeholder" style={{ height: 300 }} />}
      </div>
      <p className={`dgm-vv-answer${check ? ` dgm-k-${check.id}` : ''}`} aria-live="polite">
        {check ? <><strong>{check.question}</strong><span>{check.text}</span></> : <span className="dgm-hint">{VV.hint}</span>}
      </p>
    </div>
  );
}
