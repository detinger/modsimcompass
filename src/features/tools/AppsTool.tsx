import { Boxes, ExternalLink, FileDown, Grid3x3, Link2Off, Network, Dices, Workflow } from 'lucide-react';
import { Link } from '../../app/router';
import { FAMILIES, FAMILY_TONE, METHODS, SPECIALIST_APPS, type MethodFamily } from '../../domain/methods/registry';
import { ToolFrame } from './ToolFrame';

const FAMILY_ICON: Record<MethodFamily, typeof Boxes> = { relationships: Network, uncertainty: Dices, processes: Workflow, emergence: Grid3x3 };
const FAMILY_ORDER: MethodFamily[] = ['relationships', 'uncertainty', 'processes', 'emergence'];

/** Specialist apps: one card per app, grouped by method family. Links are never invented. */
export default function AppsTool() {
  const apps = Object.values(SPECIALIST_APPS).map((a) => {
    const methods = METHODS.filter((m) => m.appId === a.id);
    return { ...a, methods, family: methods[0]?.family ?? 'processes' as MethodFamily };
  }).sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family));
  return (
    <ToolFrame id="apps" wide={false}>
      <div className="handoff">
        <span className="handoff-icon" aria-hidden="true"><FileDown size={20} /></span>
        <p><strong>Handoff is manual.</strong> Export your passport from the project, then open the app. Nothing is transferred automatically.</p>
        <Link className="btn" to="/project/conclude">Go to export</Link>
      </div>
      <ul className="app-cards">
        {apps.map((a) => {
          const Icon = FAMILY_ICON[a.family];
          return (
            <li key={a.id} className={`app-card ${FAMILY_TONE[a.family]}`}>
              <div className="app-top">
                <span className="tile-icon" aria-hidden="true"><Icon size={22} /></span>
                <span className="app-family">{FAMILIES[a.family].label}</span>
              </div>
              <h2>{a.name}</h2>
              <ul className="app-methods" aria-label="Methods">
                {a.methods.map((m) => <li key={m.id}>{m.name}</li>)}
              </ul>
              {a.url ? (
                <a className="btn primary app-open" href={a.url} target="_blank" rel="noopener noreferrer">
                  Open {a.name} <ExternalLink size={15} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="app-missing"><Link2Off size={15} aria-hidden="true" /> App link not configured</span>
              )}
            </li>
          );
        })}
      </ul>
    </ToolFrame>
  );
}
