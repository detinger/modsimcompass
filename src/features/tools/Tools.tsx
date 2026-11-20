import { ArrowRight, Send } from 'lucide-react';
import { Link } from '../../app/router';
import { TOOL_GROUPS, toolById, type ToolId } from './registry';
import { ToolArt } from './ToolArt';
import SandboxTool from './sandbox/SandboxTool';
import DistributionsTool from './DistributionsTool';
import ChooseTool from './ChooseTool';
import FittingTool from './FittingTool';
import SamplingTool from './SamplingTool';
import RegressionTool from './RegressionTool';
import AppsTool from './AppsTool';
import '../../styles/tools.css';

/** `/tools` is the hub; `/tools/:id` opens one tool in the common frame. */
export default function Tools({ toolId, sub }: { toolId?: string; sub?: string }) {
  switch (toolId) {
    case undefined: return <ToolsHub />;
    case 'sandbox': return <SandboxTool />;
    case 'distributions': return <DistributionsTool kind={sub} />;
    case 'choose': return <ChooseTool />;
    case 'fitting': return <FittingTool />;
    case 'sampling': return <SamplingTool />;
    case 'regression': return <RegressionTool />;
    case 'apps': return <AppsTool />;
    default: return (
      <div className="page">
        <div className="page-head"><h1>Tool not found</h1><p className="lede">This address does not match a tool.</p></div>
        <Link className="btn primary" to="/tools">All tools</Link>
      </div>
    );
  }
}

function ToolTile({ id, feature }: { id: ToolId; feature?: boolean }) {
  const t = toolById(id)!;
  const Icon = t.icon;
  return (
    <Link to={`/tools/${t.id}`} className={`tile tool-tile ${t.tone}${feature ? ' feature' : ''}`}>
      <span className="tool-tile-art"><ToolArt id={t.id} /></span>
      <span className="tool-tile-body">
        <span className="tile-icon"><Icon size={20} aria-hidden="true" /></span>
        <span className="tool-tile-text">
          <span className="tile-title">{t.short}</span>
          <span className="tile-text">{t.tagline}</span>
        </span>
        <ArrowRight className="tool-tile-go" size={18} aria-hidden="true" />
      </span>
    </Link>
  );
}

function ToolsHub() {
  return (
    <div className="page tools-hub">
      <div className="page-head">
        <h1>Tools</h1>
        <p className="lede">Small instruments for your project. Try things here, then send what you keep.</p>
      </div>
      <div className="tool-groups">
        {TOOL_GROUPS.map((g) => (
          <section key={g.id} className={`tool-group group-${g.id}`} aria-labelledby={`tg-${g.id}`}>
            <h2 id={`tg-${g.id}`}>{g.title}</h2>
            <ul className="tool-tiles">
              {g.tools.map((id) => <li key={id}><ToolTile id={id} feature={g.id === 'simulate'} /></li>)}
            </ul>
          </section>
        ))}
      </div>
      <p className="hub-note"><Send size={14} aria-hidden="true" /> Distributions can be sent to your project inputs or to the sandbox.</p>
    </div>
  );
}
